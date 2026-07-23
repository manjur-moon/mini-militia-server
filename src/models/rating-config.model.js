import mongoose from "mongoose";
import {
  baseSchemaOptions,
  createModel,
  finiteNumberValidator,
} from "./model.helpers.js";

const normalizationSchema = new mongoose.Schema(
  {
    metric: { type: String, required: true, trim: true },
    method: {
      type: String,
      enum: ["min_max", "percentile", "target", "inverse_target"],
      required: true,
    },
    minimum: { type: Number, default: null },
    maximum: { type: Number, default: null },
    target: { type: Number, default: null },
    weight: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
      validate: finiteNumberValidator,
    },
  },
  { _id: false, strict: "throw" },
);

const componentConfigSchema = new mongoose.Schema(
  {
    component: {
      type: String,
      enum: ["attack", "survival", "consistency", "activity"],
      required: true,
    },
    metrics: {
      type: [normalizationSchema],
      required: true,
      validate: {
        validator: (metrics) => metrics.length > 0,
        message: "A rating component requires at least one metric.",
      },
    },
  },
  { _id: false, strict: "throw" },
);

const ratingConfigSchema = new mongoose.Schema(
  {
    version: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      immutable: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 1000, default: "" },
    minimumMatches: { type: Number, required: true, min: 1, max: 100 },
    newPlayerConfidenceFloor: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    components: { type: [componentConfigSchema], required: true },
    overallWeights: {
      attack: { type: Number, required: true, min: 0, max: 1 },
      survival: { type: Number, required: true, min: 0, max: 1 },
      consistency: { type: Number, required: true, min: 0, max: 1 },
      activity: { type: Number, required: true, min: 0, max: 1 },
    },
    isActive: { type: Boolean, required: true, default: false },
    effectiveFrom: { type: Date, required: true },
    createdBy: { type: String, required: true, trim: true },
    createdReason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  baseSchemaOptions,
);

ratingConfigSchema.pre("validate", function validateRatingWeights() {
  const components = this.components ?? [];
  const componentNames = components.map((component) => component.component);
  const expectedComponents = ["attack", "survival", "consistency", "activity"];

  if (
    componentNames.length !== expectedComponents.length ||
    new Set(componentNames).size !== expectedComponents.length ||
    expectedComponents.some((component) => !componentNames.includes(component))
  ) {
    throw new Error(
      "Rating config must define attack, survival, consistency, and activity exactly once.",
    );
  }

  for (const component of components) {
    const metricNames = component.metrics.map((metric) => metric.metric);
    if (new Set(metricNames).size !== metricNames.length) {
      throw new Error(`Metric names for ${component.component} must be unique.`);
    }

    const metricWeightTotal = component.metrics.reduce(
      (total, metric) => total + metric.weight,
      0,
    );
    if (Math.abs(metricWeightTotal - 1) > 0.000001) {
      throw new Error(`Metric weights for ${component.component} must total 1.`);
    }

    for (const metric of component.metrics) {
      if (
        metric.method === "min_max" &&
        (!Number.isFinite(metric.minimum) ||
          !Number.isFinite(metric.maximum) ||
          metric.maximum <= metric.minimum)
      ) {
        throw new Error(
          `Metric ${metric.metric} requires a valid minimum and maximum.`,
        );
      }
      if (
        ["target", "inverse_target"].includes(metric.method) &&
        (!Number.isFinite(metric.target) || metric.target <= 0)
      ) {
        throw new Error(`Metric ${metric.metric} requires a positive target.`);
      }
    }
  }

  const overallWeights = this.overallWeights?.toObject
    ? this.overallWeights.toObject()
    : this.overallWeights;
  const overallWeightTotal = Object.values(overallWeights ?? {}).reduce(
    (total, weight) => total + weight,
    0,
  );
  if (Math.abs(overallWeightTotal - 1) > 0.000001) {
    throw new Error("Overall rating weights must total 1.");
  }
});

ratingConfigSchema.index(
  { isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);

export const RatingConfig = createModel(
  "RatingConfig",
  ratingConfigSchema,
  "ratingConfigs",
);
