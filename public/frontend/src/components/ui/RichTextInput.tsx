import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { forwardRef, useImperativeHandle } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Link as LinkIcon, Paperclip, Smile,
  ImageIcon, Gift, FileText, Send,
} from 'lucide-react';

export interface RichTextInputHandle {
  insertText: (text: string) => void;
}

interface Props {
  onSend: (html: string, text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  attachment: File | null;
  setAttachment: (f: File | null) => void;
  sending: boolean;
  showEmoji: boolean;
  setShowEmoji: (v: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  imageInputRef: React.RefObject<HTMLInputElement>;
  docInputRef: React.RefObject<HTMLInputElement>;
}

function ToolBtn({
  active, onClick, title, children,
}: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className={`p-1 rounded transition-colors text-[13px] font-medium select-none ${
        active ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
      }`}
    >
      {children}
    </button>
  );
}

export default forwardRef<RichTextInputHandle, Props>(({
  onSend, disabled, placeholder, attachment, setAttachment,
  sending, showEmoji, setShowEmoji, fileInputRef, imageInputRef, docInputRef,
}, ref) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: placeholder ?? 'Type a message...' }),
    ],
    editorProps: {
      attributes: {
        class: 'min-h-[40px] max-h-[140px] overflow-y-auto outline-none text-[14px] text-gray-700 leading-snug px-1',
      },
      handleKeyDown(_, event) {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          handleSend();
          return true;
        }
        return false;
      },
    },
  });

  useImperativeHandle(ref, () => ({
    insertText: (text: string) => {
      editor?.chain().focus().insertContent(text).run();
    },
  }), [editor]);

  const handleSend = () => {
    if (!editor) return;
    const html = editor.getHTML();
    const text = editor.getText();
    if (!text.trim() && !attachment) return;
    onSend(html, text);
    editor.commands.clearContent();
  };

  const setLink = () => {
    const url = window.prompt('URL');
    if (!url) return;
    editor?.chain().focus().setLink({ href: url }).run();
  };

  const isEmpty = !editor?.getText().trim() && !attachment;

  if (!editor) return null;

  return (
    <div className={`border-t border-gray-100 bg-white ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 pt-2 pb-1 border-b border-gray-100">
        <ToolBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
          <Bold size={13} />
        </ToolBtn>
        <ToolBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
          <Italic size={13} />
        </ToolBtn>
        <ToolBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
          <UnderlineIcon size={13} />
        </ToolBtn>
        <ToolBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
          <Strikethrough size={13} />
        </ToolBtn>
        <div className="w-px h-4 bg-gray-200 mx-1" />
        <ToolBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
          <List size={13} />
        </ToolBtn>
        <ToolBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">
          <ListOrdered size={13} />
        </ToolBtn>
        <div className="w-px h-4 bg-gray-200 mx-1" />
        <ToolBtn active={editor.isActive('link')} onClick={setLink} title="Add link">
          <LinkIcon size={13} />
        </ToolBtn>
      </div>

      {/* Attachment preview */}
      {attachment && (
        <div className="flex items-center gap-2 px-4 pt-2 pb-0">
          <div className="flex items-center gap-2 px-3 py-1 bg-primary-50 border border-primary-200 rounded-lg text-primary-700 text-[12px] font-medium">
            <Paperclip size={11} />
            <span className="truncate max-w-[200px]">{attachment.name}</span>
            <button onClick={() => setAttachment(null)} className="ml-1 hover:text-red-500 transition-colors">✕</button>
          </div>
        </div>
      )}

      {/* Editor area */}
      <div className="px-4 pt-2 pb-1 cursor-text" onClick={() => editor.commands.focus()}>
        <EditorContent editor={editor} />
      </div>

      {/* Bottom toolbar */}
      <div className="flex items-center gap-1 px-4 pb-2 pt-1">
        <input ref={fileInputRef}  type="file" className="hidden" onChange={e => setAttachment(e.target.files?.[0] ?? null)} />
        <input ref={imageInputRef} type="file" className="hidden" accept="image/*" onChange={e => setAttachment(e.target.files?.[0] ?? null)} />
        <input ref={docInputRef}   type="file" className="hidden" accept=".pdf,.doc,.docx,.txt,.xlsx,.pptx" onChange={e => setAttachment(e.target.files?.[0] ?? null)} />

        <button onClick={() => fileInputRef.current?.click()} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors" title="Attach file"><Paperclip size={15} /></button>
        <button onClick={() => setShowEmoji(!showEmoji)} className={`p-1.5 rounded-lg transition-colors ${showEmoji ? 'bg-primary-50 text-primary-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`} title="Emoji"><Smile size={15} /></button>
        <button onClick={() => imageInputRef.current?.click()} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors" title="Send image"><ImageIcon size={15} /></button>
        <button disabled className="p-1.5 text-gray-300 rounded-lg cursor-not-allowed" title="GIFs coming soon"><Gift size={15} /></button>
        <button onClick={() => docInputRef.current?.click()} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors" title="Send document"><FileText size={15} /></button>

        <span className="text-[11px] text-gray-300 ml-auto mr-3 shrink-0">Press Enter to send</span>
        <button
          onClick={handleSend}
          disabled={sending || isEmpty}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white text-[12.5px] font-semibold rounded-xl transition-colors"
        >
          <Send size={13} /> Send
        </button>
      </div>
    </div>
  );
});
