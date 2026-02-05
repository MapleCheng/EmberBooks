import { Router, Request, Response } from "express";
import { PaymentPlanModel } from "../models/PaymentPlan.js";
import { RecordModel } from "../models/Record.js";
import { authMiddleware } from "../middleware/auth.js";

export const plansRouter = Router();
plansRouter.use(authMiddleware);

// ─── POST /api/plans/generate-records ──────────────────────────
plansRouter.post("/generate-records", async (req: Request, res: Response) => {
  try {
    const plans = await PaymentPlanModel.find({ userId: req.userId, status: "active" });
    let totalCreated = 0;
    const details: { planId: string; planName: string; recordsCreated: number }[] = [];
    
    for (const plan of plans) {
      const created = await generateMissingRecordsForPlan(plan);
      totalCreated += created;
      if (created > 0) {
        details.push({ planId: String(plan._id), planName: plan.name, recordsCreated: created });
      }
    }
    
    res.json({ success: true, data: { totalCreated, details } });
  } catch (error) {
    console.error("Generate records error:", error);
    res.status(500).json({ success: false, error: "Failed to generate records" });
  }
});

// ─── Helpers ───────────────────────────────────────────────────

/** Calculate the date for a given period index based on start date and frequency */
function calcPeriodDate(startDate: Date, periodIndex: number, frequency: string, paymentDay: number): Date {
  const d = new Date(startDate);
  const offset = periodIndex; // 0-based: period 0 = startDate

  switch (frequency) {
    case "weekly":
      d.setDate(d.getDate() + offset * 7);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + offset);
      break;
    case "monthly":
    default: {
      let month = d.getMonth() + offset;
      let year = d.getFullYear();
      year += Math.floor(month / 12);
      month = month % 12;
      const maxDay = new Date(year, month + 1, 0).getDate();
      d.setFullYear(year);
      d.setMonth(month);
      d.setDate(Math.min(paymentDay, maxDay));
      break;
    }
  }
  return d;
}

/** Generate records for a plan */
async function generateRecords(
  plan: { _id: unknown; userId: unknown; name: string; type: string; amount: number; totalPeriods: number; frequency: string; paymentDay: number; startDate: Date; accountId: unknown; category: string; subcategory?: string; counterparty?: string },
  startPeriod: number = 0,
  count?: number,
): Promise<unknown[]> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const periodsToGenerate = count || plan.totalPeriods;
  const records = [];

  for (let i = 0; i < periodsToGenerate; i++) {
    const periodIndex = startPeriod + i;
    const date = calcPeriodDate(plan.startDate, periodIndex, plan.frequency, plan.paymentDay);
    const isPast = date <= today;

    const notePrefix = plan.type === "installment"
      ? `[分期 ${periodIndex}/${plan.totalPeriods}] ${plan.name}`
      : `[循環] ${plan.name}`;

    records.push({
      userId: plan.userId,
      type: plan.type === "installment" ? "payable" : "expense",
      amount: plan.amount,
      category: plan.category,
      subcategory: plan.subcategory || undefined,
      date,
      billingDate: date,
      note: notePrefix,
      account: plan.accountId,
      counterparty: plan.counterparty || undefined,
      recurring: true,
      planId: plan._id,
      periodIndex,
      paymentStatus: isPast ? "confirmed" : "scheduled",
    });
  }

  const created = await RecordModel.insertMany(records);
  return created;
}

/** Calculate how many periods a plan should have */
function calcTotalPeriods(plan: { type: string; totalPeriods?: number | null; startDate: Date; frequency: string }): number {
  // installment or recurring with explicit totalPeriods
  if (plan.totalPeriods && plan.totalPeriods > 0) return plan.totalPeriods;
  
  // recurring without totalPeriods: generate from startDate to now + 12 months
  const now = new Date();
  const futureLimit = new Date(now.getFullYear(), now.getMonth() + 12, now.getDate());
  const start = new Date(plan.startDate);
  
  let periods = 0;
  switch (plan.frequency) {
    case "weekly": {
      const diffMs = futureLimit.getTime() - start.getTime();
      periods = Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000));
      break;
    }
    case "yearly": {
      periods = futureLimit.getFullYear() - start.getFullYear() + 1;
      break;
    }
    case "monthly":
    default: {
      periods = (futureLimit.getFullYear() - start.getFullYear()) * 12 + (futureLimit.getMonth() - start.getMonth()) + 1;
      break;
    }
  }
  return Math.max(periods, 1);
}

/** Generate only missing records for a single plan (idempotent) */
async function generateMissingRecordsForPlan(plan: InstanceType<typeof PaymentPlanModel>): Promise<number> {
  const totalPeriods = calcTotalPeriods(plan);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // All expected periodIndexes: 0 to totalPeriods-1 (0-based)
  const allIndexes = Array.from({ length: totalPeriods }, (_, i) => i);
  
  // Find existing records for this plan
  const existingRecords = await RecordModel.find(
    { planId: plan._id },
    { periodIndex: 1 }
  ).lean();
  const existingIndexes = new Set(existingRecords.map(r => r.periodIndex));
  
  // Find missing indexes
  const missingIndexes = allIndexes.filter(idx => !existingIndexes.has(idx));
  
  if (missingIndexes.length === 0) return 0;
  
  const records = missingIndexes.map(periodIndex => {
    const date = calcPeriodDate(plan.startDate, periodIndex, plan.frequency, plan.paymentDay);
    const isPast = date <= today;
    
    const notePrefix = plan.type === "installment"
      ? `[分期 ${periodIndex}/${totalPeriods}] ${plan.name}`
      : `[循環] ${plan.name}`;
    
    return {
      userId: plan.userId,
      type: plan.category === "應付款項" ? "payable" : "expense",
      amount: plan.amount,
      category: plan.category,
      subcategory: plan.subcategory || undefined,
      date,
      billingDate: date,
      note: notePrefix,
      account: plan.accountId,
      counterparty: plan.counterparty || undefined,
      recurring: plan.type === "recurring",
      planId: plan._id,
      periodIndex,
      paymentStatus: isPast ? "confirmed" : "scheduled",
      tags: [],
      fee: 0,
      discount: 0,
    };
  });
  
  try {
    await RecordModel.insertMany(records, { ordered: false });
  } catch (err: unknown) {
    // 忽略 duplicate key error（E11000），其他錯誤仍然拋出
    if (
      !(err instanceof Error) ||
      !("code" in err && (err as Record<string, unknown>).code === 11000)
    ) {
      throw err;
    }
  }
  return records.length;
}

// ─── GET /api/plans ────────────────────────────────────────────
plansRouter.get("/", async (req: Request, res: Response) => {
  try {
    const filter: Record<string, unknown> = { userId: req.userId };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type) filter.type = req.query.type;

    const items = await PaymentPlanModel.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (error) {
    console.error("Fetch plans error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch plans" });
  }
});

// ─── POST /api/plans ───────────────────────────────────────────
plansRouter.post("/", async (req: Request, res: Response) => {
  try {
    const {
      name, type, amount, totalPeriods: inputTotalPeriods, frequency, paymentDay,
      startDate, accountId, category, subcategory, counterparty, note,
    } = req.body;

    // recurring defaults to 12 periods
    const totalPeriods = type === "recurring" ? (inputTotalPeriods || 12) : inputTotalPeriods;

    const planData: Record<string, unknown> = {
      userId: req.userId,
      name,
      type,
      amount,
      totalPeriods,
      frequency: frequency || "monthly",
      paymentDay,
      startDate: new Date(startDate),
      accountId,
      category,
      subcategory,
      counterparty,
      note,
      status: "active",
    };

    // Installment: calculate totalAmount
    if (type === "installment") {
      planData.totalAmount = amount * totalPeriods;
    }

    const plan = await PaymentPlanModel.create(planData);

    // Generate all period records (idempotent)
    const recordsCreated = await generateMissingRecordsForPlan(plan);

    res.status(201).json({ success: true, data: { plan, recordsCreated } });
  } catch (error) {
    console.error("Create plan error:", error);
    res.status(500).json({ success: false, error: "Failed to create plan" });
  }
});

// ─── GET /api/plans/:id ────────────────────────────────────────
plansRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const plan = await PaymentPlanModel.findOne({ _id: req.params.id, userId: req.userId });
    if (!plan) {
      res.status(404).json({ success: false, error: "Plan not found" });
      return;
    }

    const records = await RecordModel.find({ planId: plan._id })
      .sort({ periodIndex: 1 })
      .lean();

    // Calculate summary
    const paidRecords = records.filter((r) => r.paymentStatus === "confirmed");
    const scheduledRecords = records.filter((r) => r.paymentStatus === "scheduled");

    const paidAmount = paidRecords.reduce((s, r) => s + r.amount, 0);
    const scheduledAmount = scheduledRecords.reduce((s, r) => s + r.amount, 0);
    const totalAmount = plan.totalAmount || (plan.amount * (plan.totalPeriods || records.length));
    const unpaidAmount = totalAmount - paidAmount;

    const summary = {
      totalPeriods: plan.totalPeriods || records.length,
      paidCount: paidRecords.length,
      scheduledCount: scheduledRecords.length,
      remainingCount: scheduledRecords.length,
      paidAmount,
      scheduledAmount,
      totalAmount,
      unpaidAmount: Math.max(unpaidAmount, 0),
    };

    res.json({ success: true, data: { plan, records, summary } });
  } catch (error) {
    console.error("Fetch plan detail error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch plan detail" });
  }
});

// ─── PUT /api/plans/:id ────────────────────────────────────────
plansRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const allowedFields = [
      "name", "accountId", "category", "subcategory",
      "counterparty", "note", "status",
    ];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const plan = await PaymentPlanModel.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      updates,
      { new: true },
    );
    if (!plan) {
      res.status(404).json({ success: false, error: "Plan not found" });
      return;
    }
    
    // Re-generate missing records after update
    await generateMissingRecordsForPlan(plan);
    
    res.json({ success: true, data: plan });
  } catch (error) {
    console.error("Update plan error:", error);
    res.status(500).json({ success: false, error: "Failed to update plan" });
  }
});

// ─── DELETE /api/plans/:id ─────────────────────────────────────
plansRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const plan = await PaymentPlanModel.findOne({ _id: req.params.id, userId: req.userId });
    if (!plan) {
      res.status(404).json({ success: false, error: "Plan not found" });
      return;
    }

    // Delete only scheduled records; keep confirmed ones
    const deleteResult = await RecordModel.deleteMany({
      planId: plan._id,
      paymentStatus: "scheduled",
    });

    // Clear planId from confirmed records so they become standalone
    await RecordModel.updateMany(
      { planId: plan._id, paymentStatus: "confirmed" },
      { $set: { planId: null } },
    );

    await PaymentPlanModel.deleteOne({ _id: plan._id });

    res.json({
      success: true,
      data: {
        deletedPlan: plan.name,
        deletedScheduledRecords: deleteResult.deletedCount,
      },
    });
  } catch (error) {
    console.error("Delete plan error:", error);
    res.status(500).json({ success: false, error: "Failed to delete plan" });
  }
});

// ─── POST /api/plans/:id/extend ────────────────────────────────
plansRouter.post("/:id/extend", async (req: Request, res: Response) => {
  try {
    const plan = await PaymentPlanModel.findOne({ _id: req.params.id, userId: req.userId });
    if (!plan) {
      res.status(404).json({ success: false, error: "Plan not found" });
      return;
    }

    if (plan.type !== "recurring") {
      res.status(400).json({ success: false, error: "Only recurring plans can be extended" });
      return;
    }

    // Update plan totalPeriods
    const extensionPeriods = 12;
    plan.totalPeriods = (plan.totalPeriods || 0) + extensionPeriods;
    await plan.save();

    // Generate missing records (idempotent)
    const recordsCreated = await generateMissingRecordsForPlan(plan);

    res.json({
      success: true,
      data: {
        newTotalPeriods: plan.totalPeriods,
        newRecords: recordsCreated,
      },
    });
  } catch (error) {
    console.error("Extend plan error:", error);
    res.status(500).json({ success: false, error: "Failed to extend plan" });
  }
});

// ─── PUT /api/plans/:id/records/:recordId ──────────────────────
plansRouter.put("/:id/records/:recordId", async (req: Request, res: Response) => {
  try {
    const allowedFields = ["amount", "date", "billingDate", "paymentStatus", "note"];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = (field === "date" || field === "billingDate") ? new Date(req.body[field]) : req.body[field];
      }
    }
    // 如果修改了 date 但沒有指定 billingDate，billingDate 同步更新
    if (updates.date !== undefined && updates.billingDate === undefined) {
      updates.billingDate = updates.date;
    }

    const record = await RecordModel.findOneAndUpdate(
      {
        _id: req.params.recordId,
        planId: req.params.id,
        userId: req.userId,
      },
      updates,
      { new: true },
    );

    if (!record) {
      res.status(404).json({ success: false, error: "Record not found" });
      return;
    }

    res.json({ success: true, data: record });
  } catch (error) {
    console.error("Update plan record error:", error);
    res.status(500).json({ success: false, error: "Failed to update record" });
  }
});

// ─── POST /api/plans/:id/records/:recordId/confirm ─────────────
plansRouter.post("/:id/records/:recordId/confirm", async (req: Request, res: Response) => {
  try {
    const record = await RecordModel.findOneAndUpdate(
      {
        _id: req.params.recordId,
        planId: req.params.id,
        userId: req.userId,
      },
      { paymentStatus: "confirmed" },
      { new: true },
    );

    if (!record) {
      res.status(404).json({ success: false, error: "Record not found" });
      return;
    }

    // Check if all periods are now confirmed/skipped → mark plan as completed
    const plan = await PaymentPlanModel.findById(req.params.id);
    if (plan && plan.type === "installment") {
      const scheduledCount = await RecordModel.countDocuments({
        planId: plan._id,
        paymentStatus: "scheduled",
      });
      if (scheduledCount === 0) {
        plan.status = "completed";
        await plan.save();
      }
    }

    res.json({ success: true, data: record });
  } catch (error) {
    console.error("Confirm record error:", error);
    res.status(500).json({ success: false, error: "Failed to confirm record" });
  }
});

// ─── DELETE /api/plans/:id/records/:recordId ───────────────────
plansRouter.delete("/:id/records/:recordId", async (req: Request, res: Response) => {
  try {
    const record = await RecordModel.findOneAndDelete({
      _id: req.params.recordId,
      planId: req.params.id,
      userId: req.userId,
    });

    if (!record) {
      res.status(404).json({ success: false, error: "Record not found" });
      return;
    }

    res.json({ success: true, data: record });
  } catch (error) {
    console.error("Delete plan record error:", error);
    res.status(500).json({ success: false, error: "Failed to delete record" });
  }
});

// ─── POST /api/plans/:id/records ───────────────────────────────
plansRouter.post("/:id/records", async (req: Request, res: Response) => {
  try {
    const plan = await PaymentPlanModel.findOne({ _id: req.params.id, userId: req.userId });
    if (!plan) {
      res.status(404).json({ success: false, error: "Plan not found" });
      return;
    }

    // Find max existing periodIndex
    const lastRecord = await RecordModel.findOne({ planId: plan._id })
      .sort({ periodIndex: -1 })
      .lean();
    const nextIndex = (lastRecord?.periodIndex ?? -1) + 1;

    const { amount, date } = req.body;
    const recordAmount = amount ?? plan.amount;
    const recordDate = date ? new Date(date) : calcPeriodDate(plan.startDate, nextIndex, plan.frequency, plan.paymentDay);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const isPast = recordDate <= today;

    const notePrefix = plan.type === "installment"
      ? `[分期 ${nextIndex}/${plan.totalPeriods || "?"}] ${plan.name}`
      : `[循環] ${plan.name}`;

    const record = await RecordModel.create({
      userId: req.userId,
      type: plan.type === "installment" ? "payable" : "expense",
      amount: recordAmount,
      category: plan.category,
      subcategory: plan.subcategory || undefined,
      date: recordDate,
      billingDate: recordDate,
      note: notePrefix,
      account: plan.accountId,
      counterparty: plan.counterparty || undefined,
      recurring: plan.type === "recurring",
      planId: plan._id,
      periodIndex: nextIndex,
      paymentStatus: isPast ? "confirmed" : "scheduled",
    });

    // Update plan totalPeriods if needed
    if (plan.totalPeriods && nextIndex >= plan.totalPeriods) {
      plan.totalPeriods = nextIndex + 1;
      if (plan.type === "installment") {
        plan.totalAmount = plan.amount * plan.totalPeriods;
      }
      await plan.save();
    }

    res.status(201).json({ success: true, data: record });
  } catch (error) {
    console.error("Add plan record error:", error);
    res.status(500).json({ success: false, error: "Failed to add record" });
  }
});
