import mongoose, { Schema } from "mongoose";

const creditCardStatementSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    billingCycleStart: { type: Date, required: true },
    billingCycleEnd: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    statementAmount: { type: Number },
    paidAmount: { type: Number },
    paidDate: { type: Date },
    status: { type: String, enum: ["pending", "confirmed", "paid"], default: "pending" },
    note: { type: String },
  },
  { timestamps: true },
);

creditCardStatementSchema.index({ userId: 1, accountId: 1, billingCycleEnd: -1 });

export const CreditCardStatementModel = mongoose.model("CreditCardStatement", creditCardStatementSchema);
