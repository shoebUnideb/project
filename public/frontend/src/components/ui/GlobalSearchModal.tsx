import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Layers, Newspaper, X } from 'lucide-react';
import { searchApi, type SearchResults } from '../../api/search';

interface Props {
  onClose: () => void;
}


const EMPTY: SearchResults = { users: [], workspaces: [], posts: [] };

export default function GlobalSearchModal({ onClose }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(EMPTY); return; }
    setLoading(true);
    try { setResults(await searchApi.search(q)); }
    finally { setLoading(false); }
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(val), 300);
  };

  const go = (path: string) => { onClose(); navigate(path); };

  const hasResults = (results.users.length + results.workspaces.length + results.posts.length) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Input bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => handleChange(e.target.value)}
            placeholder="Search people, workspaces, posts…"
            className="flex-1 text-[14px] text-gray-800 placeholder-gray-400 outline-none bg-transparent"
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults(EMPTY); }} className="text-gray-300 hover:text-gray-500">
              <X size={15} />
            </button>
          )}
          <kbd className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded font-mono">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-50">
          {loading && (
            <p className="text-[12px] text-gray-400 text-center py-8">Searching…</p>
          )}

          {!loading && query.length >= 2 && !hasResults && (
            <p className="text-[13px] text-gray-400 text-center py-8">No results for "{query}"</p>
          )}

          {!loading && query.length < 2 && (
            <p className="text-[12px] text-gray-400 text-center py-8">Type at least 2 characters to search</p>
          )}

          {results.users.length > 0 && (
            <section className="py-2">
              <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                <Users size={10} /> People
              </p>
              {results.users.map(u => (
                <button key={u.id} onClick={() => go('/marketplace')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                  <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-[11px] font-bold flex items-center justify-center uppercase shrink-0">
                    {(u.first_name || u.username)[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-800 truncate">
                      {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username}
                    </p>
                    <p className="text-[11px] text-gray-400 capitalize">{u.role}</p>
                  </div>
                </button>
              ))}
            </section>
          )}

          {results.workspaces.length > 0 && (
            <section className="py-2">
              <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                <Layers size={10} /> Workspaces
              </p>
              {results.workspaces.map(w => (
                <button key={w.id} onClick={() => go(`/workspaces/${w.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                  <Layers size={14} className="text-primary-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-800 truncate">{w.name}</p>
                    {w.description && <p className="text-[11px] text-gray-400 truncate">{w.description}</p>}
                  </div>
                </button>
              ))}
            </section>
          )}

          {results.posts.length > 0 && (
            <section className="py-2">
              <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                <Newspaper size={10} /> Posts
              </p>
              {results.posts.map(p => (
                <button key={p.id} onClick={() => go('/feed')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                  <Newspaper size={14} className="text-gray-300 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-800 truncate">{p.title}</p>
                    {p.body && <p className="text-[11px] text-gray-400 truncate">{p.body}</p>}
                  </div>
                </button>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
