import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Palette, User, Circle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

import { base44 } from '@/api/base44Client';

export default function DesignSettingsModal({ isOpen, onClose, user, onUpdate }) {
  const [saving, setSaving] = useState(false);
  const [profileTheme, setProfileTheme] = useState(user?.profile_theme || {
    backgroundColor: '#1e293b',
    avatarBorder: '#0ea5e9',
    overlayColor: 'gradient',
    buttonColor: '#0ea5e9',
    avatarStyle: 'default'
  });

  const themePresets = [
    { name: 'Ocean', bg: '#1e293b', border: '#0ea5e9', overlay: 'gradient', button: '#0ea5e9' },
    { name: 'Sunset', bg: '#831843', border: '#f97316', overlay: 'orange', button: '#f97316' },
    { name: 'Forest', bg: '#14532d', border: '#22c55e', overlay: 'green', button: '#22c55e' },
    { name: 'Purple', bg: '#581c87', border: '#a855f7', overlay: 'purple', button: '#a855f7' },
    { name: 'Rose', bg: '#4c0519', border: '#f43f5e', overlay: 'rose', button: '#f43f5e' },
    { name: 'Dark', bg: '#0c0a09', border: '#78716c', overlay: 'dark', button: '#78716c' }
  ];

  const backgroundColors = [
    { name: 'Slate', color: '#1e293b' },
    { name: 'Rose', color: '#831843' },
    { name: 'Emerald', color: '#14532d' },
    { name: 'Purple', color: '#581c87' },
    { name: 'Crimson', color: '#4c0519' },
    { name: 'Charcoal', color: '#0c0a09' },
    { name: 'Navy', color: '#1e3a8a' },
    { name: 'Amber', color: '#78350f' }
  ];

  const accentColors = [
    { name: 'Sky', color: '#0ea5e9' },
    { name: 'Orange', color: '#f97316' },
    { name: 'Green', color: '#22c55e' },
    { name: 'Purple', color: '#a855f7' },
    { name: 'Rose', color: '#f43f5e' },
    { name: 'Stone', color: '#78716c' },
    { name: 'Blue', color: '#3b82f6' },
    { name: 'Yellow', color: '#eab308' }
  ];

  const avatarStyles = [
    { id: 'default', name: 'Default', seed: 'default' },
    { id: 'adventurer', name: 'Adventurer', seed: 'adventurer' },
    { id: 'bottts', name: 'Robot', seed: 'bottts' },
    { id: 'fun-emoji', name: 'Emoji', seed: 'fun-emoji' },
    { id: 'lorelei', name: 'Portrait', seed: 'lorelei' },
    { id: 'pixel-art', name: 'Pixel', seed: 'pixel-art' }
  ];

  const handleSave = async () => {
    setSaving(true);
    await base44.auth.updateMe({ 
      profile_theme: profileTheme
    });
    onUpdate({ ...user, profile_theme: profileTheme });
    setSaving(false);
    onClose();
  };

  const handleResetToDefault = () => {
    setProfileTheme({
      backgroundColor: '#1e293b',
      avatarBorder: '#0ea5e9',
      overlayColor: 'gradient',
      buttonColor: '#0ea5e9',
      avatarStyle: 'default'
    });
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
            className="bg-slate-800 rounded-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-600/50">
              <h3 className="text-white font-semibold text-lg">Customize Theme</h3>
              <button onClick={onClose}>
                <X className="w-6 h-6 text-slate-400 hover:text-white" />
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* Profile Theme */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Palette className="w-5 h-5 text-sky-500" />
                  <h4 className="text-white font-medium">Profile Theme</h4>
                </div>
                <p className="text-slate-500 text-sm mb-4">
                  Customize your profile appearance
                </p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {themePresets.map((theme) => (
                    <button
                      key={theme.name}
                      onClick={() => setProfileTheme({
                        backgroundColor: theme.bg,
                        avatarBorder: theme.border,
                        overlayColor: theme.overlay,
                        buttonColor: theme.button,
                        avatarStyle: profileTheme.avatarStyle || 'default'
                      })}
                      className={`relative h-20 rounded-lg overflow-hidden border-2 transition-all ${
                        profileTheme.backgroundColor === theme.bg 
                          ? 'border-sky-400 scale-105 opacity-100' 
                          : 'border-slate-600 hover:border-slate-500 opacity-60 hover:opacity-80'
                      }`}
                      style={{ backgroundColor: theme.bg }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div 
                          className="w-8 h-8 rounded-full border-2"
                          style={{ borderColor: theme.border }}
                        />
                      </div>
                      <div className="absolute bottom-1 left-0 right-0 text-center">
                        <span className="text-white text-[10px] font-medium px-1 py-0.5 bg-black/50 rounded">
                          {theme.name}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Custom Colors */}
                <div className="space-y-4">
                  {/* Background Color */}
                  <div>
                    <label className="text-white text-sm font-medium mb-2 block">Background Color</label>
                    <div className="grid grid-cols-4 gap-2">
                      {backgroundColors.map((bg) => (
                        <button
                          key={bg.name}
                          onClick={() => setProfileTheme({ ...profileTheme, backgroundColor: bg.color })}
                          className={`h-10 rounded-md border-2 transition-all ${
                            profileTheme.backgroundColor === bg.color
                              ? 'border-white scale-105 opacity-100'
                              : 'border-slate-600/50 opacity-50 hover:opacity-80'
                          }`}
                          style={{ backgroundColor: bg.color }}
                          title={bg.name}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Accent Color */}
                  <div>
                    <label className="text-white text-sm font-medium mb-2 block">Accent Color (Border & Buttons)</label>
                    <div className="grid grid-cols-4 gap-2">
                      {accentColors.map((accent) => (
                        <button
                          key={accent.name}
                          onClick={() => setProfileTheme({ 
                            ...profileTheme, 
                            avatarBorder: accent.color,
                            buttonColor: accent.color
                          })}
                          className={`h-10 rounded-md border-2 transition-all flex items-center justify-center ${
                            profileTheme.avatarBorder === accent.color
                              ? 'border-white scale-105 opacity-100'
                              : 'border-slate-600/50 opacity-50 hover:opacity-80'
                          }`}
                          style={{ backgroundColor: accent.color }}
                          title={accent.name}
                        >
                          <Circle className="w-5 h-5 text-white" fill="white" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Avatar Style */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-5 h-5 text-sky-500" />
                  <h4 className="text-white font-medium">Avatar Style</h4>
                </div>
                <p className="text-slate-500 text-sm mb-4">
                  Choose your avatar appearance
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {avatarStyles.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setProfileTheme({ ...profileTheme, avatarStyle: style.id })}
                      className={`relative h-24 rounded-lg overflow-hidden border-2 transition-all ${
                        profileTheme.avatarStyle === style.id
                          ? 'border-sky-400 scale-105 opacity-100'
                          : 'border-slate-600 hover:border-slate-500 opacity-60 hover:opacity-80'
                      }`}
                    >
                      <img
                        src={`https://api.dicebear.com/7.x/${style.seed}/svg?seed=${user?.email || 'demo'}`}
                        alt={style.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-1 left-0 right-0 text-center">
                        <span className="text-white text-[10px] font-medium px-1 py-0.5 bg-black/70 rounded">
                          {style.name}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Reset to Default */}
              <Button
                onClick={handleResetToDefault}
                variant="outline"
                className="w-full border-red-400/50 text-red-400 hover:bg-red-500/20 h-10 rounded-full"
              >
                Reset to Default
              </Button>

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