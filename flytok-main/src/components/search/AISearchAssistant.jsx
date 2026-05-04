import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Send, Loader2, Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';

export default function AISearchAssistant({ isOpen, onClose, onSearch }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: 'Hello! I\'m your AI assistant. Let me help you find the right place. Tell me what kind of destination you\'re looking for!'
      }]);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async () => {
    if (!input.trim() || loading) return;
    
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    
    setLoading(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract 2-3 key search terms from this travel request. Return ONLY the search terms with # prefix (e.g., #beaches #tropical #asia), nothing else: "${userMessage}"`,
      });
      
      const searchQuery = result.trim();
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Perfect! I'll search for ${searchQuery} for you. Let me take you to the results!` 
      }]);
      
      setTimeout(() => {
        onClose();
        setMessages([]);
        onSearch(searchQuery);
      }, 1500);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I had trouble processing that. Please try again!' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'voice-message.webm', { type: 'audio/webm' });
        
        // Upload audio file
        setLoading(true);
        try {
          const { file_url } = await base44.integrations.Core.UploadFile({ file: audioFile });
          
          // Add user voice message indicator
          setMessages(prev => [...prev, { role: 'user', content: '🎤 Voice message...' }]);
          
          // Transcribe audio using LLM
          const result = await base44.integrations.Core.InvokeLLM({
            prompt: 'Transcribe this audio message and extract 2-3 key travel search terms. Return ONLY the search terms with # prefix (e.g., #beaches #tropical #asia), nothing else.',
            file_urls: [file_url]
          });
          
          const searchQuery = result.trim();
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `Perfect! I'll search for ${searchQuery} for you. Let me take you to the results!` 
          }]);
          
          setTimeout(() => {
            onClose();
            setMessages([]);
            onSearch(searchQuery);
          }, 1500);
        } catch (error) {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: 'Sorry, I had trouble processing your voice message. Please try again!' 
          }]);
        } finally {
          setLoading(false);
        }
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I couldn\'t access your microphone. Please check your permissions.' 
      }]);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/90 z-50 flex items-end justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-t-3xl w-full max-w-md h-[85vh] overflow-hidden shadow-2xl border-t border-x border-sky-500/20 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">AI Travel Assistant</h3>
                  <p className="text-slate-400 text-xs">Tell me what you're looking for</p>
                </div>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.role === 'user' 
                      ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white' 
                      : 'bg-slate-800/50 text-white border border-slate-700/50'
                  }`}>
                    {message.role === 'assistant' && (
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-4 h-4 text-sky-400" />
                        <span className="text-sky-400 text-xs font-semibold">AI Assistant</span>
                      </div>
                    )}
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </div>
                </motion.div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800/50 rounded-2xl px-4 py-3 border border-slate-700/50">
                    <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-slate-700/50">
              <div className="flex items-center gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={isRecording ? "Recording..." : "Type your destination request..."}
                  className="flex-1 bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500 focus:border-sky-400/60 rounded-full h-12 px-4"
                  disabled={loading || isRecording}
                />
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={loading}
                  className={`w-12 h-12 rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg ${
                    isRecording 
                      ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 animate-pulse shadow-red-500/30' 
                      : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 shadow-purple-500/30'
                  }`}
                >
                  {isRecording ? (
                    <Square className="w-5 h-5 text-white" />
                  ) : (
                    <Mic className="w-5 h-5 text-white" />
                  )}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!input.trim() || loading || isRecording}
                  className="w-12 h-12 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-sky-500/30"
                >
                  <Send className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}