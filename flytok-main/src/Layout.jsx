import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Home, Search, PlusSquare, MessageCircle, Bookmark, MapPin, User } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import UploadModal from '@/components/upload/UploadModal';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const queryClient = useQueryClient();

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

  const handleUpload = async (videoData) => {
    await base44.entities.Video.create(videoData);
    queryClient.invalidateQueries({ queryKey: ['videos'] });
  };

  const navItems = [
    { name: 'Home', icon: Home, page: 'Home' },
    { name: 'Map', icon: MapPin, page: 'Map' },
    { name: 'Create', icon: PlusSquare, page: null, action: () => setUploadOpen(true) },
    { name: 'Saved', icon: Bookmark, page: 'Saved' },
    { name: 'Profile', icon: User, page: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-black">
      {children}

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800/50">
        <div className="flex items-center justify-evenly h-16 w-full">
          {navItems.map((item) => {
            const isActive = currentPageName === item.page;
            const Icon = item.icon;

            if (item.action) {
              return (
                <button
                  key={item.name}
                  onClick={item.action}
                  className="flex-1 flex flex-col items-center justify-center h-full group"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-400 via-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-sky-500/30 group-hover:scale-110 transition-transform">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </button>
              );
            }

            return (
              <Link
                key={item.name}
                to={createPageUrl(item.page)}
                className="flex-1 flex flex-col items-center justify-center h-full group"
              >
                <Icon className={cn(
                  "w-6 h-6 transition-colors",
                  isActive ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"
                )} />
                <span className={cn(
                  "text-[10px] mt-1 font-medium transition-colors",
                  isActive ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"
                )}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Upload modal */}
      <UploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUpload={handleUpload}
        user={user}
      />
    </div>
  );
}