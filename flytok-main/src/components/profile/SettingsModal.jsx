import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Camera, User, Phone, Mail, MapPin, Plane, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';

export default function SettingsModal({ isOpen, onClose, user, onUpdate }) {
  const [saving, setSaving] = useState(false);
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [username, setUsername] = useState(user?.username || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(user?.address || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [destinations, setDestinations] = useState(user?.dream_destinations || []);
  const [newDestination, setNewDestination] = useState('');
  const fileInputRef = useRef(null);

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploadingAvatar(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setAvatar(file_url);
    setUploadingAvatar(false);
  };

  const handleAddDestination = () => {
    const trimmed = newDestination.trim();
    if (trimmed && !destinations.includes(trimmed)) {
      setDestinations([...destinations, trimmed]);
      setNewDestination('');
    }
  };

  const handleRemoveDestination = (dest) => {
    setDestinations(destinations.filter(d => d !== dest));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddDestination();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await base44.auth.updateMe({ 
      avatar,
      username,
      phone,
      address,
      dream_destinations: destinations
    });
    onUpdate({ ...user, avatar, username, phone, address, dream_destinations: destinations });
    setSaving(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-slate-800 rounded-lg w-full max-w-sm max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-600/50">
              <h3 className="text-white font-semibold text-lg">Edit Profile</h3>
              <button onClick={onClose}>
                <X className="w-6 h-6 text-slate-400 hover:text-white" />
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* Profile Picture */}
              <div>
                <h4 className="text-white font-medium mb-3">Profile Picture</h4>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img
                      src={avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`}
                      alt="Profile"
                      className="w-20 h-20 rounded-full object-cover border-2 border-slate-500"
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="absolute bottom-0 right-0 w-8 h-8 bg-sky-500/90 rounded-full flex items-center justify-center border-2 border-slate-900 hover:bg-sky-500 transition-colors"
                    >
                      {uploadingAvatar ? (
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      ) : (
                        <Camera className="w-4 h-4 text-white" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Username */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-sky-500" />
                  <label className="text-white font-medium text-sm">Username</label>
                </div>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="bg-slate-700/60 border-slate-500/40 text-white placeholder:text-slate-400 focus:border-sky-400/60"
                />
              </div>

              {/* Email (read-only) */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-4 h-4 text-sky-500" />
                  <label className="text-white font-medium text-sm">Email</label>
                </div>
                <Input
                  value={user?.email || ''}
                  disabled
                  className="bg-slate-700/40 border-slate-500/40 text-slate-400"
                />
              </div>

              {/* Phone */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="w-4 h-4 text-sky-500" />
                  <label className="text-white font-medium text-sm">Phone Number</label>
                </div>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter your phone number"
                  className="bg-slate-700/60 border-slate-500/40 text-white placeholder:text-slate-400 focus:border-sky-400/60"
                />
              </div>

              {/* Address */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-sky-500" />
                  <label className="text-white font-medium text-sm">Address</label>
                </div>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter your address"
                  className="bg-slate-700/60 border-slate-500/40 text-white placeholder:text-slate-400 focus:border-sky-400/60"
                />
              </div>

              {/* Dream Destinations */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Plane className="w-4 h-4 text-sky-500" />
                  <label className="text-white font-medium text-sm">Dream Destinations</label>
                </div>
                <p className="text-slate-400 text-xs mb-3">
                  Add countries or places you're interested in visiting
                </p>

                {/* Input */}
                <div className="flex gap-2 mb-3">
                  <Input
                    value={newDestination}
                    onChange={(e) => setNewDestination(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="e.g. Japan, Italy, Bali..."
                    className="bg-slate-700/60 border-slate-500/40 text-white placeholder:text-slate-400 focus:border-sky-400/60"
                  />
                  <Button
                    onClick={handleAddDestination}
                    disabled={!newDestination.trim()}
                    size="icon"
                    className="bg-sky-500/90 hover:bg-sky-500 shrink-0"
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                </div>

                {/* Destinations list */}
                <div className="flex flex-wrap gap-2 min-h-[40px]">
                  {destinations.length === 0 ? (
                    <p className="text-slate-500 text-xs">No destinations added yet</p>
                  ) : (
                    destinations.map((dest) => (
                      <Badge
                        key={dest}
                        variant="secondary"
                        className="bg-slate-600/60 text-white hover:bg-slate-500/60 cursor-pointer group px-3 py-1.5"
                        onClick={() => handleRemoveDestination(dest)}
                      >
                        {dest}
                        <X className="w-3 h-3 ml-1.5 opacity-50 group-hover:opacity-100" />
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              {/* Save button */}
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-sky-500/90 hover:bg-sky-500 h-12 rounded-full font-semibold"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}