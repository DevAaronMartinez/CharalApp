import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import MapView, { Circle, Marker, PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import { ConditionPicker } from '@/components/ConditionPicker';
import { Screen } from '@/components/Screen';
import Colors, { serviceTypeLabels } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import type { HealthService, LocationCluster } from '@/types';

const LOCAL_DELTA = { latitudeDelta: 0.08, longitudeDelta: 0.08 };

const FALLBACK_REGION: Region = {
  latitude: 23.6,
  longitude: -102.0,
  latitudeDelta: 14,
  longitudeDelta: 14,
};

export default function MapScreen() {
  const { conditions, selectedConditionId, setSelectedConditionId } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const mapRef = useRef<MapView>(null);

  const [clusters, setClusters] = useState<LocationCluster[]>([]);
  const [services, setServices] = useState<HealthService[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [showServices, setShowServices] = useState(true);
  const [showClusters, setShowClusters] = useState(true);

  const loadData = useCallback(async () => {
    const [clustersData, servicesData] = await Promise.all([
      api.getClusters(selectedConditionId ?? undefined),
      api.getServices(selectedConditionId ?? undefined),
    ]);
    setClusters(clustersData);
    setServices(servicesData);
  }, [selectedConditionId]);

  useEffect(() => {
    setLoading(true);
    loadData()
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [loadData]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;

        if (status !== 'granted') {
          setMapRegion(FALLBACK_REGION);
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;

        const region: Region = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          ...LOCAL_DELTA,
        };
        setMapRegion(region);
        mapRef.current?.animateToRegion(region, 500);
      } catch (error) {
        console.error(error);
        if (!cancelled) setMapRegion(FALLBACK_REGION);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Screen style={{ backgroundColor: colors.background }}>
      <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Mapa de comunidad</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Concentración de personas y servicios de salud
        </Text>
      </View>

      <ConditionPicker
        conditions={conditions}
        selectedId={selectedConditionId}
        onSelect={setSelectedConditionId}
      />

      <View style={styles.legend}>
        <LegendItem
          color={Colors.secondary}
          label="Comunidad"
          active={showClusters}
          onPress={() => setShowClusters((v) => !v)}
        />
        <LegendItem
          color={Colors.primary}
          label="Clínicas/Servicios"
          active={showServices}
          onPress={() => setShowServices((v) => !v)}
        />
      </View>

      {loading || !mapRegion ? (
        <ActivityIndicator style={styles.loader} color={Colors.primary} />
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? undefined : PROVIDER_DEFAULT}
          initialRegion={mapRegion}
          showsUserLocation
          showsMyLocationButton
        >
          {showClusters &&
            clusters.map((cluster, i) => (
              <Circle
                key={`cluster-${i}`}
                center={{
                  latitude: cluster.latitude,
                  longitude: cluster.longitude,
                }}
                radius={cluster.count * 200 + 300}
                fillColor={`${Colors.secondary}44`}
                strokeColor={Colors.secondary}
                strokeWidth={2}
              />
            ))}

          {showClusters &&
            clusters.map((cluster, i) => (
              <Marker
                key={`marker-cluster-${i}`}
                coordinate={{
                  latitude: cluster.latitude,
                  longitude: cluster.longitude,
                }}
                title={`${cluster.count} personas`}
                description={cluster.city ?? 'Zona de concentración'}
                pinColor={Colors.secondary}
              />
            ))}

          {showServices &&
            services.map((service) => (
              <Marker
                key={service.id}
                coordinate={{
                  latitude: service.latitude,
                  longitude: service.longitude,
                }}
                title={service.name}
                description={`${serviceTypeLabels[service.type] ?? service.type} · ${service.address}`}
                pinColor={Colors.primary}
              />
            ))}
        </MapView>
      )}
      </View>
    </Screen>
  );
}

function LegendItem({
  color,
  label,
  active,
  onPress,
}: {
  color: string;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Text
      onPress={onPress}
      style={[
        styles.legendItem,
        {
          backgroundColor: active ? `${color}22` : '#E5E7EB33',
          color: active ? color : '#9CA3AF',
        },
      ]}
    >
      ● {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  legendItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  map: {
    flex: 1,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 16,
  },
  loader: { marginTop: 80 },
});
