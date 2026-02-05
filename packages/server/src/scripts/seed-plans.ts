import mongoose from "mongoose";
import dotenv from "dotenv";
import { PaymentPlanModel } from "../models/PaymentPlan.js";
import { RecordModel } from "../models/Record.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/ember-books";
const USER_ID = process.env.SEED_USER_ID || "000000000000000000000000";

interface PlanDefinition {
  plan: {
    name: string;
    type: "recurring" | "installment";
    amount: number;
    totalAmount?: number;
    totalPeriods: number;
    frequency: string;
    paymentDay: number;
    startDate: Date;
    accountName: string;
    category: string;
    subcategory: string;
    counterparty?: string;
    status: string;
  };
  recordQuery: Record<string, any>;
  recordType: "expense" | "payable";
  excludeInitialDebt?: boolean;
}

const planDefinitions: PlanDefinition[] = [
  // === Recurring (7) — type: "recurring", totalPeriods: 12 ===

  // 1. 影音串流服務
  {
    plan: {
      name: "影音串流服務",
      type: "recurring",
      amount: 299,
      totalPeriods: 12,
      frequency: "monthly",
      paymentDay: 2,
      startDate: new Date("2025-08-02"),
      accountName: "範例信用卡 A",
      category: "娛樂",
      subcategory: "影音",
      counterparty: "範例影音公司",
      status: "active",
    },
    recordType: "expense",
    recordQuery: { amount: 299, note: { $regex: "影音串流服務", $options: "i" } },
  },
  // 2. 雲端儲存服務
  {
    plan: {
      name: "雲端儲存服務",
      type: "recurring",
      amount: 100,
      totalPeriods: 12,
      frequency: "monthly",
      paymentDay: 18,
      startDate: new Date("2025-08-18"),
      accountName: "範例信用卡 A",
      category: "購物",
      subcategory: "應用軟體",
      counterparty: "範例科技公司",
      status: "active",
    },
    recordType: "expense",
    recordQuery: { amount: 100, note: { $regex: "雲端儲存服務", $options: "i" } },
  },
  // 3. 線上學習平台
  {
    plan: {
      name: "線上學習平台",
      type: "recurring",
      amount: 200,
      totalPeriods: 12,
      frequency: "monthly",
      paymentDay: 27,
      startDate: new Date("2025-07-27"),
      accountName: "範例信用卡 A",
      category: "娛樂",
      subcategory: "影音",
      counterparty: "範例科技公司",
      status: "active",
    },
    recordType: "expense",
    recordQuery: { amount: 200, note: { $regex: "線上學習平台", $options: "i" } },
  },
  // 4. 音樂串流服務
  {
    plan: {
      name: "音樂串流服務",
      type: "recurring",
      amount: 149,
      totalPeriods: 12,
      frequency: "monthly",
      paymentDay: 6,
      startDate: new Date("2025-09-06"),
      accountName: "範例信用卡 A",
      category: "娛樂",
      subcategory: "音樂",
      counterparty: "範例音樂公司",
      status: "active",
    },
    recordType: "expense",
    recordQuery: { amount: 149, merchant: "範例音樂公司" },
  },
  // 5. 健身房月費
  {
    plan: {
      name: "健身房月費",
      type: "recurring",
      amount: 999,
      totalPeriods: 12,
      frequency: "monthly",
      paymentDay: 25,
      startDate: new Date("2025-07-25"),
      accountName: "範例信用卡 B",
      category: "娛樂",
      subcategory: "健身",
      counterparty: "範例健身房",
      status: "active",
    },
    recordType: "expense",
    recordQuery: { amount: 999, merchant: "範例健身房", note: { $regex: "月費", $options: "i" } },
  },
  // 6. 電信通話費
  {
    plan: {
      name: "電信通話費",
      type: "recurring",
      amount: 500,
      totalPeriods: 12,
      frequency: "monthly",
      paymentDay: 21,
      startDate: new Date("2025-08-21"),
      accountName: "範例信用卡 A",
      category: "個人",
      subcategory: "通話費",
      counterparty: "範例電信",
      status: "active",
    },
    recordType: "expense",
    recordQuery: { amount: 500, merchant: "範例電信", category: "個人" },
  },
  // 7. 寬頻網路費
  {
    plan: {
      name: "寬頻網路費",
      type: "recurring",
      amount: 800,
      totalPeriods: 12,
      frequency: "monthly",
      paymentDay: 20,
      startDate: new Date("2025-08-20"),
      accountName: "範例信用卡 A",
      category: "家居",
      subcategory: "網路費",
      counterparty: "範例電信",
      status: "active",
    },
    recordType: "expense",
    recordQuery: { amount: 800, merchant: "範例電信", category: "家居" },
  },

  // === Installment (4) — type: "installment" ===

  // 8. 筆電分期
  {
    plan: {
      name: "筆電分期",
      type: "installment",
      amount: 3000,
      totalAmount: 36000,
      totalPeriods: 12,
      frequency: "monthly",
      paymentDay: 6,
      startDate: new Date("2025-08-06"),
      accountName: "範例信用卡 B",
      category: "購物",
      subcategory: "電子產品",
      status: "active",
    },
    recordType: "expense",
    recordQuery: { amount: 3000, note: { $regex: "筆電", $options: "i" } },
  },
  // 9. 範例保險 A
  {
    plan: {
      name: "範例保險 A",
      type: "installment",
      amount: 3000,
      totalAmount: 30000,
      totalPeriods: 10,
      frequency: "monthly",
      paymentDay: 24,
      startDate: new Date("2025-08-24"),
      accountName: "範例信用卡 A",
      category: "個人",
      subcategory: "保險",
      counterparty: "範例保險公司",
      status: "active",
    },
    recordType: "expense",
    recordQuery: { amount: 3000, merchant: "範例保險公司" },
  },
  // 10. 範例保險 B
  {
    plan: {
      name: "範例保險 B",
      type: "installment",
      amount: 2500,
      totalAmount: 22500,
      totalPeriods: 9,
      frequency: "monthly",
      paymentDay: 24,
      startDate: new Date("2025-08-24"),
      accountName: "範例信用卡 A",
      category: "個人",
      subcategory: "保險",
      counterparty: "範例保險公司",
      status: "active",
    },
    recordType: "expense",
    recordQuery: { amount: 2500, merchant: "範例保險公司" },
  },
  // 11. 健身器材分期 — DO NOT filter by amount (amounts vary)
  {
    plan: {
      name: "健身器材分期",
      type: "installment",
      amount: 2000,
      totalAmount: 16000,
      totalPeriods: 8,
      frequency: "monthly",
      paymentDay: 24,
      startDate: new Date("2025-08-24"),
      accountName: "範例信用卡 A",
      category: "娛樂",
      subcategory: "健身",
      counterparty: "範例健身房",
      status: "active",
    },
    recordType: "expense",
    // Use category + subcategory + account only (no amount filter!)
    recordQuery: { category: "娛樂", subcategory: "健身" },
  },

  // === Payable Installment (3) — type: "installment", recordType: "payable" ===

  // 12. 朋友借入
  {
    plan: {
      name: "朋友借入",
      type: "installment",
      amount: 10000,
      totalAmount: 120000,
      totalPeriods: 12,
      frequency: "monthly",
      paymentDay: 5,
      startDate: new Date("2025-08-05"),
      accountName: "範例銀行 A",
      category: "應付款項",
      subcategory: "借入",
      counterparty: "朋友 A",
      status: "active",
    },
    recordType: "payable",
    excludeInitialDebt: true,
    recordQuery: { counterparty: "朋友 A", amount: 10000 },
  },
  // 13. 車貸 A
  {
    plan: {
      name: "車貸 A",
      type: "installment",
      amount: 3000,
      totalAmount: 36000,
      totalPeriods: 12,
      frequency: "monthly",
      paymentDay: 5,
      startDate: new Date("2025-08-04"),
      accountName: "範例銀行 B",
      category: "應付款項",
      subcategory: "車貸",
      counterparty: "範例金融 A",
      status: "active",
    },
    recordType: "payable",
    excludeInitialDebt: true,
    recordQuery: { counterparty: "範例金融 A", amount: 3000 },
  },
  // 14. 車貸 B
  {
    plan: {
      name: "車貸 B",
      type: "installment",
      amount: 12000,
      totalAmount: 696000,
      totalPeriods: 58,
      frequency: "monthly",
      paymentDay: 5,
      startDate: new Date("2025-08-05"),
      accountName: "範例銀行 C",
      category: "應付款項",
      subcategory: "車貸",
      counterparty: "範例金融 B",
      status: "active",
    },
    recordType: "payable",
    excludeInitialDebt: true,
    recordQuery: { counterparty: "範例金融 B", amount: 12000 },
  },
];

async function seedPlans() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDB 已連線");

    const userObjectId = new mongoose.Types.ObjectId(USER_ID);

    // Step 1: Clear existing data
    console.log("\n🧹 清空現有資料...");
    const deletedPlans = await PaymentPlanModel.deleteMany({ userId: userObjectId });
    console.log(`   刪除 ${deletedPlans.deletedCount} 個 PaymentPlan`);

    const clearedRecords = await RecordModel.updateMany(
      { userId: userObjectId, planId: { $ne: null } },
      { $set: { planId: null, periodIndex: null } },
    );
    console.log(`   清除 ${clearedRecords.modifiedCount} 筆 Record 的 planId/periodIndex`);

    // Step 2: Resolve account IDs dynamically
    console.log("\n🔍 查詢帳戶 ID...");
    const accountNames = [...new Set(planDefinitions.map((d) => d.plan.accountName))];
    const db = mongoose.connection.db!;
    const accounts = await db
      .collection("accounts")
      .find({ userId: userObjectId, name: { $in: accountNames } })
      .toArray();

    const accountMap = new Map<string, mongoose.Types.ObjectId>();
    for (const acc of accounts) {
      accountMap.set(acc.name, acc._id);
      console.log(`   ${acc.name}: ${acc._id}`);
    }

    // Verify all accounts found
    for (const name of accountNames) {
      if (!accountMap.has(name)) {
        throw new Error(`帳戶 "${name}" 不存在！`);
      }
    }

    // Step 3: Create plans and bind records
    console.log("\n📋 建立計劃並綁定記錄...");
    let totalPlansCreated = 0;
    let totalRecordsLinked = 0;

    for (const def of planDefinitions) {
      const { plan, recordQuery, recordType, excludeInitialDebt } = def;
      const accountId = accountMap.get(plan.accountName)!;

      // Create the plan (omit accountName, add accountId)
      const { accountName, ...planData } = plan;
      const createdPlan = await PaymentPlanModel.create({
        ...planData,
        userId: userObjectId,
        accountId,
      });
      totalPlansCreated++;

      // Build record query
      const query: Record<string, any> = {
        userId: userObjectId,
        type: recordType,
        ...recordQuery,
      };

      // For expense records, also filter by account
      if (recordType === "expense") {
        query.account = accountId;
      }

      // Find matching records
      let records = await RecordModel.find(query).sort({ date: 1 });

      // Exclude initial debt records for payable plans
      // (records where amount equals plan.totalAmount are debt creation, not repayment)
      if (excludeInitialDebt && plan.totalAmount) {
        records = records.filter((r) => r.amount !== plan.totalAmount);
      }

      // Bind records
      let linkedCount = 0;
      for (let i = 0; i < records.length; i++) {
        await RecordModel.updateOne(
          { _id: records[i]._id },
          { planId: createdPlan._id, periodIndex: i },
        );
        linkedCount++;
      }

      totalRecordsLinked += linkedCount;
      console.log(`   ✅ ${plan.name}: 綁定 ${linkedCount} 筆記錄`);
    }

    // Print summary
    console.log("\n📊 總統計:");
    console.log(`   計劃建立: ${totalPlansCreated} 個`);
    console.log(`   記錄綁定: ${totalRecordsLinked} 筆`);

    await mongoose.disconnect();
    console.log("\n✅ 完成");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seed 失敗:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedPlans();
