import { Router } from "express";
import { pool } from "../db/pool";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(503).json({ status: "error", db: "unreachable" });
  }
});
