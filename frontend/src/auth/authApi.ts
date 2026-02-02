import { api } from "@/api/client";

export type LoginReq = { email: string; password: string };
export type LoginRes = { accessToken: string };

export type RegisterReq = {
  email: string;
  password: string;
  role: "CANDIDATE" | "RECRUITER";
  nickname: string;
  phoneNumber: string;
  companyCode?: string;
};
export type RegisterRes = { userId: string; message: string };

export interface User {
  id: string;
  email: string;
  nickname: string;
  role: string;
  phoneNumber?: string;
  companyCode?: string;
}

export async function login(body: LoginReq): Promise<LoginRes> {
  return api<LoginRes>("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
    credentials: "include",
  });
}

export async function register(body: RegisterReq): Promise<RegisterRes> {
  return api<RegisterRes>("/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
    credentials: "include",
  });
}

export async function refresh(): Promise<{ accessToken: string }> {
  const refreshToken = document.cookie
    .split("; ")
    .find((c) => c.startsWith("refreshToken="))
    ?.split("=")[1];
  if (!refreshToken) throw new Error("No refresh token");
  return api<{ accessToken: string }>("/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
    credentials: "include",
  });
}

export async function getMe(): Promise<User> {
  return api<User>("/v1/users/me");
}

export async function logout(): Promise<void> {
  return api<void>("/v1/auth/logout", { method: "POST" });
}
