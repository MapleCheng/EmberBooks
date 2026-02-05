import type { IAccount } from "@ember-books/shared";
import { apiClient } from "./client.js";

export interface AccountBalanceItem {
  accountId: string;
  name: string;
  type: string;
  group: string;
  includeInStats: boolean;
  currency: string;
  initialBalance: number;
  currentBalance: number;
  creditLimit: number | null;
  availableCredit?: number;
}

export interface BalanceSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

export interface AccountBalancesResponse {
  data: AccountBalanceItem[];
  summary: BalanceSummary;
}

export function fetchAccounts(): Promise<IAccount[]> {
  return apiClient<IAccount[]>("/accounts");
}

export function fetchAccountBalances(): Promise<AccountBalancesResponse> {
  return apiClient<AccountBalancesResponse>("/accounts/balances");
}

export function createAccount(data: Partial<IAccount>): Promise<IAccount> {
  return apiClient<IAccount>("/accounts", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateAccount(id: string, data: Partial<IAccount>): Promise<IAccount> {
  return apiClient<IAccount>(`/accounts/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteAccount(id: string): Promise<IAccount> {
  return apiClient<IAccount>(`/accounts/${id}`, {
    method: "DELETE",
  });
}
