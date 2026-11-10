"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { api, clearApiCache, UNAUTHORIZED_EVENT } from "@/lib/client";
import { SettingsProvider } from "@/lib/settings";
import type { AuthUser } from "@/lib/types";

type AuthValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);
const ToastContext = createContext<(message: string, tone?: "ok" | "bad") => void>(() => undefined);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("Auth missing");
  return value;
}

export function useToast() {
  return useContext(ToastContext);
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    api<AuthUser>("/api/auth/me")
      .then((me) => {
        if (!cancel) setUser(me);
      })
      .catch(() => {
        if (!cancel) setUser(null);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      clearApiCache();
      setUser(null);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    const { error } = await authClient.signIn.email({
      email,
      password,
      rememberMe: remember,
    });
    if (error) throw new Error(error.message || "Email or password is incorrect.");
    setUser(await api<AuthUser>("/api/auth/me"));
  }, []);

  // The app shell sends a signed-out user to /login.
  const logout = useCallback(() => {
    clearApiCache();
    void authClient.signOut().finally(() => setUser(null));
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; message: string; tone: "ok" | "bad" }[]>([]);
  const push = useCallback((message: string, tone: "ok" | "bad" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3200);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-24 right-4 z-[70] grid gap-2 lg:bottom-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl px-4 py-3 text-sm text-white shadow-lg ${toast.tone === "bad" ? "bg-danger" : "bg-ink"}`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}
