import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Heart, MessageCircle, Share2, Eye, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function TrendingPlacesModal({ isOpen, onClose }) {
  const navigate = useNavigate();

  const { data: videos = [] } = useQuery({
    queryKey: ['videos'],
    queryFn: () => base44.entities.Video.list('-created_date', 200),
  });

  // Calculate trending places
  const trendingPlaces = React.useMemo(() => {
    const placeStats = {};

    videos.forEach(video => {
      if (!video.location) return;

      const location = video.location.toLowerCase().trim();
      if (!placeStats[location]) {
        placeStats[location] = {
          location: video.location,
          videos: [],
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          totalViews: 0,
        };
      }

      placeStats[location].videos.push(video);
      placeStats[location].totalLikes += video.likes_count || 0;
      placeStats[location].totalComments += video.comments_count || 0;
      placeStats[location].totalShares += video.shares_count || 0;
      placeStats[location].totalViews += video.views_count || 0;
    });

    // Calculate trending score (weighted)
    const places = Object.values(placeStats).map(place => ({
      ...place,
      score: 
        (place.totalLikes * 2) + 
        (place.totalComments * 3) + 
        (place.totalShares * 4) + 
        (place.totalViews * 1) +
        (place.videos.length * 5)
    }));

    // Sort by score and get top 15
    return places.sort((a, b) => b.score - a.score).slice(0, 15);
  }, [videos]);

  const handlePlaceClick = (place) => {
    onClose();
    // Navigate to search with location
    navigate(createPageUrl('Search') + `?q=${encodeURIComponent(place.location)}`);
  };

  const formatCount = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num?.toString() || '0';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-b from-zinc-900 to-black rounded-t-3xl max-h-[85vh] overflow-hidden"
          >
            {/* Header */}
            <div className="sticky top-0 bg-zinc-900/95 backdrop-blur-lg border-b border-zinc-800 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="text-white font-bold text-xl">Trending Places</h2>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
              <p className="text-zinc-400 text-sm mt-1">Top destinations based on engagement</p>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(85vh-5rem)] pb-6">
              {trendingPlaces.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                  <MapPin className="w-12 h-12 mb-2" />
                  <p>No trending places yet</p>
                </div>
              ) : (
                <div className="px-4 pt-4 space-y-3">
                  {trendingPlaces.map((place, index) => (
                    <motion.button
                      key={place.location}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handlePlaceClick(place)}
                      className="w-full bg-zinc-800/50 hover:bg-zinc-800 rounded-2xl p-4 transition-all text-left border border-zinc-700/50 hover:border-zinc-600"
                    >
                      <div className="flex items-start gap-4">
                        {/* Rank */}
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-lg ${
                          index === 0 ? 'bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-600 text-yellow-900 shadow-yellow-500/50' :
                          index === 1 ? 'bg-gradient-to-br from-gray-200 via-gray-300 to-gray-400 text-gray-800 shadow-gray-400/50' :
                          index === 2 ? 'bg-gradient-to-br from-orange-400 via-amber-600 to-orange-700 text-white shadow-orange-600/50' :
                          'bg-zinc-700 text-zinc-300'
                        }`}>
                          {index + 1}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <MapPin className="w-4 h-4 text-sky-400 flex-shrink-0" />
                              <h3 className="text-white font-semibold truncate">{place.location}</h3>
                            </div>
                            <div className="flex items-center gap-1 text-orange-400 flex-shrink-0">
                              <TrendingUp className="w-3 h-3" />
                              <span className="text-xs font-medium">{formatCount(place.score)}</span>
                            </div>
                          </div>

                          {/* Stats */}
                          <div className="flex items-center gap-4 text-xs text-zinc-400">
                            <span className="flex items-center gap-1">
                              <Heart className="w-3 h-3" />
                              {formatCount(place.totalLikes)}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="w-3 h-3" />
                              {formatCount(place.totalComments)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Share2 className="w-3 h-3" />
                              {formatCount(place.totalShares)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {formatCount(place.totalViews)}
                            </span>
                          </div>

                          {/* Video count */}
                          <p className="text-xs text-zinc-500 mt-2">
                            {place.videos.length} video{place.videos.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}