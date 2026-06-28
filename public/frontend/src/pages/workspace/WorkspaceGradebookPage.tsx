import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Users, CheckCircle, Clock, AlertCircle, Circle, Loader2 } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useApi } from '../../hooks/useApi';
import { workspacesApi } from '../../api/workspaces';
import type { Gradebook, SubmissionStatus } from '../../types';
import Avatar from '../../components/ui/Avatar';

const STATUS_COLOR: Record<SubmissionStatus, string> = {
  not_started:    'bg-gray-100 text-gray-400',
  in_progress:    'bg-primary-50 text-primary-500',
  submitted:      'bg-indigo-50 text-indigo-500',
  needs_revision: 'bg-orange-50 text-orange-500',
  resubmitted:    'bg-purple-50 text-purple-500',
  completed:      'bg-green-50 text-green-600',
};

const STATUS_ICON: Record<SubmissionStatus, React.ReactNode> = {
  not_started:    <Circle      size={10} />,
  in_progress:    <Loader2     size={10} />,
  submitted:      <Clock       size={10} />,
  needs_revision: <AlertCircle size={10} />,
  resubmitted:    <Clock       size={10} />,
  completed:      <CheckCircle size={10} />,
};

export default function WorkspaceGradebookPage() {
  const { workspace, isOwner } = useWorkspace();
  const [search, setSearch] = useState('');

  const { data: gradebook, loading } = useApi<Gradebook>(
    () => workspacesApi.getGradebook(workspace!.id),
    [workspace?.id],
  );

  if (!workspace || !isOwner) return (
    <div className="p-8 text-center text-gray-400 text-[13px]">Access denied.</div>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 size={24} className="animate-spin text-primary-400" />
    </div>
  );

  if (!gradebook) return null;

  const { tasks, rows } = gradebook;
  const filteredRows = rows.filter(r =>
    r.student_name.toLowerCase().includes(search.toLowerCase())
  );

  const exportCsv = () => {
    const header = ['Student', ...tasks.map(t => `${t.title} (status)`), ...tasks.map(t => `${t.title} (score)`)];
    const lines = rows.map(r => [
      r.student_name,
      ...tasks.map(t => r.scores[t.id]?.status ?? '-'),
      ...tasks.map(t => {
        const cell = r.scores[t.id];
        return cell ? `${cell.score}/${t.max_score}` : '-';
      }),
    ]);
    const csv = [header, ...lines].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `gradebook-${workspace.slug}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Link to={`/w/${workspace.slug}/tasks`}
            className="text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h2 className="text-[17px] font-bold text-gray-900">Gradebook</h2>
            <p className="text-[12px] text-gray-400 mt-0.5">
              {rows.length} students · {tasks.length} tasks
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search students…"
            className="px-3 py-1.5 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 w-40"
          />
          <button onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {tasks.length === 0 && (
        <div className="py-16 text-center text-gray-400">
          <Users size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-[14px]">No published tasks yet.</p>
        </div>
      )}

      {tasks.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="min-w-full text-[12px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-500 sticky left-0 bg-gray-50 min-w-[160px]">
                  Student
                </th>
                {tasks.map(t => (
                  <th key={t.id} className="px-3 py-3 font-semibold text-gray-500 text-center min-w-[120px] max-w-[160px]">
                    <div className="truncate" title={t.title}>{t.title}</div>
                    {t.max_score > 0 && (
                      <div className="text-[10px] text-gray-400 font-normal mt-0.5">{t.max_score} pts</div>
                    )}
                    {t.due_date && (
                      <div className="text-[10px] text-gray-400 font-normal">{t.due_date}</div>
                    )}
                  </th>
                ))}
                <th className="px-3 py-3 font-semibold text-gray-500 text-center min-w-[90px]">Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => {
                const totalScore = tasks.reduce((s, t) => s + (row.scores[t.id]?.score ?? 0), 0);
                const maxScore   = tasks.reduce((s, t) => s + t.max_score, 0);
                const completedCount = tasks.filter(t => row.scores[t.id]?.status === 'completed').length;

                return (
                  <tr key={row.student_id}
                    className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-4 py-3 sticky left-0 bg-inherit">
                      <div className="flex items-center gap-2">
                        <Avatar src={row.student_picture ?? undefined} name={row.student_name} size="sm" />
                        <span className="font-medium text-gray-800 truncate max-w-[120px]">{row.student_name}</span>
                      </div>
                    </td>
                    {tasks.map(t => {
                      const cell = row.scores[t.id];
                      if (!cell) {
                        return (
                          <td key={t.id} className="px-3 py-3 text-center">
                            <span className="text-gray-300 text-[10px]">—</span>
                          </td>
                        );
                      }
                      const colorCls = STATUS_COLOR[cell.status];
                      return (
                        <td key={t.id} className="px-3 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${colorCls}`}>
                              {STATUS_ICON[cell.status]}
                              {cell.status.replace('_', ' ')}
                            </span>
                            {t.max_score > 0 && (
                              <span className="text-[11px] text-gray-500 font-medium">
                                {cell.score}/{t.max_score}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        {maxScore > 0 && (
                          <span className="text-[12px] font-bold text-gray-700">{totalScore}/{maxScore}</span>
                        )}
                        <span className="text-[10px] text-gray-400">{completedCount}/{tasks.length} done</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
