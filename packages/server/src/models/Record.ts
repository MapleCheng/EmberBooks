import mongoose, { Schema } from "mongoose";

const RECORD_TYPES = [
  "expense", "income", "transfer", "receivable", "payable",
  "balance_adjustment", "refund", "interest", "reward", "discount",
];

const recordSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: RECORD_TYPES, required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    subcategory: { type: String },
    date: { type: Date, required: true, default: Date.now },
    note: { type: String, default: "" },
    account: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    toAccount: { type: Schema.Types.ObjectId, ref: "Account" },
    fee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    merchant: { type: String },
    counterparty: { type: String },
    project: { type: String },
    tags: { type: [String], default: [] },
    recurring: { type: Boolean, default: false },
    statementId: { type: Schema.Types.ObjectId, ref: "CreditCardStatement", default: null },
    reconciled: { type: Boolean, default: false },
    billingDate: { type: Date, default: null },
    planId: { type: Schema.Types.ObjectId, ref: "PaymentPlan", default: null },
    periodIndex: { type: Number, default: null },
    paymentStatus: { type: String, enum: ["scheduled", "confirmed", "skipped"], default: null },
  },
  { timestamps: true },
);

recordSchema.index({ userId: 1, date: -1 });
recordSchema.index({ userId: 1, type: 1 });
recordSchema.index({ userId: 1, type: 1, date: -1 });
recordSchema.index({ userId: 1, category: 1, date: -1 });
recordSchema.index({ userId: 1, account: 1, statementId: 1 });
recordSchema.index(
  { planId: 1, periodIndex: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { planId: { $exists: true, $ne: null } },
  },
);

export const RecordModel = mongoose.model("Record", recordSchema);
