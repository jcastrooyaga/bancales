import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { apiClient, ettApiClient } from '../api/client';

interface EttUser { id: string; name: string; email: string; ettId: string; }

interface AuthContextValue {
  user: User | null;
  ettUser: EttUser | null;
  login: (email: string, password: string) => Promise<void>;
  ettLogin: (email: string, password: string) => Promise<void>;
  logout: () => void;
  ettLogout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>(null!);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [ettUser, setEttUser] = useState<EttUser | null>(() => {
    const stored = localStorage.getItem('ettUser');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data } = await apiClient.post('/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  };

  const ettLogin = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data } = await ettApiClient.post('/ett/login', { email, password });
      localStorage.setItem('ettToken', data.token);
      localStorage.setItem('ettUser', JSON.stringify(data.ettUser));
      setEttUser(data.ettUser);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    apiClient.post('/auth/logout').catch(() => {});
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const ettLogout = () => {
    localStorage.removeItem('ettToken');
    localStorage.removeItem('ettUser');
    setEttUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, ettUser, login, ettLogin, logout, ettLogout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
