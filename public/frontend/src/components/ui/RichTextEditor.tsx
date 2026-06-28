import { useRef, useEffect } from 'react';
import { Bold, Italic, List, ListOrdered, Link2 } from 'lucide-react';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
}

export default function RichTextEditor({ value, onChange, placeholder = 'Write something…', minHeight = 120, className = '' }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);

  useEffect(() => {
    if (!editorRef.current) return;
    if (isInternalUpdate.current) { isInternalUpdate.current = false; return; }
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const exec = (cmd: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, arg);
    handleChange();
  };

  const handleChange = () => {
    if (!editorRef.current) return;
    isInternalUpdate.current = true;
    onChange(editorRef.current.innerHTML);
  };

  const isEmpty = !value || value === '<br>' || value === '<div><br></div>';

  const btnCls = 'p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors';

  return (
    <div className={`border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50">
        <button type="button" onClick={() => exec('bold')} className={btnCls} title="Bold">
          <Bold size={13} />
        </button>
        <button type="button" onClick={() => exec('italic')} className={btnCls} title="Italic">
          <Italic size={13} />
        </button>
        <div className="w-px h-4 bg-gray-200 mx-1" />
        <button type="button" onClick={() => exec('insertUnorderedList')} className={btnCls} title="Bullet list">
          <List size={13} />
        </button>
        <button type="button" onClick={() => exec('insertOrderedList')} className={btnCls} title="Numbered list">
          <ListOrdered size={13} />
        </button>
        <div className="w-px h-4 bg-gray-200 mx-1" />
        <button
          type="button"
          onClick={() => {
            const url = prompt('Enter URL:');
            if (url) exec('createLink', url);
          }}
          className={btnCls}
          title="Insert link"
        >
          <Link2 size={13} />
        </button>
      </div>

      {/* Editable area */}
      <div className="relative">
        {isEmpty && (
          <span className="absolute top-3 left-3.5 text-[13px] text-gray-300 pointer-events-none select-none">
            {placeholder}
          </span>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleChange}
          onBlur={handleChange}
          className="px-3.5 py-3 text-[13.5px] text-gray-800 leading-relaxed outline-none prose prose-sm max-w-none"
          style={{ minHeight }}
        />
      </div>
    </div>
  );
}
