import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function NewChatModal({ isOpen, onClose, onSelectUser, currentUserEmail }) {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (query) => {
    setSearch(query);
    if (query.length < 2) {
      setUsers([]);
      return;
    }

    setLoading(true);
    // Fetch all users and filter (since we don't have a search endpoint)
    const allUsers = await base44.entities.User.list();
    const filtered = allUsers.filter(user => 
      user.email !== currentUserEmail &&
      (user.full_name?.toLowerCase().includes(query.toLowerCase()) ||
       user.email?.toLowerCase().includes(query.toLowerCase()))
    );
    setUsers(filtered);
    setLoading(false);
  };

  const handleSelectUser = (user) => {
    onSelectUser(user);
    setSearch('');
    setUsers([]);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 z-50"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-x-4 top-20 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md bg-zinc-900 rounded-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h3 className="text-white font-semibold text-lg">New Message</h3>
              <button onClick={onClose} className="text-zinc-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <Input
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="pl-10 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 rounded-full"
                  autoFocus
                />
              </div>
            </div>

            {/* Results */}
            <ScrollArea className="max-h-80">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-rose-500 animate-spin" />
                </div>
              ) : users.length > 0 ? (
                <div className="divide-y divide-zinc-800">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className="w-full flex items-center gap-3 p-4 hover:bg-zinc-800 transition-colors text-left"
                    >
                      <img
                        src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
                        alt={user.full_name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      <div>
                        <p className="text-white font-medium">{user.full_name}</p>
                        <p className="text-zinc-500 text-sm">{user.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : search.length >= 2 ? (
                <div className="text-center py-8 text-zinc-500">
                  <p>No users found</p>
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-500">
                  <p className="text-sm">Type at least 2 characters to search</p>
                </div>
              )}
            </ScrollArea>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}