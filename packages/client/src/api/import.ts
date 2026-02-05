import { apiClient } from "./client.js";

export interface ImportStats {
  total: number;
  imported: number;
  skipped: number;
  accounts_created: number;
  categories_created: number;
  transfers_merged: number;
}

export function importMoze(file: File): Promise<ImportStats> {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient<ImportStats>("/import/moze", {
    method: "POST",
    body: formData,
  });
}
