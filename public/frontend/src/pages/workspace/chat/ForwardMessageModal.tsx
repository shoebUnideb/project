import { X } from 'lucide-react';
import Avatar from '../../../components/ui/Avatar';
import type { WorkspaceChatChannel, WorkspaceDMConversation, User } from '../../../types';
import { channelIcon, senderName } from './chatUtils';

export function ForwardMessageModal({ body, channels, dmConversations, onClose, onForward }: {
  body: string;
  channels: WorkspaceChatChannel[];
  dmConversations: WorkspaceDMConversation[];
  currentUser: User;
  onClose: () => void;
  onForward: (target: { type: 'channel'; id: number } | { type: 'dm'; userId: number }) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"><X size={16} /></button>
        <h3 className="text-[15px] font-bold text-gray-800 mb-1">Forward Message</h3>
        <p className="text-[12px] text-gray-400 mb-3 truncate">"{body.slice(0, 60)}{body.length > 60 ? '…' : ''}"</p>

        <div className="max-h-72 overflow-y-auto space-y-0.5">
          {channels.filter(c => !c.is_archived).map(ch => (
            <button key={`ch-${ch.id}`}
                    onClick={() => { onForward({ type: 'channel', id: ch.id }); onClose(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left">
              <span className="text-gray-400 shrink-0">{channelIcon(ch.channel_type, 13)}</span>
              <span className="text-[13px] text-gray-700">{ch.name}</span>
            </button>
          ))}
          {dmConversations.map(conv => (
            <button key={`dm-${conv.user.id}`}
                    onClick={() => { onForward({ type: 'dm', userId: conv.user.id }); onClose(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left">
              <Avatar src={conv.user.profile_picture ?? undefined} name={senderName(conv.user)} size="sm" />
              <span className="text-[13px] text-gray-700">{senderName(conv.user)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
