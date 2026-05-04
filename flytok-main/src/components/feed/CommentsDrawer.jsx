import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Send, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function CommentsDrawer({ 
  isOpen, 
  onClose, 
  comments, 
  onAddComment,
  isLoading 
}) {
  const [newComment, setNewComment] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!newComment.trim() || rating === 0) return;
    setSending(true);
    await onAddComment(newComment, rating);
    setNewComment('');
    setRating(0);
    setSending(false);
  };

  const renderStars = (count, size = 'sm') => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              size === 'sm' ? 'w-3 h-3' : 'w-5 h-5',
              star <= count ? 'text-amber-400 fill-amber-400' : 'text-zinc-600'
            )}
          />
        ))}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />
          
          {/* Drawer */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 h-[60vh] bg-zinc-900 rounded-t-3xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div className="w-8" />
              <h3 className="text-white font-semibold">
                {comments.length} Comments
              </h3>
              <button onClick={onClose}>
                <X className="w-6 h-6 text-zinc-400" />
              </button>
            </div>

            {/* Comments list */}
            <ScrollArea className="flex-1 p-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-zinc-500">
                  <p>No comments yet</p>
                  <p className="text-sm">Be the first to comment!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <img
                        src={comment.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.user_email}`}
                        alt={comment.user_name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium text-sm">
                            {comment.user_name || 'User'}
                          </span>
                          <span className="text-zinc-500 text-xs">
                            {format(new Date(comment.created_date), 'MMM d')}
                          </span>
                          {comment.rating && renderStars(comment.rating)}
                        </div>
                        <p className="text-zinc-300 text-sm mt-0.5">
                          {comment.content}
                        </p>
                        <div className="flex items-center gap-4 mt-2">
                          <button className="flex items-center gap-1 text-zinc-500 text-xs">
                            <Heart className="w-4 h-4" />
                            {comment.likes_count || 0}
                          </button>
                          <button className="text-zinc-500 text-xs">
                            Reply
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-zinc-800 space-y-3">
              {/* Star rating */}
              <div className="flex items-center gap-3">
                <span className="text-zinc-400 text-sm">Share your feelings:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                      className="p-0.5"
                    >
                      <Star
                        className={cn(
                          'w-6 h-6 transition-colors',
                          star <= (hoverRating || rating)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-zinc-600'
                        )}
                      />
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <span className="text-zinc-500 text-xs">
                    {rating === 1 ? 'Disagree' : rating === 5 ? 'Strongly agree!' : ''}
                  </span>
                )}
              </div>
              
              <div className="flex gap-2">
                <Input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 rounded-full"
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                />
                <Button
                  onClick={handleSubmit}
                  disabled={!newComment.trim() || rating === 0 || sending}
                  className="bg-sky-500 hover:bg-sky-600 rounded-full px-4"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}