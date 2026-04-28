import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

// OpenStreetMap Nominatim — free, no API key. Their usage policy asks for a
// real User-Agent and modest request volume; we only fire after a debounce.
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

export function LocationPicker({ value, onChange }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${NOMINATIM}?format=json&limit=5&q=${encodeURIComponent(query)}`,
          { headers: { Accept: 'application/json' } },
        );
        if (!res.ok) throw new Error('Geocoding failed');
        const data = await res.json();
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => debounce.current && clearTimeout(debounce.current);
  }, [query]);

  function pick(r) {
    onChange({
      latitude: parseFloat(r.lat),
      longitude: parseFloat(r.lon),
      label: r.display_name,
    });
    setResults([]);
    setQuery('');
  }

  function useCurrent() {
    if (!('geolocation' in navigator)) {
      alert('This browser does not support geolocation.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          label: 'Current location',
        });
      },
      (err) => alert(err.message ?? 'Could not get current location'),
      { enableHighAccuracy: true, timeout: 7000 },
    );
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-start gap-2 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2">
          <MapPin className="w-4 h-4 text-sky-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-zinc-100 text-sm truncate">{value.label}</div>
            <div className="text-zinc-500 text-xs">
              {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-zinc-500 hover:text-zinc-200"
            aria-label="Remove location"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a place (e.g. Eiffel Tower, Tokyo)…"
              className="pl-9 bg-zinc-950 border-zinc-800 text-zinc-100"
              autoComplete="off"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 animate-spin" />
            )}
          </div>

          {results.length > 0 && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-md overflow-hidden max-h-60 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={`${r.osm_type}-${r.osm_id}`}
                  type="button"
                  onClick={() => pick(r)}
                  className="w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900 flex items-start gap-2 border-b border-zinc-900 last:border-b-0"
                >
                  <MapPin className="w-3.5 h-3.5 text-zinc-500 mt-0.5 flex-shrink-0" />
                  <span className="truncate">{r.display_name}</span>
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={useCurrent}
            className="text-xs text-sky-400 hover:text-sky-300"
          >
            Use my current location
          </button>
        </>
      )}
    </div>
  );
}
