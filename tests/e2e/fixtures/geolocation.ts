import type { BrowserContext } from '@playwright/test';

export type Coords = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

const DEFAULT_COORDS: Coords = {
  latitude: -6.2088,
  longitude: 106.8456,
  accuracy: 12,
};

export async function mockGeolocation(
  context: BrowserContext,
  coords: Partial<Coords> = {}
) {
  const merged = { ...DEFAULT_COORDS, ...coords };
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({
    latitude: merged.latitude,
    longitude: merged.longitude,
    accuracy: merged.accuracy,
  });
  return merged;
}

export async function denyGeolocation(context: BrowserContext) {
  await context.clearPermissions();
}
