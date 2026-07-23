import { Router } from "express";
import { getHealth } from "../controllers/health.controller.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { healthRequestSchema } from "../validators/health.validation.js";

export const healthRouter = Router();

healthRouter.get("/", validateRequest(healthRequestSchema), getHealth);
