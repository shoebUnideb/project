import {
  useState, useRef, useEffect, useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Bold, Italic, List, ListOrdered, Link2, Paperclip, Smile,
  Image, Gift, FileText, Send, X, Reply, AlertCircle,
} from 'lucide-react';
import type { WorkspaceChatMessage } from '../../types';

// ── Emoji data ───────────────────────────────────────────────────────────

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: 'Smileys',
    emojis: [
      '😀','😂','😍','😎','🥹','😭','🤔','😅','😊','🙂',
      '😏','😜','🤩','🥳','😢','😤','🤯','🙌','🙏','👍',
      '👎','❤️','🔥','🎉','👏','✅','💯','🚀','💡','⭐',
    ],
  },
  {
    label: 'Objects',
    emojis: [
      '📎','📄','📚','📖','🗓','⏰','💼','🎯','🎓','📝',
      '💻','📊','📈','📌','🔑','💬','📧','🎁','🏆','💪',
    ],
  },
];

function senderName(u: { first_name?: string; last_name?: string; username: string }) {
  return `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.username;
}

// ── EmojiPicker ──────────────────────────────────────────────────────────

function EmojiPicker({
  anchorEl,
  onPick,
  onClose,
}: {
  anchorEl: HTMLElement | null;
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [activeGroup, setActiveGroup] = useState(0);

  useEffect(() => {
    if (anchorEl) {
      const r = anchorEl.getBoundingClientRect();
      const top = r.top - 8;
      const left = r.left;
      setPos({ top: Math.max(8, top - 230), left: Math.min(left, window.innerWidth - 240) });
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
  }, [anchorEl, onClose]);

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
      className="bg-white rounded-xl shadow-2xl border border-gray-200 w-[232px] overflow-hidden"
    >
      {/* Group tabs */}
      <div className="flex border-b border-gray-100 px-2 pt-1.5">
        {EMOJI_GROUPS.map((g, i) => (
          <button
            key={g.label}
            onClick={() => setActiveGroup(i)}
            className={`px-2 pb-1.5 text-[11px] font-medium border-b-2 transition-colors -mb-px mr-1 ${
              activeGroup === i ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>
      {/* Grid */}
      <div className="grid grid-cols-8 gap-0.5 p-2">
        {EMOJI_GROUPS[activeGroup].emojis.map(em => (
          <button
            key={em}
            onClick={() => { onPick(em); onClose(); }}
            className="w-7 h-7 flex items-center justify-center text-[17px] hover:bg-gray-100 rounded-lg transition-colors"
          >
            {em}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}

// ── LinkPopup ────────────────────────────────────────────────────────────

function LinkPopup({
  onConfirm,
  onCancel,
}: {
  onConfirm: (url: string) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState('https://');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 0); }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
      <Link2 size={13} className="text-gray-400 shrink-0" />
      <input
        ref={inputRef}
        value={url}
        onChange={e => setUrl(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); onConfirm(url); }
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="https://example.com"
        className="flex-1 text-[12.5px] bg-transparent focus:outline-none text-gray-700"
      />
      <button
        onClick={() => onConfirm(url)}
        className="px-2.5 py-1 text-[11.5px] bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium"
      >
        Add
      </button>
      <button
        onClick={onCancel}
        className="text-gray-400 hover:text-gray-600"
      >
        <X size={13} />
      </button>
    </div>
  );
}

// ── ToolbarButton ────────────────────────────────────────────────────────

function ToolbarBtn({
  active, title, onClick, children,
}: {
  active?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors text-[13px] font-semibold ${
        active
          ? 'bg-primary-100 text-primary-700'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

// ── RichTextEditor ────────────────────────────────────────────────────────

export interface RichTextEditorProps {
  onSend: (html: string, messageType: 'message' | 'announcement', file?: File | null) => void;
  disabled?: boolean;
  showAnnouncementTab?: boolean;
  replyTo?: WorkspaceChatMessage | null;
  onCancelReply?: () => void;
  sendError?: string;
  onClearError?: () => void;
  onTyping?: () => void;
}

export default function RichTextEditor({
  onSend,
  disabled = false,
  showAnnouncementTab = false,
  replyTo,
  onCancelReply,
  sendError,
  onClearError,
  onTyping,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const emojiAnchorRef = useRef<HTMLButtonElement>(null);

  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachPreview, setAttachPreview] = useState<string | null>(null);
  const [messageTab, setMessageTab] = useState<'message' | 'announcement'>('message');
  const [isEmpty, setIsEmpty] = useState(true);

  // Formatting state
  const [fmtBold, setFmtBold] = useState(false);
  const [fmtItalic, setFmtItalic] = useState(false);
  const [fmtUl, setFmtUl] = useState(false);
  const [fmtOl, setFmtOl] = useState(false);

  // Popups
  const [showEmoji, setShowEmoji] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const savedRange = useRef<Range | null>(null);

  // ── helpers ──────────────────────────────────────────────

  const focusEditor = useCallback(() => {
    editorRef.current?.focus();
  }, []);

  const updateFormats = useCallback(() => {
    setFmtBold(document.queryCommandState('bold'));
    setFmtItalic(document.queryCommandState('italic'));
    setFmtUl(document.queryCommandState('insertUnorderedList'));
    setFmtOl(document.queryCommandState('insertOrderedList'));
  }, []);

  const updateEmpty = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const text = el.innerText.trim();
    setIsEmpty(text === '' && !el.querySelector('img'));
  }, []);

  // ── format commands ───────────────────────────────────────

  const exec = useCallback((cmd: string, value?: string) => {
    focusEditor();
    document.execCommand(cmd, false, value);
    updateFormats();
    updateEmpty();
  }, [focusEditor, updateFormats, updateEmpty]);

  const openLink = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
    setShowLink(true);
  }, []);

  const confirmLink = useCallback((url: string) => {
    setShowLink(false);
    if (!url || url === 'https://') return;
    focusEditor();
    const sel = window.getSelection();
    if (savedRange.current) {
      sel?.removeAllRanges();
      sel?.addRange(savedRange.current);
    }
    document.execCommand('createLink', false, url);
    // Make links open in new tab
    editorRef.current?.querySelectorAll('a').forEach(a => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
    updateEmpty();
  }, [focusEditor, updateEmpty]);

  // ── emoji insert ──────────────────────────────────────────

  const insertEmoji = useCallback((emoji: string) => {
    focusEditor();
    document.execCommand('insertText', false, emoji);
    updateEmpty();
  }, [focusEditor, updateEmpty]);

  // ── file attach ───────────────────────────────────────────

  const handleFile = useCallback((file: File | null) => {
    if (!file) return;
    setAttachFile(file);
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setAttachPreview(url);
    } else {
      setAttachPreview(null);
    }
  }, []);

  const removeFile = useCallback(() => {
    if (attachPreview) URL.revokeObjectURL(attachPreview);
    setAttachFile(null);
    setAttachPreview(null);
  }, [attachPreview]);

  // ── send ──────────────────────────────────────────────────

  const handleSend = useCallback(() => {
    if (disabled) return;
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML.trim();
    const hasContent = el.innerText.trim() || attachFile;
    if (!hasContent) return;

    onSend(html, messageTab, attachFile);

    // Reset editor
    el.innerHTML = '';
    removeFile();
    setIsEmpty(true);
    setMessageTab('message');
  }, [disabled, attachFile, messageTab, onSend, removeFile]);

  // ── keyboard ──────────────────────────────────────────────

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Send on Enter (no shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      // Allow Enter inside lists
      if (!fmtUl && !fmtOl) {
        e.preventDefault();
        handleSend();
        return;
      }
    }
    // Ctrl/Cmd shortcuts
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') { e.preventDefault(); exec('bold'); }
      if (e.key === 'i') { e.preventDefault(); exec('italic'); }
      if (e.key === 'k') { e.preventDefault(); openLink(); }
    }
    // Typing indicator
    onTyping?.();
  }, [fmtUl, fmtOl, handleSend, exec, openLink, onTyping]);

  // ── selection change ──────────────────────────────────────

  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection();
      if (sel && editorRef.current?.contains(sel.anchorNode)) {
        updateFormats();
      }
    };
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, [updateFormats]);

  // ── paste: strip formatting ───────────────────────────────

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    updateEmpty();
  }, [updateEmpty]);

  // ── render ────────────────────────────────────────────────

  return (
    <div className="shrink-0 bg-white border-t border-gray-100 px-3 py-2.5">
      {/* Send error */}
      {sendError && (
        <div className="flex items-center gap-1.5 text-[12px] text-red-500 mb-1.5">
          <AlertCircle size={12} /> {sendError}
          <button onClick={onClearError} className="ml-auto"><X size={11} /></button>
        </div>
      )}

      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 mb-1.5 px-2.5 py-1 bg-primary-50 border border-primary-100 rounded-lg">
          <Reply size={12} className="text-primary-500 shrink-0" />
          <span className="text-[11.5px] text-primary-700 font-medium">{senderName(replyTo.sender)}:</span>
          <span className="text-[11.5px] text-gray-500 truncate flex-1">{replyTo.body.replace(/<[^>]+>/g, '')}</span>
          <button onClick={onCancelReply} className="text-gray-400 hover:text-gray-600 shrink-0"><X size={12} /></button>
        </div>
      )}

      {/* Main editor box */}
      <div className="border border-gray-200 rounded-xl focus-within:border-gray-300 focus-within:ring-1 focus-within:ring-gray-200 transition-all overflow-hidden">

        {/* Announcement / Message tabs */}
        {showAnnouncementTab && (
          <div className="flex gap-0 px-3 pt-2 border-b border-gray-100">
            {(['message', 'announcement'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setMessageTab(t)}
                className={`px-2 pb-1.5 text-[11.5px] font-medium capitalize border-b-2 transition-colors -mb-px ${
                  messageTab === t ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Formatting toolbar */}
        <div className="flex items-center gap-0.5 px-2 pt-2 pb-1.5 border-b border-gray-100">
          <ToolbarBtn active={fmtBold} title="Bold (Ctrl+B)" onClick={() => exec('bold')}>
            <Bold size={13} />
          </ToolbarBtn>
          <ToolbarBtn active={fmtItalic} title="Italic (Ctrl+I)" onClick={() => exec('italic')}>
            <Italic size={13} />
          </ToolbarBtn>

          <div className="w-px h-4 bg-gray-200 mx-1" />

          <ToolbarBtn active={fmtUl} title="Bullet list" onClick={() => exec('insertUnorderedList')}>
            <List size={13} />
          </ToolbarBtn>
          <ToolbarBtn active={fmtOl} title="Ordered list" onClick={() => exec('insertOrderedList')}>
            <ListOrdered size={13} />
          </ToolbarBtn>

          <div className="w-px h-4 bg-gray-200 mx-1" />

          <ToolbarBtn active={showLink} title="Add link (Ctrl+K)" onClick={openLink}>
            <Link2 size={13} />
          </ToolbarBtn>
        </div>

        {/* Link popup */}
        {showLink && (
          <LinkPopup
            onConfirm={confirmLink}
            onCancel={() => { setShowLink(false); focusEditor(); }}
          />
        )}

        {/* ContentEditable surface */}
        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={updateEmpty}
          onKeyDown={handleKeyDown}
          onMouseUp={updateFormats}
          onPaste={handlePaste}
          data-placeholder="Type a message…"
          className={`
            min-h-[34px] max-h-[96px] overflow-y-auto
            px-3 pt-2 pb-1
            text-[13px] text-gray-700 leading-relaxed
            focus:outline-none
            empty-placeholder
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        />

        {/* File/image preview */}
        {attachFile && (
          <div className="flex items-center gap-2 mx-3 mb-2 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
            {attachPreview ? (
              <img src={attachPreview} alt="preview" className="w-10 h-10 rounded-lg object-cover shrink-0 border border-gray-200" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                <FileText size={14} className="text-primary-600" />
              </div>
            )}
            <span className="text-[12px] text-gray-600 truncate flex-1">{attachFile.name}</span>
            <button onClick={removeFile} className="text-gray-400 hover:text-gray-600 shrink-0"><X size={12} /></button>
          </div>
        )}

        {/* Bottom action bar */}
        <div className="flex items-center justify-between px-2 pb-2 pt-1">
          <div className="flex items-center gap-0.5">
            {/* Attachment */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach file"
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
            >
              <Paperclip size={14} />
            </button>
            <input ref={fileInputRef} type="file" className="hidden"
                   onChange={e => { handleFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />

            {/* Emoji */}
            <button
              ref={emojiAnchorRef}
              type="button"
              onClick={() => setShowEmoji(v => !v)}
              title="Emoji"
              className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${showEmoji ? 'bg-primary-50 text-primary-600' : 'hover:bg-gray-100 text-gray-400'}`}
            >
              <Smile size={14} />
            </button>

            {/* Image */}
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              title="Image"
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
            >
              <Image size={14} />
            </button>
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
                   onChange={e => { handleFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />

            {/* GIF — coming soon */}
            <button
              type="button"
              title="GIF (coming soon)"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 cursor-not-allowed"
              disabled
            >
              <Gift size={14} />
            </button>

            {/* Document */}
            <button
              type="button"
              onClick={() => docInputRef.current?.click()}
              title="Attach document"
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
            >
              <FileText size={14} />
            </button>
            <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv"
                   className="hidden"
                   onChange={e => { handleFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400 hidden sm:block">
              Press Enter to send
            </span>
            <button
              type="button"
              onClick={handleSend}
              disabled={disabled || (isEmpty && !attachFile)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white text-[12px] font-semibold rounded-lg transition-colors"
            >
              <Send size={12} /> Send
            </button>
          </div>
        </div>
      </div>

      {/* Emoji picker portal */}
      {showEmoji && (
        <EmojiPicker
          anchorEl={emojiAnchorRef.current}
          onPick={insertEmoji}
          onClose={() => setShowEmoji(false)}
        />
      )}
    </div>
  );
}
