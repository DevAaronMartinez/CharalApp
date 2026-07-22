import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearToken, loadToken, saveToken } from '@/services/api';
import type { Condition, User } from '@/types';

interface AuthContextValue {
  user: User | null;
  conditions: Condition[];
  selectedConditionId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    conditionIds: string[];
    latitude?: number;
    longitude?: number;
    city?: string;
    bio?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  setSelectedConditionId: (id: string | null) => void;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [selectedConditionId, setSelectedConditionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const me = await api.getMe();
      setUser(me);
      if (!selectedConditionId && me.conditionIds?.length) {
        setSelectedConditionId(me.conditionIds[0]);
      }
    } catch {
      setUser(null);
      await clearToken();
    }
  }, [selectedConditionId]);

  useEffect(() => {
    async function init() {
      try {
        const [token, allConditions] = await Promise.all([
          loadToken(),
          api.getConditions(),
        ]);
        setConditions(allConditions);
        if (token) await refreshUser();
      } catch (error) {
        console.error('Init error:', error);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { user: loggedUser, token } = await api.login(email, password);
    await saveToken(token);
    setUser(loggedUser);
    if (loggedUser.conditionIds?.length) {
      setSelectedConditionId(loggedUser.conditionIds[0]);
    }
  }, []);

  const register = useCallback(
    async (payload: {
      name: string;
      email: string;
      password: string;
      conditionIds: string[];
      latitude?: number;
      longitude?: number;
      city?: string;
      bio?: string;
    }) => {
      const { user: newUser, token } = await api.register(payload);
      await saveToken(token);
      setUser(newUser);
      if (newUser.conditionIds?.length) {
        setSelectedConditionId(newUser.conditionIds[0]);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    await clearToken();
    setUser(null);
    setSelectedConditionId(null);
  }, []);

  const updateProfile = useCallback(async (updates: Partial<User>) => {
    const updated = await api.updateProfile(updates);
    setUser(updated);
  }, []);

  const value = useMemo(
    () => ({
      user,
      conditions,
      selectedConditionId,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      setSelectedConditionId,
      updateProfile,
      refreshUser,
    }),
    [
      user,
      conditions,
      selectedConditionId,
      isLoading,
      login,
      register,
      logout,
      updateProfile,
      refreshUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
