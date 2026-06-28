import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, ShieldOff, ShieldAlert, Paperclip, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { messagesApi, blocksApi } from '../../api/messages';
import { relativeTime } from '../../utils/time';
import apiClient from '../../api/apiClient';
import Avatar from '../../components/ui/Avatar';
import Card from '../../components/ui/Card';
import type { Message } from '../../types';

function dateSeparatorLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function groupByDay(messages: Message[]): Array<{ label: string; messages: Message[] }> {
  const groups: Array<{ label: string; messages: Message[] }> = [];
  for (const m of messages) {
    const label = dateSeparatorLabel(m.timestamp);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.messages.push(m);
    } else {
      groups.push({ label, messages: [m] });
    }
  }
  return groups;
}

export default function ConversationPage() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [newMsg, setNewMsg]     = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sending, setSending]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const targetId = Number(userId);

  const { data: messages, refetch } = useApi(
    () => messagesApi.getThread(targetId),
    [targetId]
  );
  const { data: blockStatus, refetch: refetchBlocks } = useApi(blocksApi.list, []);

  const iBlockedThem = blockStatus?.blocked_ids.includes(targetId) ?? false;
  const theyBlockedMe = blockStatus?.blocked_me_ids.includes(targetId) ?? false;
  const messagingBlocked = iBlockedThem || theyBlockedMe;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!newMsg.trim() && !pendingFile) return;
    setSending(true);
    try {
      await apiClient.initCsrf();
      await messagesApi.send(targetId, newMsg.trim(), pendingFile ?? undefined);
      setNewMsg('');
      setPendingFile(null);
      if (fileRef.current) fileRef.current.value = '';
      refetch();
    } finally {
      setSending(false);
    }
  };

  const msgs = messages ?? [];
  const other = msgs.length > 0
    ? (msgs[0].sender.id === user?.id ? msgs[0].receiver : msgs[0].sender)
    : null;

  const otherName = other
    ? (`${other.first_name} ${other.last_name}`.trim() || other.username)
    : `User #${targetId}`;

  const groups = groupByDay(msgs);

  return (
    <div className="max-w-2xl">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-gray-800 mb-5"
      >
        <ArrowLeft size={14} /> Back
      </button>

      <Card padding="none" className="flex flex-col" style={{ height: '560px' } as React.CSSProperties}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100">
          <Avatar name={otherName} size="sm" />
          <div>
            <p className="text-[13px] font-semibold text-gray-800">{otherName}</p>
            {other && (
              <p className="text-[11px] text-gray-400 capitalize">
                {other.role === 'student' ? 'Mentee' : other.role}
              </p>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {msgs.length === 0 && (
            <p className="text-center text-[13px] text-gray-400 mt-8">
              No messages yet. Say hello!
            </p>
          )}

          {groups.map(group => (
            <div key={group.label}>
              {/* Date separator */}
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-[11px] font-medium text-gray-400">{group.label}</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              <div className="space-y-2">
                {group.messages.map(m => {
                  const isMe = m.sender.id === user?.id;
                  return (
                    <div key={m.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                      {!isMe && (
                        <Avatar
                          name={`${m.sender.first_name} ${m.sender.last_name}`.trim() || m.sender.username}
                          size="sm"
                        />
                      )}
                      <div
                        className={[
                          'max-w-[70%] px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed',
                          isMe
                            ? 'bg-primary-600 text-white rounded-br-sm'
                            : 'bg-gray-100 text-gray-800 rounded-bl-sm',
                        ].join(' ')}
                      >
                        {m.body && <p>{m.body}</p>}
                        {m.attachment && (
                          <a
                            href={m.attachment}
                            target="_blank"
                            rel="noreferrer"
                            className={`flex items-center gap-1.5 text-[12px] mt-1 underline ${isMe ? 'text-primary-100' : 'text-primary-600'}`}
                          >
                            <Paperclip size={11} />
                            {decodeURIComponent(m.attachment.split('/').pop() ?? 'Attachment')}
                          </a>
                        )}
                        <p className={`text-[10px] mt-1 ${isMe ? 'text-primary-200' : 'text-gray-400'}`}>
                          {relativeTime(m.timestamp)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input / blocked state */}
        {messagingBlocked ? (
          <div className="px-5 py-4 border-t border-gray-100">
            {iBlockedThem ? (
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2 text-[13px] text-gray-500">
                  <ShieldAlert size={15} className="text-gray-400 shrink-0" />
                  You have blocked this user.
                </div>
                <button
                  onClick={async () => {
                    await apiClient.initCsrf();
                    await blocksApi.unblock(targetId);
                    refetchBlocks();
                  }}
                  className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 text-[12px] font-semibold rounded-lg transition-colors"
                >
                  <ShieldOff size={12} /> Unblock
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 text-[13px] text-gray-500">
                <ShieldAlert size={15} className="text-gray-400 shrink-0" />
                You cannot send messages to this user.
              </div>
            )}
          </div>
        ) : (
          <div className="px-5 py-3.5 border-t border-gray-100">
            {pendingFile && (
              <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-primary-50 border border-primary-100 rounded-lg">
                <Paperclip size={12} className="text-primary-600 shrink-0" />
                <span className="text-[12px] text-primary-700 truncate flex-1">{pendingFile.name}</span>
                <button onClick={() => { setPendingFile(null); if (fileRef.current) fileRef.current.value = ''; }} className="text-gray-400 hover:text-red-500">
                  <X size={13} />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input ref={fileRef} type="file" className="hidden" onChange={e => setPendingFile(e.target.files?.[0] ?? null)} />
              <button onClick={() => fileRef.current?.click()} className="p-2.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-50 transition-colors" title="Attach file">
                <Paperclip size={15} />
              </button>
              <input
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="Type a message…"
                className="flex-1 px-3.5 py-2.5 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                onClick={send}
                disabled={sending || (!newMsg.trim() && !pendingFile)}
                className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white rounded-lg transition-colors"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
