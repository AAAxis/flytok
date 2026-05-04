/**
 * Google Maps dark style. Mirrors the Snazzy / "Aubergine" baseline that the
 * web demo uses, tuned to the brand palette in `lib/theme.ts` so map tiles
 * sit comfortably next to the rest of the dark UI.
 *
 * iOS uses Apple Maps which doesn't accept JSON styles — for that platform
 * `userInterfaceStyle="dark"` on `<MapView>` does the equivalent job.
 */
export const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0f1115' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a8f99' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f1115' }] },
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#2a2f3a' }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#a1a1aa' }],
  },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1a1d24' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#52525b' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#262a33' }],
  },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#070a0f' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#3f3f46' }],
  },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#13161d' }] },
];
