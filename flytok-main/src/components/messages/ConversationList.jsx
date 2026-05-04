import React from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ConversationList({ 
  conversations, 
  currentUserEmail, 
  selectedId, 
  onSelect,
  isLoading 
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
            <div className="w-14 h-14 rounded-full bg-zinc-800" />
            <div className="flex-1">
              <div className="h-4 w-24 bg-zinc-800 rounded mb-2" />
              <div className="h-3 w-40 bg-zinc-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
        <p>No messages yet</p>
        <p className="text-sm mt-1">Start a conversation!</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-900">
      {conversations.map((conv) => {
        const otherEmail = conv.participant_emails.find(e => e !== currentUserEmail);
        const unreadCount = conv.unread_count?.[currentUserEmail] || 0;
        const isSelected = selectedId === conv.id;
        const isSender = conv.last_message_sender === currentUserEmail;

        return (
          <button
            key={conv.id}
            onClick={() => onSelect(conv)}
            className={cn(
              "w-full flex items-center gap-3 p-4 hover:bg-zinc-900/50 transition-colors text-left",
              isSelected && "bg-zinc-900"
            )}
          >
            <div className="relative">
              <img
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${otherEmail}`}
                alt=""
                className="w-14 h-14 rounded-full object-cover"
              />
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{unreadCount}</span>
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h3 className={cn(
                  "font-semibold truncate",
                  unreadCount > 0 ? "text-white" : "text-zinc-300"
                )}>
                  {otherEmail?.split('@')[0]}
                </h3>
                <span className="text-xs text-zinc-500">
                  {formatMessageDate(conv.last_message_date)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {isSender && (
                  conv.unread_count?.[otherEmail] > 0 
                    ? <Check className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                    : <CheckCheck className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                )}
                <p className={cn(
                  "text-sm truncate",
                  unreadCount > 0 ? "text-zinc-300 font-medium" : "text-zinc-500"
                )}>
                  {conv.last_message}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function formatMessageDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d');
}