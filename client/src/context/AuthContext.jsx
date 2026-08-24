import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api, { onAuthLost } from "../lib/api";
import { signInWithGoogle, firebaseSignOut } from "../lib/firebase";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check current session
  useEffect(() => {
    let active = true;
    api.me()
      .then((data) => { if (active) setUser(data.user); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // When refresh fails
  useEffect(() => onAuthLost(() => setUser(null)), []);

  const login = useCallback(async (creds) => {
    const data = await api.login(creds);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (body) => {
    const data = await api.register(body);
    setUser(data.user);
    return data.user;
  }, []);

  // Google Firebase Authentication
  const loginWithGoogle = useCallback(async () => {
    const { user: fbUser, idToken } = await signInWithGoogle();
    const data = await api.firebaseAuth({
      idToken,
      name: fbUser.name,
      email: fbUser.email,
      phone: fbUser.phone,
      photoURL: fbUser.photoURL,
    });
    setUser(data.user);
    return data.user;
  }, []);

  const requestOtp = useCallback((phone) => api.requestOtp(phone), []);

  const verifyOtp = useCallback(async (body) => {
    const data = await api.verifyOtp(body);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
      await firebaseSignOut();
    } finally {
      setUser(null);
    }
  }, []);

  const value = {
    user, loading, isAuthenticated: Boolean(user),
    login, register, loginWithGoogle, logout, requestOtp, verifyOtp,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
