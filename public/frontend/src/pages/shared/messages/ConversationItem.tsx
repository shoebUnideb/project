import { Pin, BellOff, MoreHorizontal } from 'lucide-react';
import { relativeTime } from '../../../utils/time';
import Avatar from '../../../components/ui/Avatar';
import type { Conversation } from '../../../types';
import { convName } from './messagesUtils';

interface ConvItemProps {
  conv: Conversation;
  isSelected: boolean;
  onClick: () => void;
  onMenu: (e: React.MouseEvent) => void;
  isPinned: boolean;
  isMuted: boolean;
  isFavourite: boolean;
  hasManualUnread: boolean;
}

export function ConversationItem({ conv, isSelected, onClick, onMenu, isPinned, isMuted, isFavourite, hasManualUnread }: ConvItemProps) {
  const name    = convName(conv);
  const lastMsg = conv.last_message;
  const preview = lastMsg
    ? (lastMsg.body || (lastMsg.attachment ? '📎 Attachment' : ''))
    : 'No messages yet';
  const time       = lastMsg ? relativeTime(lastMsg.timestamp) : '';
  const showUnread = (conv.unread > 0 || hasManualUnread) && !isMuted;

  return (
    <div className="relative group" onContextMenu={e => { e.preventDefault(); onMenu(e); }}>
      <button
        onClick={onClick}
        className={[
          'w-full text-left flex items-center gap-3 px-3 py-3 rounded-xl transition-colors pr-9',
          isSelected ? 'bg-primary-50' : 'hover:bg-gray-50',
        ].join(' ')}
      >
        <div className="relative shrink-0">
          <Avatar name={name} src={conv.user.profile_picture ?? undefined} size="md" />
          {isFavourite && <span className="absolute -top-0.5 -right-0.5 text-[10px] leading-none">⭐</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className={`text-[13px] truncate ${isSelected ? 'font-bold text-primary-700' : 'font-semibold text-gray-900'}`}>{name}</p>
              {isPinned && <Pin size={10} className="text-gray-400 shrink-0" />}
              {isMuted && <BellOff size={10} className="text-gray-400 shrink-0" />}
            </div>
            <span className="text-[11px] text-gray-400 shrink-0">{time}</span>
          </div>
          <p className={`text-[12px] truncate mt-0.5 ${hasManualUnread && !isMuted ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>{preview}</p>
        </div>
        {showUnread && (
          <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center">
            {conv.unread > 0 ? conv.unread : '●'}
          </span>
        )}
      </button>
      <button
        onClick={e => { e.stopPropagation(); onMenu(e); }}
        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all z-10"
      >
        <MoreHorizontal size={13} />
      </button>
    </div>
  );
}
