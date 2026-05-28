import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

import { api, clearAuth, getStoredAuth, storeAuth, type AuthUser } from "@/lib/api";

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { email: string; password: string; displayName: string }) => Promise<void>;
  refreshMe: () => Promise<void>;
  setCurrentUser: (user: AuthUser | null) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = useMemo(() => getStoredAuth(), []);
  const [, navigate] = useLocation();
  const [user, setUser] = useState<AuthUser | null>(stored.user);

  const refreshMe = async () => {
    const me = await api.me();
    const token = getStoredAuth().token;
    if (token) storeAuth(token, me);
    setUser(me);
  };

  useEffect(() => {
    if (!stored.token) return;
    refreshMe().catch(() => {
      clearAuth();
      setUser(null);
    });
  }, [stored.token]);

  const value: AuthContextValue = {
    user,
    isAuthenticated: Boolean(user),
    async login(email, password) {
      const result = await api.login(email, password);
      storeAuth(result.token, result.user);
      setUser(result.user);
      toast.success(`Login realizado como ${result.user.displayName}.`);
      navigate(result.user.role === "ADMIN" ? "/admin" : "/portal");
    },
    async register(payload) {
      const result = await api.register(payload);
      storeAuth(result.token, result.user);
      setUser(result.user);
      toast.success(`Conta criada para ${result.user.displayName}.`);
      navigate("/portal");
    },
    async refreshMe() {
      await refreshMe();
    },
    setCurrentUser(nextUser) {
      const token = getStoredAuth().token;
      if (token && nextUser) storeAuth(token, nextUser);
      setUser(nextUser);
    },
    logout() {
      clearAuth();
      setUser(null);
      toast.success("Sessão encerrada.");
      navigate("/");
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
