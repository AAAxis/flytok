import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Volume2, VolumeX } from 'lucide-react';

const destinations = [
  {
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200',
    location: 'Swiss Alps',
    country: 'Switzerland'
  },
  {
    image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200',
    location: 'Kyoto',
    country: 'Japan'
  },
  {
    image: 'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=1200',
    location: 'Santorini',
    country: 'Greece'
  },
  {
    image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1200',
    location: 'Rome',
    country: 'Italy'
  },
  {
    image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200',
    location: 'Paris',
    country: 'France'
  },
  {
    image: 'https://images.unsplash.com/photo-1531572753322-ad063cecc140?w=1200',
    location: 'Bali',
    country: 'Indonesia'
  },
  {
    image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200',
    location: 'Dubai',
    country: 'UAE'
  },
  {
    image: 'https://images.unsplash.com/photo-1485738422979-f5c462d49f74?w=1200',
    location: 'New York',
    country: 'USA'
  }
];

export default function PromoVideo({ onComplete, onSkip }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);
  const intervalRef = useRef(null);
  const containerRef = useRef(null);
  const touchStartY = useRef(0);

  useEffect(() => {
    // Auto-advance slides
    intervalRef.current = setInterval(() => {
      setCurrentIndex(prev => {
        if (prev >= destinations.length - 1) {
          clearInterval(intervalRef.current);
          setTimeout(onComplete, 1500);
          return prev;
        }
        return prev + 1;
      });
    }, 3000);

    // Progress bar
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const total = destinations.length * 3000;
        const increment = (100 / total) * 100;
        return Math.min(prev + increment, 100);
      });
    }, 100);

    return () => {
      clearInterval(intervalRef.current);
      clearInterval(progressInterval);
    };
  }, [onComplete]);

  const handleSkip = () => {
    clearInterval(intervalRef.current);
    if (onSkip) onSkip();
    else onComplete();
  };

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    const touchEndY = e.changedTouches[0].clientY;
    const swipeDistance = touchStartY.current - touchEndY;
    // Swipe up to skip
    if (swipeDistance > 80) {
      handleSkip();
    }
  };

  const handleWheel = (e) => {
    if (e.deltaY > 50) {
      handleSkip();
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      {/* Background music */}
      <audio
        ref={audioRef}
        autoPlay
        loop
        src="https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3"
      />

      {/* Image slideshow */}
      <div className="relative w-[90vw] max-w-sm mx-auto h-[75vh] rounded-3xl overflow-hidden shadow-2xl border border-white/10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0"
          >
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${destinations[currentIndex].image})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />
          </motion.div>
        </AnimatePresence>

        {/* Location info */}
        <div className="absolute bottom-24 left-0 right-0 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.5 }}
            >
              <motion.h2 
                className="text-white text-4xl font-bold mb-2 drop-shadow-lg"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                {destinations[currentIndex].location}
              </motion.h2>
              <motion.p 
                className="text-white/80 text-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {destinations[currentIndex].country}
              </motion.p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Slide indicators */}
        <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-2">
          {destinations.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentIndex 
                  ? 'w-6 bg-white' 
                  : i < currentIndex 
                    ? 'w-1.5 bg-white/60'
                    : 'w-1.5 bg-white/30'
              }`}
            />
          ))}
        </div>

        {/* Welcome text */}
        <motion.div 
          className="absolute bottom-4 left-0 right-0 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <p className="text-white font-bold text-lg mb-1 drop-shadow-lg">
            Help Others To Find Their Vacation
          </p>
          <p className="text-white/60 text-sm">
            Welcome to <span className="text-sky-400 font-semibold">FlyTok</span>
          </p>
        </motion.div>
      </div>

      {/* Animated particles/sparkles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white/60 rounded-full"
            initial={{ 
              x: Math.random() * window.innerWidth,
              y: window.innerHeight + 10,
              opacity: 0 
            }}
            animate={{ 
              y: -10,
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: "linear"
            }}
          />
        ))}
      </div>

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/20">
        <motion.div 
          className="h-full bg-gradient-to-r from-sky-400 to-blue-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Top controls */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
        <button
          onClick={toggleMute}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5 text-white" />
          ) : (
            <Volume2 className="w-5 h-5 text-white" />
          )}
        </button>
        <button
          onClick={handleSkip}
          className="px-4 py-2 rounded-full bg-black/40 backdrop-blur-sm text-white text-sm font-medium"
        >
          Skip
        </button>
      </div>


    </motion.div>
  );
}