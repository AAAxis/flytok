import type { VideoLocation } from '@/lib/firestore';

/**
 * Upload location labels are produced by reverse geocoding in the form
 * "place, city, region, country". The final non-empty segment is therefore a
 * stable, backwards-compatible country key for existing videos too.
 */
export function countryFromLocation(location?: VideoLocation | null): string | null {
  const label = location?.label?.trim();
  if (!label) return null;
  const parts = label.split(',').map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) ?? null;
}

export function sameCountry(
  location: VideoLocation | null | undefined,
  country: string,
): boolean {
  return countryFromLocation(location)?.toLocaleLowerCase() === country.trim().toLocaleLowerCase();
}
