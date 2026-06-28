import { Search, X } from 'lucide-react';
import Avatar from '../../../components/ui/Avatar';

export type SimpleUser = {
  id: number; username: string;
  first_name: string; last_name: string;
  role: string; profile_picture?: string | null;
};

interface NewMessageModalProps {
  query: string;
  onQueryChange: (q: string) => void;
  results: SimpleUser[];
  loading: boolean;
  onSelect: (u: SimpleUser) => void;
  onClose: () => void;
}

export function NewMessageModal({ query, onQueryChange, results, loading, onSelect, onClose }: NewMessageModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/30 backdrop-blur-sm">
      <div className="w-[440px] bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="text-[14px] font-bold text-gray-900">New message</p>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={15} />
          </button>
        </div>
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => onQueryChange(e.target.value)}
              placeholder="Search by name or username..."
              className="w-full pl-8 pr-3 py-2 text-[13px] border border-[#e0e0e0] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {loading ? (
            <p className="text-[12.5px] text-gray-400 text-center py-6">Searching…</p>
          ) : results.length === 0 && query ? (
            <p className="text-[12.5px] text-gray-400 text-center py-6">No users found.</p>
          ) : results.length === 0 ? (
            <p className="text-[12.5px] text-gray-400 text-center py-6">Start typing to search for a user.</p>
          ) : results.map(u => {
            const name = `${u.first_name} ${u.last_name}`.trim() || u.username;
            return (
              <button key={u.id} onClick={() => onSelect(u)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                <Avatar name={name} src={u.profile_picture ?? undefined} size="md" />
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[13px] font-semibold text-gray-900 truncate">{name}</p>
                  <p className="text-[11.5px] text-gray-400 capitalize">{u.role === 'superadmin' ? 'Admin' : u.role}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
