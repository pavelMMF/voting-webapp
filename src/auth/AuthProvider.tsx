import React, { createContext, useContext, useEffect, useState } from "react";

type User = { email: string; role: string; walletAddress: string | null };

type AuthCtx = {
  user: User | null;
  isAuthed: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<{ verifyUrl?: string }>;
  verifyEmail: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, credentials: "include" });
  const txt = await r.text().catch(() => "");
  if (!r.ok) throw new Error(txt || `API ${r.status}`);
  return txt ? (JSON.parse(txt) as T) : ({} as T);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  async function refresh() {
    try {
      const r = await apiJson<{ ok: boolean; user?: User }>("/api/auth/me");
      setUser(r.ok ? (r.user ?? null) : null);
    } catch {
      setUser(null);
    }
  }

  async function login(email: string, password: string) {
    await apiJson("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    await refresh();
  }

  async function register(email: string, password: string) {
    const r = await apiJson<{ ok: boolean; verifyUrl?: string }>("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return { verifyUrl: r.verifyUrl };
  }

  async function verifyEmail(token: string) {
    await apiJson("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  }

  async function logout() {
    await apiJson("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <Ctx.Provider value={{ user, isAuthed: !!user, login, register, verifyEmail, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
