import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Play, MapPin, Heart, Eye, Filter, X, Navigation } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icon for user location
const userLocationIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10" fill="#4ade80" opacity="0.2"/>
      <circle cx="12" cy="12" r="6" fill="#4ade80"/>
      <circle cx="12" cy="12" r="2" fill="white"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

function RecenterMap({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 12);
    }
  }, [center, map]);
  return null;
}

// Location coordinates mapping
const locationCoords = {
  'rome, italy': [41.9028, 12.4964],
  'paris, france': [48.8566, 2.3522],
  'tokyo, japan': [35.6762, 139.6503],
  'kyoto, japan': [35.0116, 135.7681],
  'london, united kingdom': [51.5074, -0.1278],
  'new york city, usa': [40.7128, -74.0060],
  'sydney, australia': [-33.8688, 151.2093],
  'dubai, uae': [25.2048, 55.2708],
  'bali, indonesia': [-8.3405, 115.0920],
  'santorini, greece': [36.3932, 25.4615],
  'marrakech, morocco': [31.6295, -7.9811],
  'rio de janeiro, brazil': [-22.9068, -43.1729],
  'maldives': [3.2028, 73.2207],
  'cappadocia, turkey': [38.6431, 34.8289],
  'swiss alps, switzerland': [46.8182, 8.2275],
  'reykjavik, iceland': [64.1466, -21.9426],
  'agra, india': [27.1767, 78.0081],
  'masai mara, kenya': [-1.4061, 35.0175],
  'phi phi islands, thailand': [7.7407, 98.7784],
  'amalfi, italy': [40.6340, 14.6027],
};

function getCoordinates(location) {
  if (!location) return null;
  const normalized = location.toLowerCase().trim();
  
  // Direct match
  if (locationCoords[normalized]) return locationCoords[normalized];
  
  // Partial match
  for (const [key, coords] of Object.entries(locationCoords)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return coords;
    }
  }
  
  return null;
}

function formatCount(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num?.toString() || '0';
}

export default function Map() {
  const navigate = useNavigate();
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [menuOpen, setMenuOpen] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  
  // Swipe navigation
  const touchStartX = React.useRef(0);
  const touchStartY = React.useRef(0);

  const handleTouchStart = (e) => {
    const screenWidth = window.innerWidth;
    const touchX = e.touches[0].clientX;
    
    // Only allow swipe if starting from left or right edge (within 50px)
    if (touchX < 50 || touchX > screenWidth - 50) {
      touchStartX.current = touchX;
      touchStartY.current = e.touches[0].clientY;
    } else {
      touchStartX.current = -1; // Invalid start
    }
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === -1) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = Math.abs(touchEndY - touchStartY.current);
    
    if (Math.abs(deltaX) > deltaY && Math.abs(deltaX) > 100) {
      if (deltaX > 0) {
        navigate(createPageUrl('Home'));
      } else {
        navigate(createPageUrl('Saved'));
      }
    }
    
    touchStartX.current = -1;
  };

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ['videos'],
    queryFn: () => base44.entities.Video.list('-created_date', 100),
  });

  // Get all unique hashtags/categories
  const categories = ['all', ...new Set(videos.flatMap(v => v.hashtags || []))].slice(0, 10);

  // Filter videos by category
  const filteredVideos = selectedCategory === 'all' 
    ? videos 
    : videos.filter(v => v.hashtags?.includes(selectedCategory));

  // Group videos by location
  const videosByLocation = filteredVideos.reduce((acc, video) => {
    if (video.location) {
      const coords = getCoordinates(video.location);
      if (coords) {
        const key = coords.join(',');
        if (!acc[key]) {
          acc[key] = { coords, location: video.location, videos: [] };
        }
        acc[key].videos.push(video);
      }
    }
    return acc;
  }, {});

  const locations = Object.values(videosByLocation);

  const enableLocation = () => {
    if (navigator.geolocation) {
      setLocationEnabled(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
        },
        (error) => {
          console.error('Error getting location:', error);
          setLocationEnabled(false);
          alert('Could not get your location. Please check your browser permissions.');
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div 
      className="h-[calc(100vh-4rem)] pb-16 bg-black relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top right buttons */}
      <div className="absolute top-4 right-4 z-[1001] flex flex-col gap-2">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500/90 to-sky-700/90 backdrop-blur-sm flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
        >
          <Filter className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={enableLocation}
          className={`w-10 h-10 rounded-full backdrop-blur-sm flex items-center justify-center shadow-lg hover:scale-110 transition-transform ${
            locationEnabled
              ? 'bg-gradient-to-br from-blue-500/90 to-blue-700/90'
              : 'bg-gradient-to-br from-gray-500/90 to-gray-700/90'
          }`}
        >
          <Navigation className={`w-5 h-5 text-white ${locationEnabled ? 'fill-white' : ''}`} />
        </button>
      </div>

      {/* Category menu */}
      <div className={`absolute top-0 left-0 bottom-0 z-[1000] w-64 bg-gradient-to-br from-sky-900/95 via-sky-800/95 to-sky-900/95 backdrop-blur-xl transform transition-transform duration-300 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-sky-600/50">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-white font-semibold text-lg">Categories</h2>
            <button onClick={() => setMenuOpen(false)} className="w-8 h-8 rounded-full bg-sky-700/50 flex items-center justify-center hover:bg-sky-700 transition-colors">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
          <p className="text-sky-200 text-xs">
            Filter by category
          </p>
        </div>
        
        <div className="p-4 space-y-2 overflow-y-auto max-h-[calc(100%-5rem)]">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                setMenuOpen(false);
              }}
              className={`w-full px-4 py-3 rounded-xl text-sm font-medium text-left transition-all ${
                selectedCategory === cat
                  ? 'bg-white text-sky-900 shadow-lg'
                  : 'bg-sky-700/30 text-sky-100 hover:bg-sky-700/50'
              }`}
            >
              {cat === 'all' ? '✨ All Categories' : `#${cat}`}
            </button>
          ))}
        </div>
      </div>

      {/* Backdrop */}
      {menuOpen && (
        <div 
          className="absolute inset-0 bg-black/50 z-[999]"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Map */}
      <MapContainer
        center={[20, 0]}
        zoom={2}
        className="h-full w-full"
        style={{ background: '#1a1a1a' }}
        closePopupOnClick={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {userLocation && <RecenterMap center={userLocation} />}

        {userLocation && (
          <Marker position={userLocation} icon={userLocationIcon}>
            <Popup>
              <div className="bg-zinc-900 rounded-lg p-2">
                <p className="text-white text-sm font-medium">Your Location</p>
                <p className="text-zinc-400 text-xs">You are here</p>
              </div>
            </Popup>
          </Marker>
        )}

        {locations.map((loc, index) => (
          <Marker 
            key={index} 
            position={loc.coords}
            eventHandlers={{
              click: () => setSelectedLocation(loc),
            }}
          >
            <Popup className="video-popup">
              <div className="bg-zinc-900 rounded-lg overflow-hidden min-w-[250px]">
                <div className="p-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-rose-500" />
                    <span className="text-white font-medium text-sm">{loc.location}</span>
                  </div>
                  <p className="text-zinc-400 text-xs mt-1">{loc.videos.length} video{loc.videos.length > 1 ? 's' : ''}</p>
                </div>
                
                <div className="max-h-[300px] overflow-y-auto">
                  {loc.videos.map((video) => (
                    <div 
                      key={video.id}
                      onClick={() => navigate(createPageUrl('Home') + `?video=${video.id}`)}
                      className="p-2 hover:bg-zinc-800 cursor-pointer border-b border-zinc-800 last:border-0"
                    >
                      <div className="flex gap-2">
                        <div className="relative w-16 h-20 rounded overflow-hidden flex-shrink-0">
                          {video.thumbnail_url ? (
                            <img 
                              src={video.thumbnail_url} 
                              alt="" 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <video 
                              src={video.video_url} 
                              className="w-full h-full object-cover"
                              muted
                            />
                          )}
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <Play className="w-4 h-4 text-white fill-white" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs line-clamp-2">{video.caption}</p>
                          <p className="text-zinc-500 text-xs mt-1">@{video.creator_name}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="flex items-center gap-1 text-zinc-500 text-xs">
                              <Heart className="w-3 h-3" />
                              {formatCount(video.likes_count)}
                            </span>
                            <span className="flex items-center gap-1 text-zinc-500 text-xs">
                              <Eye className="w-3 h-3" />
                              {formatCount(video.views_count)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Custom styles for popup */}
      <style>{`
        .leaflet-popup-content-wrapper {
          background: transparent;
          box-shadow: none;
          padding: 0;
        }
        .leaflet-popup-content {
          margin: 0;
        }
        .leaflet-popup-tip {
          background: #18181b;
        }
        .leaflet-container {
          background: #1a1a1a;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}