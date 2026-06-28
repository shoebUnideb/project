import { Download } from 'lucide-react';
import { useApi } from '../../../hooks/useApi';
import { workspacesApi } from '../../../api/workspaces';
import type { TaskReport } from '../../../types';
import { StatusPill } from '../../../components/workspace/task/TaskStatusPill';

export function ReportsTab({ workspaceId, taskId }: { workspaceId: number; taskId: number }) {
  const { data: report, loading } = useApi<TaskReport>(
    () => workspacesApi.getTaskReport(workspaceId, taskId),
    [workspaceId, taskId],
  );

  if (loading) return <p className="text-[13px] text-gray-400 py-8 text-center">Loading report…</p>;
  if (!report) return null;

  const { counts, rows } = report;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',           val: counts.total,     color: 'bg-gray-50 text-gray-700' },
          { label: 'Completed',       val: counts.completed, color: 'bg-green-50 text-green-700' },
          { label: 'Awaiting Review', val: counts.submitted, color: 'bg-indigo-50 text-indigo-700' },
          { label: 'Overdue',         val: counts.overdue,   color: 'bg-red-50 text-red-700' },
        ].map(c => (
          <div key={c.label} className={`rounded-xl p-4 ${c.color}`}>
            <p className="text-[22px] font-bold">{c.val}</p>
            <p className="text-[11px] font-medium mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex justify-between text-[12px] text-gray-500 mb-1.5">
          <span>Completion</span>
          <span className="font-semibold text-gray-800">{counts.completion_pct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full" style={{ width: `${counts.completion_pct}%` }} />
        </div>
      </div>

      <a
        href={workspacesApi.exportTaskReport(workspaceId, taskId)}
        download
        className="inline-flex items-center gap-2 px-3 py-1.5 text-[12px] font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Download size={13} /> Export CSV
      </a>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">All Submissions</p>
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-left">
                <th className="px-4 py-2.5 font-semibold">Student</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Deliverables</th>
                <th className="px-4 py-2.5 font-semibold">Overdue</th>
                <th className="px-4 py-2.5 font-semibold">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.submission_id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{r.student_name}</td>
                  <td className="px-4 py-2.5"><StatusPill s={r.status} /></td>
                  <td className="px-4 py-2.5 text-gray-500">{r.checks_done}/{r.checks_total}</td>
                  <td className="px-4 py-2.5">
                    {r.is_overdue
                      ? <span className="text-red-500 font-semibold">Yes</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400">
                    {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
