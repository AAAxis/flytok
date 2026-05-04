import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Bookmark, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import VideoGrid from '@/components/profile/VideoGrid';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';

export default function Saved() {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const navigate = useNavigate();
  
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
        navigate(createPageUrl('Map'));
      } else {
        navigate(createPageUrl('Profile'));
      }
    }
    
    touchStartX.current = -1;
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (e) {
        // Not logged in
      }
    };
    fetchUser();
  }, []);

  // Fetch saved video IDs
  const { data: savedVideoIds = [] } = useQuery({
    queryKey: ['savedVideos', user?.email],
    queryFn: () => base44.entities.SavedVideo.filter({ user_email: user?.email }, '-created_date'),
    enabled: !!user?.email,
  });

  // Fetch full video data
  const { data: savedVideos = [], isLoading } = useQuery({
    queryKey: ['savedVideosFull', savedVideoIds.map(s => s.video_id).join(',')],
    queryFn: async () => {
      const vids = [];
      for (const saved of savedVideoIds) {
        const videos = await base44.entities.Video.filter({ id: saved.video_id });
        if (videos.length > 0) vids.push(videos[0]);
      }
      return vids;
    },
    enabled: savedVideoIds.length > 0,
  });

  const handleVideoClick = (video) => {
    navigate(createPageUrl('Home'));
  };

  const filteredVideos = savedVideos.filter(v =>
    !searchQuery ||
    v.caption?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.hashtags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
    v.creator_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 pb-20">
        <div className="text-center">
          <Bookmark className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
          <p className="text-white text-xl mb-2">Saved Videos</p>
          <p className="text-zinc-500 mb-4">Log in to see your saved videos</p>
          <button
            onClick={() => base44.auth.redirectToLogin()}
            className="px-6 py-2 bg-rose-500 text-white rounded-full font-semibold"
          >
            Log in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-black pb-20"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="sticky top-0 bg-black/95 backdrop-blur-lg z-10 border-b border-zinc-800">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-white font-bold text-xl">Saved</h1>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          {showSearch ? (
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search saved videos..."
                  className="pl-9 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500 rounded-full h-9"
                  autoFocus
                />
              </div>
              <button
                onClick={() => { setShowSearch(false); setSearchQuery(''); }}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm w-full bg-zinc-900 rounded-full px-4 py-2"
            >
              <Search className="w-4 h-4" />
              Search saved videos
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : savedVideos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <Bookmark className="w-16 h-16 mb-4" />
          <p className="text-lg">No saved videos yet</p>
          <p className="text-sm">Videos you save will appear here</p>
        </div>
      ) : (
        <VideoGrid videos={filteredVideos} onVideoClick={handleVideoClick} />
      )}
    </div>
  );
}