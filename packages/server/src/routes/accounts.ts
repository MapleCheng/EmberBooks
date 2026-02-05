import { Router } from "express";
import mongoose from "mongoose";
import { AccountModel } from "../models/Account.js";
import { RecordModel } from "../models/Record.js";
import { authMiddleware } from "../middleware/auth.js";

export const accountsRouter = Router();
accountsRouter.use(authMiddleware);

// GET all accounts
accountsRouter.get("/", async (req, res) => {
  try {
    const accounts = await AccountModel.find({ userId: req.userId });
    res.json({ success: true, data: accounts });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch accounts" });
  }
});

// GET account balances — must be before /:id
accountsRouter.get("/balances", async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    const accounts = await AccountModel.find({ userId: req.userId });

    // Aggregate: sum amounts by account for each relevant type
    // 只計算到當下的紀錄（不含未來的 scheduled 紀錄）
    const now = new Date();
    const dateFilter = { $lte: now };

    const [asAccountAgg, asToAccountAgg, feeAgg] = await Promise.all([
      // Records where this account is the primary account
      RecordModel.aggregate([
        { $match: { userId, date: dateFilter, paymentStatus: { $ne: "scheduled" } } },
        {
          $group: {
            _id: { account: "$account", type: "$type" },
            total: { $sum: "$amount" },
          },
        },
      ]),
      // Records where this account is the toAccount (transfers in, credit card payments)
      RecordModel.aggregate([
        { $match: { userId, date: dateFilter, paymentStatus: { $ne: "scheduled" }, toAccount: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: { toAccount: "$toAccount", type: "$type" },
            total: { $sum: "$amount" },
          },
        },
      ]),
      // Fee aggregation per account
      RecordModel.aggregate([
        { $match: { userId, date: dateFilter, paymentStatus: { $ne: "scheduled" }, fee: { $gt: 0 } } },
        {
          $group: {
            _id: "$account",
            totalFee: { $sum: "$fee" },
          },
        },
      ]),
    ]);

    // Build lookup maps
    const accountTotals: Record<string, Record<string, number>> = {};
    const toAccountTotals: Record<string, Record<string, number>> = {};
    const feeTotals: Record<string, number> = {};

    for (const row of asAccountAgg) {
      const accId = row._id.account.toString();
      if (!accountTotals[accId]) accountTotals[accId] = {};
      accountTotals[accId][row._id.type] = row.total;
    }

    for (const row of asToAccountAgg) {
      const accId = row._id.toAccount.toString();
      if (!toAccountTotals[accId]) toAccountTotals[accId] = {};
      toAccountTotals[accId][row._id.type] = row.total;
    }

    for (const row of feeAgg) {
      feeTotals[row._id.toString()] = row.totalFee;
    }

    const data = accounts.map((acc) => {
      const id = acc._id.toString();
      const at = accountTotals[id] || {};
      const tat = toAccountTotals[id] || {};
      const fees = feeTotals[id] || 0;
      const initial = (acc as any).initialBalance || 0;

      let currentBalance: number;

      if (acc.type === "credit") {
        // Credit card: negative = debt
        currentBalance =
          initial -
          (at["expense"] || 0) +
          (tat["transfer"] || 0) +   // 繳款（轉入）
          (at["refund"] || 0) +
          (at["reward"] || 0) +       // 紅利回饋
          (at["discount"] || 0) +     // 折扣
          (at["balance_adjustment"] || 0) - // 餘額調整
          (at["transfer"] || 0) -     // 轉出（如預借現金）
          fees -
          (at["interest"] || 0);
      } else {
        // Physical accounts (bank, cash, ewallet, investment)
        currentBalance =
          initial +
          (at["income"] || 0) -
          (at["expense"] || 0) -
          (at["transfer"] || 0) +
          (tat["transfer"] || 0) -
          (at["payable"] || 0) +
          (at["receivable"] || 0) +
          (at["refund"] || 0) +
          (at["reward"] || 0) +
          (at["discount"] || 0) +
          (at["balance_adjustment"] || 0) -
          (at["interest"] || 0) -
          fees;
      }

      const result: any = {
        accountId: id,
        name: acc.name,
        type: acc.type,
        group: (acc as any).group || "",
        includeInStats: (acc as any).includeInStats !== false,
        currency: acc.currency || "TWD",
        initialBalance: initial,
        currentBalance: Math.round(currentBalance * 100) / 100,
        creditLimit: acc.creditLimit || null,
      };

      if (acc.type === "credit" && acc.creditLimit) {
        result.availableCredit = acc.creditLimit + currentBalance; // currentBalance is negative
      }

      return result;
    });

    // Summary — only include accounts with includeInStats === true
    const statsData = data.filter((d) => d.includeInStats);

    const totalAssets = statsData
      .filter((d) => d.type === "physical" && d.currentBalance > 0)
      .reduce((sum, d) => sum + d.currentBalance, 0);

    const totalLiabilities = statsData
      .filter((d) => d.type === "credit" && d.currentBalance < 0)
      .reduce((sum, d) => sum + Math.abs(d.currentBalance), 0);

    res.json({
      success: true,
      data: {
        data,
        summary: {
          totalAssets: Math.round(totalAssets * 100) / 100,
          totalLiabilities: Math.round(totalLiabilities * 100) / 100,
          netWorth: Math.round((totalAssets - totalLiabilities) * 100) / 100,
        },
      },
    });
  } catch (error) {
    console.error("Failed to calculate balances:", error);
    res.status(500).json({ success: false, error: "Failed to calculate balances" });
  }
});

// GET single account
accountsRouter.get("/:id", async (req, res) => {
  try {
    const account = await AccountModel.findOne({ _id: req.params.id, userId: req.userId });
    if (!account) {
      res.status(404).json({ success: false, error: "Account not found" });
      return;
    }
    res.json({ success: true, data: account });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch account" });
  }
});

// POST create account
accountsRouter.post("/", async (req, res) => {
  try {
    const account = await AccountModel.create({ ...req.body, userId: req.userId });
    res.status(201).json({ success: true, data: account });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to create account" });
  }
});

// PUT update account
accountsRouter.put("/:id", async (req, res) => {
  try {
    const account = await AccountModel.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true },
    );
    if (!account) {
      res.status(404).json({ success: false, error: "Account not found" });
      return;
    }
    res.json({ success: true, data: account });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to update account" });
  }
});

// DELETE account
accountsRouter.delete("/:id", async (req, res) => {
  try {
    const account = await AccountModel.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!account) {
      res.status(404).json({ success: false, error: "Account not found" });
      return;
    }
    res.json({ success: true, data: account });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to delete account" });
  }
});
