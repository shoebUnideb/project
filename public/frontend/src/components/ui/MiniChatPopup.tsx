import { useState, useEffect, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Maximize2, Send, Paperclip } from 'lucide-react';
import { messagesApi } from '../../api/messages';
import apiClient, { ApiError } from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';
import Avatar from './Avatar';
import type { Message } from '../../types';

interface Props {
  userId: number;
  userName: string;
  userAvatar?: string;
  onClose: () => void;
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function groupByDate(msgs: Message[]): [string, Message[]][] {
  const map = new Map<string, Message[]>();
  for (const m of msgs) {
    const key = new Date(m.timestamp).toDateString();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return [...map.entries()];
}

function formatLabel(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function MiniChatPopup({ userId, userName, userAvatar, onClose }: Props) {
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody]         = useState('');
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState('');
  const bodyRef  = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const msgs = await messagesApi.getThread(userId);
      setMessages(msgs ?? []);
    } catch { /* silent */ }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!body.trim() || sending) return;
    setError('');
    setSending(true);
    try {
      await apiClient.initCsrf();
      await messagesApi.send(userId, body.trim());
      setBody('');
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        const d = err.data as Record<string, string | string[]>;
        setError(String((Array.isArray(d.detail) ? d.detail[0] : d.detail) ?? 'Failed to send.'));
      } else {
        setError('Server error.');
      }
    } finally {
      setSending(false);
      bodyRef.current?.focus();
    }
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const grouped = groupByDate(messages);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col w-[340px] h-[480px] bg-white rounded-2xl shadow-2xl border border-[#e0e0e0] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-[#e0e0e0] bg-white shrink-0">
        <Avatar src={userAvatar} name={userName} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-gray-900 truncate">{userName}</p>
          <p className="text-[11px] text-green-500 font-medium">Active</p>
        </div>
        <button
          onClick={() => { onClose(); navigate('/messages'); }}
          title="Open full conversation"
          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Maximize2 size={14} />
        </button>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-1 bg-[#f8f8f8]">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center mb-2">
              <Send size={18} className="text-primary-400" />
            </div>
            <p className="text-[12.5px] font-medium text-gray-700">Start the conversation</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Say hi to {userName}</p>
          </div>
        ) : (
          grouped.map(([dateStr, dayMsgs]) => (
            <div key={dateStr}>
              <div className="flex items-center gap-2 my-2">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-[10px] text-gray-400 shrink-0">{formatLabel(dateStr)}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              {dayMsgs.map(msg => {
                const mine = msg.sender.id === me?.id;
                return (
                  <div key={msg.id} className={`flex mb-1.5 ${mine ? 'justify-end' : 'justify-start'}`}>
                    {!mine && (
                      <div className="mr-1.5 self-end shrink-0">
                        <Avatar src={userAvatar} name={userName} size="sm" />
                      </div>
                    )}
                    <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-[13px] leading-snug ${
                      mine
                        ? 'bg-primary-600 text-white rounded-br-sm'
                        : 'bg-white text-gray-900 border border-gray-200 rounded-bl-sm'
                    }`}>
                      <p>{msg.body}</p>
                      <p className={`text-[10px] mt-0.5 ${mine ? 'text-primary-200' : 'text-gray-400'}`}>
                        {formatTime(msg.timestamp)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-3.5 py-1.5 bg-red-50 border-t border-red-100 text-[11px] text-red-600">
          {error}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="flex items-end gap-2 px-3 py-2.5 border-t border-[#e0e0e0] bg-white shrink-0">
        <button
          type="button"
          className="p-1.5 text-gray-400 hover:text-gray-600 shrink-0 transition-colors"
          title="Attach file"
        >
          <Paperclip size={15} />
        </button>
        <textarea
          ref={bodyRef}
          rows={1}
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type a message…"
          className="flex-1 resize-none overflow-hidden text-[13px] bg-gray-100 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder-gray-400 max-h-[80px]"
          style={{ height: 'auto' }}
          onInput={e => {
            const t = e.currentTarget;
            t.style.height = 'auto';
            t.style.height = Math.min(t.scrollHeight, 80) + 'px';
          }}
        />
        <button
          type="submit"
          disabled={!body.trim() || sending}
          className="p-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white rounded-xl transition-colors shrink-0"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
