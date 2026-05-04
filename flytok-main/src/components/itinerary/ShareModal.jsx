import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Link2, Copy, Check, Users, Globe, Lock, UserPlus, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function ShareModal({ isOpen, onClose, itinerary, onUpdate }) {
  const [isPublic, setIsPublic] = useState(itinerary?.is_public || false);
  const [collaboratorEmail, setCollaboratorEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);

  const shareUrl = `${window.location.origin}/Itinerary?id=${itinerary?.id}`;
  
  const generateShareCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTogglePublic = async (checked) => {
    setIsPublic(checked);
    const updates = { is_public: checked };
    if (checked && !itinerary.share_code) {
      updates.share_code = generateShareCode();
    }
    await base44.entities.Itinerary.update(itinerary.id, updates);
    onUpdate?.();
    toast.success(checked ? 'Itinerary is now public' : 'Itinerary is now private');
  };

  const handleAddCollaborator = async () => {
    if (!collaboratorEmail.trim()) return;
    
    setAdding(true);
    const currentCollaborators = itinerary.collaborators || [];
    
    if (currentCollaborators.includes(collaboratorEmail)) {
      toast.error('User is already a collaborator');
      setAdding(false);
      return;
    }

    await base44.entities.Itinerary.update(itinerary.id, {
      collaborators: [...currentCollaborators, collaboratorEmail.trim()]
    });
    
    // Send notification email
    await base44.integrations.Core.SendEmail({
      to: collaboratorEmail.trim(),
      subject: `You've been invited to collaborate on a trip to ${itinerary.destination}!`,
      body: `You've been added as a collaborator on a trip itinerary to ${itinerary.destination}. View and edit it here: ${shareUrl}`
    });

    setCollaboratorEmail('');
    setAdding(false);
    onUpdate?.();
    toast.success('Collaborator added and notified!');
  };

  const handleRemoveCollaborator = async (email) => {
    const updated = (itinerary.collaborators || []).filter(c => c !== email);
    await base44.entities.Itinerary.update(itinerary.id, { collaborators: updated });
    onUpdate?.();
    toast.success('Collaborator removed');
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-4 right-4 top-1/2 -translate-y-1/2 max-w-md mx-auto bg-zinc-900 rounded-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h3 className="text-white font-semibold text-lg">Share Itinerary</h3>
              <button onClick={onClose} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* Public toggle */}
              <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-xl">
                <div className="flex items-center gap-3">
                  {isPublic ? (
                    <Globe className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Lock className="w-5 h-5 text-zinc-400" />
                  )}
                  <div>
                    <p className="text-white font-medium">Public access</p>
                    <p className="text-zinc-500 text-sm">Anyone with link can view</p>
                  </div>
                </div>
                <Switch checked={isPublic} onCheckedChange={handleTogglePublic} />
              </div>

              {/* Share link */}
              <div className="space-y-2">
                <label className="text-zinc-400 text-sm font-medium">Share link</label>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center gap-2 bg-zinc-800 rounded-xl px-3 py-2">
                    <Link2 className="w-4 h-4 text-zinc-500" />
                    <span className="text-zinc-300 text-sm truncate">{shareUrl}</span>
                  </div>
                  <Button
                    onClick={handleCopyLink}
                    className="bg-white text-black hover:bg-zinc-200 rounded-xl"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Add collaborators */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-zinc-400" />
                  <label className="text-zinc-400 text-sm font-medium">Collaborators</label>
                </div>
                <p className="text-zinc-500 text-xs">Collaborators can edit and add activities</p>
                
                <div className="flex gap-2">
                  <Input
                    value={collaboratorEmail}
                    onChange={(e) => setCollaboratorEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="flex-1 bg-zinc-800 border-zinc-700 text-white rounded-xl"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCollaborator()}
                  />
                  <Button
                    onClick={handleAddCollaborator}
                    disabled={adding || !collaboratorEmail.trim()}
                    className="bg-rose-500 hover:bg-rose-600 rounded-xl"
                  >
                    <UserPlus className="w-4 h-4" />
                  </Button>
                </div>

                {/* Collaborator list */}
                {itinerary?.collaborators?.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {itinerary.collaborators.map((email) => (
                      <div key={email} className="flex items-center justify-between p-2 bg-zinc-800/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                            <Mail className="w-4 h-4 text-zinc-400" />
                          </div>
                          <span className="text-zinc-300 text-sm">{email}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveCollaborator(email)}
                          className="text-zinc-500 hover:text-rose-400 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}