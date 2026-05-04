import * as Location from 'expo-location';

export type GeoResult = {
  label: string;
  latitude: number;
  longitude: number;
};

// iOS sometimes returns place.name as a raw "lat, lng" string when the pin
// isn't on a known address. Reject those — we want a real place label.
function looksLikeCoords(s: string): boolean {
  return /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(s.trim());
}

function placeLabel(p: Location.LocationGeocodedAddress, fallback?: string): string {
  const candidates = [p.name, p.street, p.city, p.subregion, p.region, p.country];
  const parts = candidates
    .filter((x): x is string => x != null && !looksLikeCoords(x));
  // dedupe consecutive duplicates (e.g., when name === city)
  const out: string[] = [];
  for (const part of parts) {
    if (out[out.length - 1] !== part) out.push(part);
  }
  const label = out.join(', ');
  if (label) return label;
  if (p.country && !looksLikeCoords(p.country)) return p.country;
  return fallback || 'Pinned location';
}

export async function geocodeAddress(query: string, max = 5): Promise<GeoResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const matches = await Location.geocodeAsync(trimmed);
  if (!matches.length) return [];

  // Reverse-geocode each candidate so we can show a friendly label.
  const top = matches.slice(0, max);
  const results = await Promise.all(
    top.map(async (m) => {
      try {
        const places = await Location.reverseGeocodeAsync({
          latitude: m.latitude,
          longitude: m.longitude,
        });
        const place = places[0];
        return {
          latitude: m.latitude,
          longitude: m.longitude,
          label: place ? placeLabel(place, trimmed) : trimmed,
        };
      } catch {
        return { latitude: m.latitude, longitude: m.longitude, label: trimmed };
      }
    }),
  );

  // Drop duplicates by label
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.label)) return false;
    seen.add(r.label);
    return true;
  });
}

export async function getCurrentLocationLabeled(): Promise<GeoResult> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Location permission denied');
  }
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  let label = 'Current location';
  try {
    const places = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
    if (places[0]) label = placeLabel(places[0], label);
  } catch {
    // keep fallback label
  }
  return {
    label,
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
  };
}

/**
 * Best-effort country-level location used as a fallback when the user didn't
 * pick a specific place but we still want a pin on the map. Returns null if
 * GPS permission is denied.
 */
export async function getCountryLocation(): Promise<GeoResult | null> {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    let granted = perm.granted;
    if (!granted && perm.canAskAgain) {
      const ask = await Location.requestForegroundPermissionsAsync();
      granted = ask.granted;
    }
    if (!granted) return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Lowest,
    });
    const places = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
    const country = places[0]?.country ?? 'Unknown';
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      label: country,
    };
  } catch {
    return null;
  }
}
