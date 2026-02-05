export interface IUserSettings {
  payDay: number;
}

export interface IUser {
  _id: string;
  email: string;
  name: string;
  createdAt: Date;
  settings?: IUserSettings;
}

export type RecordType =
  | "expense"
  | "income"
  | "transfer"
  | "receivable"
  | "payable"
  | "balance_adjustment"
  | "refund"
  | "interest"
  | "reward"
  | "discount";

export interface IRecord {
  _id: string;
  userId: string;
  type: RecordType;
  amount: number;
  category: string;
  subcategory?: string;
  date: Date;
  note?: string;
  account: string;
  toAccount?: string;
  fee?: number;
  discount?: number;
  merchant?: string;
  counterparty?: string;
  project?: string;
  tags?: string[];
  recurring?: boolean;
  statementId?: string;
  reconciled?: boolean;
  billingDate?: Date;
  _deferredOut?: boolean;
  _deferredIn?: boolean;
  _isPayment?: boolean;
  _isCashAdvance?: boolean;
  planId?: string;
  periodIndex?: number;
  paymentStatus?: "scheduled" | "confirmed" | "skipped";
  createdAt: Date;
  updatedAt: Date;
}

export type PlanType = "installment" | "recurring";
export type PlanStatus = "active" | "completed" | "paused";

export interface IPaymentPlan {
  _id: string;
  userId: string;
  name: string;
  type: PlanType;
  amount: number;
  totalAmount?: number;
  totalPeriods?: number;
  frequency: "monthly" | "yearly" | "weekly";
  paymentDay: number;
  startDate: Date;
  accountId: string;
  category: string;
  subcategory?: string;
  counterparty?: string;
  note?: string;
  status: PlanStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICategory {
  _id: string;
  userId: string;
  name: string;
  icon: string;
  type: string;
  subcategories: string[];
  budget?: number;
}

export interface IAccount {
  _id: string;
  userId: string;
  name: string;
  type: AccountType;
  group: string;
  includeInStats: boolean;
  balance: number;
  initialBalance?: number;
  currency?: string;
  creditLimit?: number;
  billDay?: number;
  payDay?: number;
}

export type AccountType = "physical" | "credit";
export type CategoryType = string;

export type StatementStatus = "pending" | "confirmed" | "paid";

export interface ICreditCardStatement {
  _id: string;
  userId: string;
  accountId: string;
  billingCycleStart: Date;
  billingCycleEnd: Date;
  dueDate: Date;
  statementAmount?: number;
  paidAmount?: number;
  paidDate?: Date;
  status: StatementStatus;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBillingPeriod {
  billingCycleStart: Date;
  billingCycleEnd: Date;
  records: IRecord[];
  totalAmount: number;
  status: "unreconciled" | "pending" | "confirmed";
  statementId?: string;
}

export interface IFinalizeRequest {
  accountId: string;
  billingCycleStart: Date;
  billingCycleEnd: Date;
  confirmedIds: string[];
  deferredIds: string[];
}
