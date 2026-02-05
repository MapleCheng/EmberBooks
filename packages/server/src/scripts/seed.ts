import mongoose from "mongoose";
import dotenv from "dotenv";
import { UserModel } from "../models/User.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/ember-books";

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDB 已連線");

    const existing = await UserModel.findOne({ email: "admin@emberbooks.local" });
    if (existing) {
      console.log("⚠️  使用者已存在:");
      console.log(`   userId: ${existing._id}`);
      console.log(`   email: ${existing.email}`);
      console.log(`   name: ${existing.name}`);
    } else {
      const user = await UserModel.create({
        email: "admin@emberbooks.local",
        password: "changeme",
        name: "Maple",
      });
      console.log("✅ 使用者已建立:");
      console.log(`   userId: ${user._id}`);
      console.log(`   email: ${user.email}`);
      console.log(`   name: ${user.name}`);
    }

    await mongoose.disconnect();
    console.log("✅ 完成");
  } catch (error) {
    console.error("❌ Seed 失敗:", error);
    process.exit(1);
  }
}

seed();
