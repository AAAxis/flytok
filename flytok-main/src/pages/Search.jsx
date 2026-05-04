import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Search as SearchIcon, ArrowLeft, MapPin, Calendar, Play, User, Moon, Tent, Building, Plane, Plus, X, Music, UtensilsCrossed, Umbrella } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { addSearchHistory } from '@/components/feed/usePreferences';

export default function Search() {
  const [query, setQuery] = useState('');
  const [user, setUser] = useState(null);
  const [userPrefers, setUserPrefers] = useState([]);
  const [showAddPrefer, setShowAddPrefer] = useState(false);
  const [newPrefer, setNewPrefer] = useState('');
  const navigate = useNavigate();
  
  const urlParams = new URLSearchParams(window.location.search);
  const initialQuery = urlParams.get('q') || '';

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        // Load user's preferred searches
        if (currentUser.preferred_searches) {
          setUserPrefers(currentUser.preferred_searches);
        }
      } catch (e) {}
    };
    fetchUser();
  }, []);

  const handleAddPrefer = async () => {
    if (!newPrefer.trim() || !user) return;
    const preferText = newPrefer.startsWith('#') ? newPrefer : `#${newPrefer}`;
    const updated = [...userPrefers, preferText];
    setUserPrefers(updated);
    await base44.auth.updateMe({ preferred_searches: updated });
    setNewPrefer('');
    setShowAddPrefer(false);
  };

  const handleRemovePrefer = async (index) => {
    const updated = userPrefers.filter((_, i) => i !== index);
    setUserPrefers(updated);
    await base44.auth.updateMe({ preferred_searches: updated });
  };

  // Fetch all videos
  const { data: allVideos = [] } = useQuery({
    queryKey: ['allVideos'],
    queryFn: () => base44.entities.Video.list('-created_date', 100),
  });

  // Fetch all users
  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
  });

  // Fetch itineraries (public ones or user's own)
  const { data: allItineraries = [] } = useQuery({
    queryKey: ['allItineraries'],
    queryFn: () => base44.entities.Itinerary.list('-created_date', 50),
  });

  const searchLower = query.toLowerCase().trim();

  // Filter videos
  const filteredVideos = allVideos.filter(video => {
    if (!searchLower) return false;
    return video.caption?.toLowerCase().includes(searchLower) ||
           video.hashtags?.some(tag => tag.toLowerCase().includes(searchLower)) ||
           video.creator_name?.toLowerCase().includes(searchLower) ||
           video.destination?.toLowerCase().includes(searchLower);
  });

  // Filter users
  const filteredUsers = allUsers.filter(u => {
    if (!searchLower) return false;
    return u.full_name?.toLowerCase().includes(searchLower) ||
           u.email?.toLowerCase().includes(searchLower);
  });

  // Filter itineraries
  const filteredItineraries = allItineraries.filter(it => {
    if (!searchLower) return false;
    return it.destination?.toLowerCase().includes(searchLower) ||
           it.title?.toLowerCase().includes(searchLower);
  });

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim() && user) {
      addSearchHistory(user.email, query.trim());
    }
  };

  const handleVideoClick = (video) => {
    navigate(createPageUrl('Home') + `?video=${video.id}`);
  };

  const handleUserClick = (u) => {
    navigate(createPageUrl('Profile') + `?email=${u.email}`);
  };

  const handleItineraryClick = (it) => {
    navigate(createPageUrl('Itinerary') + `?id=${it.id}`);
  };

  const totalResults = filteredVideos.length + filteredUsers.length + filteredItineraries.length;

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-black/95 backdrop-blur-lg z-20 p-4 border-b border-zinc-800">
        <form onSubmit={handleSearch} className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search videos, users, destinations..."
              className="pl-10 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 rounded-full h-11"
              autoFocus
            />
          </div>
        </form>
      </div>

      {!searchLower ? (
        <div className="p-4">
          {/* Popular Searches */}
          <h3 className="text-white font-semibold mb-4">Popular Searches</h3>
          <div className="flex flex-wrap gap-2">
            {[
              { label: '#Nightlife', icon: Moon, color: 'from-purple-500 to-pink-500' },
              { label: '#Trips', icon: Plane, color: 'from-sky-500 to-blue-500' },
              { label: '#Camps', icon: Tent, color: 'from-green-500 to-emerald-500' },
              { label: '#Hotels', icon: Building, color: 'from-amber-500 to-orange-500' },
              { label: '#Club', icon: Music, color: 'from-pink-500 to-rose-500' },
              { label: '#Restaurant', icon: UtensilsCrossed, color: 'from-red-500 to-orange-500' },
              { label: '#Beach', icon: Umbrella, color: 'from-cyan-500 to-teal-500' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => setQuery(item.label.slice(1).toLowerCase())}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r ${item.color} text-white text-sm font-medium shadow-lg hover:scale-105 transition-transform`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Your Prefers */}
          {user && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Your Prefers</h3>
                <div className="relative">
                  <button
                    onClick={() => setShowAddPrefer(!showAddPrefer)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500/60 to-violet-500/60 text-white text-xs font-medium hover:from-purple-500 hover:to-violet-500 transition-all active:scale-95"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                  
                  {showAddPrefer && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-800 rounded-xl border border-zinc-700 p-3 shadow-xl z-10">
                      <p className="text-zinc-400 text-xs mb-2">Add your preference</p>
                      <div className="flex gap-2">
                        <Input
                          value={newPrefer}
                          onChange={(e) => setNewPrefer(e.target.value)}
                          placeholder="e.g. camping"
                          className="flex-1 h-9 bg-zinc-900 border-zinc-600 text-white text-sm rounded-lg"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleAddPrefer()}
                        />
                        <button
                          onClick={handleAddPrefer}
                          className="w-9 h-9 rounded-lg bg-green-500 hover:bg-green-400 flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {userPrefers.map((prefer, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-green-500/20 border border-green-500/40 text-green-400 text-sm font-medium group hover:bg-green-500/30 transition-colors"
                  >
                    <button onClick={() => setQuery(prefer.slice(1).toLowerCase())}>
                      {prefer}
                    </button>
                    <button
                      onClick={() => handleRemovePrefer(index)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3 text-green-300 hover:text-white" />
                    </button>
                  </div>
                ))}
                {userPrefers.length === 0 && (
                  <p className="text-zinc-500 text-sm">No preferences yet. Add some!</p>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
            <SearchIcon className="w-10 h-10 mb-3" />
            <p>Search for videos, users, or destinations</p>
          </div>
        </div>
      ) : totalResults === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <p className="text-lg mb-1">No results for "{query}"</p>
          <p className="text-sm">Try different keywords</p>
        </div>
      ) : (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full bg-transparent border-b border-zinc-800 rounded-none h-12 px-4">
            <TabsTrigger value="all" className="flex-1 data-[state=active]:bg-transparent data-[state=active]:text-white text-zinc-500">
              All ({totalResults})
            </TabsTrigger>
            <TabsTrigger value="videos" className="flex-1 data-[state=active]:bg-transparent data-[state=active]:text-white text-zinc-500">
              Videos ({filteredVideos.length})
            </TabsTrigger>
            <TabsTrigger value="users" className="flex-1 data-[state=active]:bg-transparent data-[state=active]:text-white text-zinc-500">
              Users ({filteredUsers.length})
            </TabsTrigger>
            <TabsTrigger value="trips" className="flex-1 data-[state=active]:bg-transparent data-[state=active]:text-white text-zinc-500">
              Trips ({filteredItineraries.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-0">
            {/* Users section */}
            {filteredUsers.length > 0 && (
              <div className="p-4 border-b border-zinc-800">
                <h3 className="text-white font-semibold mb-3">Users</h3>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {filteredUsers.slice(0, 5).map(u => (
                    <button key={u.id} onClick={() => handleUserClick(u)} className="flex-shrink-0 flex flex-col items-center">
                      <img
                        src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.email}`}
                        alt={u.full_name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-zinc-700"
                      />
                      <p className="text-white text-xs mt-1 truncate w-16 text-center">{u.full_name}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Itineraries section */}
            {filteredItineraries.length > 0 && (
              <div className="p-4 border-b border-zinc-800">
                <h3 className="text-white font-semibold mb-3">Travel Itineraries</h3>
                <div className="space-y-3">
                  {filteredItineraries.slice(0, 3).map(it => (
                    <button key={it.id} onClick={() => handleItineraryClick(it)} className="w-full flex gap-3 bg-zinc-900 rounded-xl overflow-hidden text-left">
                      <img
                        src={it.cover_image || `https://source.unsplash.com/120x80/?${it.destination}`}
                        alt={it.destination}
                        className="w-24 h-16 object-cover"
                      />
                      <div className="flex-1 py-2 pr-3">
                        <p className="text-white text-sm font-medium truncate">{it.title || it.destination}</p>
                        <p className="text-zinc-500 text-xs flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {it.destination}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Videos grid */}
            {filteredVideos.length > 0 && (
              <div className="p-4">
                <h3 className="text-white font-semibold mb-3">Videos</h3>
                <div className="grid grid-cols-3 gap-1">
                  {filteredVideos.map(video => (
                    <VideoThumb key={video.id} video={video} onClick={() => handleVideoClick(video)} />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="videos" className="mt-0 p-4">
            <div className="grid grid-cols-3 gap-1">
              {filteredVideos.map(video => (
                <VideoThumb key={video.id} video={video} onClick={() => handleVideoClick(video)} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="users" className="mt-0 p-4 space-y-3">
            {filteredUsers.map(u => (
              <button key={u.id} onClick={() => handleUserClick(u)} className="w-full flex items-center gap-3 p-3 bg-zinc-900 rounded-xl">
                <img
                  src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.email}`}
                  alt={u.full_name}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div className="text-left">
                  <p className="text-white font-medium">{u.full_name}</p>
                  <p className="text-zinc-500 text-sm">@{u.email?.split('@')[0]}</p>
                </div>
              </button>
            ))}
          </TabsContent>

          <TabsContent value="trips" className="mt-0 p-4 space-y-3">
            {filteredItineraries.map(it => (
              <button key={it.id} onClick={() => handleItineraryClick(it)} className="w-full bg-zinc-900 rounded-xl overflow-hidden text-left">
                <div className="relative h-28">
                  <img
                    src={it.cover_image || `https://source.unsplash.com/400x200/?${it.destination}`}
                    alt={it.destination}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="absolute bottom-2 left-3">
                    <p className="text-white font-semibold text-sm">{it.title || it.destination}</p>
                    <p className="text-zinc-400 text-xs flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {it.destination}
                    </p>
                  </div>
                </div>
                <div className="p-3 flex items-center gap-2 text-zinc-400 text-xs">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(it.start_date), 'MMM d')} - {format(new Date(it.end_date), 'MMM d')}
                </div>
              </button>
            ))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function VideoThumb({ video, onClick }) {
  return (
    <button onClick={onClick} className="relative aspect-[9/16] bg-zinc-800 overflow-hidden group">
      {video.thumbnail_url ? (
        <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <video src={video.video_url} className="w-full h-full object-cover" muted />
      )}
      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <Play className="w-6 h-6 text-white fill-white" />
      </div>
      <div className="absolute bottom-1 left-1 flex items-center gap-1 text-white text-xs">
        <Play className="w-3 h-3 fill-white" />
        {formatCount(video.views_count || 0)}
      </div>
    </button>
  );
}

function formatCount(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}