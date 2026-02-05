import mongoose, { Schema } from "mongoose";

const categorySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true },
  icon: { type: String, default: "📁" },
  type: { type: String, required: true },
  subcategories: { type: [String], default: [] },
  budget: { type: Number },
});

export const CategoryModel = mongoose.model("Category", categorySchema);
