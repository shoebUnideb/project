import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiList } from '../../hooks/useApi';
import { profilesApi } from '../../api/profiles';
import Avatar from '../../components/ui/Avatar';
import { Users, Search, ChevronRight, MapPin, GraduationCap } from 'lucide-react';

export default function MentorStudentsPage() {
  const [search, setSearch] = useState('');
  const { data: students } = useApiList(profilesApi.getMentorStudents);

  const filtered = students.filter(s => {
    if (!search) return true;
    const name = `${s.user.first_name} ${s.user.last_name} ${s.user.username}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">My Students</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            {students.length} student{students.length !== 1 ? 's' : ''} assigned to you
          </p>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search students…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-7 pr-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-52"
          />
        </div>
      </div>

      {students.length === 0 ? (
        <div className="bg-white border border-[#e0e0e0] rounded-xl px-6 py-16 text-center">
          <Users size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-gray-600">No students assigned yet</p>
          <p className="text-[12.5px] text-gray-400 mt-1">Contact the administrator to get students assigned to you.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-[#e0e0e0] rounded-xl px-6 py-12 text-center">
          <p className="text-[13px] text-gray-500">No students match "<strong>{search}</strong>"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(sp => (
            <Link
              key={sp.id}
              to={`/mentor/students/${sp.id}`}
              className="bg-white border border-[#e0e0e0] rounded-xl p-5 hover:shadow-md hover:border-primary-200 transition-all group"
            >
              <div className="flex items-start gap-4">
                <Avatar
                  src={sp.profile_picture ?? undefined}
                  name={`${sp.user.first_name} ${sp.user.last_name}`}
                  size="lg"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-gray-900 truncate">
                    {sp.user.first_name} {sp.user.last_name}
                  </p>
                  <p className="text-[12px] text-gray-400 truncate">@{sp.user.username}</p>

                  {sp.career_stage && (
                    <div className="flex items-center gap-1 mt-2">
                      <GraduationCap size={11} className="text-gray-400 shrink-0" />
                      <span className="text-[11.5px] text-gray-500 truncate">{sp.career_stage.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</span>
                    </div>
                  )}
                  {sp.city && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin size={11} className="text-gray-400 shrink-0" />
                      <span className="text-[11.5px] text-gray-500 truncate">{sp.city}</span>
                    </div>
                  )}
                </div>
                <ChevronRight size={15} className="text-gray-300 group-hover:text-primary-500 transition-colors shrink-0 mt-1" />
              </div>

              {sp.bio && (
                <p className="mt-3 text-[12px] text-gray-500 line-clamp-2 leading-relaxed border-t border-gray-50 pt-3">
                  {sp.bio}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
