import { useRef, useState, useEffect, useCallback } from 'react';
import { workspacesApi } from '../../api/workspaces';
import type { MentionUser } from '../../types';

interface Props {
  value: string;
  onChange: (v: string) => void;
  workspaceId: number;
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
}

export default function MentionTextarea({ value, onChange, workspaceId, placeholder, rows = 3, className, disabled }: Props) {
  const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!q) { setSuggestions([]); setShowDropdown(false); return; }
      try {
        const res = await workspacesApi.getMentionAutocomplete(workspaceId, q);
        setSuggestions(res);
        setShowDropdown(res.length > 0);
        setActiveIndex(0);
      } catch {
        setSuggestions([]); setShowDropdown(false);
      }
    }, 200);
  }, [workspaceId]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    onChange(v);
    const cursor = e.target.selectionStart ?? v.length;
    const slice = v.slice(0, cursor);
    const match = slice.match(/@(\w*)$/);
    if (match) {
      setMentionStart(cursor - match[0].length);
      fetchSuggestions(match[1]);
    } else {
      setMentionStart(null);
      setShowDropdown(false);
    }
  }

  function pickSuggestion(user: MentionUser) {
    if (mentionStart === null) return;
    const before = value.slice(0, mentionStart);
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    const after = value.slice(cursor);
    const newValue = `${before}@${user.username} ${after}`;
    onChange(newValue);
    setShowDropdown(false);
    setMentionStart(null);
    setSuggestions([]);
    setTimeout(() => {
      const pos = before.length + user.username.length + 2;
      textareaRef.current?.setSelectionRange(pos, pos);
      textareaRef.current?.focus();
    }, 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickSuggestion(suggestions[activeIndex]); }
    else if (e.key === 'Escape') { setShowDropdown(false); }
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={className ?? 'w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400'}
      />
      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 mt-1 w-64 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto text-sm">
          {suggestions.map((u, i) => (
            <li
              key={u.id}
              onMouseDown={e => { e.preventDefault(); pickSuggestion(u); }}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${i === activeIndex ? 'bg-violet-50' : 'hover:bg-gray-50'}`}
            >
              {u.profile_picture_url
                ? <img src={u.profile_picture_url} className="w-6 h-6 rounded-full object-cover" alt="" />
                : <span className="w-6 h-6 rounded-full bg-violet-200 flex items-center justify-center text-xs font-bold text-violet-700">{u.display_name[0]?.toUpperCase()}</span>
              }
              <span className="font-medium">{u.display_name}</span>
              <span className="text-gray-400">@{u.username}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
