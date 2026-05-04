import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Search, TrendingUp, Hash } from 'lucide-react';
import VideoGrid from '@/components/profile/VideoGrid';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';

export default function Discover() {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // Fetch all videos
  const { data: allVideos = [] } = useQuery({
    queryKey: ['allVideos'],
    queryFn: () => base44.entities.Video.list('-views_count', 100),
  });

  // Get trending hashtags
  const trendingHashtags = React.useMemo(() => {
    const tagCounts = {};
    allVideos.forEach(video => {
      video.hashtags?.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    return Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .map(([tag, count]) => ({ tag, count }));
  }, [allVideos]);

  // Filter videos based on search
  const filteredVideos = React.useMemo(() => {
    if (!searchQuery.trim()) return allVideos;
    const query = searchQuery.toLowerCase();
    return allVideos.filter(video => 
      video.caption?.toLowerCase().includes(query) ||
      video.hashtags?.some(tag => tag.toLowerCase().includes(query)) ||
      video.creator_name?.toLowerCase().includes(query)
    );
  }, [allVideos, searchQuery]);

  const handleHashtagClick = (tag) => {
    setSearchQuery(tag);
  };

  const handleVideoClick = (video) => {
    navigate(createPageUrl('Home'));
  };

  return (
    <div className="h-screen bg-black flex flex-col">
      {/* Search header */}
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-lg p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search videos, hashtags, users..."
            className="pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500 rounded-full h-12"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-20">
        {!searchQuery && (
          <>
            {/* Trending section */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-rose-500" />
                <h2 className="text-white font-semibold text-lg">Trending</h2>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {trendingHashtags.map(({ tag, count }) => (
                  <button
                    key={tag}
                    onClick={() => handleHashtagClick(tag)}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-900 rounded-full hover:bg-zinc-800 transition-colors"
                  >
                    <Hash className="w-4 h-4 text-rose-500" />
                    <span className="text-white font-medium">{tag}</span>
                    <span className="text-zinc-500 text-sm">{count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Categories */}
            <div className="mb-6">
              <h2 className="text-white font-semibold text-lg mb-4">Explore</h2>
              <div className="grid grid-cols-2 gap-2">
                {['Dance', 'Comedy', 'Food', 'Sports', 'Music', 'Travel'].map((category) => (
                  <button
                    key={category}
                    onClick={() => setSearchQuery(category.toLowerCase())}
                    className="relative h-24 rounded-xl overflow-hidden group"
                  >
                    <img
                      src={`https://images.unsplash.com/photo-${getCategoryImage(category)}?w=400&h=300&fit=crop`}
                      alt={category}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <span className="absolute bottom-3 left-3 text-white font-semibold">
                      {category}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Search results or all videos */}
        <div>
          {searchQuery && (
            <h2 className="text-white font-semibold text-lg mb-4">
              Results for "{searchQuery}"
            </h2>
          )}
          <VideoGrid videos={filteredVideos} onVideoClick={handleVideoClick} />
        </div>
      </div>
    </div>
  );
}

function getCategoryImage(category) {
  const images = {
    Dance: '1547153760-18fc86324498',
    Comedy: '1527224538127-308e3f8e5358',
    Food: '1504674900247-0877df9cc836',
    Sports: '1461896836934-d13b35d8b91f',
    Music: '1511671782779-c97d3d27a1d4',
    Travel: '1469474968028-56623f02e42e'
  };
  return images[category] || images.Travel;
}