import { useMemo } from 'react';
import { History, Check, Send, Calendar, FileText } from 'lucide-react';
import { useApi } from '../../../hooks/useApi';
import { workspacesApi } from '../../../api/workspaces';
import type { WorkspaceTask, TaskReport } from '../../../types';

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export function ActivityLogTab({ workspaceId, task }: { workspaceId: number; task: WorkspaceTask }) {
  const { data: report, loading } = useApi<TaskReport>(
    () => workspacesApi.getTaskReport(workspaceId, task.id),
    [workspaceId, task.id],
  );

  const entries = useMemo(() => {
    if (!report) return [];
    const creatorName = task.created_by
      ? (`${task.created_by.first_name || ''} ${task.created_by.last_name || ''}`.trim() || task.created_by.username)
      : 'Admin';
    type Entry = { label: string; subtitle: string; date: string; type: string };
    const items: Entry[] = [
      { label: 'Task published', subtitle: `by ${creatorName}`, date: task.created_at, type: 'task' },
    ];
    if (task.due_date && task.updated_at !== task.created_at) {
      items.push({
        label: `Task due date updated to ${fmtDate(task.due_date)}`,
        subtitle: `by ${creatorName}`,
        date: task.updated_at,
        type: 'info',
      });
    }
    report.rows.forEach(r => {
      if (r.submitted_at) {
        items.push({ label: `Student ${r.student_name} submitted`, subtitle: '', date: r.submitted_at, type: 'submit' });
      }
      if (r.completed_at && r.status === 'completed') {
        items.push({ label: `${r.student_name} completed`, subtitle: '', date: r.completed_at, type: 'complete' });
      }
    });
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [report, task.created_by, task.created_at, task.due_date, task.updated_at]);

  if (loading) return <p className="text-[13px] text-gray-400 py-8 text-center">Loading…</p>;

  if (entries.length === 0) return (
    <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
      <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mb-3 mx-auto">
        <History size={22} className="text-gray-300" />
      </div>
      <p className="text-[13.5px] font-semibold text-gray-500">No activity yet</p>
    </div>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center">
            <History size={15} className="text-gray-500" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-gray-900">Activity Log</p>
            <p className="text-[11px] text-gray-400">{entries.length} event{entries.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>
      <div className="divide-y divide-gray-50">
        {entries.map((ev, i) => (
          <div key={i} className="flex items-start gap-4 px-6 py-4 hover:bg-gray-50/60 transition-colors">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
              ev.type === 'complete' ? 'bg-green-100' :
              ev.type === 'submit'   ? 'bg-indigo-100' :
              'bg-primary-100'
            }`}>
              {ev.type === 'complete' ? <Check size={13} className="text-green-600" /> :
               ev.type === 'submit'   ? <Send size={12} className="text-indigo-600" /> :
               ev.type === 'info'     ? <Calendar size={12} className="text-primary-600" /> :
               <FileText size={12} className="text-primary-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-gray-700">{ev.label}</p>
              {ev.subtitle && <p className="text-[11.5px] text-gray-400 mt-0.5">{ev.subtitle}</p>}
            </div>
            <span className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap pt-0.5">
              {fmtDate(ev.date)}
              {', '}
              {new Date(ev.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
