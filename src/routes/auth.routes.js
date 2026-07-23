import { Router } from "express";
import { getCurrentAccount } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const authRouter = Router();

authRouter.get("/me", requireAuth, getCurrentAccount);
