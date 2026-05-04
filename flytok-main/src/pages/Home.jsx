import React, { useState, useEffect, useRef, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import VideoPlayer from '@/components/feed/VideoPlayer';
import CommentsDrawer from '@/components/feed/CommentsDrawer';
import PromoVideo from '@/components/promo/PromoVideo';
import ShareModal from '@/components/feed/ShareModal';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { Search, Plane, Flame, Sparkles } from 'lucide-react';
import Logo from '@/components/common/Logo';
import { updatePreferenceScore, addSearchHistory, sortVideosByPreference, trackWatchTime } from '@/components/feed/usePreferences';
import TrendingPlacesModal from '@/components/trending/TrendingPlacesModal';
import AISearchAssistant from '@/components/search/AISearchAssistant';

export default function Home() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState(null);
  const [user, setUser] = useState(null);
  const [likedVideos, setLikedVideos] = useState(new Set());
  const [followingUsers, setFollowingUsers] = useState(new Set());
  const [savedVideos, setSavedVideos] = useState(new Set());
  const [showPromo, setShowPromo] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedVideoForShare, setSelectedVideoForShare] = useState(null);
  const [trendingModalOpen, setTrendingModalOpen] = useState(false);
  const [aiSearchOpen, setAiSearchOpen] = useState(false);

  const containerRef = useRef(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  // Swipe navigation
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const [isSwipeActive, setIsSwipeActive] = useState(false);

  // Check if first visit
  useEffect(() => {
    const hasSeenPromo = localStorage.getItem('flytok_promo_seen');
    if (!hasSeenPromo) {
      setShowPromo(true);
    }
  }, []);

  const handlePromoComplete = () => {
    localStorage.setItem('flytok_promo_seen', 'true');
    setShowPromo(false);
  };

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        // Fetch user's likes
        const likes = await base44.entities.VideoLike.filter({ user_email: currentUser.email });
        setLikedVideos(new Set(likes.map(l => l.video_id)));
        
        // Fetch user's follows
        const follows = await base44.entities.Follow.filter({ follower_email: currentUser.email });
        setFollowingUsers(new Set(follows.map(f => f.following_email)));

        // Fetch user's saved videos
        const saved = await base44.entities.SavedVideo.filter({ user_email: currentUser.email });
        setSavedVideos(new Set(saved.map(s => s.video_id)));
        } catch (e) {
        // User not logged in
      }
    };
    fetchUser();
  }, []);

  // Fetch videos
  const { data: allVideos = [], isLoading } = useQuery({
    queryKey: ['videos'],
    queryFn: () => base44.entities.Video.list('-created_date', 50),
  });

  // Fetch user preferences
  const { data: userPreferences } = useQuery({
    queryKey: ['userPreferences', user?.email],
    queryFn: async () => {
      const prefs = await base44.entities.UserPreference.filter({ user_email: user.email });
      return prefs[0] || null;
    },
    enabled: !!user?.email,
  });

  // Sort videos based on user preferences (For You feed)
  const videos = useMemo(() => {
    if (userPreferences) {
      return sortVideosByPreference(allVideos, userPreferences);
    }
    return allVideos;
  }, [allVideos, userPreferences]);

  // Fetch comments for selected video
  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ['comments', selectedVideoId],
    queryFn: () => base44.entities.Comment.filter({ video_id: selectedVideoId }, '-created_date'),
    enabled: !!selectedVideoId,
  });

  // Handle video parameter from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('video');
    
    if (videoId && videos.length > 0) {
      const videoIndex = videos.findIndex(v => v.id === videoId);
      if (videoIndex !== -1) {
        const container = containerRef.current;
        if (container) {
          const scrollHeight = container.clientHeight;
          container.scrollTo({
            top: videoIndex * scrollHeight,
            behavior: 'smooth'
          });
          setCurrentIndex(videoIndex);
        }
      }
    }
  }, [videos]);

  // Handle scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const height = container.clientHeight;
      const newIndex = Math.round(scrollTop / height);
      if (newIndex !== currentIndex && newIndex >= 0 && newIndex < videos.length) {
        setCurrentIndex(newIndex);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [currentIndex, videos.length]);

  const handleLike = async (video) => {
    if (!user) {
      base44.auth.redirectToLogin();
      return;
    }

    const isLiked = likedVideos.has(video.id);
    
    if (isLiked) {
      // Unlike
      const likes = await base44.entities.VideoLike.filter({ 
        video_id: video.id, 
        user_email: user.email 
      });
      if (likes.length > 0) {
        await base44.entities.VideoLike.delete(likes[0].id);
      }
      await base44.entities.Video.update(video.id, { 
        likes_count: Math.max(0, (video.likes_count || 0) - 1) 
      });
      setLikedVideos(prev => {
        const next = new Set(prev);
        next.delete(video.id);
        return next;
      });
    } else {
      // Like
      await base44.entities.VideoLike.create({ 
        video_id: video.id, 
        user_email: user.email 
      });
      await base44.entities.Video.update(video.id, { 
        likes_count: (video.likes_count || 0) + 1 
      });
      setLikedVideos(prev => new Set(prev).add(video.id));
      
      // Update preferences
      updatePreferenceScore(user.email, video.hashtags, 'like');
    }
    
    queryClient.invalidateQueries({ queryKey: ['videos'] });
    queryClient.invalidateQueries({ queryKey: ['userPreferences', user?.email] });
  };

  const handleComment = (video) => {
    if (!user) {
      base44.auth.redirectToLogin();
      return;
    }
    setSelectedVideoId(video.id);
    setCommentsOpen(true);
  };

  const handleAddComment = async (content, rating) => {
    if (!user || !selectedVideoId) return;
    
    await base44.entities.Comment.create({
      video_id: selectedVideoId,
      content,
      rating,
      user_name: user.full_name,
      user_avatar: user.avatar,
      user_email: user.email,
    });

    // Update comment count
    const video = videos.find(v => v.id === selectedVideoId);
    if (video) {
      await base44.entities.Video.update(selectedVideoId, {
        comments_count: (video.comments_count || 0) + 1
      });
      
      // Update preferences based on rating
      if (rating >= 4) {
        updatePreferenceScore(user.email, video.hashtags, 'comment');
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ['comments', selectedVideoId] });
    queryClient.invalidateQueries({ queryKey: ['videos'] });
    queryClient.invalidateQueries({ queryKey: ['userPreferences', user?.email] });
  };

  const handleFollow = async (video) => {
    if (!user) {
      base44.auth.redirectToLogin();
      return;
    }
    
    const isFollowing = followingUsers.has(video.creator_email);
    
    if (isFollowing) {
      const follows = await base44.entities.Follow.filter({
        follower_email: user.email,
        following_email: video.creator_email
      });
      if (follows.length > 0) {
        await base44.entities.Follow.delete(follows[0].id);
      }
      setFollowingUsers(prev => {
        const next = new Set(prev);
        next.delete(video.creator_email);
        return next;
      });
    } else {
      await base44.entities.Follow.create({
        follower_email: user.email,
        following_email: video.creator_email
      });
      setFollowingUsers(prev => new Set(prev).add(video.creator_email));
    }
  };

  const handleProfileClick = (video) => {
    // Track profile visit preference
    if (user) {
      updatePreferenceScore(user.email, video.hashtags, 'profile_visit', video.creator_email);
    }
    navigate(createPageUrl('Profile') + `?email=${video.creator_email}`);
  };

  const handleShare = (video) => {
        if (user) {
          updatePreferenceScore(user.email, video.hashtags, 'share', video.creator_email);
        }
        setSelectedVideoForShare(video);
        setShareModalOpen(true);
      };

  const handleSave = async (video) => {
    if (!user) {
      base44.auth.redirectToLogin();
      return;
    }

    const isSaved = savedVideos.has(video.id);

    if (isSaved) {
      const saved = await base44.entities.SavedVideo.filter({
        video_id: video.id,
        user_email: user.email
      });
      if (saved.length > 0) {
        await base44.entities.SavedVideo.delete(saved[0].id);
      }
      setSavedVideos(prev => {
        const next = new Set(prev);
        next.delete(video.id);
        return next;
      });
    } else {
      await base44.entities.SavedVideo.create({
        video_id: video.id,
        user_email: user.email
      });
      setSavedVideos(prev => new Set(prev).add(video.id));
      
      // Update preferences
      updatePreferenceScore(user.email, video.hashtags, 'save');
    }
    
    queryClient.invalidateQueries({ queryKey: ['userPreferences', user?.email] });
  };

  // Handle swipe gestures
  const handleTouchStart = (e) => {
    const screenWidth = window.innerWidth;
    const touchX = e.touches[0].clientX;
    
    // Only allow swipe if starting from left or right edge (within 50px)
    if (touchX < 50 || touchX > screenWidth - 50) {
      touchStartX.current = touchX;
      touchStartY.current = e.touches[0].clientY;
      setIsSwipeActive(true);
    }
  };

  const handleTouchMove = (e) => {
    if (!isSwipeActive) return;
    
    const deltaX = Math.abs(e.touches[0].clientX - touchStartX.current);
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current);
    
    // Keep tracking if it's a horizontal swipe
    if (deltaY > deltaX) {
      setIsSwipeActive(false);
    }
  };

  const handleTouchEnd = (e) => {
    if (!isSwipeActive) {
      setIsSwipeActive(false);
      return;
    }
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = Math.abs(touchEndY - touchStartY.current);
    
    // Only trigger if horizontal swipe is dominant
    if (Math.abs(deltaX) > deltaY && Math.abs(deltaX) > 100) {
      if (deltaX > 0) {
        // Swipe right - go to Map
        navigate(createPageUrl('Map'));
      } else {
        // Swipe left - go to Saved
        navigate(createPageUrl('Saved'));
      }
    }
    
    setIsSwipeActive(false);
  };

  if (isLoading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="relative w-20 h-20">
          {/* Globe */}
          <div className="absolute inset-0 rounded-full border-2 border-sky-500/30" />
          <div className="absolute inset-2 rounded-full border border-sky-500/20" />
          <div className="absolute inset-0 rounded-full border-t-2 border-sky-500/20" style={{ transform: 'rotateX(60deg)' }} />
          {/* Flying plane */}
          <div className="absolute inset-0 animate-spin" style={{ animationDuration: '2s' }}>
            <Plane className="absolute -top-1 left-1/2 -translate-x-1/2 w-5 h-5 text-sky-400 -rotate-45" />
          </div>
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white">
        <p className="text-xl mb-2">No videos yet</p>
        <p className="text-zinc-500">Be the first to upload!</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black">
      {/* Promo video for first-time visitors */}
                  {showPromo && <PromoVideo onComplete={handlePromoComplete} onSkip={handlePromoComplete} />}

      {/* Header with Logo and Search */}
                <div className="fixed top-0 left-0 right-0 z-40 p-4 bg-gradient-to-b from-black/80 to-transparent">
                  <div className="flex items-center justify-between max-w-lg mx-auto">
                    <button onClick={() => navigate(createPageUrl('Home'))} className="flex items-baseline">
                          <span className="text-lg font-extrabold text-white">Fly</span>
                          <span className="text-lg font-extrabold text-sky-400">Tok</span>
                        </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setAiSearchOpen(true)}
                        className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                        title="AI Travel Assistant"
                      >
                        <Sparkles className="w-5 h-5 text-white" />
                      </button>
                      <button
                        onClick={() => setTrendingModalOpen(true)}
                        className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                      >
                        <Flame className="w-5 h-5 text-white" />
                      </button>
                      <button
                        onClick={() => navigate(createPageUrl('Search'))}
                        className="flex items-center gap-2 bg-slate-800/80 px-4 py-2 rounded-full text-slate-400 hover:text-white transition-colors"
                      >
                        <Search className="w-4 h-4" />
                        <span className="text-sm">Search</span>
                      </button>
                    </div>
                  </div>
                </div>

      <div 
                ref={containerRef}
                className="h-[calc(100vh-4rem)] overflow-y-scroll snap-y snap-mandatory scroll-smooth"
                style={{ scrollSnapType: 'y mandatory' }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {videos.map((video, index) => (
                  <div 
                    key={video.id}
                    className="h-[calc(100vh-4rem)] w-full snap-start snap-always border-b border-zinc-800"
                  >
            <VideoPlayer
              video={video}
              isActive={index === currentIndex}
              isLiked={likedVideos.has(video.id)}
              isFollowing={followingUsers.has(video.creator_email) || video.creator_email === user?.email}
              isSaved={savedVideos.has(video.id)}
              onLike={() => handleLike(video)}
              onComment={() => handleComment(video)}
              onShare={() => handleShare(video)}
              onFollow={() => handleFollow(video)}
              onSave={() => handleSave(video)}
              onProfileClick={() => handleProfileClick(video)}
            />
          </div>
        ))}
      </div>

      <CommentsDrawer
        isOpen={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        comments={comments}
        isLoading={commentsLoading}
        onAddComment={handleAddComment}
      />

      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        video={selectedVideoForShare}
      />

      <TrendingPlacesModal
        isOpen={trendingModalOpen}
        onClose={() => setTrendingModalOpen(false)}
      />

      <AISearchAssistant
        isOpen={aiSearchOpen}
        onClose={() => setAiSearchOpen(false)}
        onSearch={(query) => navigate(createPageUrl('Search') + `?q=${encodeURIComponent(query)}`)}
      />
      </div>
      );
      }