import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import Avatar from '../../../components/ui/Avatar';
import { relativeTime } from '../../../utils/time';
import type { OrgChatMessage, OrgDMMessage } from '../../api/orgApi';
import { senderName } from './OrgChatUtils';

export function OrgSearchModal({
  messages, dmMessages, isDM, onClose,
}: {
  messages: OrgChatMessage[];
  dmMessages: OrgDMMessage[];
  isDM: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const pool: (OrgChatMessage | OrgDMMessage)[] = isDM ? dmMessages : messages;

  const results = query.trim()
    ? pool.filter(m => (m.body ?? '').toLowerCase().includes(query.toLowerCase()))
    : [];

  function highlight(text: string) {
    if (!query.trim()) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <>{text}</>;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-200 text-gray-900 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
            placeholder={isDM ? 'Search in this conversation…' : 'Search in this channel…'}
            className="flex-1 text-[14px] text-gray-700 placeholder-gray-400 focus:outline-none"
          />
          {query.trim() && (
            <span className="text-[11.5px] text-gray-400 shrink-0">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg shrink-0 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {!query.trim() ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <Search size={18} className="text-gray-400" />
              </div>
              <p className="text-[13px] text-gray-500 font-medium">Search messages</p>
              <p className="text-[12px] text-gray-400 mt-1">
                {isDM ? 'Find messages in this conversation' : 'Find messages in this channel'}
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-[13px] text-gray-500 font-medium">No results for "{query}"</p>
              <p className="text-[12px] text-gray-400 mt-1">Try a different keyword</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {results.map(m => {
                const name = senderName(m.sender);
                const body = m.body ?? '';
                return (
                  <button
                    key={m.id}
                    onClick={onClose}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors"
                  >
                    <Avatar
                      src={m.sender.profile_picture ?? undefined}
                      name={name}
                      size="sm"
                      className="shrink-0 mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[12.5px] font-semibold text-gray-800">{name}</span>
                        <span className="text-[11px] text-gray-400">{relativeTime(m.created_at)}</span>
                      </div>
                      <p className="text-[12.5px] text-gray-600 leading-relaxed line-clamp-2">
                        {highlight(body)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
