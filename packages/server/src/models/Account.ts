import mongoose, { Schema } from "mongoose";

const accountSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, enum: ["physical", "credit"], required: true },
  group: { type: String, default: "" },
  includeInStats: { type: Boolean, default: true },
  balance: { type: Number, default: 0 },
  initialBalance: { type: Number, default: 0 },
  currency: { type: String, default: "TWD" },
  creditLimit: { type: Number },
  billDay: { type: Number },
  payDay: { type: Number },
});

export const AccountModel = mongoose.model("Account", accountSchema);
