import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Music2, Hash, Loader2, Video, MapPin, Mic, Sparkles, Camera, Wand2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import VideoEditor from './VideoEditor';
import CameraCapture from './CameraCapture';

export default function UploadModal({ isOpen, onClose, onUpload, user }) {
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [musicName, setMusicName] = useState('');
  const [location, setLocation] = useState('');
  const [uploading, setUploading] = useState(false);
  const [aiVoiceText, setAiVoiceText] = useState('');
  const [aiVoiceEnabled, setAiVoiceEnabled] = useState(false);
  const [generatingVoice, setGeneratingVoice] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [editSettings, setEditSettings] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('video/')) {
      // Check file size - warn if over 100MB
      if (file.size > 100 * 1024 * 1024) {
        alert('File is large. Upload may take a while.');
      }
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
    }
  };

  const handleCameraCapture = (media) => {
    setShowCamera(false);
    if (media.type === 'video') {
      setVideoFile(new File([media.blob], 'recorded-video.webm', { type: 'video/webm' }));
      setVideoPreview(media.url);
    } else {
      // For photos, we'll need to handle differently - maybe create a slideshow video
      setVideoFile(new File([media.blob], 'captured-photo.jpg', { type: 'image/jpeg' }));
      setVideoPreview(media.url);
    }
  };

  const handleEditorSave = (settings) => {
    setEditSettings(settings);
    setShowEditor(false);
    // Apply music name from editor if selected
    if (settings.music && settings.music !== 'none') {
      setMusicName(`♪ ${settings.music.charAt(0).toUpperCase() + settings.music.slice(1)}`);
    }
  };

  const handleUpload = async () => {
    if (!videoFile || !caption.trim()) return;
    
    setUploading(true);
    
    // Generate AI voice script if enabled but no text provided
    let voiceScript = aiVoiceText;
    if (aiVoiceEnabled && !aiVoiceText.trim()) {
      setGeneratingVoice(true);
      const voiceResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a short, engaging voiceover script (2-3 sentences max) for a travel video with the following caption: "${caption}". Location: ${location || 'unknown'}. Make it sound natural and exciting, like a travel influencer would say it.`,
        response_json_schema: {
          type: "object",
          properties: {
            script: { type: "string" }
          },
          required: ["script"]
        }
      });
      voiceScript = voiceResult.script;
      setGeneratingVoice(false);
    }
    
    // Check content for offensive/racist/violent material
          const contentToCheck = `${caption} ${hashtags} ${voiceScript}`;
          const moderationResult = await base44.integrations.Core.InvokeLLM({
            prompt: `You are a content moderation system. Analyze the following video caption and hashtags for:
    1. Racist, offensive, hateful, or discriminatory content
    2. Violent content (fights, abuse, gore, weapons being used violently)

    IMPORTANT EXCEPTION: Allow combat sports and martial arts competitions such as:
    - UFC, MMA, Boxing, Wrestling, Judo, Karate, Taekwondo, Muay Thai, Kickboxing, BJJ (Brazilian Jiu-Jitsu)
    - Professional or amateur sports competitions
    - Training/sparring footage
    - Sports tournaments worldwide

    Be strict on real violence but allow legitimate sports content.

    Content to check: "${contentToCheck}"

    Respond with JSON only.`,
            response_json_schema: {
              type: "object",
              properties: {
                is_appropriate: { type: "boolean", description: "true if content is safe or legitimate sports, false if it contains real violence or hate" },
                reason: { type: "string", description: "Brief explanation if blocked" },
                is_combat_sport: { type: "boolean", description: "true if content appears to be combat sports/martial arts" }
              },
              required: ["is_appropriate"]
            }
          });

    if (!moderationResult.is_appropriate) {
      setUploading(false);
      alert(`Your content was blocked: ${moderationResult.reason || 'Contains inappropriate content'}`);
      return;
    }
    
    // Upload video file
    const { file_url } = await base44.integrations.Core.UploadFile({ file: videoFile });
    
    // Create video record
    await onUpload({
      video_url: file_url,
      caption: caption.trim(),
      hashtags: hashtags.split(',').map(t => t.trim()).filter(Boolean),
      music_name: aiVoiceEnabled ? 'AI Voiceover' : (musicName || 'Original Sound'),
      location: `#${location.trim()}`,
      creator_name: user?.full_name || 'Anonymous',
      creator_avatar: user?.avatar,
      creator_email: user?.email,
      likes_count: 0,
      comments_count: 0,
      shares_count: 0,
      views_count: 0,
      ai_voice_script: aiVoiceEnabled ? voiceScript : null,
      edit_settings: editSettings
    });
    
    // Reset form
    setVideoFile(null);
    setVideoPreview(null);
    setCaption('');
    setHashtags('');
    setMusicName('');
    setLocation('');
    setAiVoiceText('');
    setAiVoiceEnabled(false);
    setEditSettings(null);
    setUploading(false);
    onClose();
  };

  const reset = () => {
    setVideoFile(null);
    setVideoPreview(null);
    setCaption('');
    setHashtags('');
    setMusicName('');
    setLocation('');
    setAiVoiceText('');
    setAiVoiceEnabled(false);
    setEditSettings(null);
    setShowEditor(false);
    setShowCamera(false);
    onClose();
  };

  // Show camera capture
  if (showCamera) {
    return (
      <CameraCapture 
        onCapture={handleCameraCapture}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  // Show video editor
  if (showEditor && videoPreview) {
    return (
      <VideoEditor
        videoFile={videoFile}
        videoPreview={videoPreview}
        onSave={handleEditorSave}
        onCancel={() => setShowEditor(false)}
      />
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-zinc-900 rounded-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
              <button onClick={reset}>
                <X className="w-6 h-6 text-zinc-400" />
              </button>
              <h3 className="text-white font-semibold">Create Video</h3>
              <div className="w-6" />
            </div>

            <div className="p-4 space-y-4">
              {/* Video upload area */}
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {!videoPreview ? (
                <div className="space-y-3">
                  {/* Camera capture option */}
                  <button
                    onClick={() => setShowCamera(true)}
                    className="w-full p-4 bg-gradient-to-r from-sky-500/20 to-purple-500/20 border border-sky-500/30 rounded-xl flex items-center gap-4 hover:border-sky-500 transition-all"
                  >
                    <div className="w-12 h-12 rounded-full bg-sky-500 flex items-center justify-center">
                      <Camera className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-white font-medium">Record Video or Take Photo</p>
                      <p className="text-zinc-400 text-sm">Use your camera to capture content</p>
                    </div>
                  </button>

                  {/* Upload option */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-[9/16] max-h-[250px] border-2 border-dashed border-zinc-700 rounded-xl flex flex-col items-center justify-center gap-3 hover:border-sky-500 transition-colors"
                  >
                    <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center">
                      <Upload className="w-7 h-7 text-sky-500" />
                    </div>
                    <p className="text-white font-medium">Upload from device</p>
                    <p className="text-zinc-500 text-sm">Or drag and drop</p>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative aspect-[9/16] max-h-[250px] rounded-xl overflow-hidden">
                    <video
                      src={videoPreview}
                      className="w-full h-full object-cover"
                      style={editSettings ? {
                        filter: `brightness(${editSettings.brightness / 100}) contrast(${editSettings.contrast / 100}) saturate(${editSettings.saturation / 100})`
                      } : {}}
                      muted
                      autoPlay
                      loop
                    />
                    <button
                      onClick={() => {
                        setVideoFile(null);
                        setVideoPreview(null);
                        setEditSettings(null);
                      }}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center"
                    >
                      <X className="w-5 h-5 text-white" />
                    </button>
                    
                    {/* Edit indicator */}
                    {editSettings && (
                      <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-sky-500/80 text-white text-xs flex items-center gap-1">
                        <Wand2 className="w-3 h-3" />
                        Edited
                      </div>
                    )}
                  </div>
                  
                  {/* Edit button */}
                  <Button
                    variant="outline"
                    onClick={() => setShowEditor(true)}
                    className="w-full border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-white"
                  >
                    <Wand2 className="w-4 h-4 mr-2" />
                    Edit Video (Trim, Filters, Effects, Music)
                  </Button>
                </div>
              )}

              {/* Caption */}
              <div>
                <Textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write a caption..."
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 resize-none"
                  rows={3}
                />
              </div>

              {/* Hashtags */}
              <div className="flex items-center gap-2">
                <Hash className="w-5 h-5 text-zinc-500" />
                <Input
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  placeholder="Add hashtags (comma separated)"
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                />
              </div>

              {/* AI Voice Option */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setAiVoiceEnabled(!aiVoiceEnabled)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    aiVoiceEnabled 
                      ? 'bg-sky-500/20 border-sky-500 text-sky-400' 
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    aiVoiceEnabled ? 'bg-sky-500' : 'bg-zinc-700'
                  }`}>
                    <Mic className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-white">Add AI Voiceover</p>
                    <p className="text-xs text-zinc-500">Generate narration for your video</p>
                  </div>
                  <Sparkles className={`w-5 h-5 ${aiVoiceEnabled ? 'text-sky-400' : 'text-zinc-600'}`} />
                </button>
                
                {aiVoiceEnabled && (
                  <Textarea
                    value={aiVoiceText}
                    onChange={(e) => setAiVoiceText(e.target.value)}
                    placeholder="Enter your voiceover script (or leave empty to auto-generate from caption)..."
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 resize-none"
                    rows={2}
                  />
                )}
              </div>

              {/* Music */}
              {!aiVoiceEnabled && (
                <div className="flex items-center gap-2">
                  <Music2 className="w-5 h-5 text-zinc-500" />
                  <Input
                    value={musicName}
                    onChange={(e) => setMusicName(e.target.value)}
                    placeholder="Add sound name"
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                  />
                </div>
              )}

              {/* Country Hashtag (Required) */}
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-zinc-500" />
                <div className="flex items-center flex-1 bg-zinc-800 border border-zinc-700 rounded-md">
                  <span className="text-zinc-400 pl-3">#</span>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value.replace(/^#/, ''))}
                    placeholder="Country (required, e.g. France)"
                    className="bg-transparent border-0 text-white placeholder:text-zinc-500 focus-visible:ring-0"
                    required
                  />
                </div>
              </div>
              {!location.trim() && (
                <p className="text-sky-400 text-xs ml-7">* #Country is required</p>
              )}

              {/* Upload button */}
              <Button
                onClick={handleUpload}
                disabled={!videoFile || !caption.trim() || !location.trim() || uploading}
                className="w-full bg-sky-500 hover:bg-sky-600 text-white h-12 rounded-full font-semibold"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {generatingVoice ? 'Generating voice...' : 'Uploading...'}
                  </>
                ) : (
                  'Post'
                )}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}