import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { RecordModel } from "../models/Record.js";
import { CategoryModel } from "../models/Category.js";
import { AccountModel } from "../models/Account.js";
import { UserModel } from "../models/User.js";
import { PaymentPlanModel } from "../models/PaymentPlan.js";
import { CreditCardStatementModel } from "../models/CreditCardStatement.js";
import { authMiddleware } from "../middleware/auth.js";

export const reportsRouter = Router();
reportsRouter.use(authMiddleware);

// ─── Helper ────────────────────────────────────────────────────
function toObjectId(id: string) {
  return new mongoose.Types.ObjectId(id);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

async function getExcludedAccountIds(userId: mongoose.Types.ObjectId): Promise<mongoose.Types.ObjectId[]> {
  const excluded = await AccountModel.find({ userId, includeInStats: false }, { _id: 1 }).lean();
  return excluded.map((a) => a._id as mongoose.Types.ObjectId);
}

// ─── 1. GET /monthly?year=&month= ─────────────────────────────
reportsRouter.get("/monthly", async (req: Request, res: Response) => {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    if (!year || !month || month < 1 || month > 12) {
      res.status(400).json({ success: false, error: "year and month are required (month 1-12)" });
      return;
    }

    const userId = toObjectId(req.userId!);
    const excludedAccountIds = await getExcludedAccountIds(userId);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const matchStage = {
      $match: {
        userId,
        date: { $gte: startDate, $lt: endDate },
        type: { $in: ["expense", "income"] },
        account: { $nin: excludedAccountIds },
      },
    };

    // --- Summary ---
    const summaryPipeline = [
      matchStage,
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ];
    const summaryResult = await RecordModel.aggregate(summaryPipeline);

    let totalIncome = 0;
    let totalExpense = 0;
    let recordCount = 0;
    for (const row of summaryResult) {
      if (row._id === "income") totalIncome = row.total;
      if (row._id === "expense") totalExpense = row.total;
      recordCount += row.count;
    }

    // --- byCategory (expense only, with subcategories) ---
    const byCategoryPipeline = [
      { $match: { ...matchStage.$match, type: "expense" } },
      {
        $group: {
          _id: { category: "$category", subcategory: "$subcategory" },
          amount: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.category": 1 as const, amount: -1 as const } },
    ];
    const catRaw = await RecordModel.aggregate(byCategoryPipeline);

    // Group subcategories under categories
    const catMap = new Map<string, { amount: number; subs: { subcategory: string; amount: number }[] }>();
    for (const row of catRaw) {
      const cat = row._id.category || "未分類";
      const sub = row._id.subcategory || "其他";
      if (!catMap.has(cat)) catMap.set(cat, { amount: 0, subs: [] });
      const entry = catMap.get(cat)!;
      entry.amount += row.amount;
      entry.subs.push({ subcategory: sub, amount: row.amount });
    }

    const byCategory = Array.from(catMap.entries())
      .map(([category, data]) => ({
        category,
        amount: data.amount,
        percentage: totalExpense > 0 ? round1((data.amount / totalExpense) * 100) : 0,
        subcategories: data.subs.sort((a, b) => b.amount - a.amount),
      }))
      .sort((a, b) => b.amount - a.amount);

    // --- byAccount ---
    const byAccountPipeline = [
      matchStage,
      {
        $group: {
          _id: { account: "$account", type: "$type" },
          total: { $sum: "$amount" },
        },
      },
    ];
    const acctRaw = await RecordModel.aggregate(byAccountPipeline);

    // Collect unique account IDs
    const acctIds = [...new Set(acctRaw.map((r) => r._id.account.toString()))];
    const accounts = await AccountModel.find({ _id: { $in: acctIds } }).lean();
    const acctNameMap = new Map(accounts.map((a) => [a._id.toString(), a.name]));

    const acctMap = new Map<string, { account: string; accountId: string; expense: number; income: number }>();
    for (const row of acctRaw) {
      const id = row._id.account.toString();
      if (!acctMap.has(id)) {
        acctMap.set(id, {
          account: acctNameMap.get(id) || "未知帳戶",
          accountId: id,
          expense: 0,
          income: 0,
        });
      }
      const entry = acctMap.get(id)!;
      if (row._id.type === "expense") entry.expense += row.total;
      if (row._id.type === "income") entry.income += row.total;
    }
    const byAccount = Array.from(acctMap.values());

    // --- dailyTrend ---
    const dailyPipeline = [
      matchStage,
      {
        $group: {
          _id: { day: { $dayOfMonth: "$date" }, type: "$type" },
          total: { $sum: "$amount" },
        },
      },
    ];
    const dailyRaw = await RecordModel.aggregate(dailyPipeline);

    const days = daysInMonth(year, month);
    const dailyMap = new Map<number, { expense: number; income: number }>();
    for (let d = 1; d <= days; d++) dailyMap.set(d, { expense: 0, income: 0 });
    for (const row of dailyRaw) {
      const entry = dailyMap.get(row._id.day);
      if (entry) {
        if (row._id.type === "expense") entry.expense = row.total;
        if (row._id.type === "income") entry.income = row.total;
      }
    }
    const dailyTrend = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([day, data]) => ({
        date: `${year}-${pad(month)}-${pad(day)}`,
        expense: data.expense,
        income: data.income,
      }));

    res.json({
      success: true,
      data: {
        year,
        month,
        summary: { totalIncome, totalExpense, net: totalIncome - totalExpense },
        byCategory,
        byAccount,
        dailyTrend,
        recordCount,
      },
    });
  } catch (error) {
    console.error("Monthly report error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch monthly report" });
  }
});

// ─── 2. GET /yearly?year= ─────────────────────────────────────
reportsRouter.get("/yearly", async (req: Request, res: Response) => {
  try {
    const year = Number(req.query.year);
    if (!year) {
      res.status(400).json({ success: false, error: "year is required" });
      return;
    }

    const userId = toObjectId(req.userId!);
    const excludedAccountIds = await getExcludedAccountIds(userId);
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);

    const matchStage = {
      $match: {
        userId,
        date: { $gte: startDate, $lt: endDate },
        type: { $in: ["expense", "income"] },
        account: { $nin: excludedAccountIds },
      },
    };

    // --- Summary ---
    const summaryResult = await RecordModel.aggregate([
      matchStage,
      { $group: { _id: "$type", total: { $sum: "$amount" } } },
    ]);
    let totalIncome = 0;
    let totalExpense = 0;
    for (const row of summaryResult) {
      if (row._id === "income") totalIncome = row.total;
      if (row._id === "expense") totalExpense = row.total;
    }

    // --- monthlyTrend ---
    const monthlyRaw = await RecordModel.aggregate([
      matchStage,
      {
        $group: {
          _id: { month: { $month: "$date" }, type: "$type" },
          total: { $sum: "$amount" },
        },
      },
    ]);
    const monthlyMap = new Map<number, { expense: number; income: number }>();
    for (let m = 1; m <= 12; m++) monthlyMap.set(m, { expense: 0, income: 0 });
    for (const row of monthlyRaw) {
      const entry = monthlyMap.get(row._id.month);
      if (entry) {
        if (row._id.type === "expense") entry.expense = row.total;
        if (row._id.type === "income") entry.income = row.total;
      }
    }
    const monthlyTrend = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([month, data]) => ({ month, expense: data.expense, income: data.income }));

    // --- byCategory (expense) ---
    const catRaw = await RecordModel.aggregate([
      { $match: { ...matchStage.$match, type: "expense" } },
      { $group: { _id: "$category", amount: { $sum: "$amount" } } },
      { $sort: { amount: -1 } },
    ]);
    const byCategory = catRaw.map((row) => ({
      category: row._id || "未分類",
      amount: row.amount,
      percentage: totalExpense > 0 ? round1((row.amount / totalExpense) * 100) : 0,
    }));

    // --- topExpenses (top 10 single records) ---
    const topRaw = await RecordModel.aggregate([
      { $match: { ...matchStage.$match, type: "expense" } },
      { $sort: { amount: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          category: 1,
          subcategory: 1,
          amount: 1,
          date: 1,
          note: 1,
        },
      },
    ]);
    const topExpenses = topRaw.map((r) => ({
      category: r.category || "未分類",
      subcategory: r.subcategory || "",
      amount: r.amount,
      date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
      note: r.note || "",
    }));

    res.json({
      success: true,
      data: {
        year,
        summary: { totalIncome, totalExpense, net: totalIncome - totalExpense },
        monthlyTrend,
        byCategory,
        topExpenses,
      },
    });
  } catch (error) {
    console.error("Yearly report error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch yearly report" });
  }
});

// ─── 3. GET /category?category=&from=&to= ─────────────────────
reportsRouter.get("/category", async (req: Request, res: Response) => {
  try {
    const { category, from, to } = req.query;
    if (!category || !from || !to) {
      res.status(400).json({ success: false, error: "category, from, and to are required" });
      return;
    }

    const userId = toObjectId(req.userId!);
    const excludedAccountIds = await getExcludedAccountIds(userId);
    const fromDate = new Date(from as string);
    const toOriginal = new Date(to as string);
    // endDate: first day of next month after 'to'
    const toMonth = toOriginal.getUTCMonth(); // 0-based
    const toYear = toOriginal.getUTCFullYear();
    const endDate = new Date(Date.UTC(toMonth === 11 ? toYear + 1 : toYear, toMonth === 11 ? 0 : toMonth + 1, 1));

    const matchStage = {
      $match: {
        userId,
        category: category as string,
        date: { $gte: fromDate, $lt: endDate },
        type: "expense",
        account: { $nin: excludedAccountIds },
      },
    };

    // --- Total ---
    const totalResult = await RecordModel.aggregate([
      matchStage,
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const total = totalResult[0]?.total || 0;

    // --- monthlyTrend ---
    const monthlyRaw = await RecordModel.aggregate([
      matchStage,
      {
        $group: {
          _id: { year: { $year: "$date" }, month: { $month: "$date" } },
          amount: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Fill all months in range
    const fromYM = { year: fromDate.getUTCFullYear(), month: fromDate.getUTCMonth() + 1 };
    const toYM = { year: toOriginal.getUTCFullYear(), month: toOriginal.getUTCMonth() + 1 };
    const monthlyMap = new Map<string, number>();
    let y = fromYM.year;
    let m = fromYM.month;
    while (y < toYM.year || (y === toYM.year && m <= toYM.month)) {
      monthlyMap.set(`${y}-${pad(m)}`, 0);
      m++;
      if (m > 12) { m = 1; y++; }
    }
    for (const row of monthlyRaw) {
      const key = `${row._id.year}-${pad(row._id.month)}`;
      monthlyMap.set(key, row.amount);
    }
    const monthlyTrend = Array.from(monthlyMap.entries()).map(([yearMonth, amount]) => ({
      yearMonth,
      amount,
    }));

    // --- bySubcategory ---
    const subRaw = await RecordModel.aggregate([
      matchStage,
      { $group: { _id: "$subcategory", amount: { $sum: "$amount" } } },
      { $sort: { amount: -1 } },
    ]);
    const bySubcategory = subRaw.map((row) => ({
      subcategory: row._id || "其他",
      amount: row.amount,
      percentage: total > 0 ? round1((row.amount / total) * 100) : 0,
    }));

    res.json({
      success: true,
      data: {
        category,
        period: {
          from: (from as string),
          to: (to as string),
        },
        total,
        monthlyTrend,
        bySubcategory,
      },
    });
  } catch (error) {
    console.error("Category report error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch category report" });
  }
});

// ─── 4. GET /budget ────────────────────────────────────────────
reportsRouter.get("/budget", async (req: Request, res: Response) => {
  try {
    const userId = toObjectId(req.userId!);
    const excludedAccountIds = await getExcludedAccountIds(userId);
    const now = new Date();
    const year = Number(req.query.year) || now.getFullYear();
    const month = Number(req.query.month) || now.getMonth() + 1;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    // Find categories with budget
    const budgetCategories = await CategoryModel.find({
      userId,
      budget: { $gt: 0 },
    }).lean();

    if (budgetCategories.length === 0) {
      res.json({
        success: true,
        data: {
          year,
          month,
          categories: [],
          totalBudget: 0,
          totalSpent: 0,
          totalRemaining: 0,
        },
      });
      return;
    }

    const categoryNames = budgetCategories.map((c) => c.name);

    // Aggregate expenses for this month grouped by category
    const spentRaw = await RecordModel.aggregate([
      {
        $match: {
          userId,
          date: { $gte: startDate, $lt: endDate },
          type: "expense",
          category: { $in: categoryNames },
          account: { $nin: excludedAccountIds },
        },
      },
      { $group: { _id: "$category", spent: { $sum: "$amount" } } },
    ]);

    const spentMap = new Map<string, number>();
    for (const row of spentRaw) {
      spentMap.set(row._id, row.spent);
    }

    let totalBudget = 0;
    let totalSpent = 0;

    const categories = budgetCategories.map((cat) => {
      const budget = cat.budget!;
      const spent = spentMap.get(cat.name) || 0;
      const remaining = budget - spent;
      const percentage = round1((spent / budget) * 100);
      let status: "ok" | "warning" | "over";
      if (percentage >= 100) status = "over";
      else if (percentage >= 80) status = "warning";
      else status = "ok";

      totalBudget += budget;
      totalSpent += spent;

      return { category: cat.name, budget, spent, remaining, percentage, status };
    });

    res.json({
      success: true,
      data: {
        year,
        month,
        categories,
        totalBudget,
        totalSpent,
        totalRemaining: totalBudget - totalSpent,
      },
    });
  } catch (error) {
    console.error("Budget report error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch budget report" });
  }
});

// ─── 5. GET /cashflow?year=&month= ─────────────────────────────
// Helper: get a date for day D in a given year/month, clamped to month end
function dateForDay(year: number, month: number, day: number): Date {
  const maxDay = new Date(year, month, 0).getDate(); // last day of that month
  return new Date(year, month - 1, Math.min(day, maxDay));
}

// Helper: add N months to {year, month}
function addMonths(year: number, month: number, n: number): { year: number; month: number } {
  let m = month + n;
  let y = year;
  while (m > 12) { m -= 12; y++; }
  while (m < 1) { m += 12; y--; }
  return { year: y, month: m };
}

// Helper: compute monthly totals for chaining (lightweight — no breakdowns)
async function computeMonthlyDelta(
  userId: any,
  year: number,
  month: number,
  excludedAccountIds: any[],
  allAccounts: any[],
): Promise<number> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const physicalAccountIds = allAccounts.filter(a => a.type === "physical").map(a => a._id);
  const creditAccounts = allAccounts.filter(a => a.type === "credit");
  const creditAccountIds = creditAccounts.map(a => a._id);

  // Income
  const incomeAgg = await RecordModel.aggregate([
    { $match: { userId, type: "income", date: { $gte: startDate, $lt: endDate }, account: { $nin: excludedAccountIds } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const income = incomeAgg[0]?.total || 0;

  // Direct expense (physical accounts, exclude credit)
  const directAgg = await RecordModel.aggregate([
    { $match: { userId, type: "expense", date: { $gte: startDate, $lt: endDate }, account: { $in: physicalAccountIds, $nin: excludedAccountIds } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const direct = directAgg[0]?.total || 0;

  // Credit card bills
  let creditBills = 0;
  for (const card of creditAccounts) {
    if (!card.billDay || !card.payDay) continue;
    const dueDate = dateForDay(year, month, card.payDay);
    if (dueDate >= startDate && dueDate < endDate) {
      if (excludedAccountIds.some((id: any) => id.equals(card._id))) continue;
      const billEndMonth = addMonths(year, month, -1);
      const billEnd = dateForDay(billEndMonth.year, billEndMonth.month, card.billDay);
      const billStartMonth = addMonths(billEndMonth.year, billEndMonth.month, -1);
      const billStartBase = dateForDay(billStartMonth.year, billStartMonth.month, card.billDay);
      const billStart = new Date(billStartBase);
      billStart.setDate(billStart.getDate() + 1);
      const billEndInclusive = new Date(billEnd);
      billEndInclusive.setDate(billEndInclusive.getDate() + 1);

      // Try statement amount first
      const statement = await CreditCardStatementModel.findOne({
        userId, accountId: card._id, dueDate: { $gte: startDate, $lt: endDate },
      }).lean();
      if (statement && (statement as any).statementAmount != null) {
        creditBills += (statement as any).statementAmount as number;
      } else {
        const agg = await RecordModel.aggregate([
          { $match: { userId, type: "expense", account: card._id, date: { $gte: billStart, $lt: billEndInclusive } } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);
        creditBills += agg[0]?.total || 0;
      }
    }
  }

  // Fixed expenses (payable + scheduled plans on physical accounts)
  const payableAgg = await RecordModel.aggregate([
    { $match: { userId, type: "payable", date: { $gte: startDate, $lt: endDate }, account: { $nin: excludedAccountIds } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const scheduledAgg = await RecordModel.aggregate([
    { $match: { userId, planId: { $ne: null }, paymentStatus: "scheduled", type: { $ne: "payable" }, date: { $gte: startDate, $lt: endDate }, account: { $nin: [...excludedAccountIds, ...creditAccountIds] } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const fixed = (payableAgg[0]?.total || 0) + (scheduledAgg[0]?.total || 0);

  return income - direct - creditBills - fixed;
}

// Helper: compute actual opening balance from account records
async function computeActualOpening(
  userId: any,
  startDate: Date,
  physicalAccounts: any[],
): Promise<number> {
  const physicalAccountIds = physicalAccounts.map(a => a._id);
  // 排除 scheduled 紀錄（未實際發生的排程）
  const notScheduled = { paymentStatus: { $ne: "scheduled" } };

  const [asAccountAgg, asToAccountAgg, feeAgg] = await Promise.all([
    RecordModel.aggregate([
      { $match: { userId, date: { $lt: startDate }, account: { $in: physicalAccountIds }, ...notScheduled } },
      { $group: { _id: { account: "$account", type: "$type" }, total: { $sum: "$amount" } } },
    ]),
    RecordModel.aggregate([
      { $match: { userId, date: { $lt: startDate }, toAccount: { $in: physicalAccountIds }, ...notScheduled } },
      { $group: { _id: { toAccount: "$toAccount", type: "$type" }, total: { $sum: "$amount" } } },
    ]),
    RecordModel.aggregate([
      { $match: { userId, date: { $lt: startDate }, account: { $in: physicalAccountIds }, fee: { $gt: 0 }, ...notScheduled } },
      { $group: { _id: "$account", totalFee: { $sum: "$fee" } } },
    ]),
  ]);

  const accountTotals: Record<string, Record<string, number>> = {};
  const toAccountTotals: Record<string, Record<string, number>> = {};
  const feeTotals: Record<string, number> = {};

  for (const row of asAccountAgg) {
    const id = row._id.account.toString();
    if (!accountTotals[id]) accountTotals[id] = {};
    accountTotals[id][row._id.type] = row.total;
  }
  for (const row of asToAccountAgg) {
    const id = row._id.toAccount.toString();
    if (!toAccountTotals[id]) toAccountTotals[id] = {};
    toAccountTotals[id][row._id.type] = row.total;
  }
  for (const row of feeAgg) {
    feeTotals[row._id.toString()] = row.totalFee;
  }

  let total = 0;
  for (const acc of physicalAccounts) {
    const id = acc._id.toString();
    const at = accountTotals[id] || {};
    const tat = toAccountTotals[id] || {};
    const fees = feeTotals[id] || 0;
    const initial = (acc as any).initialBalance || 0;
    total += initial + (at["income"] || 0) - (at["expense"] || 0) - (at["transfer"] || 0) + (tat["transfer"] || 0) - (at["payable"] || 0) + (at["receivable"] || 0) + (at["refund"] || 0) + (at["reward"] || 0) + (at["discount"] || 0) + (at["balance_adjustment"] || 0) - (at["interest"] || 0) - fees;
  }
  return Math.round(total * 100) / 100;
}

reportsRouter.get("/cashflow", async (req: Request, res: Response) => {
  try {
    const userId = toObjectId(req.userId!);
    const excludedAccountIds = await getExcludedAccountIds(userId);
    const now = new Date();
    const year = Number(req.query.year) || now.getFullYear();
    const month = Number(req.query.month) || now.getMonth() + 1;

    if (month < 1 || month > 12) {
      res.status(400).json({ success: false, error: "month must be 1-12" });
      return;
    }

    // Period: first day to last day of the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);
    const formatDate = (d: Date) => d.toISOString().slice(0, 10);

    // 1. Income: all income with individual records per category
    const rawIncomeRecords = await RecordModel.find({
      userId,
      type: "income",
      date: { $gte: startDate, $lt: endDate },
      account: { $nin: excludedAccountIds },
    }).sort({ date: 1 }).lean();

    const incomeCatMap = new Map<string, { amount: number; records: Array<{ date: string; note: string; merchant: string; subcategory: string; amount: number }> }>();
    for (const r of rawIncomeRecords) {
      const cat = r.category || "未分類";
      if (!incomeCatMap.has(cat)) incomeCatMap.set(cat, { amount: 0, records: [] });
      const entry = incomeCatMap.get(cat)!;
      entry.amount += r.amount;
      entry.records.push({ date: formatDate(r.date), note: r.note || "", merchant: r.merchant || "", subcategory: r.subcategory || "", amount: r.amount });
    }
    const incomeByCategory = Array.from(incomeCatMap.entries())
      .map(([category, { amount, records }]) => ({ category, amount, records }))
      .sort((a, b) => b.amount - a.amount);
    const totalIncome = incomeByCategory.reduce((sum, c) => sum + c.amount, 0);

    // 2. Get all accounts for later use
    const allAccounts = await AccountModel.find({ userId, includeInStats: { $ne: false } }).lean();
    const directAccountIds = allAccounts
      .filter((a) => a.type === "physical")
      .map((a) => a._id);
    const creditAccounts = allAccounts.filter((a) => a.type === "credit");

    // 2.5. Calculate opening & closing balance directly from account records
    const physicalAccounts = allAccounts.filter((a) => a.type === "physical");
    const physicalAccountIds = physicalAccounts.map((a) => a._id);

    const openingBalance = await computeActualOpening(userId, startDate, physicalAccounts);
    const computedClosing = await computeActualOpening(userId, endDate, physicalAccounts);

    // 3. Direct expenses (physical account expenses) with individual records
    const rawDirectRecords = await RecordModel.find({
      userId,
      type: "expense",
      date: { $gte: startDate, $lt: endDate },
      account: { $in: directAccountIds, $nin: excludedAccountIds },
    }).sort({ date: 1 }).lean();

    const directCatMap = new Map<string, { amount: number; records: Array<{ date: string; note: string; merchant: string; subcategory: string; amount: number }> }>();
    for (const r of rawDirectRecords) {
      const cat = r.category || "未分類";
      if (!directCatMap.has(cat)) directCatMap.set(cat, { amount: 0, records: [] });
      const entry = directCatMap.get(cat)!;
      entry.amount += r.amount;
      entry.records.push({ date: formatDate(r.date), note: r.note || "", merchant: r.merchant || "", subcategory: r.subcategory || "", amount: r.amount });
    }
    const directByCategory = Array.from(directCatMap.entries())
      .map(([category, { amount, records }]) => ({ category, amount, records }))
      .sort((a, b) => b.amount - a.amount);
    const directTotal = directByCategory.reduce((sum, c) => sum + c.amount, 0);

    // 4. Credit card bills: find cards where payDay falls in this month
    const creditCardBills: Array<{
      account: string;
      accountId: string;
      billAmount: number;
      dueDate: string;
      breakdown: {
        planItems: Array<{ name: string; category: string; subcategory: string; amount: number }>;
        planTotal: number;
        otherByCategory: Array<{ category: string; amount: number; records: Array<{ date: string; note: string; merchant: string; subcategory: string; amount: number }> }>;
        otherTotal: number;
      };
      estimated: boolean;
    }> = [];

    for (const card of creditAccounts) {
      const cardBillDay = card.billDay;
      const cardPayDay = card.payDay;
      if (!cardBillDay || !cardPayDay) continue;

      // Check if payDay falls in this month
      const dueDate = dateForDay(year, month, cardPayDay);
      if (dueDate >= startDate && dueDate < endDate) {
        // Calculate bill amount: previous billDay+1 to current billDay
        // payDay in month M covers billing period that ended on billDay of M-1
        const billEndMonth = addMonths(year, month, -1);
        const billEnd = dateForDay(billEndMonth.year, billEndMonth.month, cardBillDay);

        const billStartMonth = addMonths(billEndMonth.year, billEndMonth.month, -1);
        const billStartBase = dateForDay(billStartMonth.year, billStartMonth.month, cardBillDay);
        const billStart = new Date(billStartBase);
        billStart.setDate(billStart.getDate() + 1);

        const billEndInclusive = new Date(billEnd);
        billEndInclusive.setDate(billEndInclusive.getDate() + 1);

        // Skip if this card is excluded
        if (excludedAccountIds.some(id => id.equals(card._id))) continue;

        // Try to use confirmed statement amount first
        let billAmount: number;
        let isEstimated = false;
        const statement = await CreditCardStatementModel.findOne({
          userId,
          accountId: card._id,
          dueDate: { $gte: startDate, $lt: endDate },
        }).lean();

        if (statement && statement.statementAmount != null) {
          billAmount = statement.statementAmount as number;
        } else {
          isEstimated = true;
          // Fallback: aggregate expense records in billing period
          const billAmountResult = await RecordModel.aggregate([
            {
              $match: {
                userId,
                type: "expense",
                account: card._id,
                date: { $gte: billStart, $lt: billEndInclusive },
              },
            },
            { $group: { _id: null, total: { $sum: "$amount" } } },
          ]);
          billAmount = billAmountResult[0]?.total || 0;
        }

        // --- Breakdown: query individual records in billing period ---
        const billRecords = await RecordModel.find({
          userId,
          type: "expense",
          account: card._id,
          date: { $gte: billStart, $lt: billEndInclusive },
        }).lean();

        // Split: records with planId vs without
        const planRecords = billRecords.filter((r) => r.planId);
        const otherRecords = billRecords.filter((r) => !r.planId);

        // Fetch plan names in batch
        const planIds = [...new Set(planRecords.map((r) => r.planId!.toString()))];
        const plans = planIds.length > 0
          ? await PaymentPlanModel.find({ _id: { $in: planIds } }).lean()
          : [];
        const planMap = new Map(plans.map((p) => [p._id.toString(), p.name]));

        const planItems = planRecords.map((r) => ({
          name: planMap.get(r.planId!.toString()) || "未知方案",
          category: r.category || "未分類",
          subcategory: r.subcategory || "",
          amount: r.amount,
        }));
        const planTotal = planItems.reduce((sum, i) => sum + i.amount, 0);

        // Other records: group by category with individual records
        const otherCategoryMap = new Map<string, { amount: number; records: Array<{ date: string; note: string; merchant: string; subcategory: string; amount: number }> }>();
        for (const r of otherRecords) {
          const cat = r.category || "未分類";
          if (!otherCategoryMap.has(cat)) {
            otherCategoryMap.set(cat, { amount: 0, records: [] });
          }
          const entry = otherCategoryMap.get(cat)!;
          entry.amount += r.amount;
          entry.records.push({
            date: formatDate(r.date),
            note: r.note || "",
            merchant: r.merchant || "",
            subcategory: r.subcategory || "",
            amount: r.amount,
          });
        }
        const otherByCategory = Array.from(otherCategoryMap.entries())
          .map(([category, { amount, records }]) => ({ category, amount, records: records.sort((a, b) => a.date.localeCompare(b.date)) }))
          .sort((a, b) => b.amount - a.amount);
        const otherTotal = otherByCategory.reduce((sum, i) => sum + i.amount, 0);

        const breakdown = { planItems, planTotal, otherByCategory, otherTotal };

        creditCardBills.push({
          account: card.name,
          accountId: card._id.toString(),
          billAmount,
          dueDate: formatDate(dueDate),
          breakdown,
          estimated: isEstimated,
        });
      }
    }

    const creditBillsTotal = creditCardBills.reduce((sum, c) => sum + c.billAmount, 0);

    // 5. Fixed expenses: payable type + scheduled plan records
    const fixedExpenseRecords = await RecordModel.find({
      userId,
      type: "payable",
      date: { $gte: startDate, $lt: endDate },
      account: { $nin: excludedAccountIds },
    }).lean();

    // Credit card account IDs — plan records on credit cards follow billing cycle,
    // so exclude them here (they're already included in creditCardBills)
    const creditAccountIds = creditAccounts.map((a) => a._id);

    const scheduledPlanRecords = await RecordModel.find({
      userId,
      planId: { $ne: null },
      paymentStatus: "scheduled",
      type: { $ne: "payable" },  // exclude payable — already counted above
      date: { $gte: startDate, $lt: endDate },
      account: { $nin: [...excludedAccountIds, ...creditAccountIds] },  // exclude credit card accounts
    }).lean();

    type FixedRecord = { date: string; note: string; merchant: string; counterparty: string; amount: number };
    const fixedMap = new Map<string, { category: string; subcategory: string; amount: number; records: FixedRecord[] }>();

    const addToFixedMap = (r: any) => {
      const key = `${r.category || "應付款項"}|${r.subcategory || ""}`;
      if (!fixedMap.has(key)) {
        fixedMap.set(key, { category: r.category || "應付款項", subcategory: r.subcategory || "", amount: 0, records: [] });
      }
      const entry = fixedMap.get(key)!;
      entry.amount += r.amount;
      entry.records.push({
        date: formatDate(r.date),
        note: r.note || "",
        merchant: r.merchant || "",
        counterparty: r.counterparty || "",
        amount: r.amount,
      });
    };

    for (const r of fixedExpenseRecords) addToFixedMap(r);
    for (const r of scheduledPlanRecords) addToFixedMap(r);

    const fixedItems = Array.from(fixedMap.values())
      .map(item => ({ ...item, records: item.records.sort((a, b) => a.date.localeCompare(b.date)) }))
      .sort((a, b) => b.amount - a.amount);
    const fixedTotal = fixedItems.reduce((sum, item) => sum + item.amount, 0);

    // 6. Daily balance
    const days = daysInMonth(year, month);
    const dailyIncomeMap = new Map<number, number>();

    // Get daily income
    const dailyIncomeRaw = await RecordModel.aggregate([
      {
        $match: {
          userId,
          type: "income",
          date: { $gte: startDate, $lt: endDate },
          account: { $nin: excludedAccountIds },
        },
      },
      {
        $group: {
          _id: { $dayOfMonth: "$date" },
          total: { $sum: "$amount" },
        },
      },
    ]);
    for (const row of dailyIncomeRaw) {
      dailyIncomeMap.set(row._id, row.total);
    }

    // Get daily direct expense (physical accounts only)
    const dailyDirectExpenseRaw = await RecordModel.aggregate([
      {
        $match: {
          userId,
          type: "expense",
          date: { $gte: startDate, $lt: endDate },
          account: { $in: directAccountIds, $nin: excludedAccountIds },
        },
      },
      {
        $group: {
          _id: { $dayOfMonth: "$date" },
          total: { $sum: "$amount" },
        },
      },
    ]);
    const dailyDirectExpenseMap = new Map<number, number>();
    for (const row of dailyDirectExpenseRaw) {
      dailyDirectExpenseMap.set(row._id, row.total);
    }

    // Build dailyCreditBillMap from creditCardBills
    const dailyCreditBillMap = new Map<number, number>();
    for (const bill of creditCardBills) {
      const dayNum = new Date(bill.dueDate).getDate();
      dailyCreditBillMap.set(dayNum, (dailyCreditBillMap.get(dayNum) || 0) + bill.billAmount);
    }

    // Build dailyFixedExpenseMap from fixed expense records
    const dailyFixedExpenseMap = new Map<number, number>();
    for (const r of fixedExpenseRecords) {
      const dayNum = new Date(r.date).getDate();
      dailyFixedExpenseMap.set(dayNum, (dailyFixedExpenseMap.get(dayNum) || 0) + r.amount);
    }
    for (const r of scheduledPlanRecords) {
      const dayNum = new Date(r.date).getDate();
      dailyFixedExpenseMap.set(dayNum, (dailyFixedExpenseMap.get(dayNum) || 0) + r.amount);
    }

    // Build daily actual balance delta from ALL records on physical accounts
    // This ensures runningBalance matches actual account balances
    const dailyActualDeltaMap = new Map<number, number>();

    // All records FROM physical accounts (grouped by day)
    const dailyFromPhysRaw = await RecordModel.aggregate([
      {
        $match: {
          userId,
          date: { $gte: startDate, $lt: endDate },
          account: { $in: physicalAccountIds },
          paymentStatus: { $ne: "scheduled" },
        },
      },
      {
        $group: {
          _id: { day: { $dayOfMonth: "$date" }, type: "$type" },
          total: { $sum: "$amount" },
          totalFee: { $sum: "$fee" },
        },
      },
    ]);
    for (const row of dailyFromPhysRaw) {
      const day = row._id.day;
      const type = row._id.type;
      let delta = 0;
      if (type === "income") delta = row.total;
      else if (type === "expense" || type === "transfer" || type === "payable" || type === "interest") delta = -row.total;
      else if (["receivable", "refund", "reward", "discount", "balance_adjustment"].includes(type)) delta = row.total;
      delta -= (row.totalFee || 0);
      dailyActualDeltaMap.set(day, (dailyActualDeltaMap.get(day) || 0) + delta);
    }

    // Transfers IN to physical accounts
    const dailyToPhysRaw = await RecordModel.aggregate([
      {
        $match: {
          userId,
          type: "transfer",
          date: { $gte: startDate, $lt: endDate },
          toAccount: { $in: physicalAccountIds },
          paymentStatus: { $ne: "scheduled" },
        },
      },
      { $group: { _id: { $dayOfMonth: "$date" }, total: { $sum: "$amount" } } },
    ]);
    for (const row of dailyToPhysRaw) {
      dailyActualDeltaMap.set(row._id, (dailyActualDeltaMap.get(row._id) || 0) + row.total);
    }

    // Build daily balance array with breakdown
    let runningBalance = openingBalance;
    const dailyBalance: Array<{
      date: string;
      income: number;
      directExpense: number;
      creditBillPayment: number;
      fixedExpense: number;
      expense: number;
      net: number;
      runningBalance: number;
    }> = [];

    for (let day = 1; day <= days; day++) {
      const income = dailyIncomeMap.get(day) || 0;
      const directExpense = dailyDirectExpenseMap.get(day) || 0;
      const creditBillPayment = dailyCreditBillMap.get(day) || 0;
      const fixedExpense = dailyFixedExpenseMap.get(day) || 0;
      const expense = directExpense + creditBillPayment + fixedExpense;
      const actualDelta = dailyActualDeltaMap.get(day) || 0;
      runningBalance = Math.round((runningBalance + actualDelta) * 100) / 100;

      dailyBalance.push({
        date: `${year}-${pad(month)}-${pad(day)}`,
        income,
        directExpense,
        creditBillPayment,
        fixedExpense,
        expense,
        net: actualDelta,
        runningBalance,
      });
    }

    // 6.5. Other adjustments: balance_adjustment, interest, fees, etc. on physical accounts
    // These aren't captured by direct/creditBills/fixed but affect the actual balance
    const otherAdjRecords = await RecordModel.find({
      userId,
      type: { $in: ["balance_adjustment", "interest", "refund", "reward", "discount", "receivable"] },
      date: { $gte: startDate, $lt: endDate },
      account: { $in: physicalAccountIds },
      paymentStatus: { $ne: "scheduled" },
    }).lean();

    let adjustmentsTotal = 0;
    const adjustmentItems: Array<{ date: string; type: string; note: string; amount: number }> = [];
    for (const r of otherAdjRecords) {
      // balance_adjustment can be positive or negative
      // refund/reward/discount/receivable = positive (money in)
      // interest = negative (money out)
      let delta: number;
      if (r.type === "interest") {
        delta = -r.amount;
      } else if (r.type === "balance_adjustment") {
        delta = r.amount; // already signed correctly in the record
      } else {
        delta = r.amount; // refund, reward, discount, receivable = money in
      }
      adjustmentsTotal += delta;
      adjustmentItems.push({
        date: formatDate(r.date),
        type: r.type,
        note: r.note || "",
        amount: delta,
      });
    }

    // Also account for fees on expense/income/payable records (not counted in waterfall amounts)
    const feeRecords = await RecordModel.find({
      userId,
      date: { $gte: startDate, $lt: endDate },
      account: { $in: physicalAccountIds },
      fee: { $gt: 0 },
      paymentStatus: { $ne: "scheduled" },
    }).lean();

    for (const r of feeRecords) {
      const fee = (r as any).fee || 0;
      if (fee > 0) {
        adjustmentsTotal -= fee;
        adjustmentItems.push({
          date: formatDate(r.date),
          type: "fee",
          note: `${r.note || r.type} 手續費`,
          amount: -fee,
        });
      }
    }

    adjustmentsTotal = Math.round(adjustmentsTotal * 100) / 100;

    // 7. Closing balance from actual account balances at end of month
    const totalExpenses = directTotal + creditBillsTotal + fixedTotal;
    const closingBalance = computedClosing;
    const net = closingBalance - openingBalance;
    let status: "ok" | "tight" | "negative";
    if (net < 0) status = "negative";
    else if (totalIncome > 0 && net / totalIncome <= 0.2) status = "tight";
    else status = "ok";

    res.json({
      success: true,
      data: {
        period: {
          year,
          month,
          from: formatDate(startDate),
          to: formatDate(new Date(year, month - 1, days)),
        },
        income: {
          total: totalIncome,
          byCategory: incomeByCategory,
        },
        expenses: {
          total: totalExpenses,
          direct: {
            total: directTotal,
            byCategory: directByCategory,
          },
          creditCardBills: {
            total: creditBillsTotal,
            cards: creditCardBills,
          },
          fixed: {
            total: fixedTotal,
            items: fixedItems,
          },
          adjustments: {
            total: adjustmentsTotal,
            items: adjustmentItems,
          },
        },
        dailyBalance,
        openingBalance,
        closingBalance,
        summary: {
          totalIncome,
          totalExpenses,
          net,
          status,
          openingBalance,
          closingBalance,
        },
      },
    });
  } catch (error) {
    console.error("Cashflow report error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch cashflow report" });
  }
});
