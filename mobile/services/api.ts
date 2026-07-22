import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { NativeModules, Platform } from 'react-native';
import type {
  AuthResponse,
  Condition,
  HealthService,
  LocationCluster,
  Post,
  Recommendation,
  User,
} from '@/types';

function getMetroHostname(): string | null {
  const hostUri =
    Constants.expoGoConfig?.debuggerHost ??
    Constants.expoConfig?.hostUri ??
    (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost;

  if (hostUri) {
    return hostUri.split(':')[0];
  }

  // Dev build en dispositivo físico: misma IP que Metro (bundle URL)
  const sourceCode = NativeModules.SourceCode as
    | { scriptURL?: string; getConstants?: () => { scriptURL?: string } }
    | undefined;
  const scriptURL = sourceCode?.getConstants?.()?.scriptURL ?? sourceCode?.scriptURL;

  if (typeof scriptURL === 'string') {
    const match = scriptURL.match(/^https?:\/\/([^:/?#]+)/);
    const host = match?.[1];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return host;
    }
  }

  return null;
}

function getApiUrl(): string {
  const configured =
    Constants.expoConfig?.extra?.apiUrl ?? process.env.EXPO_PUBLIC_API_URL;

  if (configured && configured !== 'auto' && !configured.includes('localhost')) {
    return configured.replace(/\/$/, '');
  }

  const hostname = getMetroHostname();
  if (hostname) {
    return `http://${hostname}:3001`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001';
  }

  return 'http://localhost:3001';
}

const API_URL = getApiUrl();

let authToken: string | null = null;

export async function loadToken() {
  if (Platform.OS === 'web') {
    authToken = localStorage.getItem('auth_token');
  } else {
    authToken = await SecureStore.getItemAsync('auth_token');
  }
  return authToken;
}

export async function saveToken(token: string) {
  authToken = token;
  if (Platform.OS === 'web') {
    localStorage.setItem('auth_token', token);
  } else {
    await SecureStore.setItemAsync('auth_token', token);
  }
}

export async function clearToken() {
  authToken = null;
  if (Platform.OS === 'web') {
    localStorage.removeItem('auth_token');
  } else {
    await SecureStore.deleteItemAsync('auth_token');
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Error en la solicitud');
  }

  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (payload: {
    name: string;
    email: string;
    password: string;
    conditionIds: string[];
    latitude?: number;
    longitude?: number;
    city?: string;
    bio?: string;
  }) =>
    request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: () => request<{ message: string }>('/api/auth/logout', { method: 'POST' }),

  getMe: () => request<User>('/api/auth/me'),

  getConditions: () => request<Condition[]>('/api/conditions'),

  getRecommendations: (conditionId: string) =>
    request<{ condition: Condition; recommendations: Recommendation[] }>(
      `/api/conditions/${conditionId}/recommendations`
    ),

  getPosts: (conditionId?: string) =>
    request<Post[]>(`/api/posts${conditionId ? `?conditionId=${conditionId}` : ''}`),

  createPost: (payload: {
    conditionId: string;
    title: string;
    content: string;
    tags?: string[];
  }) =>
    request<Post>('/api/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  likePost: (postId: string) =>
    request<Post>(`/api/posts/${postId}/like`, { method: 'POST' }),

  getServices: (conditionId?: string) =>
    request<HealthService[]>(
      `/api/services${conditionId ? `?conditionId=${conditionId}` : ''}`
    ),

  getUsers: (params?: { conditionId?: string; needsHelp?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.conditionId) query.set('conditionId', params.conditionId);
    if (params?.needsHelp !== undefined) query.set('needsHelp', String(params.needsHelp));
    const qs = query.toString();
    return request<User[]>(`/api/users${qs ? `?${qs}` : ''}`);
  },

  getClusters: (conditionId?: string) =>
    request<LocationCluster[]>(
      `/api/users/clusters${conditionId ? `?conditionId=${conditionId}` : ''}`
    ),

  identifyMedication: (params?: {
    barcode?: string;
    q?: string;
    conditionId?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.barcode) query.set('barcode', params.barcode);
    if (params?.q) query.set('q', params.q);
    if (params?.conditionId) query.set('conditionId', params.conditionId);
    const qs = query.toString();
    return request<import('@/types').MedicationIdentifyResult>(
      `/api/medications/identify${qs ? `?${qs}` : ''}`
    );
  },

  identifyMedicationFromOcr: (text: string, conditionId?: string) =>
    request<import('@/types').MedicationIdentifyResult>('/api/medications/identify-ocr', {
      method: 'POST',
      body: JSON.stringify({ text, conditionId }),
    }),

  identifyMedicationFromImage: (imageBase64: string, conditionId?: string) =>
    request<import('@/types').MedicationIdentifyResult>('/api/medications/identify-image', {
      method: 'POST',
      body: JSON.stringify({ imageBase64, conditionId }),
    }),

  updateProfile: (updates: Partial<User>) =>
    request<User>('/api/users/me', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
};
