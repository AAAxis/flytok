import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Camera, Video, Scissors, Sparkles, Music2, Layers, 
  Play, Pause, RotateCcw, Check, ChevronLeft, ChevronRight,
  Sun, Contrast, Droplets, Palette, Zap, Moon, CloudRain, Flame
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

const FILTERS = [
  { id: 'none', name: 'Original', filter: '' },
  { id: 'vivid', name: 'Vivid', filter: 'saturate(1.4) contrast(1.1)' },
  { id: 'warm', name: 'Warm', filter: 'sepia(0.3) saturate(1.2)' },
  { id: 'cool', name: 'Cool', filter: 'hue-rotate(20deg) saturate(0.9)' },
  { id: 'vintage', name: 'Vintage', filter: 'sepia(0.5) contrast(0.9) brightness(1.1)' },
  { id: 'bw', name: 'B&W', filter: 'grayscale(1)' },
  { id: 'dramatic', name: 'Dramatic', filter: 'contrast(1.3) saturate(0.8)' },
  { id: 'fade', name: 'Fade', filter: 'contrast(0.9) brightness(1.1) saturate(0.8)' },
  { id: 'golden', name: 'Golden', filter: 'sepia(0.2) saturate(1.3) brightness(1.05)' },
  { id: 'arctic', name: 'Arctic', filter: 'hue-rotate(180deg) saturate(0.6) brightness(1.2)' },
];

const EFFECTS = [
  { id: 'none', name: 'None', icon: X },
  { id: 'blur', name: 'Blur BG', icon: Droplets },
  { id: 'vignette', name: 'Vignette', icon: Moon },
  { id: 'grain', name: 'Film Grain', icon: Sparkles },
  { id: 'light-leak', name: 'Light Leak', icon: Sun },
  { id: 'duotone', name: 'Duotone', icon: Palette },
];

const TRANSITIONS = [
  { id: 'none', name: 'None' },
  { id: 'fade', name: 'Fade' },
  { id: 'slide', name: 'Slide' },
  { id: 'zoom', name: 'Zoom' },
  { id: 'flip', name: 'Flip' },
  { id: 'blur', name: 'Blur' },
];

const MUSIC_TRACKS = [
  { id: 'none', name: 'No Music', url: null },
  { id: 'upbeat', name: 'Upbeat Travel', url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3' },
  { id: 'chill', name: 'Chill Vibes', url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3' },
  { id: 'adventure', name: 'Adventure', url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0c6ff1bab.mp3' },
  { id: 'cinematic', name: 'Cinematic', url: 'https://cdn.pixabay.com/download/audio/2022/02/22/audio_d1718ab41b.mp3' },
];

export default function VideoEditor({ 
  videoFile, 
  videoPreview, 
  onSave, 
  onCancel,
  onCaptureVideo,
  onCapturePhoto 
}) {
  const [activeTab, setActiveTab] = useState('trim');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Trim state
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(100);
  
  // Filter & Effects state
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [selectedEffect, setSelectedEffect] = useState('none');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  
  // Music state
  const [selectedMusic, setSelectedMusic] = useState('none');
  const [musicVolume, setMusicVolume] = useState(70);
  
  // Transition state
  const [selectedTransition, setSelectedTransition] = useState('none');
  
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.addEventListener('loadedmetadata', () => {
        setDuration(videoRef.current.duration);
        setTrimEnd(100);
      });
      videoRef.current.addEventListener('timeupdate', () => {
        setCurrentTime(videoRef.current.currentTime);
      });
    }
  }, [videoPreview]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = musicVolume / 100;
    }
  }, [musicVolume]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        audioRef.current?.pause();
      } else {
        videoRef.current.play();
        audioRef.current?.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const getFilterStyle = () => {
    const filter = FILTERS.find(f => f.id === selectedFilter);
    let filterStr = filter?.filter || '';
    
    // Add adjustments
    filterStr += ` brightness(${brightness / 100}) contrast(${contrast / 100}) saturate(${saturation / 100})`;
    
    return { filter: filterStr.trim() };
  };

  const getEffectClass = () => {
    switch (selectedEffect) {
      case 'vignette': return 'vignette-effect';
      case 'grain': return 'grain-effect';
      case 'light-leak': return 'light-leak-effect';
      default: return '';
    }
  };

  const handleSave = () => {
    onSave({
      trimStart: (trimStart / 100) * duration,
      trimEnd: (trimEnd / 100) * duration,
      filter: selectedFilter,
      effect: selectedEffect,
      brightness,
      contrast,
      saturation,
      music: selectedMusic,
      musicVolume,
      transition: selectedTransition
    });
  };

  const tabs = [
    { id: 'trim', name: 'Trim', icon: Scissors },
    { id: 'filters', name: 'Filters', icon: Sparkles },
    { id: 'adjust', name: 'Adjust', icon: Sun },
    { id: 'effects', name: 'Effects', icon: Layers },
    { id: 'music', name: 'Music', icon: Music2 },
    { id: 'transition', name: 'Transition', icon: Zap },
  ];

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <button onClick={onCancel}>
          <X className="w-6 h-6 text-zinc-400" />
        </button>
        <h3 className="text-white font-semibold">Edit Video</h3>
        <Button 
          size="sm" 
          onClick={handleSave}
          className="bg-sky-500 hover:bg-sky-600 text-white rounded-full px-4"
        >
          <Check className="w-4 h-4 mr-1" />
          Done
        </Button>
      </div>

      {/* Video Preview */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-zinc-950">
        <div className={`relative max-h-full aspect-[9/16] ${getEffectClass()}`}>
          <video
            ref={videoRef}
            src={videoPreview}
            className="h-full w-full object-contain rounded-lg"
            style={getFilterStyle()}
            loop
            playsInline
            muted={selectedMusic !== 'none'}
          />
          
          {/* Effect overlays */}
          {selectedEffect === 'vignette' && (
            <div className="absolute inset-0 pointer-events-none rounded-lg" 
              style={{ boxShadow: 'inset 0 0 100px 40px rgba(0,0,0,0.5)' }} 
            />
          )}
          {selectedEffect === 'light-leak' && (
            <div className="absolute inset-0 pointer-events-none rounded-lg bg-gradient-to-br from-orange-500/20 via-transparent to-pink-500/20" />
          )}
          {selectedEffect === 'grain' && (
            <div className="absolute inset-0 pointer-events-none rounded-lg opacity-30 grain-overlay" />
          )}
          
          {/* Play/Pause overlay */}
          <button 
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center"
          >
            {!isPlaying && (
              <div className="bg-black/40 rounded-full p-4">
                <Play className="w-10 h-10 text-white fill-white" />
              </div>
            )}
          </button>
        </div>
        
        {/* Background music audio */}
        {selectedMusic !== 'none' && (
          <audio
            ref={audioRef}
            src={MUSIC_TRACKS.find(m => m.id === selectedMusic)?.url}
            loop
          />
        )}
      </div>

      {/* Timeline (for trim) */}
      {activeTab === 'trim' && (
        <div className="px-4 py-3 bg-zinc-900 border-t border-zinc-800">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-zinc-400 text-xs">{formatTime((trimStart / 100) * duration)}</span>
            <div className="flex-1 h-12 bg-zinc-800 rounded-lg relative overflow-hidden">
              {/* Video thumbnails placeholder */}
              <div className="absolute inset-0 flex">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex-1 bg-zinc-700 border-r border-zinc-800" />
                ))}
              </div>
              {/* Trim handles */}
              <div 
                className="absolute top-0 bottom-0 bg-sky-500/30 border-l-4 border-r-4 border-sky-500"
                style={{ left: `${trimStart}%`, right: `${100 - trimEnd}%` }}
              />
            </div>
            <span className="text-zinc-400 text-xs">{formatTime((trimEnd / 100) * duration)}</span>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-zinc-500 text-xs mb-1 block">Start</label>
              <Slider
                value={[trimStart]}
                onValueChange={([v]) => setTrimStart(Math.min(v, trimEnd - 5))}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
            <div className="flex-1">
              <label className="text-zinc-500 text-xs mb-1 block">End</label>
              <Slider
                value={[trimEnd]}
                onValueChange={([v]) => setTrimEnd(Math.max(v, trimStart + 5))}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Filters panel */}
      {activeTab === 'filters' && (
        <div className="px-4 py-3 bg-zinc-900 border-t border-zinc-800">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setSelectedFilter(filter.id)}
                className={`flex-shrink-0 text-center ${
                  selectedFilter === filter.id ? 'opacity-100' : 'opacity-60'
                }`}
              >
                <div 
                  className={`w-16 h-16 rounded-lg bg-zinc-700 mb-1 overflow-hidden border-2 ${
                    selectedFilter === filter.id ? 'border-sky-500' : 'border-transparent'
                  }`}
                  style={{ filter: filter.filter }}
                >
                  <div className="w-full h-full bg-gradient-to-br from-sky-400 to-purple-500" />
                </div>
                <span className="text-white text-xs">{filter.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Adjust panel */}
      {activeTab === 'adjust' && (
        <div className="px-4 py-3 bg-zinc-900 border-t border-zinc-800 space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-zinc-400 text-sm flex items-center gap-2">
                <Sun className="w-4 h-4" /> Brightness
              </span>
              <span className="text-white text-sm">{brightness}%</span>
            </div>
            <Slider
              value={[brightness]}
              onValueChange={([v]) => setBrightness(v)}
              min={50}
              max={150}
              step={1}
            />
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-zinc-400 text-sm flex items-center gap-2">
                <Contrast className="w-4 h-4" /> Contrast
              </span>
              <span className="text-white text-sm">{contrast}%</span>
            </div>
            <Slider
              value={[contrast]}
              onValueChange={([v]) => setContrast(v)}
              min={50}
              max={150}
              step={1}
            />
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-zinc-400 text-sm flex items-center gap-2">
                <Droplets className="w-4 h-4" /> Saturation
              </span>
              <span className="text-white text-sm">{saturation}%</span>
            </div>
            <Slider
              value={[saturation]}
              onValueChange={([v]) => setSaturation(v)}
              min={0}
              max={200}
              step={1}
            />
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setBrightness(100);
              setContrast(100);
              setSaturation(100);
            }}
            className="w-full border-zinc-700 text-zinc-400"
          >
            <RotateCcw className="w-4 h-4 mr-2" /> Reset
          </Button>
        </div>
      )}

      {/* Effects panel */}
      {activeTab === 'effects' && (
        <div className="px-4 py-3 bg-zinc-900 border-t border-zinc-800">
          <div className="grid grid-cols-3 gap-3">
            {EFFECTS.map((effect) => {
              const Icon = effect.icon;
              return (
                <button
                  key={effect.id}
                  onClick={() => setSelectedEffect(effect.id)}
                  className={`p-4 rounded-xl border transition-all ${
                    selectedEffect === effect.id 
                      ? 'bg-sky-500/20 border-sky-500 text-sky-400' 
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                  }`}
                >
                  <Icon className="w-6 h-6 mx-auto mb-1" />
                  <span className="text-xs">{effect.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Music panel */}
      {activeTab === 'music' && (
        <div className="px-4 py-3 bg-zinc-900 border-t border-zinc-800 space-y-3">
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {MUSIC_TRACKS.map((track) => (
              <button
                key={track.id}
                onClick={() => {
                  setSelectedMusic(track.id);
                  if (audioRef.current && track.url) {
                    audioRef.current.src = track.url;
                    if (isPlaying) audioRef.current.play();
                  }
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                  selectedMusic === track.id 
                    ? 'bg-sky-500/20 border border-sky-500' 
                    : 'bg-zinc-800 border border-zinc-700'
                }`}
              >
                <Music2 className={`w-5 h-5 ${selectedMusic === track.id ? 'text-sky-400' : 'text-zinc-500'}`} />
                <span className={selectedMusic === track.id ? 'text-sky-400' : 'text-white'}>{track.name}</span>
              </button>
            ))}
          </div>
          {selectedMusic !== 'none' && (
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-zinc-400 text-sm">Music Volume</span>
                <span className="text-white text-sm">{musicVolume}%</span>
              </div>
              <Slider
                value={[musicVolume]}
                onValueChange={([v]) => setMusicVolume(v)}
                max={100}
                step={1}
              />
            </div>
          )}
        </div>
      )}

      {/* Transition panel */}
      {activeTab === 'transition' && (
        <div className="px-4 py-3 bg-zinc-900 border-t border-zinc-800">
          <p className="text-zinc-500 text-xs mb-3">Transition effect when video loops</p>
          <div className="flex gap-2 flex-wrap">
            {TRANSITIONS.map((trans) => (
              <button
                key={trans.id}
                onClick={() => setSelectedTransition(trans.id)}
                className={`px-4 py-2 rounded-full text-sm transition-all ${
                  selectedTransition === trans.id 
                    ? 'bg-sky-500 text-white' 
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                }`}
              >
                {trans.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex border-t border-zinc-800 bg-zinc-900">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${
                activeTab === tab.id ? 'text-sky-400' : 'text-zinc-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{tab.name}</span>
            </button>
          );
        })}
      </div>

      {/* Custom CSS for effects */}
      <style>{`
        .grain-overlay {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
        }
      `}</style>
    </div>
  );
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}