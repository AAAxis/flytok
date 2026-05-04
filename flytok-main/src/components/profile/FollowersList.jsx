import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { User } from 'lucide-react';

export default function FollowersList({ followers, users }) {
  const navigate = useNavigate();

  // Map follower emails to user data
  const followerUsers = followers.map(f => 
    users.find(u => u.email === f.follower_email)
  ).filter(Boolean);

  if (followerUsers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
        <User className="w-12 h-12 mb-3 text-slate-600" />
        <p>No followers yet</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-700">
      {followerUsers.map((user) => (
        <button
          key={user.id}
          onClick={() => navigate(createPageUrl('Profile') + `?email=${user.email}`)}
          className="w-full flex items-center gap-3 p-4 hover:bg-slate-800/50 transition-colors"
        >
          <img
            src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
            alt={user.full_name}
            className="w-12 h-12 rounded-full object-cover"
          />
          <div className="text-left">
            <p className="text-white font-medium">{user.full_name || 'User'}</p>
            <p className="text-slate-400 text-sm">@{user.full_name?.toLowerCase().replace(/\s/g, '_') || 'user'}</p>
          </div>
        </button>
      ))}
    </div>
  );
}