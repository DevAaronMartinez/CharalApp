import { Redirect } from 'expo-router';

/** Recomendaciones viven dentro del tab Comunidad (index). */
export default function RecommendationsRedirect() {
  return <Redirect href="/(tabs)" />;
}
