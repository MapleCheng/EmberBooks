import { apiClient } from "./client.js";

// === Types ===

export interface MonthlySummary {
  totalIncome: number;
  totalExpense: number;
  net: number;
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  subcategories?: { subcategory: string; amount: number }[];
}

export interface AccountBreakdown {
  account: string;
  expense: number;
  income: number;
}

export interface DailyTrend {
  date: string;
  expense: number;
  income: number;
}

export interface MonthlyReport {
  year: number;
  month: number;
  summary: MonthlySummary;
  byCategory: CategoryBreakdown[];
  byAccount: AccountBreakdown[];
  dailyTrend: DailyTrend[];
  recordCount: number;
}

export interface MonthlyTrend {
  month: number;
  expense: number;
  income: number;
}

export interface TopExpense {
  category: string;
  subcategory: string;
  amount: number;
}

export interface YearlyReport {
  year: number;
  summary: MonthlySummary;
  monthlyTrend: MonthlyTrend[];
  byCategory: CategoryBreakdown[];
  topExpenses: TopExpense[];
}

export interface BudgetCategory {
  category: string;
  budget: number;
  spent: number;
  remaining: number;
  percentage: number;
  status: "ok" | "warning" | "over";
}

export interface BudgetReport {
  year: number;
  month: number;
  categories: BudgetCategory[];
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
}

// === Cashflow Types ===

export interface CashflowPeriod {
  year: number;
  month: number;
  from: string;
  to: string;
}

export interface CategoryRecord {
  date: string;
  note: string;
  merchant: string;
  subcategory: string;
  amount: number;
}

export interface CashflowIncome {
  total: number;
  byCategory: Array<{ category: string; amount: number; records: CategoryRecord[] }>;
}

export interface CashflowDirectExpenses {
  total: number;
  byCategory: Array<{ category: string; amount: number; records: CategoryRecord[] }>;
}

export interface CashflowCreditCardBreakdown {
  planItems: Array<{ name: string; category: string; subcategory: string; amount: number }>;
  planTotal: number;
  otherByCategory: Array<{ category: string; amount: number; records: Array<{ date: string; note: string; merchant: string; subcategory: string; amount: number }> }>;
  otherTotal: number;
}

export interface CashflowCreditCard {
  account: string;
  accountId: string;
  billAmount: number;
  dueDate: string;
  breakdown?: CashflowCreditCardBreakdown;
  estimated?: boolean;
}

export interface CashflowCreditCardBills {
  total: number;
  cards: CashflowCreditCard[];
}

export interface FixedExpenseRecord {
  date: string;
  note: string;
  merchant: string;
  counterparty: string;
  amount: number;
}

export interface CashflowFixedExpense {
  category: string;
  subcategory: string;
  amount: number;
  records: FixedExpenseRecord[];
}

export interface CashflowFixedExpenses {
  total: number;
  items: CashflowFixedExpense[];
}

export interface CashflowExpenses {
  total: number;
  direct: CashflowDirectExpenses;
  creditCardBills: CashflowCreditCardBills;
  fixed: CashflowFixedExpenses;
  adjustments?: { total: number };
}

export interface CashflowDailyBalance {
  date: string;
  income: number;
  directExpense: number;
  creditBillPayment: number;
  fixedExpense: number;
  expense: number;
  net: number;
  runningBalance: number;
}

export interface CashflowSummary {
  totalIncome: number;
  totalExpenses: number;
  net: number;
  status: "ok" | "tight" | "negative";
  openingBalance: number;
  closingBalance: number;
}

export interface CashflowReport {
  period: CashflowPeriod;
  income: CashflowIncome;
  expenses: CashflowExpenses;
  dailyBalance: CashflowDailyBalance[];
  openingBalance: number;
  closingBalance: number;
  summary: CashflowSummary;
}

// === API Functions ===

export function fetchMonthlyReport(year: number, month: number): Promise<MonthlyReport> {
  return apiClient<MonthlyReport>(`/reports/monthly?year=${year}&month=${month}`);
}

export function fetchYearlyReport(year: number): Promise<YearlyReport> {
  return apiClient<YearlyReport>(`/reports/yearly?year=${year}`);
}

export function fetchCategoryTrend(category: string, from: string, to: string): Promise<DailyTrend[]> {
  return apiClient<DailyTrend[]>(`/reports/category-trend?category=${encodeURIComponent(category)}&from=${from}&to=${to}`);
}

export function fetchBudgetReport(): Promise<BudgetReport> {
  return apiClient<BudgetReport>("/reports/budget");
}

export function fetchCashflowReport(year: number, month: number): Promise<CashflowReport> {
  return apiClient<CashflowReport>(`/reports/cashflow?year=${year}&month=${month}`);
}
