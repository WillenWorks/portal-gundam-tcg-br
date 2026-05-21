import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { api, clearAuth, getStoredAuth, storeAuth, type AuthUser } from "@/lib/api";

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = useMemo(() => getStoredAuth(), []);
  const [user, setUser] = useState<AuthUser | null>(stored.user);

  useEffect(() => {
    if (!stored.token) return;
    api.me().then(setUser).catch(() => {
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
    },
    logout() {
      clearAuth();
      setUser(null);
      toast.success("Sessão encerrada.");
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
