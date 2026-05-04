import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ConversationList from '@/components/messages/ConversationList';
import ChatView from '@/components/messages/ChatView';
import NewChatModal from '@/components/messages/NewChatModal';
import { cn } from '@/lib/utils';

export default function Messages() {
  const [user, setUser] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const queryClient = useQueryClient();

  // Get conversation ID or startChat from URL if present
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const startChatEmail = urlParams.get('startChat');
    
    if (startChatEmail && user) {
      // Auto-start chat with this user
      const startChat = async () => {
        const users = await base44.entities.User.filter({ email: startChatEmail });
        if (users.length > 0) {
          handleStartNewChat(users[0]);
        }
      };
      startChat();
    }
  }, [user]);

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (e) {
        // Not logged in
      }
    };
    fetchUser();
  }, []);

  // Fetch conversations
  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations', user?.email],
    queryFn: async () => {
      const allConvs = await base44.entities.Conversation.list('-last_message_date');
      return allConvs.filter(conv => 
        conv.participant_emails?.includes(user.email)
      );
    },
    enabled: !!user?.email,
    refetchInterval: 5000, // Poll for new conversations
  });

  // Select conversation from URL param
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const convId = urlParams.get('conversation');
    if (convId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === convId);
      if (conv) {
        setSelectedConversation(conv);
        setMobileShowChat(true);
      }
    }
  }, [conversations]);

  const handleSelectConversation = (conv) => {
    setSelectedConversation(conv);
    setMobileShowChat(true);
  };

  const handleBack = () => {
    setMobileShowChat(false);
  };

  const handleStartNewChat = async (otherUser) => {
    if (!user) return;

    // Check if conversation already exists
    const existingConv = conversations.find(conv =>
      conv.participant_emails?.includes(otherUser.email)
    );

    if (existingConv) {
      setSelectedConversation(existingConv);
      setMobileShowChat(true);
      return;
    }

    // Create new conversation
    const newConv = await base44.entities.Conversation.create({
      participant_emails: [user.email, otherUser.email],
      last_message: '',
      last_message_date: new Date().toISOString(),
      unread_count: { [user.email]: 0, [otherUser.email]: 0 },
    });

    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    setSelectedConversation(newConv);
    setMobileShowChat(true);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 pb-20">
        <div className="text-center">
          <p className="text-white text-xl mb-2">Messages</p>
          <p className="text-zinc-500 mb-4">Log in to see your messages</p>
          <button 
            onClick={() => base44.auth.redirectToLogin()}
            className="px-6 py-2 bg-rose-500 text-white rounded-full font-semibold"
          >
            Log in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black pb-16 md:pb-0">
      <div className="h-full flex">
        {/* Conversations list - hidden on mobile when chat is open */}
        <div className={cn(
          "w-full md:w-96 md:border-r md:border-zinc-800 flex flex-col",
          mobileShowChat ? "hidden md:flex" : "flex"
        )}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <h1 className="text-white font-bold text-xl">{user.full_name || 'Messages'}</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setNewChatOpen(true)}
              className="text-white hover:bg-zinc-800"
            >
              <Edit className="w-5 h-5" />
            </Button>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            <ConversationList
              conversations={conversations}
              currentUserEmail={user.email}
              selectedId={selectedConversation?.id}
              onSelect={handleSelectConversation}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Chat view - full screen on mobile */}
        <div className={cn(
          "flex-1 flex flex-col",
          mobileShowChat ? "flex" : "hidden md:flex"
        )}>
          <ChatView
            conversation={selectedConversation}
            currentUser={user}
            onBack={handleBack}
          />
        </div>
      </div>

      {/* New chat modal */}
      <NewChatModal
        isOpen={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onSelectUser={handleStartNewChat}
        currentUserEmail={user.email}
      />
    </div>
  );
}