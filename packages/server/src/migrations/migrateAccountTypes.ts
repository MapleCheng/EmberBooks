import { AccountModel } from "../models/Account.js";

const TYPE_MIGRATION_MAP: Record<string, { type: string; group: string }> = {
  bank: { type: "physical", group: "🏦 銀行帳戶" },
  cash: { type: "physical", group: "💵 現金" },
  ewallet: { type: "physical", group: "📱 電子錢包" },
  investment: { type: "physical", group: "📈 投資帳戶" },
  credit: { type: "credit", group: "💳 信用卡" },
};

export async function migrateAccountTypes(): Promise<void> {
  const oldTypes = Object.keys(TYPE_MIGRATION_MAP);

  // Find accounts with old type values
  const accounts = await AccountModel.find({ type: { $in: oldTypes } });

  if (accounts.length === 0) {
    console.log("✅ Account type migration: no legacy accounts found, skipping.");
    return;
  }

  console.log(`🔄 Migrating ${accounts.length} accounts to new type/group schema...`);

  for (const account of accounts) {
    const mapping = TYPE_MIGRATION_MAP[account.type as string];
    if (mapping) {
      await AccountModel.updateOne(
        { _id: account._id },
        {
          $set: {
            type: mapping.type,
            group: mapping.group,
            includeInStats: true,
          },
        },
      );
    }
  }

  console.log(`✅ Account type migration complete: ${accounts.length} accounts updated.`);
}
