import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import WebViewBase, { type WebViewMessageEvent } from 'react-native-webview';

const WebView = WebViewBase as any;

export type AndroidLatLng = { latitude: number; longitude: number };
export type AndroidRegion = AndroidLatLng & { latitudeDelta: number; longitudeDelta: number };
export type AndroidOpenMapRef = {
  animateToRegion: (region: AndroidRegion, duration?: number) => void;
  fitToCoordinates: (coords: AndroidLatLng[]) => void;
};

type MarkerModel = { id: string; coordinate: AndroidLatLng; html: string };
type LineModel = { id: string; coordinates: AndroidLatLng[]; strokeColor: string; strokeWidth: number };
type MapContextValue = {
  setMarker: (marker: MarkerModel, handler?: () => void) => void;
  removeMarker: (id: string) => void;
  setLine: (line: LineModel) => void;
  removeLine: (id: string) => void;
};

const MapContext = createContext<MapContextValue | null>(null);

function zoomForRegion(region: AndroidRegion): number {
  const delta = Math.max(region.longitudeDelta || 0.05, 0.0001);
  return Math.max(1, Math.min(18, Math.round(Math.log2(360 / delta))));
}

function esc(value: string) {
  return value.replace(/[&<>"']/g, (ch) => (
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;'
  ));
}

function pinHtml(label: string, selected = false) {
  const gold = selected ? ' gold' : '';
  return `<div class="pin-head${gold}">${esc(label)}</div><div class="pin-tip${gold}"></div>`;
}

function baseHtml(initial: AndroidRegion) {
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
html,body,#map{height:100%;width:100%;margin:0;background:#0b0f14}.leaflet-container{background:#0b0f14;font-family:-apple-system,BlinkMacSystemFont,sans-serif}.leaflet-control-attribution{background:rgba(8,12,18,.72);color:#d1d5db;font:10px -apple-system,sans-serif}.roamerz-pin{transform:translate(-50%,-100%)}.pin-head{min-width:30px;height:30px;padding:0 8px;border-radius:16px;background:#38bdf8;color:#020617;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:2px solid rgba(255,255,255,.9);box-shadow:0 6px 14px rgba(0,0,0,.35)}.pin-head.gold{background:#fbbf24}.pin-tip{width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:10px solid #38bdf8;margin:-2px auto 0}.pin-tip.gold{border-top-color:#fbbf24}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map=L.map('map',{zoomControl:false,attributionControl:true}).setView([${initial.latitude},${initial.longitude}],${zoomForRegion(initial)});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
var markerLayer=L.layerGroup().addTo(map),lineLayer=L.layerGroup().addTo(map);
function post(p){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(p))}
map.on('click',function(e){post({type:'mapPress',latitude:e.latlng.lat,longitude:e.latlng.lng})});
window.setData=function(payload){markerLayer.clearLayers();lineLayer.clearLayers();(payload.lines||[]).forEach(function(line){if(!line.coordinates||line.coordinates.length<2)return;L.polyline(line.coordinates.map(function(c){return[c.latitude,c.longitude]}),{color:line.strokeColor,weight:line.strokeWidth,opacity:.95,lineCap:'round',lineJoin:'round'}).addTo(lineLayer)});(payload.markers||[]).forEach(function(marker){var icon=L.divIcon({className:'roamerz-pin',html:marker.html,iconSize:[44,44],iconAnchor:[22,44]});L.marker([marker.coordinate.latitude,marker.coordinate.longitude],{icon:icon}).on('click',function(e){L.DomEvent.stopPropagation(e);post({type:'markerPress',id:marker.id})}).addTo(markerLayer)})};
window.setCenter=function(region){map.setView([region.latitude,region.longitude],${zoomForRegion(initial)},{animate:true})};
window.fitCoords=function(coords){if(!coords||coords.length===0)return;map.fitBounds(L.latLngBounds(coords.map(function(c){return[c.latitude,c.longitude]})),{padding:[40,40],animate:false})};
post({type:'ready'});
</script></body></html>`;
}

export const AndroidOpenMap = forwardRef<AndroidOpenMapRef, {
  children?: ReactNode;
  initialRegion?: AndroidRegion | null;
  onMapReady?: () => void;
  onPress?: (event: any) => void;
  style?: StyleProp<ViewStyle>;
}>(function AndroidOpenMap({ children, initialRegion, onMapReady, onPress, style }, ref) {
  const webRef = useRef<any>(null);
  const handlersRef = useRef(new Map<string, () => void>());
  const [ready, setReady] = useState(false);
  const [markers, setMarkers] = useState<Record<string, MarkerModel>>({});
  const [lines, setLines] = useState<Record<string, LineModel>>({});
  const initial = initialRegion ?? { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.1, longitudeDelta: 0.1 };
  const html = useMemo(() => baseHtml(initial), [initial.latitude, initial.longitude, initial.latitudeDelta, initial.longitudeDelta]);
  const payload = useMemo(() => ({ markers: Object.values(markers), lines: Object.values(lines) }), [markers, lines]);

  const sendData = () => {
    webRef.current?.injectJavaScript(`window.setData(${JSON.stringify(payload)}); true;`);
  };

  useEffect(() => {
    if (ready) sendData();
  }, [ready, payload]);

  useImperativeHandle(ref, () => ({
    animateToRegion(region) {
      webRef.current?.injectJavaScript(`window.setCenter(${JSON.stringify(region)}); true;`);
    },
    fitToCoordinates(coords) {
      webRef.current?.injectJavaScript(`window.fitCoords(${JSON.stringify(coords)}); true;`);
    },
  }));

  const context = useMemo<MapContextValue>(() => ({
    setMarker(marker, handler) {
      if (handler) handlersRef.current.set(marker.id, handler);
      setMarkers((prev) => ({ ...prev, [marker.id]: marker }));
    },
    removeMarker(id) {
      handlersRef.current.delete(id);
      setMarkers((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    setLine(line) {
      setLines((prev) => ({ ...prev, [line.id]: line }));
    },
    removeLine(id) {
      setLines((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
  }), []);

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') {
        setReady(true);
        onMapReady?.();
      } else if (data.type === 'markerPress') {
        handlersRef.current.get(data.id)?.();
      } else if (data.type === 'mapPress') {
        onPress?.({ nativeEvent: { lngLat: [data.longitude, data.latitude] } });
      }
    } catch {}
  }

  return (
    <MapContext.Provider value={context}>
      <WebView
        ref={webRef}
        source={{ html }}
        style={[styles.flex, style]}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        onMessage={handleMessage}
        onLoadEnd={sendData}
      />
      {children}
    </MapContext.Provider>
  );
});

export function AndroidOpenMarker({
  coordinate,
  id,
  onPress,
}: {
  children: ReactNode;
  coordinate: AndroidLatLng;
  id?: string;
  onPress?: () => void;
  anchor?: 'center' | 'bottom';
}) {
  const ctx = useContext(MapContext);
  const markerId = id ?? `${coordinate.latitude}:${coordinate.longitude}`;
  useEffect(() => {
    ctx?.setMarker(
      {
        id: markerId,
        coordinate,
        html: pinHtml(markerId.match(/\d+$/)?.[0] ?? '•'),
      },
      onPress,
    );
    return () => ctx?.removeMarker(markerId);
  }, [ctx, markerId, coordinate.latitude, coordinate.longitude, onPress]);
  return null;
}

export function AndroidOpenPolyline({
  coordinates,
  id,
  strokeColor,
  strokeWidth,
}: {
  coordinates: AndroidLatLng[];
  id: string;
  strokeColor: string;
  strokeWidth: number;
}) {
  const ctx = useContext(MapContext);
  useEffect(() => {
    ctx?.setLine({ id, coordinates, strokeColor, strokeWidth });
    return () => ctx?.removeLine(id);
  }, [ctx, id, coordinates, strokeColor, strokeWidth]);
  return null;
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
