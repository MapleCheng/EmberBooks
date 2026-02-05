import type { IUser, IUserSettings } from "@ember-books/shared";
import { apiClient } from "./client.js";

export interface LoginResponse {
  token: string;
  user: IUser;
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiClient<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getMe(): Promise<IUser> {
  return apiClient<IUser>("/auth/me");
}

export function updateProfile(data: { name?: string; email?: string }): Promise<IUser> {
  return apiClient<IUser>("/auth/profile", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function changePassword(data: { currentPassword: string; newPassword: string }): Promise<{ success: boolean; message: string }> {
  return apiClient<{ success: boolean; message: string }>("/auth/password", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function fetchUserSettings(): Promise<IUserSettings> {
  return apiClient<IUserSettings>("/auth/settings");
}

export function updateUserSettings(settings: Partial<IUserSettings>): Promise<IUserSettings> {
  return apiClient<IUserSettings>("/auth/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}
