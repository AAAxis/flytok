import React, { useState, useRef } from 'react';
import { Send, Image, Smile, Mic, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

export default function ChatInput({ onSend, disabled }) {
  const [message, setMessage] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState('none');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const type = file.type.startsWith('image/') ? 'image' : 'video';
    setMediaFile(file);
    setMediaType(type);
    setMediaPreview(URL.createObjectURL(file));
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType('none');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = async () => {
    if ((!message.trim() && !mediaFile) || disabled) return;

    setUploading(true);
    let mediaUrl = null;

    if (mediaFile) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: mediaFile });
      mediaUrl = file_url;
    }

    await onSend({
      content: message.trim(),
      media_url: mediaUrl,
      media_type: mediaFile ? mediaType : 'none'
    });

    setMessage('');
    clearMedia();
    setUploading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 border-t border-zinc-800 bg-black">
      {/* Media preview */}
      {mediaPreview && (
        <div className="mb-3 relative inline-block">
          {mediaType === 'image' ? (
            <img 
              src={mediaPreview} 
              alt="" 
              className="h-20 rounded-lg object-cover"
            />
          ) : (
            <video 
              src={mediaPreview} 
              className="h-20 rounded-lg"
            />
          )}
          <button
            onClick={clearMedia}
            className="absolute -top-2 -right-2 w-6 h-6 bg-zinc-700 rounded-full flex items-center justify-center hover:bg-zinc-600"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          className="text-zinc-400 hover:text-white hover:bg-zinc-800"
          disabled={uploading}
        >
          <Image className="w-5 h-5" />
        </Button>

        <div className="flex-1 relative">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500 rounded-full pr-10"
            disabled={uploading}
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white h-8 w-8"
          >
            <Smile className="w-5 h-5" />
          </Button>
        </div>

        {message.trim() || mediaFile ? (
          <Button
            onClick={handleSend}
            disabled={uploading}
            className="bg-rose-500 hover:bg-rose-600 rounded-full w-10 h-10 p-0"
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <Mic className="w-5 h-5" />
          </Button>
        )}
      </div>
    </div>
  );
}