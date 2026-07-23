import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { LOCAL_CONDITIONS, LOCAL_DEMO_USER } from '@/data/localSeed';
import type { Condition, User } from '@/types';

const PROFILE_KEY = 'local_profile_v1';

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

async function readStoredProfile(): Promise<User | null> {
  try {
    const raw =
      Platform.OS === 'web'
        ? localStorage.getItem(PROFILE_KEY)
        : await SecureStore.getItemAsync(PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

async function writeStoredProfile(user: User): Promise<void> {
  const raw = JSON.stringify(user);
  if (Platform.OS === 'web') {
    localStorage.setItem(PROFILE_KEY, raw);
  } else {
    await SecureStore.setItemAsync(PROFILE_KEY, raw);
  }
}

async function clearStoredProfile(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(PROFILE_KEY);
  } else {
    await SecureStore.deleteItemAsync(PROFILE_KEY);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [conditions] = useState<Condition[]>(LOCAL_CONDITIONS);
  const [selectedConditionId, setSelectedConditionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyUser = useCallback((next: User) => {
    setUser(next);
    if (next.conditionIds?.length) {
      setSelectedConditionId((prev) =>
        prev && next.conditionIds.includes(prev) ? prev : next.conditionIds[0]
      );
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const stored = await readStoredProfile();
    applyUser(stored ?? LOCAL_DEMO_USER);
  }, [applyUser]);

  useEffect(() => {
    async function init() {
      try {
        const stored = await readStoredProfile();
        const next = stored ?? LOCAL_DEMO_USER;
        if (!stored) {
          await writeStoredProfile(next);
        }
        applyUser(next);
      } catch (error) {
        console.error('Init local profile error:', error);
        applyUser(LOCAL_DEMO_USER);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [applyUser]);

  const login = useCallback(async (_email: string, _password: string) => {
    // Modo local: no hay autenticación remota.
    await refreshUser();
  }, [refreshUser]);

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
      const next: User = {
        ...LOCAL_DEMO_USER,
        id: `local-${Date.now()}`,
        name: payload.name,
        email: payload.email,
        conditionIds: payload.conditionIds.length
          ? payload.conditionIds
          : LOCAL_DEMO_USER.conditionIds,
        latitude: payload.latitude,
        longitude: payload.longitude,
        city: payload.city,
        bio: payload.bio,
        createdAt: new Date().toISOString(),
      };
      await writeStoredProfile(next);
      applyUser(next);
    },
    [applyUser]
  );

  const logout = useCallback(async () => {
    await clearStoredProfile();
    await writeStoredProfile(LOCAL_DEMO_USER);
    applyUser(LOCAL_DEMO_USER);
  }, [applyUser]);

  const updateProfile = useCallback(
    async (updates: Partial<User>) => {
      const base = user ?? LOCAL_DEMO_USER;
      const next: User = { ...base, ...updates };
      await writeStoredProfile(next);
      applyUser(next);
    },
    [applyUser, user]
  );

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
