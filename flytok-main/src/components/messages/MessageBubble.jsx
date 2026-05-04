import React from 'react';
import { format } from 'date-fns';
import { Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function MessageBubble({ message, isOwn, showAvatar }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn("flex gap-2 px-4", isOwn ? "justify-end" : "justify-start")}
    >
      {!isOwn && showAvatar && (
        <img
          src={message.sender_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${message.sender_email}`}
          alt=""
          className="w-8 h-8 rounded-full self-end"
        />
      )}
      {!isOwn && !showAvatar && <div className="w-8" />}
      
      <div className={cn("max-w-[70%]", isOwn && "flex flex-col items-end")}>
        {/* Media attachment */}
        {message.media_url && message.media_type !== 'none' && (
          <div className="rounded-2xl overflow-hidden mb-1">
            {message.media_type === 'image' ? (
              <img 
                src={message.media_url} 
                alt="" 
                className="max-w-full max-h-64 object-cover"
              />
            ) : (
              <video 
                src={message.media_url} 
                className="max-w-full max-h-64"
                controls
              />
            )}
          </div>
        )}
        
        {/* Message content */}
        {message.content && (
          <div className={cn(
            "px-4 py-2.5 rounded-2xl relative",
            isOwn 
              ? "bg-rose-500 text-white rounded-br-md" 
              : "bg-zinc-800 text-white rounded-bl-md"
          )}>
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          </div>
        )}
        
        {/* Time and read status */}
        <div className={cn(
          "flex items-center gap-1 mt-1 px-1",
          isOwn ? "justify-end" : "justify-start"
        )}>
          <span className="text-zinc-500 text-xs">
            {format(new Date(message.created_date), 'HH:mm')}
          </span>
          {isOwn && (
            message.is_read 
              ? <CheckCheck className="w-4 h-4 text-cyan-500" />
              : <Check className="w-4 h-4 text-zinc-500" />
          )}
        </div>
      </div>
    </motion.div>
  );
}