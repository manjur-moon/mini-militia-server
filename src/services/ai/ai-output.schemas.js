import { z } from "zod";

const conciseText = z.string().trim().min(2).max(240);
const paragraph = z.string().trim().min(10).max(1_200);
const playerReason = z
  .object({
    playerId: z
      .string()
      .trim()
      .regex(/^MM\d{3,}$/),
    reason: conciseText,
  })
  .strict();

export const periodNarrativeSchema = z
  .object({
    headline: z.string().trim().min(5).max(120),
    summary: paragraph,
    highlights: z.array(conciseText).min(1).max(5),
    watchNext: z.array(conciseText).max(4),
    topPerformerReasons: z.array(playerReason).max(3),
  })
  .strict();

export const playerNarrativeSchema = z
  .object({
    headline: z.string().trim().min(5).max(120),
    summary: paragraph,
    trendAssessment: z.enum(["improving", "stable", "declining", "insufficient_data"]),
    strengths: z.array(conciseText).max(4),
    improvements: z.array(conciseText).max(4),
    trainingFocus: z.array(conciseText).max(4),
  })
  .strict();

export const matchNarrativeSchema = z
  .object({
    headline: z.string().trim().min(5).max(120),
    summary: paragraph,
    turningPoints: z.array(conciseText).max(5),
    standoutReasons: z.array(playerReason).max(4),
    highlights: z.array(conciseText).max(5),
  })
  .strict();

export const highlightNarrativeSchema = z
  .object({
    title: z.string().trim().min(5).max(100),
    caption: z.string().trim().min(10).max(500),
    bullets: z.array(conciseText).min(1).max(5),
  })
  .strict();

export const PERIOD_NARRATIVE_JSON_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["headline", "summary", "highlights", "watchNext", "topPerformerReasons"],
  properties: {
    headline: { type: "string", minLength: 5, maxLength: 120 },
    summary: { type: "string", minLength: 10, maxLength: 1200 },
    highlights: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: { type: "string", minLength: 2, maxLength: 240 },
    },
    watchNext: {
      type: "array",
      maxItems: 4,
      items: { type: "string", minLength: 2, maxLength: 240 },
    },
    topPerformerReasons: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["playerId", "reason"],
        properties: {
          playerId: { type: "string", pattern: "^MM[0-9]{3,}$" },
          reason: { type: "string", minLength: 2, maxLength: 240 },
        },
      },
    },
  },
});

export const PLAYER_NARRATIVE_JSON_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: [
    "headline",
    "summary",
    "trendAssessment",
    "strengths",
    "improvements",
    "trainingFocus",
  ],
  properties: {
    headline: { type: "string", minLength: 5, maxLength: 120 },
    summary: { type: "string", minLength: 10, maxLength: 1200 },
    trendAssessment: {
      type: "string",
      enum: ["improving", "stable", "declining", "insufficient_data"],
    },
    strengths: {
      type: "array",
      maxItems: 4,
      items: { type: "string", minLength: 2, maxLength: 240 },
    },
    improvements: {
      type: "array",
      maxItems: 4,
      items: { type: "string", minLength: 2, maxLength: 240 },
    },
    trainingFocus: {
      type: "array",
      maxItems: 4,
      items: { type: "string", minLength: 2, maxLength: 240 },
    },
  },
});

export const MATCH_NARRATIVE_JSON_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["headline", "summary", "turningPoints", "standoutReasons", "highlights"],
  properties: {
    headline: { type: "string", minLength: 5, maxLength: 120 },
    summary: { type: "string", minLength: 10, maxLength: 1200 },
    turningPoints: {
      type: "array",
      maxItems: 5,
      items: { type: "string", minLength: 2, maxLength: 240 },
    },
    standoutReasons: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["playerId", "reason"],
        properties: {
          playerId: { type: "string", pattern: "^MM[0-9]{3,}$" },
          reason: { type: "string", minLength: 2, maxLength: 240 },
        },
      },
    },
    highlights: {
      type: "array",
      maxItems: 5,
      items: { type: "string", minLength: 2, maxLength: 240 },
    },
  },
});

export const HIGHLIGHT_NARRATIVE_JSON_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["title", "caption", "bullets"],
  properties: {
    title: { type: "string", minLength: 5, maxLength: 100 },
    caption: { type: "string", minLength: 10, maxLength: 500 },
    bullets: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: { type: "string", minLength: 2, maxLength: 240 },
    },
  },
});

const prohibitedPattern =
  /(?:https?:\/\/|www\.|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b)/i;

function collectStrings(value, output = []) {
  if (typeof value === "string") output.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, output));
  else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, output));
  }
  return output;
}

export function validateNarrativeSafety(value, allowedPlayerIds = []) {
  const warnings = [];
  if (collectStrings(value).some((text) => prohibitedPattern.test(text))) {
    warnings.push("AI output contained a URL or email-like value.");
  }
  const allowed = new Set(allowedPlayerIds);
  for (const item of value.topPerformerReasons ?? value.standoutReasons ?? []) {
    if (!allowed.has(item.playerId)) {
      warnings.push(`AI output referenced unknown player ${item.playerId}.`);
    }
  }
  return warnings;
}
