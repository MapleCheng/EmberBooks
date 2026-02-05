import { Router } from "express";
import mongoose from "mongoose";
import { CreditCardStatementModel } from "../models/CreditCardStatement.js";
import { AccountModel } from "../models/Account.js";
import { RecordModel } from "../models/Record.js";
import { authMiddleware } from "../middleware/auth.js";

export const statementsRouter = Router();
statementsRouter.use(authMiddleware);

// Helper: calculate confirmedTotal for a statement
// 含轉帳：預借現金算帳款，繳款不算
async function calcConfirmedTotal(statementId: mongoose.Types.ObjectId | string, accountId?: mongoose.Types.ObjectId | string): Promise<number> {
  const matchStage: any = { statementId: new mongoose.Types.ObjectId(statementId.toString()), reconciled: true };

  const records = await RecordModel.find(matchStage).lean();

  let total = 0;
  const accountIdStr = accountId?.toString();
  for (const r of records) {
    // 轉帳到信用卡 = 繳款，不計入帳單金額
    if (r.type === "transfer" && accountIdStr) {
      const isToCard = (r as any).toAccount?.toString() === accountIdStr && r.account?.toString() !== accountIdStr;
      if (isToCard) continue; // 繳款跳過
    }

    if (["refund", "reward", "discount", "balance_adjustment"].includes(r.type)) {
      total -= r.amount;
    } else {
      total += r.amount + ((r as any).fee || 0);
    }
  }
  return Math.round(total * 100) / 100;
}

// GET /api/statements — list statements (with confirmedTotal)
statementsRouter.get("/", async (req, res) => {
  try {
    const filter: any = { userId: req.userId };
    if (req.query.accountId) filter.accountId = req.query.accountId;
    if (req.query.status) filter.status = req.query.status;

    const statements = await CreditCardStatementModel.find(filter).sort({ billingCycleEnd: -1 }).lean();

    // Enrich each statement with confirmedTotal
    const enriched = await Promise.all(
      statements.map(async (stmt) => {
        const confirmedTotal = await calcConfirmedTotal(stmt._id, stmt.accountId);
        const difference =
          stmt.statementAmount != null ? Math.round((stmt.statementAmount - confirmedTotal) * 100) / 100 : 0;
        return { ...stmt, confirmedTotal, difference };
      }),
    );

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error("Failed to fetch statements:", error);
    res.status(500).json({ success: false, error: "Failed to fetch statements" });
  }
});

// GET /api/statements/generate — auto-generate statements for a credit card
statementsRouter.get("/generate", async (req, res) => {
  try {
    const { accountId } = req.query;
    if (!accountId) {
      res.status(400).json({ success: false, error: "accountId is required" });
      return;
    }

    const account = await AccountModel.findOne({
      _id: accountId,
      userId: req.userId,
      type: "credit",
    });

    if (!account) {
      res.status(404).json({ success: false, error: "Credit card account not found" });
      return;
    }

    if (!account.billDay) {
      res.status(400).json({ success: false, error: "Credit card billDay not set. Please set it in settings." });
      return;
    }

    const billDay = account.billDay;
    const payDay = account.payDay || billDay;

    // Find the earliest record for this card
    const firstRecord = await RecordModel.findOne({
      userId: req.userId,
      $or: [{ account: accountId }, { toAccount: accountId }],
    }).sort({ date: 1 });

    if (!firstRecord) {
      res.json({ success: true, data: [] });
      return;
    }

    // Find existing statements to avoid duplicates
    const existingStatements = await CreditCardStatementModel.find({
      userId: req.userId,
      accountId,
    });
    const existingCycleEnds = new Set(
      existingStatements.map((s) => s.billingCycleEnd.toISOString().slice(0, 10)),
    );

    // Generate billing cycles from first record date to now
    const firstDate = new Date(firstRecord.date);
    const now = new Date();

    let cycleEnd = new Date(firstDate.getFullYear(), firstDate.getMonth(), billDay);
    if (cycleEnd < firstDate) {
      cycleEnd.setMonth(cycleEnd.getMonth() + 1);
    }

    const newStatements = [];

    while (cycleEnd <= now) {
      const cycleEndStr = cycleEnd.toISOString().slice(0, 10);

      if (!existingCycleEnds.has(cycleEndStr)) {
        const cycleStart = new Date(cycleEnd);
        cycleStart.setMonth(cycleStart.getMonth() - 1);
        cycleStart.setDate(cycleStart.getDate() + 1);

        const dueDate = new Date(cycleEnd.getFullYear(), cycleEnd.getMonth(), payDay);
        if (dueDate <= cycleEnd) {
          dueDate.setMonth(dueDate.getMonth() + 1);
        }

        const cycleStartDate = new Date(cycleStart);
        cycleStartDate.setHours(0, 0, 0, 0);
        const cycleEndDate = new Date(cycleEnd);
        cycleEndDate.setHours(23, 59, 59, 999);

        const statement = await CreditCardStatementModel.create({
          userId: req.userId,
          accountId,
          billingCycleStart: cycleStartDate,
          billingCycleEnd: cycleEndDate,
          dueDate,
          status: "pending",
        });

        newStatements.push(statement);
      }

      cycleEnd = new Date(cycleEnd.getFullYear(), cycleEnd.getMonth() + 1, billDay);
    }

    res.json({ success: true, data: newStatements });
  } catch (error) {
    console.error("Failed to generate statements:", error);
    res.status(500).json({ success: false, error: "Failed to generate statements" });
  }
});

// GET /api/statements/periods — 基於 billingDate 的帳期列表
statementsRouter.get("/periods", async (req, res) => {
  try {
    const { accountId } = req.query;
    if (!accountId) {
      res.status(400).json({ success: false, error: "accountId is required" });
      return;
    }

    const account = await AccountModel.findOne({
      _id: accountId,
      userId: req.userId,
      type: "credit",
    });

    if (!account) {
      res.status(404).json({ success: false, error: "Credit card account not found" });
      return;
    }

    if (!account.billDay) {
      res.status(400).json({ success: false, error: "Credit card billDay not set" });
      return;
    }

    const billDay = account.billDay;

    // 撈所有紀錄（含轉帳）
    const accountOid = new mongoose.Types.ObjectId(accountId as string);
    const allRecords = await RecordModel.find({
      userId: req.userId,
      $or: [
        { account: accountOid },
        { toAccount: accountOid },
      ],
    }).sort({ date: 1 }).lean();

    if (allRecords.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    // 標記每筆紀錄與信用卡的關係
    const accountIdStr = accountOid.toString();
    for (const r of allRecords) {
      const isOnCard = r.account?.toString() === accountIdStr;
      const isToCard = (r as any).toAccount?.toString() === accountIdStr;
      // 轉帳到信用卡 = 繳款（不計入帳單金額）
      (r as any)._isPayment = r.type === "transfer" && isToCard && !isOnCard;
      // 從信用卡轉出 = 預借現金等（計入帳單金額）
      (r as any)._isCashAdvance = r.type === "transfer" && isOnCard;
    }

    // 找所有已存在的 statement
    const existingStatements = await CreditCardStatementModel.find({
      userId: req.userId,
      accountId,
    }).lean();

    const stmtMap = new Map<string, any>();
    for (const s of existingStatements) {
      const key = s.billingCycleEnd.toISOString().slice(0, 10);
      stmtMap.set(key, s);
    }

    const now = new Date();

    // 從最早的紀錄日期算起，建立帳期
    const firstDate = new Date(allRecords[0].date);
    let cycleEnd = new Date(firstDate.getFullYear(), firstDate.getMonth(), billDay);
    // 用當天結束時間比較，避免同一天但時間較晚的紀錄被跳過
    const firstCycleEndEOD = new Date(cycleEnd);
    firstCycleEndEOD.setHours(23, 59, 59, 999);
    if (firstCycleEndEOD < firstDate) {
      cycleEnd.setMonth(cycleEnd.getMonth() + 1);
    }

    // 建立帳期 Map
    const periodsMap = new Map<string, { cycleStart: Date; cycleEnd: Date; records: any[] }>();

    while (cycleEnd <= now || cycleEnd <= new Date(now.getFullYear(), now.getMonth() + 2, now.getDate())) {
      const cycleStart = new Date(cycleEnd);
      cycleStart.setMonth(cycleStart.getMonth() - 1);
      cycleStart.setDate(cycleStart.getDate() + 1);

      const cycleStartDate = new Date(cycleStart);
      cycleStartDate.setHours(0, 0, 0, 0);
      const cycleEndDate = new Date(cycleEnd);
      cycleEndDate.setHours(23, 59, 59, 999);

      const key = cycleEnd.toISOString().slice(0, 10);
      periodsMap.set(key, { cycleStart: cycleStartDate, cycleEnd: cycleEndDate, records: [] });

      cycleEnd = new Date(cycleEnd.getFullYear(), cycleEnd.getMonth() + 1, billDay);
      if (cycleEnd > new Date(now.getFullYear(), now.getMonth() + 3, now.getDate())) break;
    }

    // 依 date 和 billingDate 分配紀錄到對應帳期（一筆可出現在多個帳期）
    for (const r of allRecords) {
      const txDate = new Date(r.date);
      const billDate = r.billingDate ? new Date(r.billingDate) : null;

      for (const [key, period] of periodsMap) {
        const inByTxDate = txDate >= period.cycleStart && txDate <= period.cycleEnd;
        const inByBillDate = billDate ? (billDate >= period.cycleStart && billDate <= period.cycleEnd) : false;

        if (inByTxDate || inByBillDate) {
          const enriched: any = { ...r };
          // 消費日在此帳期但 billingDate 不在（延出去了）
          if (inByTxDate && billDate && !inByBillDate) {
            enriched._deferredOut = true;
          }
          // billingDate 在此帳期但消費日不在（延進來的）
          if (inByBillDate && !inByTxDate) {
            enriched._deferredIn = true;
          }
          period.records.push(enriched);
        }
      }
    }

    // 組裝結果，只回傳有紀錄的帳期
    const periods: any[] = [];
    for (const [key, period] of periodsMap) {
      if (period.records.length === 0) continue;

      const existingStmt = stmtMap.get(key);

      let totalAmount = 0;
      for (const r of period.records) {
        if ((r as any)._deferredOut) continue; // 延出去的不算在本期
        if ((r as any)._isPayment) continue;   // 繳款不計入帳單金額
        if (r.type === "refund" || r.type === "reward" || r.type === "discount" || r.type === "balance_adjustment") {
          totalAmount -= r.amount;
        } else {
          totalAmount += r.amount + (r.fee || 0);
        }
      }
      totalAmount = Math.round(totalAmount * 100) / 100;

      // 計算勾選狀態（排除 _deferredOut，它們已在原帳期處理過）
      const actionableRecords = period.records.filter((r: any) => !r._deferredOut);
      const checkedCount = actionableRecords.filter((r: any) => r.reconciled).length;
      const totalActionable = actionableRecords.length;

      let periodStatus: "unreconciled" | "pending" | "confirmed";
      if (totalActionable === 0) {
        // 只有 deferredOut 紀錄，沒有需要處理的
        periodStatus = "confirmed";
      } else if (checkedCount === 0) {
        periodStatus = "unreconciled";  // 一個都沒勾
      } else if (checkedCount < totalActionable) {
        periodStatus = "pending";       // 有勾但沒全勾
      } else {
        periodStatus = "confirmed";     // 全勾
      }

      periods.push({
        billingCycleStart: period.cycleStart.toISOString(),
        billingCycleEnd: period.cycleEnd.toISOString(),
        records: period.records,
        totalAmount,
        status: periodStatus,
        statementId: existingStmt?._id?.toString() || undefined,
      });
    }

    // 最新的在前
    periods.sort((a, b) => new Date(b.billingCycleEnd).getTime() - new Date(a.billingCycleEnd).getTime());

    res.json({ success: true, data: periods });
  } catch (error) {
    console.error("Failed to fetch billing periods:", error);
    res.status(500).json({ success: false, error: "Failed to fetch billing periods" });
  }
});

// POST /api/statements/save — 儲存對帳單（billingDate 模型）
statementsRouter.post("/save", async (req, res) => {
  try {
    const { accountId, billingCycleStart, billingCycleEnd, confirmedIds, deferredIds } = req.body;

    if (!accountId || !billingCycleStart || !billingCycleEnd) {
      res.status(400).json({ success: false, error: "Missing required fields" });
      return;
    }

    const confirmedArr = Array.isArray(confirmedIds) ? confirmedIds : [];
    const deferredArr = Array.isArray(deferredIds) ? deferredIds : [];

    const account = await AccountModel.findOne({
      _id: accountId,
      userId: req.userId,
      type: "credit",
    });

    if (!account) {
      res.status(404).json({ success: false, error: "Credit card account not found" });
      return;
    }

    // 查找該帳期是否已有 CreditCardStatement
    const existingStatement = await CreditCardStatementModel.findOne({
      userId: req.userId,
      accountId,
      billingCycleEnd: {
        $gte: new Date(new Date(billingCycleEnd).setHours(0, 0, 0, 0)),
        $lte: new Date(new Date(billingCycleEnd).setHours(23, 59, 59, 999)),
      },
    });

    // 計算繳費日
    const payDay = account.payDay || account.billDay || 1;
    const endDate = new Date(billingCycleEnd);
    const dueDate = new Date(endDate.getFullYear(), endDate.getMonth(), payDay);
    if (dueDate <= endDate) {
      dueDate.setMonth(dueDate.getMonth() + 1);
    }

    let statement;

    if (existingStatement) {
      statement = existingStatement;
      statement.billingCycleStart = new Date(billingCycleStart);
      statement.billingCycleEnd = new Date(billingCycleEnd);
      statement.dueDate = dueDate;
      statement.status = "pending";
    } else {
      statement = await CreditCardStatementModel.create({
        userId: req.userId,
        accountId,
        billingCycleStart: new Date(billingCycleStart),
        billingCycleEnd: new Date(billingCycleEnd),
        dueDate,
        status: "pending",
      });
    }

    // 之前在此 statement 但不在 confirmedIds/deferredIds 的紀錄：解除綁定
    const allHandledIds = [...confirmedArr, ...deferredArr].map((id: string) => new mongoose.Types.ObjectId(id));
    await RecordModel.updateMany(
      {
        userId: req.userId,
        statementId: statement._id,
        _id: { $nin: allHandledIds },
      },
      { $set: { statementId: null, reconciled: false } },
    );

    // confirmedIds：確認在此帳期
    if (confirmedArr.length > 0) {
      await RecordModel.updateMany(
        {
          _id: { $in: confirmedArr.map((id: string) => new mongoose.Types.ObjectId(id)) },
          userId: req.userId,
        },
        { $set: { statementId: statement._id, reconciled: true } },
      );
    }

    // deferredIds：延期到下一帳期
    if (deferredArr.length > 0) {
      // 下一帳期第一天 = billingCycleEnd + 1 day
      const nextPeriodStart = new Date(billingCycleEnd);
      nextPeriodStart.setDate(nextPeriodStart.getDate() + 1);
      nextPeriodStart.setHours(0, 0, 0, 0);

      await RecordModel.updateMany(
        {
          _id: { $in: deferredArr.map((id: string) => new mongoose.Types.ObjectId(id)) },
          userId: req.userId,
        },
        { $set: { billingDate: nextPeriodStart, reconciled: false, statementId: null } },
      );
    }

    // 重新計算 statementAmount
    const confirmedTotal = await calcConfirmedTotal(statement._id, statement.accountId);
    statement.statementAmount = confirmedTotal;

    const cycleStart = new Date(billingCycleStart);
    const cycleEnd = new Date(billingCycleEnd);
    const accountOid2 = new mongoose.Types.ObjectId(accountId);
    const periodRecords = await RecordModel.find({
      userId: req.userId,
      $or: [
        { account: accountOid2 },
        { toAccount: accountOid2 },
      ],
      date: { $gte: cycleStart, $lte: cycleEnd },
    }).lean();

    const unhandledInPeriod = periodRecords.filter((r: any) => {
      if (r.billingDate) {
        const bd = new Date(r.billingDate);
        if (bd < cycleStart || bd > cycleEnd) return false;
      }
      return !r.reconciled;
    }).length;

    statement.status = unhandledInPeriod === 0 ? "confirmed" : "pending";

    const savedStatement = await statement.save();

    res.json({
      success: true,
      data: {
        statement: savedStatement,
        confirmedTotal,
      },
    });
  } catch (error) {
    console.error("Failed to save statement:", error);
    res.status(500).json({ success: false, error: "Failed to save statement" });
  }
});

// GET /api/statements/:id/records — get records for reconciliation
statementsRouter.get("/:id/records", async (req, res) => {
  try {
    const statement = await CreditCardStatementModel.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!statement) {
      res.status(404).json({ success: false, error: "Statement not found" });
      return;
    }

    // Confirmed records: statementId = this statement, reconciled = true
    const confirmed = await RecordModel.find({
      statementId: statement._id,
      reconciled: true,
    }).sort({ date: 1 });

    // Candidate records: same card, date within ±7 days of billing cycle, not assigned
    const rangeStart = new Date(statement.billingCycleStart);
    rangeStart.setDate(rangeStart.getDate() - 7);
    rangeStart.setHours(0, 0, 0, 0);

    const rangeEnd = new Date(statement.billingCycleEnd);
    rangeEnd.setDate(rangeEnd.getDate() + 7);
    rangeEnd.setHours(23, 59, 59, 999);

    const candidates = await RecordModel.find({
      userId: req.userId,
      $or: [
        { account: statement.accountId },
        { toAccount: statement.accountId },
      ],
      date: { $gte: rangeStart, $lte: rangeEnd },
      $and: [
        { $or: [{ statementId: null }, { statementId: { $exists: false } }] },
      ],
    }).sort({ date: 1 });

    const confirmedTotal = await calcConfirmedTotal(statement._id, statement.accountId);
    const statementAmount = statement.statementAmount || 0;
    const difference = Math.round((statementAmount - confirmedTotal) * 100) / 100;

    res.json({
      success: true,
      data: {
        confirmed,
        candidates,
        confirmedTotal,
        statementAmount,
        difference,
      },
    });
  } catch (error) {
    console.error("Failed to fetch statement records:", error);
    res.status(500).json({ success: false, error: "Failed to fetch statement records" });
  }
});

// PUT /api/statements/:id/records — batch add/remove records from statement
statementsRouter.put("/:id/records", async (req, res) => {
  try {
    const statement = await CreditCardStatementModel.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!statement) {
      res.status(404).json({ success: false, error: "Statement not found" });
      return;
    }

    const { add, remove } = req.body;

    // Add records to this statement
    if (add && Array.isArray(add) && add.length > 0) {
      await RecordModel.updateMany(
        {
          _id: { $in: add.map((id: string) => new mongoose.Types.ObjectId(id)) },
          userId: req.userId,
        },
        { $set: { statementId: statement._id, reconciled: true } },
      );
    }

    // Remove records from this statement
    if (remove && Array.isArray(remove) && remove.length > 0) {
      await RecordModel.updateMany(
        {
          _id: { $in: remove.map((id: string) => new mongoose.Types.ObjectId(id)) },
          userId: req.userId,
          statementId: statement._id,
        },
        { $set: { statementId: null, reconciled: false } },
      );
    }

    // Recalculate
    const confirmedTotal = await calcConfirmedTotal(statement._id, statement.accountId);
    const statementAmount = statement.statementAmount || 0;
    const difference = Math.round((statementAmount - confirmedTotal) * 100) / 100;

    res.json({
      success: true,
      data: {
        confirmedTotal,
        statementAmount,
        difference,
      },
    });
  } catch (error) {
    console.error("Failed to update statement records:", error);
    res.status(500).json({ success: false, error: "Failed to update statement records" });
  }
});

// GET /api/statements/:id — single statement with confirmedTotal
statementsRouter.get("/:id", async (req, res) => {
  try {
    const statement = await CreditCardStatementModel.findOne({
      _id: req.params.id,
      userId: req.userId,
    }).lean();

    if (!statement) {
      res.status(404).json({ success: false, error: "Statement not found" });
      return;
    }

    const confirmedTotal = await calcConfirmedTotal(statement._id, statement.accountId);
    const difference =
      statement.statementAmount != null
        ? Math.round((statement.statementAmount - confirmedTotal) * 100) / 100
        : 0;

    // Fetch confirmed records
    const records = await RecordModel.find({
      statementId: statement._id,
      reconciled: true,
    }).sort({ date: -1 });

    res.json({
      success: true,
      data: {
        statement: { ...statement, confirmedTotal, difference },
        records,
      },
    });
  } catch (error) {
    console.error("Failed to fetch statement detail:", error);
    res.status(500).json({ success: false, error: "Failed to fetch statement detail" });
  }
});

// PUT /api/statements/:id — update statement
statementsRouter.put("/:id", async (req, res) => {
  try {
    const statement = await CreditCardStatementModel.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!statement) {
      res.status(404).json({ success: false, error: "Statement not found" });
      return;
    }

    const { statementAmount, status, paidAmount, paidDate, note } = req.body;

    if (statementAmount !== undefined) {
      statement.statementAmount = statementAmount;
    }

    if (status) statement.status = status;
    if (paidAmount !== undefined) statement.paidAmount = paidAmount;
    if (paidDate !== undefined) statement.paidDate = paidDate ? new Date(paidDate) : undefined;
    if (note !== undefined) statement.note = note;

    await statement.save();

    // Return enriched data
    const saved = statement.toObject();
    const confirmedTotal = await calcConfirmedTotal(statement._id, statement.accountId);
    const difference =
      saved.statementAmount != null
        ? Math.round((saved.statementAmount - confirmedTotal) * 100) / 100
        : 0;

    res.json({ success: true, data: { ...saved, confirmedTotal, difference } });
  } catch (error) {
    console.error("Failed to update statement:", error);
    res.status(500).json({ success: false, error: "Failed to update statement" });
  }
});

