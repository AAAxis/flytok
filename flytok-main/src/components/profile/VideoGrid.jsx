import React from 'react';
import { Play } from 'lucide-react';
import { motion } from 'framer-motion';

export default function VideoGrid({ videos, onVideoClick }) {
  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
        <Play className="w-12 h-12 mb-3" />
        <p>No videos yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-0.5">
      {videos.map((video, index) => (
        <motion.button
          key={video.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.05 }}
          onClick={() => onVideoClick(video)}
          className="relative aspect-[9/16] bg-zinc-800 overflow-hidden group"
        >
          {video.thumbnail_url ? (
            <img
              src={video.thumbnail_url}
              alt={video.caption}
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              src={video.video_url}
              className="w-full h-full object-cover"
              muted
            />
          )}
          
          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="flex items-center gap-1 text-white font-semibold">
              <Play className="w-4 h-4 fill-white" />
              {formatCount(video.views_count || 0)}
            </div>
          </div>
        </motion.button>
      ))}
    </div>
  );
}

function formatCount(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}