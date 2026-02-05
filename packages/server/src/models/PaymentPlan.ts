import mongoose, { Schema } from "mongoose";

const PLAN_TYPES = ["installment", "recurring"];
const PLAN_FREQUENCIES = ["monthly", "yearly", "weekly"];
const PLAN_STATUSES = ["active", "completed", "paused"];

const paymentPlanSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    type: { type: String, enum: PLAN_TYPES, required: true },

    // 金額
    amount: { type: Number, required: true },
    totalAmount: { type: Number },
    totalPeriods: { type: Number, required: false },

    // 時間
    frequency: { type: String, enum: PLAN_FREQUENCIES, required: true, default: "monthly" },
    paymentDay: { type: Number, required: true, min: 1, max: 28 },
    startDate: { type: Date, required: true },

    // 帳戶與分類
    accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    category: { type: String, required: true },
    subcategory: { type: String },
    counterparty: { type: String },
    note: { type: String },

    // 狀態
    status: { type: String, enum: PLAN_STATUSES, default: "active" },
  },
  { timestamps: true },
);

paymentPlanSchema.index({ userId: 1, status: 1 });
paymentPlanSchema.index({ userId: 1, type: 1 });

export const PaymentPlanModel = mongoose.model("PaymentPlan", paymentPlanSchema);
