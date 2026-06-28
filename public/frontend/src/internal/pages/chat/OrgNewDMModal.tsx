import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { orgApi } from '../../api/orgApi';
import Avatar from '../../../components/ui/Avatar';
import { senderName } from './OrgChatUtils';
import { useAuth } from '../../../context/AuthContext';

interface OrgUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  display_name?: string;
  profile_picture?: string | null;
}

export function OrgNewDMModal({ currentUserId, onSelect, onClose }: {
  currentUserId: number;
  onSelect: (user: OrgUser) => void;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<OrgUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    orgApi.getMembers().then(data => {
      const users: OrgUser[] = data
        .filter((m: any) => m.user?.id !== currentUserId)
        .map((m: any) => ({
          id: m.user.id,
          username: m.user.username,
          first_name: m.user.first_name,
          last_name: m.user.last_name,
          display_name: m.user.display_name,
          profile_picture: m.user.profile_picture,
        }));
      setMembers(users);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [currentUserId]);

  const filtered = members.filter(u =>
    senderName(u).toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"><X size={16} /></button>
        <h3 className="text-[15px] font-bold text-gray-800 mb-3">New Direct Message</h3>
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 mb-3 focus-within:ring-2 focus-within:ring-primary-500">
          <Search size={13} className="text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members…"
                 className="flex-1 text-[13px] focus:outline-none" />
        </div>
        {loading ? (
          <p className="text-[12.5px] text-gray-400 py-4 text-center">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-[12.5px] text-gray-400 py-4 text-center">No members found</p>
        ) : (
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {filtered.map(u => (
              <button key={u.id} onClick={() => { onSelect(u); onClose(); }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                <Avatar src={u.profile_picture ?? undefined} name={senderName(u)} size="sm" />
                <div className="text-left">
                  <p className="text-[13px] font-medium text-gray-800">{senderName(u)}</p>
                  <p className="text-[11px] text-gray-400">@{u.username}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
