import React, { useState } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { X, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function FollowersFollowingModal({ 
  isOpen, 
  onClose, 
  followers = [], 
  following = [], 
  users = [],
  defaultTab = 'followers'
}) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);

  // Map follower emails to user data
  const followerUsers = followers.map(f => 
    users.find(u => u.email === f.follower_email)
  ).filter(Boolean);

  // Map following emails to user data
  const followingUsers = following.map(f => 
    users.find(u => u.email === f.following_email)
  ).filter(Boolean);

  const handleUserClick = (user) => {
    onClose();
    navigate(createPageUrl('Profile') + `?email=${user.email}`);
  };

  const UserList = ({ userList, emptyText }) => {
    if (userList.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
          <User className="w-12 h-12 mb-3 text-zinc-600" />
          <p>{emptyText}</p>
        </div>
      );
    }

    return (
      <div className="divide-y divide-zinc-800 overflow-y-auto" style={{ maxHeight: isExpanded ? 'calc(95vh - 160px)' : 'calc(60vh - 160px)' }}>
        {userList.map((user) => (
          <button
            key={user.id}
            onClick={() => handleUserClick(user)}
            className="w-full flex items-center gap-3 p-4 hover:bg-zinc-800/50 transition-colors"
          >
            <img
              src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
              alt={user.full_name}
              className="w-12 h-12 rounded-full object-cover"
            />
            <div className="text-left">
              <p className="text-white font-medium">{user.full_name || 'User'}</p>
              <p className="text-zinc-400 text-sm">@{user.email?.split('@')[0]}</p>
            </div>
          </button>
        ))}
      </div>
    );
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
            className="fixed inset-0 bg-black/70 z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0, height: isExpanded ? '95vh' : '60vh' }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(e, info) => {
              if (info.offset.y < -50) {
                setIsExpanded(true);
              } else if (info.offset.y > 50) {
                if (isExpanded) {
                  setIsExpanded(false);
                } else {
                  onClose();
                }
              }
            }}
            className="fixed bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl z-50 overflow-hidden"
          >
            {/* Handle - drag indicator */}
            <div className="py-3 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 bg-zinc-600 rounded-full mx-auto" />
              <p className="text-zinc-500 text-xs text-center mt-1">
                {isExpanded ? 'Swipe down to minimize' : 'Swipe up to expand'}
              </p>
            </div>
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div className="w-8" />
              <h3 className="text-white text-lg font-semibold">Activity</h3>
              <button onClick={onClose}>
                <X className="w-6 h-6 text-zinc-400" />
              </button>
            </div>
            
            {/* Tabs */}
            <Tabs defaultValue={defaultTab} className="w-full">
              <TabsList className="w-full bg-transparent border-b border-zinc-800 rounded-none h-12">
                <TabsTrigger 
                  value="followers" 
                  className="flex-1 data-[state=active]:bg-transparent data-[state=active]:text-white text-zinc-500 rounded-none border-b-2 border-transparent data-[state=active]:border-sky-500"
                >
                  Followers ({followerUsers.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="following" 
                  className="flex-1 data-[state=active]:bg-transparent data-[state=active]:text-white text-zinc-500 rounded-none border-b-2 border-transparent data-[state=active]:border-sky-500"
                >
                  Following ({followingUsers.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="followers" className="mt-0">
                <UserList userList={followerUsers} emptyText="No followers yet" />
              </TabsContent>

              <TabsContent value="following" className="mt-0">
                <UserList userList={followingUsers} emptyText="Not following anyone yet" />
              </TabsContent>
            </Tabs>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}