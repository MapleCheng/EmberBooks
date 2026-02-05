import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./routes/auth.js";
import { recordsRouter } from "./routes/records.js";
import { categoriesRouter } from "./routes/categories.js";
import { accountsRouter } from "./routes/accounts.js";
import { reportsRouter } from "./routes/reports.js";
import { importRouter } from "./routes/import.js";
import { plansRouter } from "./routes/plans.js";
import { statementsRouter } from "./routes/statements.js";
import { queryRouter } from "./routes/query.js";
import { migrateAccountTypes } from "./migrations/migrateAccountTypes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/ember-books";

app.use(cors());
app.use(express.json());

// Auth routes (no auth middleware needed)
app.use("/api/auth", authRouter);

// Protected routes (auth middleware applied per router)
app.use("/api/records", recordsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/accounts", accountsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/import", importRouter);
app.use("/api/plans", plansRouter);
app.use("/api/statements", statementsRouter);
app.use("/api/query", queryRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDB 已連線");

    // Run migrations
    await migrateAccountTypes();

    app.listen(PORT, () => {
      console.log(`🚀 Server 啟動於 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ 啟動失敗:", error);
    process.exit(1);
  }
}

start();
