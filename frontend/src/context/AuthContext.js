import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const AuthContext = createContext();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);
  const timeoutRef = React.useRef(null);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      logout();
      alert("Session expired due to inactivity. Please sign in again.");
    }, SESSION_TIMEOUT);
  }, [logout]);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    const savedToken = localStorage.getItem("token");
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
      setToken(savedToken);
      resetTimer();
    }
    setLoading(false);
  }, [resetTimer]);

  useEffect(() => {
    if (!user) return;
    const events = ["mousedown","keypress","scroll","touchstart"];
    events.forEach(e => window.addEventListener(e, resetTimer));
    return () => events.forEach(e => window.removeEventListener(e, resetTimer));
  }, [user, resetTimer]);

  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", authToken);
    resetTimer();
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
