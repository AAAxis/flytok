import React, { useRef, useEffect, useState } from 'react';
import { Heart, MessageCircle, Share2, Music2, Plus, Check, Play, Pause, Bookmark, MapPin, Volume2, VolumeX, Maximize } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function VideoPlayer({ 
  video, 
  isActive, 
  onLike, 
  onComment, 
  onShare, 
  onFollow,
  onSave,
  isLiked,
  isFollowing,
  isSaved,
  onProfileClick
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
      const [volume, setVolume] = useState(1);
      const [isFullscreen, setIsFullscreen] = useState(false);
          const lastTap = useRef(0);
          const controlsTimeout = useRef(null);
          const touchStartY = useRef(0);

  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [isActive]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      setProgress((video.currentTime / video.duration) * 100);
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newProgress = (clickX / rect.width) * 100;
    const newTime = (newProgress / 100) * duration;
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      videoRef.current.muted = newVolume === 0;
      setIsMuted(newVolume === 0);
    }
  };

  const toggleFullscreen = () => {
        if (containerRef.current) {
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            containerRef.current.requestFullscreen();
          }
        }
      };

      useEffect(() => {
        const handleFullscreenChange = () => {
          setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
      }, []);

  const formatTime = (time) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleShowControls = () => {
        setShowControls(true);
        if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
        if (!isFullscreen) {
          controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
        }
      };

      const handleTouchStart = (e) => {
        touchStartY.current = e.touches[0].clientY;
      };

      const handleTouchEnd = (e) => {
        const touchEndY = e.changedTouches[0].clientY;
        const swipeDistance = touchStartY.current - touchEndY;
        // Swipe up from bottom (positive distance means upward swipe)
        if (swipeDistance > 50) {
          setShowControls(true);
          if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
          if (!isFullscreen) {
            controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
          }
        }
      };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!isLiked) {
        onLike();
      }
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 1000);
    }
    lastTap.current = now;
  };

  return (
    <div 
                ref={containerRef}
                className="relative h-full w-full bg-black"
                onMouseMove={handleShowControls}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
      {/* Video */}
      <video
              ref={videoRef}
              src={video.video_url}
              className="h-full w-full object-cover"
              loop
              muted={isMuted}
              playsInline
              preload="auto"
              onClick={() => {
                handleDoubleTap();
                togglePlay();
              }}
              poster={video.thumbnail_url}
              style={{ imageRendering: 'high-quality' }}
              disablePictureInPicture={false}
            />

      {/* Play/Pause indicator */}
      <AnimatePresence>
        {!isPlaying && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="bg-black/30 rounded-full p-5">
              <Play className="w-12 h-12 text-white fill-white" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Double tap heart */}
      <AnimatePresence>
        {showHeart && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <Heart className="w-24 h-24 text-sky-400 fill-sky-400 drop-shadow-lg" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Controls */}
                  <AnimatePresence>
                    {(showControls || isFullscreen) && (
                      <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                        className="absolute bottom-4 left-4 right-20 z-20"
                      >
            {/* Progress bar */}
            <div 
              className="w-full h-1 bg-white/30 rounded-full cursor-pointer mb-3"
              onClick={handleProgressClick}
            >
              <div 
                className="h-full bg-white rounded-full relative"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md" />
              </div>
            </div>

            {/* Controls row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Play/Pause */}
                <button 
                  onClick={togglePlay}
                  className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 text-white fill-white" />
                  ) : (
                    <Play className="w-4 h-4 text-white fill-white" />
                  )}
                </button>

                {/* Time */}
                <span className="text-white text-xs font-medium">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Volume */}
                <div className="flex items-center gap-1 group">
                  <button 
                    onClick={toggleMute}
                    className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
                  >
                    {isMuted ? (
                      <VolumeX className="w-4 h-4 text-white" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-white" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-16 h-1 appearance-none bg-white/30 rounded-full cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                  />
                </div>

                {/* Fullscreen */}
                <button 
                  onClick={toggleFullscreen}
                  className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
                >
                  <Maximize className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right side action bar */}
                  <div className="absolute right-3 bottom-24 flex flex-col items-center gap-4 z-30">
        {/* Profile */}
        <div className="relative">
          <button 
            onClick={onProfileClick}
            className="w-12 h-12 rounded-full border-2 border-white overflow-hidden"
          >
            <img 
              src={video.creator_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${video.creator_email}`}
              alt={video.creator_name}
              className="w-full h-full object-cover"
            />
          </button>
          {!isFollowing && (
            <button 
              onClick={onFollow}
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 bg-sky-500 rounded-full flex items-center justify-center"
            >
              <Plus className="w-3 h-3 text-white" />
            </button>
          )}
        </div>

        {/* Like */}
        <button onClick={onLike} className="flex flex-col items-center">
          <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <Heart className={cn(
              "w-7 h-7 transition-all",
              isLiked ? "text-sky-400 fill-sky-400" : "text-white"
            )} />
          </div>
          <span className="text-white text-xs mt-1 font-medium drop-shadow-lg">
            {formatCount(video.likes_count || 0)}
          </span>
        </button>

        {/* Comment */}
        <button onClick={onComment} className="flex flex-col items-center">
          <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <MessageCircle className="w-7 h-7 text-white" />
          </div>
          <span className="text-white text-xs mt-1 font-medium drop-shadow-lg">
            {formatCount(video.comments_count || 0)}
          </span>
        </button>

        {/* Save */}
        <button onClick={onSave} className="flex flex-col items-center">
          <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <Bookmark className={cn(
              "w-7 h-7 transition-all",
              isSaved ? "text-amber-400 fill-amber-400" : "text-white"
            )} />
          </div>
          <span className="text-white text-xs mt-1 font-medium drop-shadow-lg">Save</span>
        </button>

        {/* Share */}
        <button onClick={onShare} className="flex flex-col items-center">
          <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <Share2 className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-xs mt-1 font-medium drop-shadow-lg">Share</span>
        </button>
      </div>

      {/* Bottom info */}
                  <div className="absolute left-4 right-20 bottom-28">
        <h3 className="text-white font-bold text-base mb-1">
          @{video.creator_name || 'user'}
        </h3>
        <p className="text-white text-sm mb-2 line-clamp-2">
          {video.caption}
        </p>
        {video.location && (
          <div className="flex items-center gap-1 mb-2">
            <MapPin className="w-3.5 h-3.5 text-white/80" />
            <span className="text-white/80 text-sm">{video.location}</span>
          </div>
        )}
        {video.hashtags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {video.hashtags.slice(0, 3).map((tag, i) => (
              <span key={i} className="text-white/80 text-sm font-medium">
                #{tag}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Music2 className="w-4 h-4 text-white" />
          <div className="overflow-hidden">
            <motion.p 
              animate={{ x: isActive ? [0, -100, 0] : 0 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="text-white text-sm whitespace-nowrap"
            >
              {video.music_name || 'Original Sound'} - {video.creator_name || 'Creator'}
            </motion.p>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatCount(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}