import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ChatHeader from './ChatHeader';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function ChatView({ conversation, currentUser, onBack }) {
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const queryClient = useQueryClient();
  const [localMessages, setLocalMessages] = useState([]);

  const otherEmail = conversation?.participant_emails?.find(e => e !== currentUser?.email);
  const otherUser = {
    email: otherEmail,
    name: otherEmail?.split('@')[0],
  };

  // Fetch messages
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', conversation?.id],
    queryFn: () => base44.entities.Message.filter(
      { conversation_id: conversation.id }, 
      'created_date'
    ),
    enabled: !!conversation?.id,
    refetchInterval: 3000, // Poll every 3 seconds for new messages
  });

  // Update local messages when fetched messages change
  useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localMessages]);

  // Mark messages as read
  useEffect(() => {
    const markAsRead = async () => {
      if (!conversation?.id || !currentUser?.email) return;
      
      const unreadMessages = localMessages.filter(
        m => m.sender_email !== currentUser.email && !m.is_read
      );
      
      for (const msg of unreadMessages) {
        await base44.entities.Message.update(msg.id, { is_read: true });
      }

      // Update conversation unread count
      if (unreadMessages.length > 0) {
        const unreadCount = { ...(conversation.unread_count || {}) };
        unreadCount[currentUser.email] = 0;
        await base44.entities.Conversation.update(conversation.id, { unread_count: unreadCount });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }
    };
    
    markAsRead();
  }, [localMessages, conversation?.id, currentUser?.email]);

  const handleSend = async ({ content, media_url, media_type }) => {
    if (!conversation?.id || !currentUser) return;

    const newMessage = {
      conversation_id: conversation.id,
      sender_email: currentUser.email,
      sender_name: currentUser.full_name,
      sender_avatar: currentUser.avatar,
      content,
      media_url,
      media_type,
      is_read: false,
    };

    // Optimistic update
    const tempMessage = {
      ...newMessage,
      id: 'temp-' + Date.now(),
      created_date: new Date().toISOString(),
    };
    setLocalMessages(prev => [...prev, tempMessage]);

    // Create the message
    await base44.entities.Message.create(newMessage);

    // Update conversation
    const unreadCount = { ...(conversation.unread_count || {}) };
    unreadCount[otherEmail] = (unreadCount[otherEmail] || 0) + 1;
    
    await base44.entities.Conversation.update(conversation.id, {
      last_message: content || (media_type !== 'none' ? `Sent a ${media_type}` : ''),
      last_message_date: new Date().toISOString(),
      last_message_sender: currentUser.email,
      unread_count: unreadCount,
    });

    queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  };

  if (!conversation) {
    return (
      <div className="h-full flex items-center justify-center bg-black">
        <div className="text-center text-zinc-500">
          <p className="text-xl mb-2">Select a conversation</p>
          <p className="text-sm">Choose from your existing conversations or start a new one</p>
        </div>
      </div>
    );
  }

  // Group messages by sender for avatar display
  const messagesWithMeta = localMessages.map((msg, idx) => {
    const prevMsg = localMessages[idx - 1];
    const showAvatar = !prevMsg || prevMsg.sender_email !== msg.sender_email;
    return { ...msg, showAvatar };
  });

  return (
    <div className="h-full flex flex-col bg-black">
      <ChatHeader otherUser={otherUser} onBack={onBack} />
      
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="py-4 space-y-2 min-h-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messagesWithMeta.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
              <p>No messages yet</p>
              <p className="text-sm mt-1">Say hello! 👋</p>
            </div>
          ) : (
            messagesWithMeta.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={message.sender_email === currentUser?.email}
                showAvatar={message.showAvatar}
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <ChatInput onSend={handleSend} />
    </div>
  );
}