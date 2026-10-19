"use client";

import { useCallback, useEffect, useState } from "react";
import { clearToken, getToken } from "./storage";

export function qs(path: string, params: Record<string, string | number | undefined | null>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "" && value !== "ALL") query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(path, { ...options, headers, credentials: "include" });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (response.status === 401 && path !== "/api/auth/me" && !path.startsWith("/api/auth/sign-")) {
    clearToken();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new Error(data.error || "Unauthorized");
  }
  if (response.status === 413) throw new Error(data.error || "That upload is too large.");
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!path) return;
    let cancel = false;
    setLoading(true);
    api<T>(path)
      .then((next) => {
        if (!cancel) {
          setData(next);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (!cancel) setError(reason instanceof Error ? reason.message : "Request failed");
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [path, tick]);

  return { data, loading, error, reload, setData };
}
