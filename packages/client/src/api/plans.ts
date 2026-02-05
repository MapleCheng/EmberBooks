import type { IPaymentPlan, IRecord } from "@ember-books/shared";
import { apiClient } from "./client.js";

export interface PlanDetail {
  plan: IPaymentPlan;
  records: IRecord[];
  summary: {
    totalPeriods: number;
    paidCount: number;
    scheduledCount: number;
    remainingCount: number;
    paidAmount: number;
    scheduledAmount: number;
    totalAmount: number;
    unpaidAmount: number;
  };
}

export function fetchPlans(status?: string, type?: string): Promise<IPaymentPlan[]> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (type) params.set("type", type);
  const qs = params.toString();
  return apiClient<IPaymentPlan[]>(`/plans${qs ? `?${qs}` : ""}`);
}

export function createPlan(data: Record<string, unknown>): Promise<{ plan: IPaymentPlan; recordsCreated: number }> {
  return apiClient<{ plan: IPaymentPlan; recordsCreated: number }>("/plans", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function fetchPlanDetail(id: string): Promise<PlanDetail> {
  return apiClient<PlanDetail>(`/plans/${id}`);
}

export function updatePlan(id: string, data: Partial<IPaymentPlan>): Promise<IPaymentPlan> {
  return apiClient<IPaymentPlan>(`/plans/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deletePlan(id: string): Promise<{ deletedPlan: string; deletedScheduledRecords: number }> {
  return apiClient<{ deletedPlan: string; deletedScheduledRecords: number }>(`/plans/${id}`, {
    method: "DELETE",
  });
}

export function extendPlan(id: string): Promise<{ newTotalPeriods: number; newRecords: number }> {
  return apiClient<{ newTotalPeriods: number; newRecords: number }>(`/plans/${id}/extend`, {
    method: "POST",
  });
}

export function updatePlanRecord(planId: string, recordId: string, data: Record<string, unknown>): Promise<IRecord> {
  return apiClient<IRecord>(`/plans/${planId}/records/${recordId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function confirmRecord(planId: string, recordId: string): Promise<IRecord> {
  return apiClient<IRecord>(`/plans/${planId}/records/${recordId}/confirm`, {
    method: "POST",
  });
}

export function deletePlanRecord(planId: string, recordId: string): Promise<IRecord> {
  return apiClient<IRecord>(`/plans/${planId}/records/${recordId}`, {
    method: "DELETE",
  });
}

export function addPlanRecord(planId: string, data?: { amount?: number; date?: string }): Promise<IRecord> {
  return apiClient<IRecord>(`/plans/${planId}/records`, {
    method: "POST",
    body: JSON.stringify(data || {}),
  });
}

export function generatePlanRecords(): Promise<{ totalCreated: number; details: { planId: string; planName: string; recordsCreated: number }[] }> {
  return apiClient<{ totalCreated: number; details: { planId: string; planName: string; recordsCreated: number }[] }>("/plans/generate-records", {
    method: "POST",
  });
}
