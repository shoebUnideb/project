import { useState } from 'react';
import { useApiList } from '../../hooks/useApi';
import { assignmentsApi } from '../../api/assignments';
import { usersApi } from '../../api/users';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import { Users, ChevronDown } from 'lucide-react';

export default function AssignmentPage() {
  const { data: assignments, refetch } = useApiList(assignmentsApi.list);
  const { data: users } = useApiList(usersApi.list);

  const [showForm, setShowForm]           = useState(false);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedMentor, setSelectedMentor]   = useState('');
  const [notes, setNotes]                 = useState('');
  const [saving, setSaving]               = useState(false);

  const students = users.filter(u => u.role === 'student');
  const mentors  = users.filter(u => u.role === 'mentor' && u.is_approved);
  const active   = assignments.filter(a => a.is_active);
  const inactive = assignments.filter(a => !a.is_active);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await assignmentsApi.create({
        student_id: Number(selectedStudent),
        mentor_id:  Number(selectedMentor),
        notes:      notes.trim() || undefined,
      });
      refetch();
      setShowForm(false);
      setSelectedStudent('');
      setSelectedMentor('');
      setNotes('');
    } finally { setSaving(false); }
  };

  const deactivate = async (id: number) => {
    await assignmentsApi.deactivate(id);
    refetch();
  };

  return (
    <div>
      <PageHeader
        title="Mentor Assignments"
        subtitle={`${active.length} active assignment${active.length !== 1 ? 's' : ''}`}
        actions={
          <button onClick={() => setShowForm(p => !p)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-[13px] font-semibold rounded-lg transition-colors shadow-sm">
            + New Assignment
            <ChevronDown size={14} className={`transition-transform ${showForm ? 'rotate-180' : ''}`} />
          </button>
        }
      />

      {showForm && (
        <Card className="mb-6" padding="lg">
          <h3 className="text-[14px] font-semibold text-gray-800 mb-5">Assign a Student to a Mentor</h3>
          <form onSubmit={handleAssign} className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Student</label>
              <select required value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}
                className="w-full px-3.5 py-2.5 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
                <option value="">Select student…</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.first_name} {s.last_name} (@{s.username})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Mentor</label>
              <select required value={selectedMentor} onChange={e => setSelectedMentor(e.target.value)}
                className="w-full px-3.5 py-2.5 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
                <option value="">Select mentor…</option>
                {mentors.map(m => (
                  <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Notes (optional)</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes…"
                className="w-full px-3.5 py-2.5 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="sm:col-span-3 flex gap-2">
              <button type="submit" disabled={saving}
                className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-[13px] font-semibold rounded-lg transition-colors">
                {saving ? 'Saving…' : 'Create Assignment'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-5 py-2.5 border border-gray-300 text-gray-600 text-[13px] font-medium rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      <h2 className="text-[13px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Active</h2>
      {active.length === 0 ? (
        <Card className="mb-6"><EmptyState icon={<Users size={22} />} title="No active assignments" /></Card>
      ) : (
        <Card padding="none" className="mb-6">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Student</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Mentor</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400 hidden md:table-cell">Notes</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400 hidden lg:table-cell">Assigned</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {active.map((a, i) => (
                <tr key={a.id} className={`${i < active.length - 1 ? 'border-b border-gray-50' : ''} hover:bg-gray-50`}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={`${a.student.user.first_name} ${a.student.user.last_name}`} size="sm" />
                      <span className="font-medium text-gray-800">{a.student.user.first_name} {a.student.user.last_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={`${a.mentor.user.first_name} ${a.mentor.user.last_name}`} size="sm" />
                      <span className="text-gray-700">{a.mentor.user.first_name} {a.mentor.user.last_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 hidden md:table-cell">{a.notes || '—'}</td>
                  <td className="px-5 py-3.5 text-gray-400 hidden lg:table-cell">{new Date(a.assigned_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={() => deactivate(a.id)}
                      className="text-[12px] text-red-500 hover:text-red-700 font-medium">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {inactive.length > 0 && (
        <>
          <h2 className="text-[13px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Inactive ({inactive.length})</h2>
          <Card padding="none">
            {inactive.map((a, i) => (
              <div key={a.id}
                className={`flex items-center gap-4 px-5 py-3.5 opacity-50 ${i < inactive.length - 1 ? 'border-b border-gray-50' : ''}`}>
                <span className="text-[13px] text-gray-600">
                  {a.student.user.first_name} {a.student.user.last_name} → {a.mentor.user.first_name} {a.mentor.user.last_name}
                </span>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
