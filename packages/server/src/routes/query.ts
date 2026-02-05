import { Router } from "express";
import mongoose from "mongoose";
import { authMiddleware } from "../middleware/auth.js";

export const queryRouter = Router();
queryRouter.use(authMiddleware);

const ALLOWED_COLLECTIONS = ["records", "accounts", "categories", "paymentplans", "creditcardstatements"];

queryRouter.post("/", async (req, res) => {
  try {
    const { collection, filter = {}, projection, sort = {}, limit = 100 } = req.body;

    if (!collection || !ALLOWED_COLLECTIONS.includes(collection)) {
      res.status(400).json({ success: false, error: `Invalid collection. Allowed: ${ALLOWED_COLLECTIONS.join(", ")}` });
      return;
    }

    const effectiveLimit = Math.min(Math.max(1, Number(limit) || 100), 1000);

    const db = mongoose.connection.db;
    if (!db) {
      res.status(500).json({ success: false, error: "Database not connected" });
      return;
    }

    let query = db.collection(collection).find(filter);
    if (projection && Object.keys(projection).length > 0) {
      query = query.project(projection);
    }
    if (sort && Object.keys(sort).length > 0) {
      query = query.sort(sort);
    }
    query = query.limit(effectiveLimit);

    const data = await query.toArray();
    res.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Query failed";
    res.status(500).json({ success: false, error: message });
  }
});
