import { FileText, CheckCheck, Download } from 'lucide-react';
import Avatar from '../../../components/ui/Avatar';
import type { Message } from '../../../types';
import { formatTime, formatDateLabel } from './messagesUtils';

type CurrentUser = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  username?: string;
  profile_picture?: string | null;
} | null;

interface MessageThreadProps {
  grouped: [string, Message[]][];
  loading: boolean;
  currentUser: CurrentUser;
  selectedName: string;
  scrollRef: React.RefObject<HTMLDivElement>;
}

export function MessageThread({ grouped, loading, currentUser, selectedName, scrollRef }: MessageThreadProps) {
  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-1">
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-[13px] text-gray-400">Loading messages…</p>
        </div>
      ) : grouped.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-[13px] text-gray-400">No messages yet. Start the conversation.</p>
        </div>
      ) : (
        <div>
          {grouped.map(([dateKey, msgs]) => (
            <div key={dateKey}>
              <div className="flex items-center gap-3 my-1.5">
                <div className="flex-1 border-t border-gray-100" />
                <span className="text-[11px] font-medium text-gray-400 bg-white px-2 shrink-0">{formatDateLabel(msgs[0].timestamp)}</span>
                <div className="flex-1 border-t border-gray-100" />
              </div>
              {msgs.map((msg, i) => {
                const isMe = msg.sender.id === currentUser?.id;
                const prevSame = i > 0 && msgs[i - 1].sender.id === msg.sender.id;
                const msgName = isMe
                  ? (`${currentUser?.first_name ?? ''} ${currentUser?.last_name ?? ''}`.trim() || currentUser?.username || 'You')
                  : selectedName;
                return (
                  <div key={msg.id} className={`flex items-end gap-1 px-3 ${isMe ? 'flex-row-reverse' : 'flex-row'} ${prevSame ? 'mt-px' : 'mt-1.5'}`}>
                    {!isMe && (
                      <div className={`shrink-0 mb-0.5 ${prevSame ? 'invisible' : ''}`}>
                        <Avatar name={msgName} src={msg.sender.profile_picture ?? undefined} size="xs" />
                      </div>
                    )}
                    <div className={`flex flex-col max-w-[65%] ${isMe ? 'items-end' : 'items-start'}`}>
                      {msg.attachment && (
                        <a href={msg.attachment} download target="_blank" rel="noreferrer"
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-xl border transition-colors max-w-xs mb-0.5 ${
                            isMe
                              ? 'bg-primary-600 border-primary-600 hover:bg-primary-700 text-white'
                              : 'bg-gray-100 border-gray-200 hover:bg-gray-200 text-gray-700'
                          }`}>
                          <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${isMe ? 'bg-white/20' : 'bg-white'}`}>
                            <FileText size={11} className={isMe ? 'text-white' : 'text-primary-600'} />
                          </div>
                          <div className="min-w-0">
                            <p className={`text-[11px] font-medium truncate max-w-[160px] ${isMe ? 'text-white' : 'text-gray-700'}`}>{msg.attachment.split('/').pop()}</p>
                            <p className={`text-[10px] ${isMe ? 'text-white/60' : 'text-gray-400'}`}>File</p>
                          </div>
                          <Download size={11} className={`ml-1.5 shrink-0 ${isMe ? 'text-white/70' : 'text-gray-400'}`} />
                        </a>
                      )}
                      {msg.body && (
                        <div className={`relative px-2.5 py-1 rounded-2xl ${
                          isMe
                            ? 'bg-primary-600 text-white rounded-br-sm'
                            : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                        }`}>
                          <p className="text-[14px] leading-snug whitespace-pre-wrap break-words pr-14">{msg.body}</p>
                          <span className={`absolute bottom-1 right-2 flex items-center gap-0.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                            <span className={`text-[9.5px] ${isMe ? 'text-white/50' : 'text-gray-400'}`}>{formatTime(msg.timestamp)}</span>
                            {isMe && <CheckCheck size={9} className={msg.is_read ? 'text-primary-300' : 'text-white/30'} />}
                          </span>
                        </div>
                      )}
                      {!msg.body && (
                        <div className={`flex items-center gap-0.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                          <span className="text-[9.5px] text-gray-400">{formatTime(msg.timestamp)}</span>
                          {isMe && <CheckCheck size={9} className={msg.is_read ? 'text-primary-400' : 'text-gray-300'} />}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div className="h-px" />
        </div>
      )}
    </div>
  );
}
