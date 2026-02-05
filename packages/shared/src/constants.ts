import type { AccountType } from "./types.js";

export const ACCOUNT_TYPES: AccountType[] = ["physical", "credit"];

export const DEFAULT_ACCOUNT_GROUPS: Record<string, { type: AccountType; group: string }> = {
  bank: { type: "physical", group: "🏦 銀行帳戶" },
  cash: { type: "physical", group: "💵 現金" },
  ewallet: { type: "physical", group: "📱 電子錢包" },
  investment: { type: "physical", group: "📈 投資帳戶" },
  credit: { type: "credit", group: "💳 信用卡" },
};

export const RECORD_TYPES = [
  "expense", "income", "transfer", "receivable", "payable",
  "balance_adjustment", "refund", "interest", "reward", "discount",
] as const;

export const DEFAULT_CATEGORIES: Array<{
  name: string;
  icon: string;
  type: string;
  subcategories: string[];
}> = [
  { name: "餐飲", icon: "🍽️", type: "expense", subcategories: ["早餐", "午餐", "晚餐", "飲料", "點心"] },
  { name: "交通", icon: "🚗", type: "expense", subcategories: ["公車", "捷運", "計程車", "停車費", "加油"] },
  { name: "購物", icon: "🛒", type: "expense", subcategories: ["日用品", "衣物", "3C", "書籍"] },
  { name: "娛樂", icon: "🎮", type: "expense", subcategories: ["電影", "遊戲", "旅遊", "運動"] },
  { name: "居住", icon: "🏠", type: "expense", subcategories: ["房租", "水電", "網路", "管理費"] },
  { name: "醫療", icon: "🏥", type: "expense", subcategories: ["看診", "藥品", "保健"] },
  { name: "教育", icon: "📚", type: "expense", subcategories: ["學費", "課程", "考試"] },
  { name: "薪資", icon: "💰", type: "income", subcategories: ["正職", "兼職", "獎金"] },
  { name: "投資", icon: "📈", type: "income", subcategories: ["股票", "利息", "股利"] },
  { name: "其他收入", icon: "💵", type: "income", subcategories: ["禮金", "退款", "中獎"] },
  { name: "其他支出", icon: "📦", type: "expense", subcategories: [] },
  { name: "轉帳", icon: "🔄", type: "transfer", subcategories: ["轉帳"] },
  { name: "信用卡繳款", icon: "💳", type: "transfer", subcategories: ["信用卡繳款"] },
  { name: "應收款項", icon: "📥", type: "receivable", subcategories: [] },
  { name: "應付款項", icon: "📤", type: "payable", subcategories: [] },
  { name: "餘額調整", icon: "⚖️", type: "balance_adjustment", subcategories: ["餘額調整"] },
  { name: "利息", icon: "🏦", type: "interest", subcategories: ["利息"] },
  { name: "紅利回饋", icon: "🎁", type: "reward", subcategories: ["紅利回饋"] },
  { name: "折扣", icon: "🏷️", type: "discount", subcategories: ["折扣"] },
  { name: "退款", icon: "↩️", type: "refund", subcategories: [] },
];
