import React from 'react';
import { Button } from '@/components/ui/button';
import { Settings, Share2, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function ProfileHeader({ 
  user, 
  videosCount, 
  followersCount, 
  followingCount,
  isOwnProfile,
  isFollowing,
  onFollow,
  onEditProfile,
  onCustomizeTheme,
  onFollowersClick,
  onFollowingClick
}) {
  const theme = user?.profile_theme || {
    backgroundColor: '#1e293b',
    avatarBorder: '#0ea5e9',
    overlayColor: 'gradient'
  };

  const getOverlayClass = (overlayColor) => {
    const overlays = {
      gradient: 'bg-gradient-to-br from-sky-500/20 to-blue-600/20',
      orange: 'bg-gradient-to-br from-orange-500/20 to-red-600/20',
      green: 'bg-gradient-to-br from-green-500/20 to-emerald-600/20',
      purple: 'bg-gradient-to-br from-purple-500/20 to-violet-600/20',
      rose: 'bg-gradient-to-br from-rose-500/20 to-pink-600/20',
      dark: 'bg-gradient-to-br from-zinc-700/20 to-stone-800/20'
    };
    return overlays[overlayColor] || overlays.gradient;
  };

  return (
    <div className="relative p-3" style={{ backgroundColor: theme.backgroundColor }}>
      {/* Background overlay */}
      <div className={`absolute inset-0 ${getOverlayClass(theme.overlayColor)}`} />
      
      {/* Content */}
      <div className="relative">
        {/* Avatar and stats */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`}
              alt={user?.full_name}
              className="w-16 h-16 rounded-full object-cover border-3"
              style={{ borderColor: theme.avatarBorder }}
            />
          </div>

          <div className="flex-1 flex gap-4">
            <div className="text-center">
              <p className="text-white font-bold text-xl">{videosCount}</p>
              <p className="text-slate-400 text-sm">Videos</p>
            </div>
            <button onClick={onFollowersClick} className="text-center hover:opacity-80 transition-opacity">
              <p className="text-white font-bold text-xl">{formatCount(followersCount)}</p>
              <p className="text-slate-400 text-sm">Followers</p>
            </button>
            <button onClick={onFollowingClick} className="text-center hover:opacity-80 transition-opacity">
              <p className="text-white font-bold text-xl">{formatCount(followingCount)}</p>
              <p className="text-slate-400 text-sm">Following</p>
            </button>
          </div>
        </div>

        {/* Name and bio */}
        <div className="mt-2">
          <h2 className="text-white font-bold text-sm">
            @{user?.full_name?.toLowerCase().replace(/\s/g, '_') || 'user'}
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">
            {user?.bio || 'No bio yet'}
          </p>
        </div>

        {/* Actions */}
        <div className="mt-2 flex flex-col gap-1.5">
        {isOwnProfile ? (
          <>
            <Button 
              onClick={onEditProfile}
              className="w-full bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 border border-sky-500/30 rounded-lg h-8 text-xs"
            >
              Edit profile
            </Button>
            <Button 
              onClick={onCustomizeTheme}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-lg h-8 text-xs"
            >
              Customize Theme
            </Button>
          </>
        ) : (
          <div className="flex gap-2">
            <Button 
              onClick={onFollow}
              className={`flex-1 h-8 rounded-lg font-semibold text-xs ${
                isFollowing 
                                        ? 'bg-slate-600 hover:bg-slate-500 text-white' 
                                        : 'bg-sky-500 hover:bg-sky-600 text-white'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </Button>
            <Link to={createPageUrl('Messages') + `?startChat=${user?.email}`}>
              <Button
                variant="outline"
                className="bg-slate-700 hover:bg-slate-600 border-slate-600 text-white rounded-lg h-8 px-4 text-xs"
              >
                <MessageCircle className="w-3 h-3 mr-1.5" />
                Message
              </Button>
            </Link>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

function formatCount(num) {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}