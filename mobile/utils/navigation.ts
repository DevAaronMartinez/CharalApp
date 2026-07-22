import { useRouter } from 'expo-router';

/** Vuelve atrás o cae en una ruta segura si no hay historial (p. ej. modal pantalla completa). */
export function useSafeBack(fallbackRoute: '/(tabs)/profile' | '/(tabs)' = '/(tabs)/profile') {
  const router = useRouter();

  return () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallbackRoute);
    }
  };
}
