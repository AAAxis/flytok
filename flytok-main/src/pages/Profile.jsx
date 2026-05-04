import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import ProfileHeader from '@/components/profile/ProfileHeader';
import VideoGrid from '@/components/profile/VideoGrid';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Grid3X3, Bookmark, Heart, Search, X, User, Settings, Users } from 'lucide-react';
import FollowersList from '@/components/profile/FollowersList';
import SettingsModal from '@/components/profile/SettingsModal';
import DesignSettingsModal from '@/components/profile/DesignSettingsModal';
import FollowersFollowingModal from '@/components/profile/FollowersFollowingModal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const [currentUser, setCurrentUser] = useState(null);
  const [profileUser, setProfileUser] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [likedSearchQuery, setLikedSearchQuery] = useState('');
  const [showLikedSearch, setShowLikedSearch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showDesignSettings, setShowDesignSettings] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersModalTab, setFollowersModalTab] = useState('followers');
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
        navigate(createPageUrl('Saved'));
      } else {
        navigate(createPageUrl('Home'));
      }
    }
    
    touchStartX.current = -1;
  };
  
  const urlParams = new URLSearchParams(window.location.search);
  const profileEmail = urlParams.get('email');

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (e) {
        // Not logged in - if viewing own profile, need to login
        if (!profileEmail) {
          setLoading(false);
        }
      }
      setLoading(false);
    };
    fetchUser();
  }, [profileEmail]);

  // Fetch profile user
  useEffect(() => {
    const fetchProfileUser = async () => {
      if (profileEmail && profileEmail !== currentUser?.email) {
        const users = await base44.entities.User.filter({ email: profileEmail });
        if (users.length > 0) {
          setProfileUser(users[0]);
        }
      } else if (currentUser) {
        setProfileUser(currentUser);
      }
    };
    fetchProfileUser();
  }, [profileEmail, currentUser]);

  // Check if following
  useEffect(() => {
    const checkFollow = async () => {
      if (currentUser && profileUser && currentUser.email !== profileUser.email) {
        const follows = await base44.entities.Follow.filter({
          follower_email: currentUser.email,
          following_email: profileUser.email
        });
        setIsFollowing(follows.length > 0);
      }
    };
    checkFollow();
  }, [currentUser, profileUser]);

  // Fetch user's videos
  const { data: videos = [] } = useQuery({
    queryKey: ['userVideos', profileUser?.email],
    queryFn: () => base44.entities.Video.filter({ creator_email: profileUser?.email }, '-created_date'),
    enabled: !!profileUser?.email,
  });

  // Fetch followers
  const { data: followers = [] } = useQuery({
    queryKey: ['followers', profileUser?.email],
    queryFn: () => base44.entities.Follow.filter({ following_email: profileUser?.email }),
    enabled: !!profileUser?.email,
  });

  // Fetch all users for followers list
  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
  });

  // Fetch following count
  const { data: following = [] } = useQuery({
    queryKey: ['following', profileUser?.email],
    queryFn: () => base44.entities.Follow.filter({ follower_email: profileUser?.email }),
    enabled: !!profileUser?.email,
  });

  // Fetch liked videos
  const { data: likedVideoIds = [] } = useQuery({
    queryKey: ['likedVideos', profileUser?.email],
    queryFn: () => base44.entities.VideoLike.filter({ user_email: profileUser?.email }),
    enabled: !!profileUser?.email,
  });

  const { data: likedVideos = [] } = useQuery({
    queryKey: ['likedVideosFull', likedVideoIds.map(l => l.video_id).join(',')],
    queryFn: async () => {
      const vids = [];
      for (const like of likedVideoIds) {
        const videos = await base44.entities.Video.filter({ id: like.video_id });
        if (videos.length > 0) vids.push(videos[0]);
      }
      return vids;
    },
    enabled: likedVideoIds.length > 0,
  });

  const handleFollow = async () => {
    if (!currentUser) {
      base44.auth.redirectToLogin();
      return;
    }

    if (isFollowing) {
      const follows = await base44.entities.Follow.filter({
        follower_email: currentUser.email,
        following_email: profileUser.email
      });
      if (follows.length > 0) {
        await base44.entities.Follow.delete(follows[0].id);
      }
      setIsFollowing(false);
    } else {
      await base44.entities.Follow.create({
        follower_email: currentUser.email,
        following_email: profileUser.email
      });
      setIsFollowing(true);
    }
  };

  const handleVideoClick = (video) => {
    // Navigate to home with video selected
    navigate(createPageUrl('Home'));
  };

  // Show login prompt if trying to view own profile without being logged in
  if (!loading && !currentUser && !profileEmail) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
        <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center mb-6">
          <User className="w-12 h-12 text-slate-500" />
        </div>
        <h2 className="text-white text-xl font-semibold mb-2">Create Your Profile</h2>
        <p className="text-zinc-500 text-center mb-8 max-w-xs">
          Sign up or log in to create your profile, share videos, and connect with other travelers
        </p>
        <div className="flex gap-3 w-full max-w-xs">
          <Button
            onClick={() => base44.auth.redirectToLogin()}
            className="flex-1 bg-sky-500/90 hover:bg-sky-500 rounded-full h-12 font-semibold"
          >
            Sign Up
          </Button>
          <Button
            onClick={() => base44.auth.redirectToLogin()}
            variant="outline"
            className="flex-1 border-slate-600/50 text-slate-300 hover:bg-slate-700/50 rounded-full h-12 font-semibold"
          >
            Log In
          </Button>
        </div>
      </div>
    );
  }

  if (loading || !profileUser) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isOwnProfile = currentUser?.email === profileUser?.email;

  return (
    <div 
      className="min-h-screen bg-black pb-20"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >


      <ProfileHeader
        user={profileUser}
        videosCount={videos.length}
        followersCount={followers.length}
        followingCount={following.length}
        isOwnProfile={isOwnProfile}
        isFollowing={isFollowing}
        onFollow={handleFollow}
        onEditProfile={() => setShowSettings(true)}
        onCustomizeTheme={() => setShowDesignSettings(true)}
        onFollowersClick={() => {
          setFollowersModalTab('followers');
          setShowFollowersModal(true);
        }}
        onFollowingClick={() => {
          setFollowersModalTab('following');
          setShowFollowersModal(true);
        }}
      />

      <Tabs defaultValue="videos" className="w-full">
        <TabsList className="w-full bg-transparent border-b border-slate-700 rounded-none h-12">
          <TabsTrigger 
            value="videos" 
            className="flex-1 data-[state=active]:bg-transparent data-[state=active]:text-sky-400 text-slate-500 rounded-none border-b-2 border-transparent data-[state=active]:border-sky-500"
          >
            <Grid3X3 className="w-5 h-5" />
          </TabsTrigger>
          <TabsTrigger 
            value="followers" 
            className="flex-1 data-[state=active]:bg-transparent data-[state=active]:text-sky-400 text-slate-500 rounded-none border-b-2 border-transparent data-[state=active]:border-sky-500"
          >
            <Users className="w-5 h-5" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="videos" className="mt-0">
          <VideoGrid videos={videos} onVideoClick={handleVideoClick} />
        </TabsContent>

        <TabsContent value="followers" className="mt-0">
          <FollowersList followers={followers} users={allUsers} />
        </TabsContent>
      </Tabs>

      {/* Account Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        user={currentUser}
        onUpdate={(updatedUser) => {
          setCurrentUser(updatedUser);
          setProfileUser(updatedUser);
        }}
      />

      {/* Design Settings Modal */}
      <DesignSettingsModal
        isOpen={showDesignSettings}
        onClose={() => setShowDesignSettings(false)}
        user={currentUser}
        onUpdate={(updatedUser) => {
          setCurrentUser(updatedUser);
          setProfileUser(updatedUser);
        }}
      />

      {/* Followers/Following Modal */}
      <FollowersFollowingModal
        isOpen={showFollowersModal}
        onClose={() => setShowFollowersModal(false)}
        followers={followers}
        following={following}
        users={allUsers}
        defaultTab={followersModalTab}
      />
    </div>
  );
}