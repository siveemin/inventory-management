"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

// Fired when the session has expired; the auth provider signs the user out and the shell sends them to /login.
export const UNAUTHORIZED_EVENT = "ims:unauthorized";

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
  const response = await fetch(path, { ...options, headers, credentials: "include" });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (response.status === 401 && path !== "/api/auth/me" && !path.startsWith("/api/auth/sign-")) {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new Error(data.error || "Unauthorized");
  }
  if (response.status === 413) throw new Error(data.error || "That upload is too large.");
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

const noSubscribe = () => () => {};

// False during the server render and hydration, true once running in the browser.
export function useHydrated() {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}

// Last good response per GET path. Revisiting a page shows this instantly while
// a fresh copy loads in the background, so switching tabs doesn't wait on the network.
const responseCache = new Map<string, unknown>();

/** Forget cached responses, e.g. on logout so the next user never sees them. */
export function clearApiCache() {
  responseCache.clear();
}

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  const request = path ? `${path}#${tick}` : null;

  useEffect(() => {
    if (!path || !request) return;
    let cancel = false;
    api<T>(path)
      .then((next) => {
        responseCache.set(path, next);
        if (!cancel) {
          setData(next);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (!cancel) setError(reason instanceof Error ? reason.message : "Request failed");
      })
      .finally(() => {
        if (!cancel) setSettled(request);
      });
    return () => {
      cancel = true;
    };
  }, [path, request]);

  const fresh = request !== null && settled === request;
  const cached = path ? (responseCache.get(path) as T | undefined) : undefined;
  const loading = request !== null && !fresh && cached === undefined;
  return { data: fresh ? data : (cached ?? data), loading, error, reload, setData };
}
