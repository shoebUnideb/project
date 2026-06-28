import {
  Users, ClipboardList, AlertCircle, UserCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApiList } from '../../hooks/useApi';
import { usersApi } from '../../api/users';
import { assignmentsApi } from '../../api/assignments';
import MetricCard from '../../components/ui/MetricCard';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';

export default function AdminDashboard() {
  const { data: users }       = useApiList(usersApi.list);
  const { data: assignments } = useApiList(assignmentsApi.list);

  const students = users.filter(u => u.role === 'student');
  const mentors  = users.filter(u => u.role === 'mentor');
  const active   = assignments.filter(a => a.is_active);

  const assignedStudentUserIds = new Set(active.map(a => a.student.user.id));
  const unassignedStudents = students.filter(u => !assignedStudentUserIds.has(u.id));
  const pendingMentors     = mentors.filter(u => !u.is_approved);

  const metrics = [
    { label: 'Total Students',     value: students.length, icon: <Users size={18} />,        accent: 'blue'   as const },
    { label: 'Total Mentors',      value: mentors.length,  icon: <Users size={18} />,        accent: 'purple' as const },
    { label: 'Active Assignments', value: active.length,   icon: <ClipboardList size={18} />,accent: 'green'  as const },
  ];

  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        subtitle="Platform-wide overview"
        actions={
          <Link to="/admin/users"
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-[13px] font-semibold rounded-lg transition-colors shadow-sm">
            Manage Users
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {metrics.map(m => <MetricCard key={m.label} {...m} />)}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">

        {/* Unassigned students */}
        <div>
          <h2 className="text-[13px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Unassigned Students ({unassignedStudents.length})
          </h2>
          {unassignedStudents.length === 0 ? (
            <Card padding="md">
              <p className="text-[13px] text-gray-400 text-center py-2">All students are assigned.</p>
            </Card>
          ) : (
            <Card padding="none">
              {unassignedStudents.slice(0, 5).map((u, i) => (
                <div key={u.id}
                  className={`flex items-center gap-3 px-4 py-3 ${i < Math.min(unassignedStudents.length, 5) - 1 ? 'border-b border-gray-50' : ''}`}>
                  <AlertCircle size={14} className="text-orange-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-800 truncate">
                      {u.first_name ? `${u.first_name} ${u.last_name ?? ''}` : u.username}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">@{u.username}</p>
                  </div>
                  <Link to="/admin/assignments" className="text-[11.5px] text-primary-600 font-medium hover:underline shrink-0">Assign →</Link>
                </div>
              ))}
              {unassignedStudents.length > 5 && (
                <div className="px-4 py-2.5 border-t border-gray-50">
                  <Link to="/admin/assignments" className="text-[12px] text-gray-400 hover:text-primary-600">
                    +{unassignedStudents.length - 5} more — view all
                  </Link>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Pending mentor approvals */}
        <div>
          <h2 className="text-[13px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Pending Mentor Approvals ({pendingMentors.length})
          </h2>
          {pendingMentors.length === 0 ? (
            <Card padding="md">
              <p className="text-[13px] text-gray-400 text-center py-2">No pending approvals.</p>
            </Card>
          ) : (
            <Card padding="none">
              {pendingMentors.slice(0, 5).map((u, i) => (
                <div key={u.id}
                  className={`flex items-center gap-3 px-4 py-3 ${i < Math.min(pendingMentors.length, 5) - 1 ? 'border-b border-gray-50' : ''}`}>
                  <UserCheck size={14} className="text-primary-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-800 truncate">
                      {u.first_name ? `${u.first_name} ${u.last_name ?? ''}` : u.username}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">@{u.username}</p>
                  </div>
                  <Link to="/admin/users" className="text-[11.5px] text-primary-600 font-medium hover:underline shrink-0">Review →</Link>
                </div>
              ))}
            </Card>
          )}
        </div>

      </div>
    </div>
  );
}
