import mongoose from "mongoose";

export const baseSchemaOptions = Object.freeze({
  timestamps: true,
  versionKey: false,
  strict: "throw",
  minimize: false,
  toJSON: {
    virtuals: true,
    transform: (_document, returnedObject) => {
      delete returnedObject.__v;
      return returnedObject;
    },
  },
  toObject: { virtuals: true },
});

export function createModel(modelName, schema, collectionName) {
  return (
    mongoose.models[modelName] || mongoose.model(modelName, schema, collectionName)
  );
}

export function normalizeText(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function finiteNumberValidator(value) {
  return Number.isFinite(value);
}
