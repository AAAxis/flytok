import { forwardRef, useEffect, useImperativeHandle, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

export type AndroidLatLng = { latitude: number; longitude: number };
export type AndroidRegion = AndroidLatLng & { latitudeDelta: number; longitudeDelta: number };
export type AndroidOpenMapRef = {
  animateToRegion: (region: AndroidRegion, duration?: number) => void;
  fitToCoordinates: (coords: AndroidLatLng[]) => void;
};

export const AndroidOpenMap = forwardRef<AndroidOpenMapRef, {
  children?: ReactNode;
  initialRegion?: AndroidRegion | null;
  onMapReady?: () => void;
  onPress?: (event: any) => void;
  style?: StyleProp<ViewStyle>;
}>(function AndroidOpenMap({ children, onMapReady, style }, ref) {
  useImperativeHandle(ref, () => ({
    animateToRegion() {},
    fitToCoordinates() {},
  }));

  useEffect(() => {
    onMapReady?.();
  }, [onMapReady]);

  return <View style={style}>{children}</View>;
});

export function AndroidOpenMarker({
  children,
}: {
  children?: ReactNode;
  coordinate: AndroidLatLng;
  id?: string;
  onPress?: () => void;
  anchor?: 'center' | 'bottom';
}) {
  return <>{children}</>;
}

export function AndroidOpenPolyline({
  children,
}: {
  children?: ReactNode;
  coordinates: AndroidLatLng[];
  id: string;
  strokeColor: string;
  strokeWidth: number;
}) {
  return <>{children}</>;
}
