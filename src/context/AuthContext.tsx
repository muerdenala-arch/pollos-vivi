import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { api, setToken, clearToken, getToken } from "../lib/api";
import type { AppUser, Branch, AuthResponse } from "@shared/types";

interface AuthState {
  user: AppUser | null;
  branch: Branch | null;
  loading: boolean;
  loginWithPin: (pin: string) => Promise<AppUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_USER = "pv_user";
const STORAGE_BRANCH = "pv_branch";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => {
    const raw = localStorage.getItem(STORAGE_USER);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  });
  const [branch, setBranch] = useState<Branch | null>(() => {
    const raw = localStorage.getItem(STORAGE_BRANCH);
    return raw ? (JSON.parse(raw) as Branch) : null;
  });
  const [loading, setLoading] = useState(false);

  const loginWithPin = useCallback(async (pin: string) => {
    setLoading(true);
    try {
      const data = await api.post<AuthResponse>("/auth/login", { pin });
      setToken(data.token);
      setUser(data.user);
      setBranch(data.branch);
      localStorage.setItem(STORAGE_USER, JSON.stringify(data.user));
      localStorage.setItem(STORAGE_BRANCH, JSON.stringify(data.branch));
      return data.user; // se devuelve para poder redirigir según el rol sin esperar al re-render
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem(STORAGE_USER);
    localStorage.removeItem(STORAGE_BRANCH);
    setUser(null);
    setBranch(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, branch, loading, loginWithPin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
