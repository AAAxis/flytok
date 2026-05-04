import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Camera, Video, RotateCcw, Zap, ZapOff, Circle, Square, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CameraCapture({ onCapture, onClose, mode = 'video' }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [capturedMedia, setCapturedMedia] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [captureMode, setCaptureMode] = useState(mode);
  
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [facingMode]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: captureMode === 'video'
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const toggleCamera = () => {
    stopCamera();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    
    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: 'video/webm;codecs=vp9'
    });
    
    mediaRecorderRef.current = mediaRecorder;
    const chunks = [];
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setCapturedMedia({ blob, url, type: 'video' });
    };
    
    mediaRecorder.start();
    setIsRecording(true);
    setRecordingTime(0);
    
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const takePhoto = () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    
    ctx.drawImage(videoRef.current, 0, 0);
    
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      setCapturedMedia({ blob, url, type: 'photo' });
    }, 'image/jpeg', 0.95);
  };

  const handleConfirm = () => {
    if (capturedMedia) {
      onCapture(capturedMedia);
    }
  };

  const handleRetake = () => {
    setCapturedMedia(null);
    setRecordingTime(0);
    startCamera();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black z-50 flex flex-col"
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
        <button onClick={onClose}>
          <X className="w-7 h-7 text-white" />
        </button>
        
        {isRecording && (
          <div className="flex items-center gap-2 bg-red-500/80 px-3 py-1 rounded-full">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-white font-mono text-sm">{formatTime(recordingTime)}</span>
          </div>
        )}
        
        <div className="flex gap-3">
          <button 
            onClick={() => setFlashEnabled(!flashEnabled)}
            className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center"
          >
            {flashEnabled ? (
              <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            ) : (
              <ZapOff className="w-5 h-5 text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Camera preview or captured media */}
      <div className="flex-1 relative">
        {!capturedMedia ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          />
        ) : capturedMedia.type === 'video' ? (
          <video
            src={capturedMedia.url}
            autoPlay
            loop
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={capturedMedia.url}
            alt="Captured"
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
        {!capturedMedia ? (
          <>
            {/* Mode toggle */}
            <div className="flex justify-center gap-8 mb-6">
              <button
                onClick={() => setCaptureMode('photo')}
                className={`text-sm font-medium ${captureMode === 'photo' ? 'text-white' : 'text-zinc-500'}`}
              >
                Photo
              </button>
              <button
                onClick={() => setCaptureMode('video')}
                className={`text-sm font-medium ${captureMode === 'video' ? 'text-white' : 'text-zinc-500'}`}
              >
                Video
              </button>
            </div>

            {/* Capture controls */}
            <div className="flex items-center justify-center gap-8">
              <div className="w-12" />
              
              {/* Capture button */}
              {captureMode === 'photo' ? (
                <button
                  onClick={takePhoto}
                  className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center"
                >
                  <div className="w-16 h-16 rounded-full bg-white" />
                </button>
              ) : (
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center"
                >
                  {isRecording ? (
                    <Square className="w-8 h-8 text-red-500 fill-red-500" />
                  ) : (
                    <Circle className="w-16 h-16 text-red-500 fill-red-500" />
                  )}
                </button>
              )}
              
              {/* Flip camera */}
              <button
                onClick={toggleCamera}
                className="w-12 h-12 rounded-full bg-zinc-800/80 flex items-center justify-center"
              >
                <RotateCcw className="w-6 h-6 text-white" />
              </button>
            </div>
          </>
        ) : (
          /* Review controls */
          <div className="flex items-center justify-center gap-8">
            <button
              onClick={handleRetake}
              className="flex flex-col items-center gap-2"
            >
              <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center">
                <RotateCcw className="w-6 h-6 text-white" />
              </div>
              <span className="text-white text-sm">Retake</span>
            </button>
            
            <button
              onClick={handleConfirm}
              className="flex flex-col items-center gap-2"
            >
              <div className="w-14 h-14 rounded-full bg-sky-500 flex items-center justify-center">
                <Check className="w-6 h-6 text-white" />
              </div>
              <span className="text-white text-sm">Use</span>
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}