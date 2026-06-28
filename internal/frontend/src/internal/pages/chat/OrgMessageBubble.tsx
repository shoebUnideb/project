import { useState, useEffect, useRef } from 'react';
import {
  Reply, Pin, MoreHorizontal, Star, Trash, Edit2, Forward, Copy,
} from 'lucide-react';
import Avatar from '../../../components/ui/Avatar';
import { relativeTime } from '../../../utils/time';
import { sanitizeHtml } from '../../../utils/sanitize';
import type { OrgChatMessage, OrgDMMessage } from '../../api/orgApi';
import { FileAttachmentCard, OrgReactionRow, EmojiPickerPopup, OrgMessageContextMenu } from './OrgChatPrimitives';
import { senderName } from './OrgChatUtils';

export function OrgMessageBubble({
  msg, currentUserId, isAdmin, isStarred, onReact, onPin, onDelete, onReply, onEdit, onForward, onStar,
}: {
  msg: OrgChatMessage;
  currentUserId: number;
  isAdmin: boolean;
  isStarred: boolean;
  onReact: (emoji: string) => void;
  onPin: () => void;
  onDelete: () => void;
  onReply: () => void;
  onEdit: (newBody: string) => void;
  onForward: () => void;
  onStar: () => void;
}) {
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLButtonElement | null>(null);
  const emojiRef = useRef<HTMLButtonElement | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(msg.body);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const isMe = msg.sender.id === currentUserId;
  const name = senderName(msg.sender);
  const isAnnouncement = msg.message_type === 'announcement';

  useEffect(() => {
    if (editing) {
      setEditBody(msg.body);
      setTimeout(() => editRef.current?.focus(), 0);
    }
  }, [editing, msg.body]);

  const commitEdit = () => {
    const trimmed = editBody.trim();
    if (trimmed && trimmed !== msg.body) onEdit(trimmed);
    setEditing(false);
  };

  const contextActions = [
    { label: 'Copy text', icon: <Copy size={13} />, onClick: () => navigator.clipboard.writeText(msg.body) },
    { label: isStarred ? 'Unstar' : 'Star', icon: <Star size={13} className={isStarred ? 'text-yellow-500' : ''} />, onClick: onStar },
    { label: 'Forward', icon: <Forward size={13} />, onClick: onForward },
    ...(isMe ? [
      { label: 'Edit',   icon: <Edit2 size={13} />, onClick: () => setEditing(true) },
      { label: 'Unsend', icon: <Trash size={13} />, onClick: onDelete, danger: true as const },
    ] : []),
    ...(!isMe && isAdmin ? [
      { label: 'Delete', icon: <Trash size={13} />, onClick: onDelete, danger: true as const },
    ] : []),
  ];

  const openCtx = (e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <div
      onContextMenu={openCtx}
      className={`group flex items-start gap-1.5 px-1.5 py-0.5 rounded-xl hover:bg-gray-50/70 transition-colors relative ${
        isAnnouncement ? 'bg-amber-50/50 border border-amber-100 rounded-xl px-2 py-1' : ''
      } ${msg.is_pinned ? 'border-l-2 border-primary-400 pl-2' : ''} ${isStarred ? 'bg-yellow-50/40' : ''}`}
    >
      <Avatar src={msg.sender.profile_picture ?? undefined} name={name} size="xs" className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {msg.reply_to && (
          <div className="flex items-center gap-1 mb-0.5 px-1.5 py-0.5 bg-gray-100 rounded-lg border-l-2 border-primary-400">
            <Reply size={11} className="text-gray-400 shrink-0" />
            <span className="text-[11px] text-gray-500 font-medium">{msg.reply_to.sender_name}:</span>
            <span className="text-[11px] text-gray-400 truncate">{msg.reply_to.body}</span>
          </div>
        )}
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-[13px] font-semibold text-gray-800">{name}</span>
          {isAnnouncement && (
            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              Announcement
            </span>
          )}
          {msg.is_pinned && (
            <span className="text-[10px] text-primary-500 flex items-center gap-0.5">
              <Pin size={9} /> Pinned
            </span>
          )}
          {isStarred && <Star size={10} className="text-yellow-400 fill-yellow-400" />}
          <span className="text-[11px] text-gray-400 ml-auto">{relativeTime(msg.created_at)}</span>
        </div>
        {editing ? (
          <div className="mt-1">
            <textarea
              ref={editRef}
              value={editBody}
              onChange={e => setEditBody(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
                if (e.key === 'Escape') setEditing(false);
              }}
              rows={2}
              className="w-full px-2 py-1.5 text-[13px] border border-primary-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <div className="flex items-center gap-2 mt-1">
              <button onClick={commitEdit}
                      className="px-2.5 py-1 text-[11.5px] bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium">
                Save
              </button>
              <button onClick={() => setEditing(false)}
                      className="px-2.5 py-1 text-[11.5px] text-gray-500 border border-gray-200 rounded-md hover:bg-gray-50">
                Cancel
              </button>
              <span className="text-[10.5px] text-gray-400 ml-1">Enter to save · Esc to cancel</span>
            </div>
          </div>
        ) : (
          msg.body && (
            <div
              className="text-[13.5px] text-gray-700 leading-relaxed break-words rich-body"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.body) }}
            />
          )
        )}
        {msg.attachment_url && (
          <FileAttachmentCard url={msg.attachment_url} name={msg.attachment_name} />
        )}
        <OrgReactionRow reactions={msg.reactions} currentUserId={currentUserId} onReact={onReact} />
      </div>

      <div className="absolute right-2 top-1 hidden group-hover:flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg shadow-sm px-1 py-0.5">
        <button
          ref={emojiRef}
          onClick={() => setEmojiAnchor(emojiAnchor ? null : emojiRef.current)}
          className="w-6 h-6 flex items-center justify-center text-sm hover:bg-gray-100 rounded"
          title="React"
        >😊</button>
        <button onClick={onReply}
                className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded text-gray-500"
                title="Reply">
          <Reply size={12} />
        </button>
        {isAdmin && (
          <button onClick={onPin}
                  className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded text-gray-500"
                  title={msg.is_pinned ? 'Unpin' : 'Pin'}>
            <Pin size={12} />
          </button>
        )}
        <button
          onClick={e => { e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY }); }}
          className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded text-gray-500"
          title="More actions"
        >
          <MoreHorizontal size={12} />
        </button>
      </div>

      {emojiAnchor && (
        <EmojiPickerPopup anchorRef={emojiRef} onPick={onReact} onClose={() => setEmojiAnchor(null)} />
      )}
      {ctxMenu && (
        <OrgMessageContextMenu x={ctxMenu.x} y={ctxMenu.y} actions={contextActions} onClose={() => setCtxMenu(null)} />
      )}
    </div>
  );
}

export function OrgDMBubble({
  dm, currentUserId, isStarred, onEdit, onUnsend, onForward, onStar,
}: {
  dm: OrgDMMessage;
  currentUserId: number;
  isStarred: boolean;
  onEdit: (newBody: string) => void;
  onUnsend: () => void;
  onForward: () => void;
  onStar: () => void;
}) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(dm.body);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const isMe = dm.sender.id === currentUserId;
  const name = senderName(dm.sender);

  useEffect(() => {
    if (editing) {
      setEditBody(dm.body);
      setTimeout(() => editRef.current?.focus(), 0);
    }
  }, [editing, dm.body]);

  const commitEdit = () => {
    const trimmed = editBody.trim();
    if (trimmed && trimmed !== dm.body) onEdit(trimmed);
    setEditing(false);
  };

  const contextActions = [
    { label: 'Copy text', icon: <Copy size={13} />, onClick: () => navigator.clipboard.writeText(dm.body) },
    { label: isStarred ? 'Unstar' : 'Star', icon: <Star size={13} className={isStarred ? 'text-yellow-500' : ''} />, onClick: onStar },
    { label: 'Forward', icon: <Forward size={13} />, onClick: onForward },
    ...(isMe ? [
      { label: 'Edit',   icon: <Edit2 size={13} />, onClick: () => setEditing(true) },
      { label: 'Unsend', icon: <Trash size={13} />, onClick: onUnsend, danger: true as const },
    ] : []),
  ];

  const openCtx = (e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <div
      onContextMenu={openCtx}
      className={`group flex items-end gap-1.5 px-2 py-px ${isMe ? 'justify-end' : 'justify-start'} ${isStarred ? 'bg-yellow-50/30' : ''}`}
    >
      {!isMe && (
        <Avatar src={dm.sender.profile_picture ?? undefined} name={name} size="xs" className="shrink-0 mb-0.5" />
      )}

      <div className={`flex flex-col max-w-[42%] ${isMe ? 'items-end' : 'items-start'}`}>
        {editing ? (
          <div className="w-full">
            <textarea
              ref={editRef}
              value={editBody}
              onChange={e => setEditBody(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
                if (e.key === 'Escape') setEditing(false);
              }}
              rows={2}
              className="w-full px-2 py-1.5 text-[13px] border border-primary-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <div className="flex items-center gap-2 mt-1">
              <button onClick={commitEdit}
                      className="px-2.5 py-1 text-[11.5px] bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium">
                Save
              </button>
              <button onClick={() => setEditing(false)}
                      className="px-2.5 py-1 text-[11.5px] text-gray-500 border border-gray-200 rounded-md hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className={`px-2 py-1 rounded-xl ${isMe ? 'bg-[#1e2d3d] text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
            {dm.body && (
              <div
                className={`text-[13px] leading-snug break-words rich-body ${isMe ? 'rich-body-dark' : ''}`}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(dm.body) }}
              />
            )}
            {dm.attachment_url && <FileAttachmentCard url={dm.attachment_url} />}
            <div className={`flex items-center gap-1 mt-0.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
              <span className={`text-[9.5px] leading-none ${isMe ? 'text-white/40' : 'text-gray-400'}`}>
                {relativeTime(dm.created_at)}
              </span>
              {isStarred && <Star size={9} className="text-yellow-400 fill-yellow-400 ml-0.5" />}
            </div>
          </div>
        )}
      </div>

      <div className={`hidden group-hover:flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg shadow-sm px-1 py-0.5 shrink-0 mb-1 ${isMe ? 'order-first' : 'order-last'}`}>
        <button onClick={onStar}
                className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded"
                title={isStarred ? 'Unstar' : 'Star'}>
          <Star size={12} className={isStarred ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400'} />
        </button>
        <button
          onClick={e => { e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY }); }}
          className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded text-gray-500"
          title="More actions"
        >
          <MoreHorizontal size={12} />
        </button>
      </div>

      {ctxMenu && (
        <OrgMessageContextMenu x={ctxMenu.x} y={ctxMenu.y} actions={contextActions} onClose={() => setCtxMenu(null)} />
      )}
    </div>
  );
}
