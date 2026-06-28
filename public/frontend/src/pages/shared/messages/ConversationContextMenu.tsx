import {
  Archive, BellOff, Pin, Heart, ListPlus, Ban, UserCheck,
  MailOpen, Trash2, ArchiveRestore, ChevronRight,
} from 'lucide-react';

interface ConversationContextMenuProps {
  ctxMenu: { userId: number; x: number; y: number };
  ctxRef: React.RefObject<HTMLDivElement>;
  ctxMuteOpen: boolean;
  setCtxMuteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  ctxIsArchived: boolean;
  ctxIsPinned: boolean;
  ctxIsMuted: boolean;
  ctxIsFav: boolean;
  ctxIsUnread: boolean;
  ctxConvIsBlocked: boolean;
  onArchive: () => void;
  onMute: (option: '8h' | '1w' | 'always' | 'unmute') => void;
  onPin: () => void;
  onMarkUnread: () => void;
  onFavourite: () => void;
  onBlock: () => Promise<void>;
  onClear: () => Promise<void>;
  onDelete: () => Promise<void>;
}

const ctxItem = 'w-full flex items-center gap-3 px-4 py-2 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors text-left';
const ctxItemRed = 'w-full flex items-center gap-3 px-4 py-2 text-[13px] text-red-500 hover:bg-red-50 transition-colors text-left';

export function ConversationContextMenu({
  ctxMenu, ctxRef, ctxMuteOpen, setCtxMuteOpen,
  ctxIsArchived, ctxIsPinned, ctxIsMuted, ctxIsFav, ctxIsUnread, ctxConvIsBlocked,
  onArchive, onMute, onPin, onMarkUnread, onFavourite, onBlock, onClear, onDelete,
}: ConversationContextMenuProps) {
  return (
    <div
      ref={ctxRef}
      className="fixed bg-white border border-gray-200 rounded-2xl z-50 py-1.5 w-56"
      style={{ left: ctxMenu.x, top: ctxMenu.y }}
    >
      <button onClick={onArchive} className={ctxItem}>
        {ctxIsArchived
          ? <><ArchiveRestore size={14} className="shrink-0" /> Unarchive chat</>
          : <><Archive size={14} className="shrink-0" /> Archive chat</>
        }
      </button>

      <div className="relative">
        <button
          onMouseEnter={() => setCtxMuteOpen(true)}
          onClick={() => setCtxMuteOpen(v => !v)}
          className={`${ctxItem} justify-between`}
        >
          <span className="flex items-center gap-3">
            <BellOff size={14} className="shrink-0" />
            {ctxIsMuted ? 'Unmute notifications' : 'Mute notifications'}
          </span>
          <ChevronRight size={12} className="text-gray-400 shrink-0" />
        </button>
        {ctxMuteOpen && (
          <div
            className="absolute left-full top-0 ml-1 bg-white border border-gray-200 rounded-xl z-50 py-1.5 w-40"
            onMouseLeave={() => setCtxMuteOpen(false)}
          >
            <button onClick={() => onMute('8h')}     className={ctxItem}>8 hours</button>
            <button onClick={() => onMute('1w')}     className={ctxItem}>1 week</button>
            <button onClick={() => onMute('always')} className={ctxItem}>Always</button>
            {ctxIsMuted && (
              <button onClick={() => onMute('unmute')} className={ctxItem}>Unmute</button>
            )}
          </div>
        )}
      </div>

      <button onClick={onPin} className={ctxItem}>
        <Pin size={14} className="shrink-0" />
        {ctxIsPinned ? 'Unpin chat' : 'Pin chat'}
      </button>

      <button onClick={onMarkUnread} className={ctxItem}>
        <MailOpen size={14} className="shrink-0" />
        {ctxIsUnread ? 'Mark as read' : 'Mark as unread'}
      </button>

      <button onClick={onFavourite} className={ctxItem}>
        <Heart size={14} className={`shrink-0 ${ctxIsFav ? 'fill-red-400 text-red-400' : ''}`} />
        {ctxIsFav ? 'Remove from favourites' : 'Add to favourites'}
      </button>

      <button className={`${ctxItem} justify-between opacity-40 cursor-not-allowed`} disabled>
        <span className="flex items-center gap-3">
          <ListPlus size={14} className="shrink-0" /> Add to list
        </span>
        <ChevronRight size={12} className="text-gray-400 shrink-0" />
      </button>

      <div className="my-1 border-t border-gray-100" />

      <button onClick={onBlock} className={ctxConvIsBlocked ? ctxItem : ctxItemRed}>
        {ctxConvIsBlocked
          ? <><UserCheck size={14} className="shrink-0" /> Unblock</>
          : <><Ban size={14} className="shrink-0" /> Block</>
        }
      </button>

      <button onClick={onClear} className={ctxItemRed}>
        <MailOpen size={14} className="shrink-0" /> Clear chat
      </button>

      <button onClick={onDelete} className={ctxItemRed}>
        <Trash2 size={14} className="shrink-0" /> Delete chat
      </button>
    </div>
  );
}
