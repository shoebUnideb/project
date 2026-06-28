import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useApiList } from '../../hooks/useApi';
import { usersApi } from '../../api/users';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import CreateMentorModal from '../../components/ui/CreateMentorModal';
import type { Role } from '../../types';

const ROLE_FILTER: { label: string; value: Role | 'all' }[] = [
  { label: 'All',        value: 'all'        },
  { label: 'Students',   value: 'student'    },
  { label: 'Mentors',    value: 'mentor'     },
  { label: 'Admins',     value: 'superadmin' },
];

export default function UserManagementPage() {
  const [filter, setFilter] = useState<Role | 'all'>('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const { data: users, loading, refetch } = useApiList(usersApi.list);

  const filtered = users.filter(u => {
    const matchRole   = filter === 'all' || u.role === filter;
    const matchSearch = [u.username, u.email, u.first_name, u.last_name]
      .filter(Boolean)
      .some(s => s!.toLowerCase().includes(search.toLowerCase()));
    return matchRole && (search === '' || matchSearch);
  });

  const handleApprove = async (id: number) => {
    await usersApi.update(id, { is_approved: true });
    refetch();
  };

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle={`${filtered.length} users`}
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-[13px] font-semibold rounded-lg shadow-sm transition-colors"
          >
            <UserPlus size={15} />
            Create Mentor
          </button>
        }
      />
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {ROLE_FILTER.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={['px-3.5 py-1.5 text-[12px] font-medium transition-colors',
                filter === f.value ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50',
              ].join(' ')}>
              {f.label}
            </button>
          ))}
        </div>
        <input type="search" placeholder="Search users…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3.5 py-1.5 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-56" />
      </div>
      <Card padding="none">
        {loading ? <p className="text-center text-gray-400 py-10">Loading…</p> : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">User</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400 hidden sm:table-cell">Email</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Role</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400 hidden md:table-cell">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.id}
                  className={`${i < filtered.length - 1 ? 'border-b border-gray-50' : ''} hover:bg-gray-50 transition-colors`}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={`${u.first_name} ${u.last_name}`} size="sm" />
                      <div>
                        <p className="font-semibold text-gray-800">{u.first_name} {u.last_name}</p>
                        <p className="text-[11px] text-gray-400">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 hidden sm:table-cell">{u.email}</td>
                  <td className="px-5 py-3.5">
                    <span className={['text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full',
                      u.role === 'superadmin' ? 'bg-purple-100 text-purple-700' :
                      u.role === 'mentor' ? 'bg-primary-100 text-primary-700' : 'bg-green-100 text-green-700',
                    ].join(' ')}>{u.role}</span>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    {u.is_approved
                      ? <span className="text-[11px] font-medium text-green-600">Active</span>
                      : <span className="text-[11px] font-medium text-orange-500">Pending</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {!u.is_approved && u.role === 'mentor' && (
                      <button onClick={() => handleApprove(u.id)}
                        className="text-[12px] text-primary-600 hover:text-primary-800 font-medium">Approve</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && filtered.length === 0 && <p className="text-center text-gray-400 py-10">No users found.</p>}
      </Card>

      {showModal && (
        <CreateMentorModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); refetch(); }}
        />
      )}
    </div>
  );
}
