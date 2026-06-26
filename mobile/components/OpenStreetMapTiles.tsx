import { Platform } from 'react-native';
import { UrlTile } from 'react-native-maps';

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const androidOpenMapType = Platform.OS === 'android' ? 'none' : 'standard';

export function OpenStreetMapTiles() {
  if (Platform.OS !== 'android') return null;
  return (
    <UrlTile
      urlTemplate={OSM_TILE_URL}
      maximumZ={19}
      maximumNativeZ={19}
      flipY={false}
      tileSize={256}
      opacity={1}
      zIndex={1}
    />
  );
}
