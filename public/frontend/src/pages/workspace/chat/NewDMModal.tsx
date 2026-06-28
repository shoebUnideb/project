import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { workspacesApi } from '../../../api/workspaces';
import Avatar from '../../../components/ui/Avatar';
import type { User } from '../../../types';
import { senderName } from './chatUtils';

export function NewDMModal({ workspace, currentUser, onSelect, onClose }: {
  workspace: { id: number; slug: string; mentor_user_id: number; mentor_name: string; mentor_picture?: string };
  currentUser: User;
  onSelect: (user: User) => void;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    workspacesApi.getMembers(workspace.id).then(data => {
      const studentUsers = data.approved
        .map(m => m.student.user)
        .filter(u => u.id !== currentUser.id);

      const mentorUser: User = {
        id: workspace.mentor_user_id,
        username: workspace.mentor_name,
        first_name: workspace.mentor_name,
        last_name: '',
        email: '',
        role: 'mentor',
        is_approved: true,
        profile_picture: workspace.mentor_picture ?? null,
        message_permission: 'open',
      };
      const ownerUsers = mentorUser.id !== currentUser.id ? [mentorUser] : [];
      setMembers([...ownerUsers, ...studentUsers]);
    }).finally(() => setLoading(false));
  }, [workspace.id, currentUser.id]);

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
