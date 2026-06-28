import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Download } from 'lucide-react';
import type { OrgChatReaction } from '../../api/orgApi';
import { EMOJI_MAP, EMOJI_KEYS, isImageUrl } from './OrgChatUtils';

export function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-1.5">
      <div className="flex-1 border-t border-gray-100" />
      <span className="text-[11px] font-medium text-gray-400 bg-white px-2">{label}</span>
      <div className="flex-1 border-t border-gray-100" />
    </div>
  );
}

export function FileAttachmentCard({ url, name }: { url: string; name?: string | null }) {
  const isImg = isImageUrl(url);
  const label = name || url.split('/').pop() || 'File';
  if (isImg) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block mt-1.5 rounded-xl overflow-hidden max-w-xs border border-gray-200">
        <img src={url} alt={label} className="max-h-48 w-auto object-cover" />
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer"
       className="mt-1 flex items-center gap-2 px-2 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors max-w-xs">
      <div className="w-6 h-6 rounded bg-primary-100 flex items-center justify-center shrink-0">
        <FileText size={14} className="text-primary-600" />
      </div>
      <div className="min-w-0">
        <p className="text-[12.5px] font-medium text-gray-700 truncate">{label}</p>
        <p className="text-[11px] text-gray-400">File</p>
      </div>
      <Download size={13} className="text-gray-400 ml-auto shrink-0" />
    </a>
  );
}

export function OrgReactionRow({
  reactions, currentUserId, onReact,
}: {
  reactions: OrgChatReaction[];
  currentUserId: number;
  onReact: (emoji: string) => void;
}) {
  const grouped: Record<string, { count: number; mine: boolean }> = {};
  for (const r of reactions) {
    if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, mine: false };
    grouped[r.emoji].count++;
    if (r.user.id === currentUserId) grouped[r.emoji].mine = true;
  }
  const entries = Object.entries(grouped);
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {entries.map(([emoji, { count, mine }]) => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[12px] border transition-colors ${
            mine ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
          }`}
        >
          {EMOJI_MAP[emoji] ?? emoji} <span className="text-[11px]">{count}</span>
        </button>
      ))}
    </div>
  );
}

export function EmojiPickerPopup({ anchorRef, onPick, onClose }: {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    window.addEventListener('scroll', onClose, true);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [anchorRef, onClose]);

  return createPortal(
    <div ref={ref} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
         className="bg-white rounded-xl shadow-xl border border-gray-200 p-2 flex gap-1">
      {EMOJI_KEYS.map(k => (
        <button key={k} onClick={() => { onPick(k); onClose(); }}
                className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 rounded-lg transition-colors">
          {EMOJI_MAP[k]}
        </button>
      ))}
    </div>,
    document.body,
  );
}

export interface ContextMenuAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

export function OrgMessageContextMenu({ x, y, actions, onClose }: {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onClose: () => void;
}) {
  const top  = Math.min(y, window.innerHeight - actions.length * 40 - 16);
  const left = Math.min(x, window.innerWidth - 176);

  useEffect(() => {
    window.addEventListener('scroll', onClose, true);
    return () => window.removeEventListener('scroll', onClose, true);
  }, [onClose]);

  return (
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: 9998 }}
        onMouseDown={onClose}
        onContextMenu={e => { e.preventDefault(); onClose(); }}
      />
      <div
        style={{ position: 'fixed', top, left, zIndex: 9999 }}
        className="bg-white rounded-xl shadow-2xl border border-gray-200 py-1 min-w-[160px] overflow-hidden"
      >
        {actions.map((a, i) => (
          <button
            key={i}
            onMouseDown={e => { e.stopPropagation(); }}
            onClick={() => { a.onClick(); onClose(); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] font-medium transition-colors text-left ${
              a.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="shrink-0 opacity-70">{a.icon}</span>
            {a.label}
          </button>
        ))}
      </div>
    </>
  );
}
