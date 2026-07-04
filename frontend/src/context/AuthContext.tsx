import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { api } from '../services/api';

interface User {
  id: string;
  name: string;
  username: string;
  role: string;
  isActive: boolean;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  permissions: string[];
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  hasPermission: (key: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('tt_token'));
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  const fetchPermissions = useCallback(async () => {
    try {
      const permissionsResponse = await api.get('/api/auth/my-permissions');
      const nextPermissions = Array.isArray(permissionsResponse)
        ? permissionsResponse
        : Array.isArray(permissionsResponse?.data)
          ? permissionsResponse.data
          : [];
      setPermissions(nextPermissions);
    } catch (e) {
      console.error('Failed to fetch permissions', e);
      setPermissions([]);
    }
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('tt_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        if (token) {
          fetchPermissions();
        }
      } catch (e) {
        localStorage.removeItem('tt_user');
      }
    }
  }, [token, fetchPermissions]);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('tt_token', newToken);
    localStorage.setItem('tt_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setPermissions([]);
    localStorage.removeItem('tt_token');
    localStorage.removeItem('tt_user');
  };

  const hasPermission = (key: string): boolean => {
    // If DB has permissions, check them
    if (permissions.length > 0) {
      return permissions.includes(key);
    }
    
    // Fallback to hardcoded roles if table is empty or API failed
    if (user?.role === 'Admin') return true; // Admin has all by default in fallback
    
    // Fail-safe: Operator and Viewer should not get access to anything by default if permissions fail to load
    return false;
  };

  return (
    <AuthContext.Provider value={{ token, user, permissions, login, logout, isAuthenticated: !!token, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
