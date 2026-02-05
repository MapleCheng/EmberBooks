import type { ICreditCardStatement, IRecord, IBillingPeriod } from "@ember-books/shared";
import { apiClient } from "./client.js";

// Extended statement type with dynamic fields from server
export interface EnrichedStatement extends ICreditCardStatement {
  confirmedTotal: number;
  difference: number;
}

export function fetchStatements(accountId?: string, status?: string): Promise<EnrichedStatement[]> {
  const params = new URLSearchParams();
  if (accountId) params.set("accountId", accountId);
  if (status) params.set("status", status);
  const qs = params.toString();
  return apiClient<EnrichedStatement[]>(`/statements${qs ? `?${qs}` : ""}`);
}

export function generateStatements(accountId: string): Promise<ICreditCardStatement[]> {
  return apiClient<ICreditCardStatement[]>(`/statements/generate?accountId=${accountId}`);
}

export interface StatementDetail {
  statement: EnrichedStatement;
  records: IRecord[];
}

export function fetchStatementDetail(id: string): Promise<StatementDetail> {
  return apiClient<StatementDetail>(`/statements/${id}`);
}

export interface ReconciliationRecords {
  confirmed: IRecord[];
  candidates: IRecord[];
  confirmedTotal: number;
  statementAmount: number;
  difference: number;
}

export function fetchStatementRecords(id: string): Promise<ReconciliationRecords> {
  return apiClient<ReconciliationRecords>(`/statements/${id}/records`);
}

export interface ReconciliationStats {
  confirmedTotal: number;
  statementAmount: number;
  difference: number;
}

export function updateStatementRecords(
  id: string,
  body: { add?: string[]; remove?: string[] },
): Promise<ReconciliationStats> {
  return apiClient<ReconciliationStats>(`/statements/${id}/records`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function updateStatement(
  id: string,
  data: Partial<Pick<ICreditCardStatement, "statementAmount" | "status" | "paidAmount" | "paidDate" | "note">>,
): Promise<EnrichedStatement> {
  return apiClient<EnrichedStatement>(`/statements/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}


export function fetchBillingPeriods(accountId: string): Promise<IBillingPeriod[]> {
  return apiClient<IBillingPeriod[]>(`/statements/periods?accountId=${accountId}`);
}

export function saveReconciliation(data: {
  accountId: string;
  billingCycleStart: string | Date;
  billingCycleEnd: string | Date;
  confirmedIds: string[];
  deferredIds: string[];
}): Promise<{ statement: ICreditCardStatement; confirmedTotal: number }> {
  return apiClient<{ statement: ICreditCardStatement; confirmedTotal: number }>("/statements/save", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

