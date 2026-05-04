import React from 'react';
import { ArrowLeft, Phone, Video, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ChatHeader({ otherUser, onBack }) {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-zinc-800 bg-black/95 backdrop-blur-lg">
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={onBack}
        className="text-white hover:bg-zinc-800 md:hidden"
      >
        <ArrowLeft className="w-5 h-5" />
      </Button>
      
      <img
        src={otherUser?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.email}`}
        alt={otherUser?.name}
        className="w-10 h-10 rounded-full object-cover"
      />
      
      <div className="flex-1 min-w-0">
        <h3 className="text-white font-semibold truncate">
          {otherUser?.name || otherUser?.email?.split('@')[0]}
        </h3>
        <p className="text-zinc-500 text-xs">
          {otherUser?.online ? 'Online' : 'Tap for info'}
        </p>
      </div>
      
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="text-white hover:bg-zinc-800">
          <Phone className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-white hover:bg-zinc-800">
          <Video className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-white hover:bg-zinc-800">
          <MoreVertical className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}