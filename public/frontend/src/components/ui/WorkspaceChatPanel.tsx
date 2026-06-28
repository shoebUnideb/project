import { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { workspacesApi } from '../../api/workspaces';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/apiClient';
import Avatar from '../ui/Avatar';
import { relativeTime } from '../../utils/time';
import type { WorkspaceChatMessage } from '../../types';

interface Props {
  workspaceId: number;
}

export default function WorkspaceChatPanel({ workspaceId }: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<WorkspaceChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const fetchMessages = async () => {
    try {
      const data = await workspacesApi.getChatMessages(workspaceId);
      setMessages(data);
    } catch { /* not a member — silently hide */ }
  };

  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 8_000);
    return () => clearInterval(pollRef.current);
  }, [workspaceId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    setSending(true);
    setError('');
    try {
      await apiClient.initCsrf();
      const msg = await workspacesApi.sendChatMessage(workspaceId, input.trim());
      setMessages(prev => [...prev, msg]);
      setInput('');
    } catch {
      setError('Failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Group Chat</p>
        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">Live</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-[12.5px] text-gray-400 text-center py-8">No messages yet. Say hello!</p>
        )}
        {messages.map(msg => {
          const isMe = msg.sender.id === user?.id;
          const name = `${msg.sender.first_name ?? ''} ${msg.sender.last_name ?? ''}`.trim() || msg.sender.username;
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              <Avatar name={name} size="sm" className="shrink-0" />
              <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                {!isMe && (
                  <p className="text-[10.5px] text-gray-400 px-1">{name}</p>
                )}
                <div className={`px-3 py-2 rounded-2xl text-[13px] ${
                  isMe
                    ? 'bg-primary-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}>
                  {msg.body}
                </div>
                <p className="text-[10px] text-gray-400 px-1">{relativeTime(msg.created_at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100">
        {error && <p className="text-[11px] text-red-500 mb-1">{error}</p>}
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Type a message…"
            className="flex-1 px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="p-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
