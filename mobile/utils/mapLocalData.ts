import communityUsersJson from '@/data/communityUsers.json';
import healthServicesJson from '@/data/healthServices.json';
import type { HealthService, LocationCluster } from '@/types';

type CommunityUser = {
  id: string;
  name: string;
  conditionIds: string[];
  latitude?: number;
  longitude?: number;
  city?: string;
  needsHelp?: boolean;
};

const communityUsers = communityUsersJson as CommunityUser[];
const healthServices = healthServicesJson as HealthService[];

export function getLocalServices(conditionId?: string | null): HealthService[] {
  if (!conditionId) return healthServices;
  return healthServices.filter((s) => s.conditionIds.includes(conditionId));
}

export function getLocalClusters(conditionId?: string | null): LocationCluster[] {
  const filtered = communityUsers.filter((u) => {
    if (u.latitude == null || u.longitude == null) return false;
    if (!conditionId) return true;
    return u.conditionIds.includes(conditionId);
  });

  const clusters: Record<
    string,
    {
      latitude: number;
      longitude: number;
      count: number;
      city?: string;
      conditionIds: Set<string>;
    }
  > = {};

  for (const user of filtered) {
    const key = `${user.latitude!.toFixed(2)},${user.longitude!.toFixed(2)}`;
    if (!clusters[key]) {
      clusters[key] = {
        latitude: user.latitude!,
        longitude: user.longitude!,
        count: 0,
        city: user.city,
        conditionIds: new Set(),
      };
    }
    clusters[key].count += 1;
    for (const cid of user.conditionIds) {
      clusters[key].conditionIds.add(cid);
    }
  }

  return Object.values(clusters).map((c) => ({
    latitude: c.latitude,
    longitude: c.longitude,
    count: c.count,
    city: c.city,
    conditionIds: [...c.conditionIds],
  }));
}
