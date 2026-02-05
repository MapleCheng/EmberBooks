import type { ICategory } from "@ember-books/shared";
import { apiClient } from "./client.js";

export function fetchCategories(): Promise<ICategory[]> {
  return apiClient<ICategory[]>("/categories");
}

export function createCategory(data: Partial<ICategory>): Promise<ICategory> {
  return apiClient<ICategory>("/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateCategory(id: string, data: Partial<ICategory>): Promise<ICategory> {
  return apiClient<ICategory>(`/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteCategory(id: string): Promise<ICategory> {
  return apiClient<ICategory>(`/categories/${id}`, {
    method: "DELETE",
  });
}
