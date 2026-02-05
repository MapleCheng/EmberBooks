import type { IRecord } from "@ember-books/shared";
import { apiClient } from "./client.js";

export interface RecordFilters {
  type?: string;
  category?: string;
  account?: string;
  from?: string;
  to?: string;
}

export function fetchRecords(filters?: RecordFilters): Promise<IRecord[]> {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
  }
  const qs = params.toString();
  return apiClient<IRecord[]>(`/records${qs ? `?${qs}` : ""}`);
}

export function fetchRecord(id: string): Promise<IRecord> {
  return apiClient<IRecord>(`/records/${id}`);
}

export function createRecord(data: Partial<IRecord>): Promise<IRecord> {
  return apiClient<IRecord>("/records", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateRecord(id: string, data: Partial<IRecord>): Promise<IRecord> {
  return apiClient<IRecord>(`/records/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteRecord(id: string): Promise<IRecord> {
  return apiClient<IRecord>(`/records/${id}`, {
    method: "DELETE",
  });
}
