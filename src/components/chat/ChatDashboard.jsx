import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Database,
  Sparkles,
  Image as ImageIcon,
  Send,
  Paperclip,
  Menu,
  X,
  FileText,
  FileCheck,
  Loader2,
  AlertTriangle,
  Plus,
  Trash2,
  MessageSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import StaggeredList from '../ui/StaggeredList';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// --- Sidebar Session Item ---
function SessionItem({ session, active = false, onClick, onDelete }) {
  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div
      onClick={onClick}
      className={`
        w-full text-left px-3 py-3 rounded-xl flex items-center gap-2 transition-all group cursor-pointer
        ${active ? 'bg-white border border-slate-200 shadow-sm' : 'hover:bg-slate-200/50 border border-transparent'}
      `}
    >
      <MessageSquare size={14} className={`flex-shrink-0 ${active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
      <div className="flex-1 min-w-0">
        <div className={`text-sm truncate font-medium ${active ? 'text-slate-900' : 'text-slate-700'}`}>
          {session.title}
        </div>
        <div className="text-xs text-slate-400">{timeAgo(session.updated_at)}</div>
      </div>
      {active && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
          title="Delete session"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

// --- Typing Indicator ---
function TypingIndicator() {
  return (
    <div className="flex w-full justify-start">
      <div className="max-w-[85%] md:max-w-[75%] px-5 py-4 bg-white border border-slate-200 rounded-2xl rounded-tl-sm shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
        style={{ animation: 'fadeInUp 0.3s ease-out forwards' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center border border-indigo-200">
            <Database size={14} className="text-indigo-600" />
          </div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Morph Engine</span>
        </div>
        <div className="flex items-center gap-1.5 py-1">
          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

// --- Main Chat Dashboard ---
export default function ChatDashboard() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => scrollToBottom(), [messages]);

  // Check backend health on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_URL}/api/health`);
        const data = await res.json();
        setConnectionStatus(data.ollama === 'connected' ? 'connected' : 'disconnected');
      } catch {
        setConnectionStatus('disconnected');
      }
    };
    checkHealth();
  }, []);

  // Load user's sessions on mount
  useEffect(() => {
    if (!user?.uid) return;
    loadSessions();
  }, [user?.uid]);

  const loadSessions = async () => {
    if (!user?.uid) return;
    try {
      const res = await fetch(`${API_URL}/api/sessions?uid=${user.uid}`);
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  };

  // Load messages when active session changes
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    loadMessages(activeSessionId);
  }, [activeSessionId]);

  const loadMessages = async (sessionId) => {
    try {
      const res = await fetch(`${API_URL}/api/sessions/${sessionId}/messages`);
      const data = await res.json();
      setMessages((data.messages || []).map((m, i) => ({
        id: m.id || i,
        role: m.role,
        text: m.content,
      })));
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  // Create a new session
  const createNewSession = async (title = 'New Chat') => {
    if (!user?.uid) return null;
    try {
      const res = await fetch(`${API_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, title }),
      });
      const session = await res.json();
      setSessions(prev => [session, ...prev].slice(0, 10));
      setActiveSessionId(session.id);
      setMessages([]);
      return session.id;
    } catch (err) {
      console.error('Failed to create session:', err);
      return null;
    }
  };

  // Save a message to the current session
  const saveMessage = async (sessionId, role, content) => {
    try {
      await fetch(`${API_URL}/api/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, content }),
      });
    } catch (err) {
      console.error('Failed to save message:', err);
    }
  };

  // Update session title based on first user message
  const updateSessionTitle = async (sessionId, firstMessage) => {
    const title = firstMessage.length > 50
      ? firstMessage.substring(0, 50) + '...'
      : firstMessage;
    try {
      await fetch(`${API_URL}/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title } : s));
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  };

  // Delete a session
  const deleteSession = async (sessionId) => {
    try {
      await fetch(`${API_URL}/api/sessions/${sessionId}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  // Handle file selection
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
    e.target.value = '';
  };

  // Stream chat response
  const streamChatResponse = useCallback(async (userMessage, conversationHistory) => {
    const botMsgId = Date.now() + 1;
    setMessages(prev => [...prev, { id: botMsgId, role: 'bot', text: '' }]);

    let fullResponse = '';
    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: conversationHistory.map(m => ({
            role: m.role === 'bot' ? 'assistant' : 'user',
            content: m.text,
          })),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        fullResponse = `⚠️ **Error:** ${errorData.error}`;
        setMessages(prev =>
          prev.map(m => m.id === botMsgId ? { ...m, text: fullResponse, isError: true } : m)
        );
        return fullResponse;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              fullResponse += data.token;
              const currentText = fullResponse;
              setMessages(prev =>
                prev.map(m => m.id === botMsgId ? { ...m, text: currentText } : m)
              );
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      fullResponse = err.message?.includes('Failed to fetch')
        ? '⚠️ **Cannot connect to the server.** Make sure the backend is running.'
        : `⚠️ **Error:** ${err.message}`;
      setMessages(prev =>
        prev.map(m => m.id === botMsgId ? { ...m, text: fullResponse, isError: true } : m)
      );
    }
    return fullResponse;
  }, []);

  // Stream vision response
  const streamVisionResponse = useCallback(async (file, userPrompt) => {
    const botMsgId = Date.now() + 1;
    setMessages(prev => [...prev, { id: botMsgId, role: 'bot', text: '' }]);

    let fullResponse = '';
    try {
      const formData = new FormData();
      formData.append('image', file);
      if (userPrompt) formData.append('prompt', userPrompt);

      const res = await fetch(`${API_URL}/api/vision`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        fullResponse = `⚠️ **Error:** ${errorData.error}`;
        setMessages(prev =>
          prev.map(m => m.id === botMsgId ? { ...m, text: fullResponse, isError: true } : m)
        );
        return fullResponse;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              fullResponse += data.token;
              const currentText = fullResponse;
              setMessages(prev =>
                prev.map(m => m.id === botMsgId ? { ...m, text: currentText } : m)
              );
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      fullResponse = err.message?.includes('Failed to fetch')
        ? '⚠️ **Cannot connect to the server.**'
        : `⚠️ **Error:** ${err.message}`;
      setMessages(prev =>
        prev.map(m => m.id === botMsgId ? { ...m, text: fullResponse, isError: true } : m)
      );
    }
    return fullResponse;
  }, []);

  // --- Handle Send ---
  const handleSend = async (e) => {
    e?.preventDefault();
    if (isLoading) return;
    if (!inputValue.trim() && selectedFiles.length === 0) return;

    const userText = inputValue.trim();
    const files = [...selectedFiles];

    let displayText = userText;
    if (files.length > 0) {
      const fileNames = files.map(f => f.name).join(', ');
      displayText = displayText ? `${displayText}\n\n📎 ${fileNames}` : `📎 ${fileNames}`;
    }

    // Auto-create a session if none is active (logged in users only)
    let currentSessionId = activeSessionId;
    if (!currentSessionId && user?.uid) {
      currentSessionId = await createNewSession(displayText.substring(0, 50));
    }

    const newUserMsg = { id: Date.now(), role: 'user', text: displayText };
    setMessages(prev => [...prev, newUserMsg]);
    setInputValue('');
    setSelectedFiles([]);
    setIsLoading(true);

    // Save user message to DB
    if (currentSessionId) {
      await saveMessage(currentSessionId, 'user', displayText);

      // If this is the first message, update the title
      const currentMsgs = messages;
      if (currentMsgs.length === 0) {
        const cleanTitle = userText.replace(/\n/g, ' ').trim() || 'Image Analysis';
        await updateSessionTitle(currentSessionId, cleanTitle);
      }
    }

    try {
      const imageFile = files.find(f => f.type.startsWith('image/'));
      let botResponse;

      if (imageFile) {
        botResponse = await streamVisionResponse(imageFile, userText);
      } else {
        const history = messages.filter(m => m.role === 'user' || m.role === 'bot');
        botResponse = await streamChatResponse(userText, history);
      }

      // Save bot response to DB
      if (currentSessionId && botResponse) {
        await saveMessage(currentSessionId, 'bot', botResponse);
      }
    } finally {
      setIsLoading(false);
      // Refresh sessions to update timestamps
      loadSessions();
    }
  };

  // Determine if we show the empty state or messages
  const showEmptyState = !activeSessionId && messages.length === 0;

  return (
    <div className="flex h-full w-full bg-white relative">
      
      {/* Mobile Sidebar Toggle */}
      <button 
        className="md:hidden absolute top-4 left-4 z-40 p-2 bg-white rounded-lg shadow-md border border-slate-200"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar Panel */}
      <div className={`
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 transition-transform duration-300 ease-in-out
        absolute md:relative z-30 h-full w-72 md:w-80 bg-slate-50 border-r border-slate-200 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)]
      `}>
        <div className="p-4 border-b border-slate-200">
          <button
            onClick={() => {
              setActiveSessionId(null);
              setMessages([]);
            }}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm font-medium transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Plus size={16} /> New Session
          </button>
        </div>
        
        {/* Connection Status */}
        <div className="px-4 py-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-emerald-500' :
              connectionStatus === 'checking' ? 'bg-amber-500 animate-pulse' :
              'bg-red-400'
            }`} />
            <span className="text-xs text-slate-500 font-medium">
              {connectionStatus === 'connected' && 'Ollama Connected'}
              {connectionStatus === 'checking' && 'Checking connection...'}
              {connectionStatus === 'disconnected' && 'Ollama Offline'}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {sessions.length > 0 ? (
            <>
              <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider mt-1 mb-1">Recent Chats</div>
              <StaggeredList
                items={sessions}
                keyExtractor={(s) => s.id}
                className="space-y-1"
                renderItem={(session) => (
                  <SessionItem
                    session={session}
                    active={session.id === activeSessionId}
                    onClick={() => setActiveSessionId(session.id)}
                    onDelete={() => deleteSession(session.id)}
                  />
                )}
              />
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-40 text-slate-400"
            >
              <MessageSquare size={24} className="mb-2 opacity-50" />
              <span className="text-sm">No chats yet</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col h-full relative min-w-0">
        
        {showEmptyState ? (
          /* Empty State — shown when no session is active */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex-1 flex items-center justify-center p-8"
          >
            <div className="text-center max-w-md">
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-indigo-500/30"
              >
                <Database size={28} />
              </motion.div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">Start a Conversation</h2>
              <p className="text-slate-500 mb-8 leading-relaxed">
                Ask questions about databases, upload images for data extraction, or query your data in plain English.
              </p>
              <div className="grid grid-cols-2 gap-3 text-left">
                {[
                  { icon: '💬', text: 'Explain SQL joins' },
                  { icon: '📊', text: 'Extract data from an invoice' },
                  { icon: '🔍', text: 'Write a SELECT query' },
                  { icon: '📁', text: 'Analyze a database schema' },
                ].map((suggestion, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    onClick={() => { setInputValue(suggestion.text); }}
                    whileHover={{ scale: 1.03, borderColor: 'rgba(99, 102, 241, 0.3)' }}
                    whileTap={{ scale: 0.97 }}
                    className="px-4 py-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-sm text-slate-700 transition-colors text-left flex items-center gap-2 group"
                  >
                    <span>{suggestion.icon}</span>
                    <span className="group-hover:text-indigo-700 transition-colors">{suggestion.text}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          /* Messages */
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-slate-50/50">
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`
                    max-w-[85%] md:max-w-[75%] px-5 py-4 shadow-sm relative group
                    ${msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm' 
                      : msg.isError
                        ? 'bg-red-50 border border-red-200 text-red-800 rounded-2xl rounded-tl-sm'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm shadow-[0_2px_10px_rgba(0,0,0,0.02)]'}
                  `} style={{ animation: 'fadeInUp 0.3s ease-out forwards' }}>
                    
                    {msg.role === 'bot' && (
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${
                          msg.isError ? 'bg-red-100 border-red-200' : 'bg-indigo-100 border-indigo-200'
                        }`}>
                          {msg.isError
                            ? <AlertTriangle size={14} className="text-red-600" />
                            : <Database size={14} className="text-indigo-600" />
                          }
                        </div>
                        <span className={`text-xs font-bold uppercase tracking-wider ${
                          msg.isError ? 'text-red-500' : 'text-slate-500'
                        }`}>Morph Engine</span>
                      </div>
                    )}
                    
                    <div className="text-sm md:text-base leading-relaxed whitespace-pre-wrap font-medium">
                      {msg.text}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && <TypingIndicator />}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 md:p-6 bg-white border-t border-slate-200 relative">
          <div className="max-w-3xl mx-auto">
            
            <input 
              type="file" 
              multiple 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,.csv,.pdf,.json"
            />

            {selectedFiles.length > 0 && (
              <div className="absolute -top-12 left-0 w-full flex justify-center pointer-events-none">
                <div className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-full shadow-lg flex items-center gap-3 pointer-events-auto border border-slate-700" style={{ animation: 'fadeInUp 0.2s ease-out' }}>
                  <FileCheck size={16} className="text-emerald-400" />
                  <span>{selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} attached</span>
                  <div className="h-4 w-px bg-slate-700 mx-1" />
                  <button onClick={() => setSelectedFiles([])} className="hover:text-red-400 transition-colors" title="Clear files">
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}

            <form 
              onSubmit={handleSend}
              className={`
                relative flex items-end gap-2 bg-slate-50 border rounded-3xl p-2 transition-all duration-300
                ${(inputValue || selectedFiles.length > 0) ? 'border-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 'border-slate-200 shadow-sm'}
                focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:bg-white
              `}
            >
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className={`p-3 rounded-full transition-colors flex-shrink-0 ${selectedFiles.length > 0 ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'} disabled:opacity-50`}
                title="Upload files"
              >
                <Paperclip size={20} className={selectedFiles.length > 0 ? 'scale-110' : ''} style={{transition: 'transform 0.2s'}} />
              </button>
              
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder={isLoading ? 'Waiting for response...' : 'Query database, or upload an image to extract data...'}
                disabled={isLoading}
                className="flex-1 max-h-40 min-h-[44px] bg-transparent border-none focus:ring-0 resize-none py-3 px-2 text-slate-800 placeholder-slate-400 text-sm md:text-base outline-none disabled:opacity-50"
                rows={1}
              />

              <button 
                type="submit"
                disabled={isLoading || (!inputValue.trim() && selectedFiles.length === 0)}
                className={`p-3 rounded-full flex-shrink-0 transition-all duration-300 ${
                  isLoading
                    ? 'bg-indigo-600 text-white cursor-wait'
                    : (inputValue.trim() || selectedFiles.length > 0)
                      ? 'bg-indigo-600 text-white shadow-md hover:bg-indigo-700 hover:scale-105 active:scale-95' 
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} className={(inputValue.trim() || selectedFiles.length > 0) ? 'translate-x-0.5 -translate-y-0.5' : ''} style={{transition: 'transform 0.2s'}} />
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
