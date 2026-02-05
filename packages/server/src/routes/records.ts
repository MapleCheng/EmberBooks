import { Router } from "express";
import { RecordModel } from "../models/Record.js";
import { authMiddleware } from "../middleware/auth.js";

export const recordsRouter = Router();
recordsRouter.use(authMiddleware);

recordsRouter.get("/", async (req, res) => {
  try {
    const filter: Record<string, unknown> = { userId: req.userId };
    if (req.query.type) filter.type = req.query.type;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.account) {
      filter.$or = [
        { account: req.query.account },
        { toAccount: req.query.account },
      ];
    }
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) (filter.date as Record<string, unknown>)["$gte"] = new Date(req.query.from as string);
      if (req.query.to) (filter.date as Record<string, unknown>)["$lte"] = new Date(req.query.to as string);
    }
    const records = await RecordModel.find(filter).sort({ date: -1 });
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch records" });
  }
});

recordsRouter.get("/:id", async (req, res) => {
  try {
    const record = await RecordModel.findOne({ _id: req.params.id, userId: req.userId });
    if (!record) { res.status(404).json({ success: false, error: "Record not found" }); return; }
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch record" });
  }
});

recordsRouter.post("/", async (req, res) => {
  try {
    const { type, amount, category, subcategory, date, billingDate, note, account, toAccount, fee, discount, merchant, counterparty, project, tags, recurring } = req.body;
    const record = await RecordModel.create({ userId: req.userId, type, amount, category, subcategory, date, billingDate: billingDate || date, note, account, toAccount, fee, discount, merchant, counterparty, project, tags, recurring });
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to create record" });
  }
});

recordsRouter.put("/:id", async (req, res) => {
  try {
    const allowedFields = ["type", "amount", "category", "subcategory", "date", "note", "account", "toAccount", "fee", "discount", "merchant", "counterparty", "project", "tags", "recurring"];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) { if (req.body[field] !== undefined) updates[field] = req.body[field]; }
    const record = await RecordModel.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, updates, { new: true });
    if (!record) { res.status(404).json({ success: false, error: "Record not found" }); return; }
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to update record" });
  }
});

recordsRouter.delete("/:id", async (req, res) => {
  try {
    const record = await RecordModel.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!record) { res.status(404).json({ success: false, error: "Record not found" }); return; }
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to delete record" });
  }
});
