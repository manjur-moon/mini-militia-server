import { normalizeText } from "../../models/model.helpers.js";

export const OCR_PARSER_PROFILES = Object.freeze({
  GENERIC: "generic-v1",
  MINI_MILITIA_FINAL_SCORE: "mini-militia-final-score-v1",
});

const GENERIC_HEADER_WORDS =
  /\b(rank|place|placement|player|name|kills?|deaths?|score)\b/i;
const MINI_MILITIA_IGNORED_LINE =
  /^(final\s+game\s+scores?|no\s+game\s+data|total\s+bp|total\s+exp|done|waiting\s+for\s+players|ready\s+to\s+play|not\s+ready)$/i;
const BULLET_PREFIX = /^[•●·◦○*]+\s*/u;
const DASHES = /[‐‑‒–—−]/g;

function clampConfidence(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function parseInteger(value) {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function normalizeOCRNumber(value, { signed = false } = {}) {
  const compact = String(value ?? "")
    .replace(DASHES, "-")
    .replace(/\s+/g, "")
    .replace(/[OoQq]/g, "0")
    .replace(/[Il|!]/g, "1")
    .replace(/[Zz]/g, "2")
    .replace(/[Ss]/g, "5")
    .replace(/[bG]/g, "6")
    .replace(/B/g, "8")
    .replace(/g/g, "9");

  const pattern = signed ? /^[+-]?\d+$/ : /^\d+$/;
  if (!pattern.test(compact)) return null;
  const parsed = Number(compact);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function tokenize(line) {
  if (line.includes("|")) {
    return line
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (/\t/.test(line)) {
    return line
      .split(/\t+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  const wideColumns = line
    .split(/\s{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
  return wideColumns.length >= 4 ? wideColumns : line.trim().split(/\s+/);
}

function parseGenericLine(line, columnOrder) {
  const tokens = tokenize(line);
  if (tokens.length < 4) return null;

  const nameIndex = columnOrder.indexOf("name");
  const prefixCount = nameIndex;
  const suffixCount = columnOrder.length - nameIndex - 1;
  if (tokens.length < prefixCount + suffixCount + 1) return null;

  const nameTokens = tokens.slice(
    prefixCount,
    tokens.length - suffixCount || undefined,
  );
  const name = nameTokens.join(" ").trim();
  if (!name || parseInteger(name) !== null) return null;

  const values = { name };
  for (let index = 0; index < columnOrder.length; index += 1) {
    const key = columnOrder[index];
    if (key === "name") continue;
    const tokenIndex =
      index < nameIndex ? index : tokens.length - (columnOrder.length - index);
    const parsed = parseInteger(tokens[tokenIndex]);
    if (parsed === null) return null;
    values[key] = parsed;
  }

  if (values.placement < 1 || values.placement > 50) return null;
  if (values.kills < 0 || values.deaths < 0) return null;
  return values;
}

function parseMiniMilitiaLine(line) {
  const cleaned = line.replace(DASHES, "-").replace(BULLET_PREFIX, "").trim();
  if (!cleaned || MINI_MILITIA_IGNORED_LINE.test(cleaned)) return null;

  const match = cleaned.match(
    /^(?<name>.+?)\s+(?<kills>[0-9OoQqIl|!ZzSsBbGg]+)\s+(?<deaths>[0-9OoQqIl|!ZzSsBbGg]+)\s+(?<difference>[+-]\s*[0-9OoQqIl|!ZzSsBbGg]+)$/u,
  );
  if (!match?.groups) return null;

  const name = match.groups.name.replace(BULLET_PREFIX, "").trim();
  const kills = normalizeOCRNumber(match.groups.kills);
  const deaths = normalizeOCRNumber(match.groups.deaths);
  const scoreDifference = normalizeOCRNumber(match.groups.difference, {
    signed: true,
  });

  if (!name || kills === null || deaths === null || scoreDifference === null) {
    return null;
  }
  if (kills < 0 || deaths < 0) return null;

  return { name, kills, deaths, scoreDifference };
}

function parseGeneric({ lines, columnOrder, confidence }) {
  const rows = [];
  const rejectedLines = [];

  for (const line of lines) {
    if (GENERIC_HEADER_WORDS.test(line) && !/\d/.test(line)) continue;
    const parsed = parseGenericLine(line, columnOrder);
    if (!parsed) {
      rejectedLines.push(line);
      continue;
    }
    rows.push({
      playerName: parsed.name,
      normalizedPlayerName: normalizeText(parsed.name),
      kills: parsed.kills,
      deaths: parsed.deaths,
      placement: parsed.placement,
      scoreDifference: null,
      confidence,
      rawText: line,
    });
  }

  return {
    rows,
    rejectedLines,
    parserVersion: OCR_PARSER_PROFILES.GENERIC,
  };
}

function parseMiniMilitia({ lines, confidence }) {
  const rows = [];
  const rejectedLines = [];

  for (const line of lines) {
    if (MINI_MILITIA_IGNORED_LINE.test(line)) continue;
    const parsed = parseMiniMilitiaLine(line);
    if (!parsed) {
      rejectedLines.push(line);
      continue;
    }

    rows.push({
      playerName: parsed.name,
      normalizedPlayerName: normalizeText(parsed.name),
      kills: parsed.kills,
      deaths: parsed.deaths,
      placement: rows.length + 1,
      scoreDifference: parsed.scoreDifference,
      confidence,
      rawText: line,
    });
  }

  return {
    rows,
    rejectedLines,
    parserVersion: OCR_PARSER_PROFILES.MINI_MILITIA_FINAL_SCORE,
  };
}

export function parseOCRText({
  rawText,
  profile = OCR_PARSER_PROFILES.MINI_MILITIA_FINAL_SCORE,
  columnOrder = ["placement", "name", "kills", "deaths"],
  averageConfidence = null,
}) {
  const lines = String(rawText ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(DASHES, "-").trim())
    .filter(Boolean);
  const confidence = clampConfidence(averageConfidence);

  if (profile === OCR_PARSER_PROFILES.GENERIC) {
    return parseGeneric({ lines, columnOrder, confidence });
  }
  if (profile === OCR_PARSER_PROFILES.MINI_MILITIA_FINAL_SCORE) {
    return parseMiniMilitia({ lines, confidence });
  }

  throw new Error(`Unsupported OCR parser profile: ${profile}`);
}
