import React, { createContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [role, setRole] = useState(() => localStorage.getItem('role') || null);
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setRole(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('role');
  }, []);

  // Rehydrate user session on mount
  useEffect(() => {
    const rehydrate = async () => {
      const storedToken = localStorage.getItem('token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await api.get('/api/v1/auth/me');
        setUser(response.data);
        setRole(response.data.role);
        localStorage.setItem('user', JSON.stringify(response.data));
        localStorage.setItem('role', response.data.role);
      } catch (err) {
        console.warn('Failed to rehydrate auth session:', err?.response?.data || err.message);
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    rehydrate();

    // Listen for 401 unauthorized events from api interceptor
    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [logout]);

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const response = await api.post('/api/v1/auth/login', { email, password });
      const { access_token, role: userRole, name } = response.data;

      localStorage.setItem('token', access_token);
      localStorage.setItem('role', userRole);
      setToken(access_token);
      setRole(userRole);

      // Fetch user profile
      try {
        const meRes = await api.get('/api/v1/auth/me', {
          headers: { Authorization: `Bearer ${access_token}` }
        });
        setUser(meRes.data);
        localStorage.setItem('user', JSON.stringify(meRes.data));
        return { success: true, role: userRole, user: meRes.data };
      } catch {
        const fallbackUser = { name, email, role: userRole };
        setUser(fallbackUser);
        localStorage.setItem('user', JSON.stringify(fallbackUser));
        return { success: true, role: userRole, user: fallbackUser };
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (name, email, password) => {
    setIsLoading(true);
    try {
      const response = await api.post('/api/v1/auth/signup', {
        name,
        email,
        password,
      });
      const { access_token, role: confirmedRole } = response.data;

      localStorage.setItem('token', access_token);
      localStorage.setItem('role', confirmedRole);
      setToken(access_token);
      setRole(confirmedRole);

      // Fetch user profile
      try {
        const meRes = await api.get('/api/v1/auth/me', {
          headers: { Authorization: `Bearer ${access_token}` }
        });
        setUser(meRes.data);
        localStorage.setItem('user', JSON.stringify(meRes.data));
        return { success: true, role: confirmedRole, user: meRes.data };
      } catch {
        const fallbackUser = { name, email, role: confirmedRole };
        setUser(fallbackUser);
        localStorage.setItem('user', JSON.stringify(fallbackUser));
        return { success: true, role: confirmedRole, user: fallbackUser };
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
