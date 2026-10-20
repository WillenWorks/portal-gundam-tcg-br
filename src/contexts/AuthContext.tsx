import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

import { api, clearAuth, getStoredAuth, storeAuth, type AuthUser } from "@/lib/api";
import { tr } from "@/i18n/siteLanguageCore";

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, recaptchaToken?: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  register: (payload: { email: string; password: string; displayName: string; username?: string; recaptchaToken?: string }) => Promise<void>;
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
    async login(email, password, recaptchaToken) {
      try {
        const result = await api.login(email, password, recaptchaToken);
        storeAuth(result.token, result.user);
        setUser(result.user);
        toast.success(tr(`Login realizado como ${result.user.displayName}.`, `Signed in as ${result.user.displayName}.`));
        navigate("/profile", { replace: true });
      } catch (err: any) {
        toast.error(err?.message || tr("Erro ao realizar login.", "Sign-in failed."));
        throw err;
      }
    },
    async loginWithGoogle(credential) {
      try {
        const result = await api.loginWithGoogle(credential);
        storeAuth(result.token, result.user);
        setUser(result.user);
        toast.success(tr(`Login realizado como ${result.user.displayName}.`, `Signed in as ${result.user.displayName}.`));
        navigate("/profile", { replace: true });
      } catch (err: any) {
        toast.error(err?.message || tr("Erro ao autenticar com Google.", "Google sign-in failed."));
        throw err;
      }
    },
    async register(payload) {
      try {
        const result = await api.register(payload);
        storeAuth(result.token, result.user);
        setUser(result.user);
        toast.success(tr(`Conta criada para ${result.user.displayName}.`, `Account created for ${result.user.displayName}.`));
        navigate("/profile", { replace: true });
      } catch (err: any) {
        toast.error(err?.message || tr("Erro ao cadastrar conta.", "Sign-up failed."));
        throw err;
      }
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
      toast.success(tr("Sessão encerrada.", "Signed out."));
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
