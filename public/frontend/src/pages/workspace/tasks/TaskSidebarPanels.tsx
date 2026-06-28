import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Activity, CheckCircle, Circle, Inbox, Plus, Download } from 'lucide-react';
import { dueDateInfo, relativeTime, exportTasksToCSV } from './taskUtils';
import type { WorkspaceTask } from '../../../types';

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = 50, cy = 50, r = 34, sw = 13;

  if (total === 0) {
    return (
      <div className="relative w-24 h-24 mx-auto">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth={sw} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[15px] font-bold text-gray-300">0</span>
          <span className="text-[8px] text-gray-300">tasks</span>
        </div>
      </div>
    );
  }

  let angle = -Math.PI / 2;
  const paths = data.map(seg => {
    if (seg.value === 0) return null;
    const sweep = (seg.value / total) * 2 * Math.PI;
    const x1 = (cx + r * Math.cos(angle)).toFixed(3);
    const y1 = (cy + r * Math.sin(angle)).toFixed(3);
    angle += sweep;
    const x2 = (cx + r * Math.cos(angle)).toFixed(3);
    const y2 = (cy + r * Math.sin(angle)).toFixed(3);
    return (
      <path key={seg.label}
        d={`M ${x1} ${y1} A ${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2} ${y2}`}
        fill="none" stroke={seg.color} strokeWidth={sw} strokeLinecap="butt"
      />
    );
  });

  return (
    <div className="relative w-24 h-24 mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
        {paths}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[16px] font-bold text-gray-700">{total}</span>
        <span className="text-[8px] text-gray-400">tasks</span>
      </div>
    </div>
  );
}

export function TaskOverviewPanel({ tasks, isOwner }: { tasks: WorkspaceTask[]; isOwner: boolean }) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);

  const published  = tasks.filter(t => t.status === 'published');
  const draft      = tasks.filter(t => t.status === 'draft').length;
  const scheduled  = published.filter(t => t.available_from && new Date(t.available_from) > now).length;
  const inProgress = isOwner
    ? published.filter(t => t.submitted_count > 0 && t.completed_count < t.submission_count).length
    : tasks.filter(t => ['in_progress', 'submitted', 'resubmitted'].includes(t.my_submission_status ?? '')).length;
  const overdue    = isOwner
    ? published.filter(t => dueDateInfo(t.due_date)?.urgency === 'overdue' && t.completed_count < t.submission_count).length
    : tasks.filter(t => dueDateInfo(t.due_date)?.urgency === 'overdue' && t.my_submission_status !== 'completed').length;
  const newThisWeek = tasks.filter(t => new Date(t.created_at) > weekAgo).length;

  const chartData = [
    { label: 'In Progress', value: inProgress, color: '#6366f1' },
    { label: 'Scheduled',   value: scheduled,  color: '#8b5cf6' },
    { label: 'Draft',       value: draft,       color: '#cbd5e1' },
    { label: 'Overdue',     value: overdue,     color: '#f87171' },
  ];

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[12px] font-semibold text-gray-700">Task Overview</h4>
        {newThisWeek > 0 && (
          <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
            +{newThisWeek} this week
          </span>
        )}
      </div>
      <DonutChart data={chartData} />
      <div className="mt-4 space-y-1.5">
        {chartData.map(d => (
          <div key={d.label} className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-gray-500">{d.label}</span>
            </div>
            <span className="font-semibold text-gray-700 tabular-nums">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function UpcomingDeadlinesPanel({ tasks, slug }: { tasks: WorkspaceTask[]; slug: string }) {
  const items = useMemo(() => tasks
    .filter(t => t.due_date && t.status === 'published')
    .map(t => ({ task: t, info: dueDateInfo(t.due_date)! }))
    .filter(({ info }) => info.daysUntil >= 0)
    .sort((a, b) => a.info.daysUntil - b.info.daysUntil)
    .slice(0, 4),
    [tasks]);

  const urgencyColors: Record<string, string> = {
    today:  'text-orange-500 bg-orange-50',
    soon:   'text-yellow-600 bg-yellow-50',
    normal: 'text-gray-400 bg-gray-50',
  };

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <h4 className="text-[12px] font-semibold text-gray-700 mb-3">Upcoming Deadlines</h4>
      {items.length === 0 ? (
        <p className="text-[11px] text-gray-400 text-center py-4">No upcoming deadlines</p>
      ) : (
        <div className="space-y-2">
          {items.map(({ task, info }) => (
            <Link key={task.id} to={`/w/${slug}/tasks/${task.id}`}
              className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-gray-50 transition-colors group">
              <div className={`mt-0.5 shrink-0 px-1.5 py-0.5 rounded text-[9.5px] font-semibold ${urgencyColors[info.urgency] ?? 'text-gray-400 bg-gray-50'}`}>
                {info.daysUntil === 0 ? 'Today' : `${info.daysUntil}d`}
              </div>
              <div className="min-w-0">
                <p className="text-[11.5px] font-medium text-gray-700 truncate group-hover:text-primary-600">{task.title}</p>
                <p className="text-[10px] text-gray-400">{info.text}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function RecentActivityPanel({ tasks, slug }: { tasks: WorkspaceTask[]; slug: string }) {
  const items = useMemo(() => {
    const events: { task: WorkspaceTask; icon: React.ReactNode; text: string; time: string }[] = [];
    const sorted = [...tasks].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    for (const t of sorted.slice(0, 6)) {
      if (t.submitted_count > 0 && t.status === 'published') {
        events.push({ task: t, icon: <Inbox size={10} className="text-indigo-400" />, text: `${t.submitted_count} submitted`, time: relativeTime(t.updated_at) });
      } else if (t.status === 'published') {
        events.push({ task: t, icon: <CheckCircle size={10} className="text-emerald-400" />, text: 'Published', time: relativeTime(t.updated_at) });
      } else if (t.status === 'draft') {
        events.push({ task: t, icon: <Circle size={10} className="text-gray-300" />, text: 'Draft', time: relativeTime(t.updated_at) });
      }
    }
    return events.slice(0, 5);
  }, [tasks]);

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Activity size={12} className="text-gray-400" />
        <h4 className="text-[12px] font-semibold text-gray-700">Recent Activity</h4>
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-gray-400 text-center py-4">No recent activity</p>
      ) : (
        <div className="space-y-2.5">
          {items.map(({ task, icon, text, time }, i) => (
            <Link key={i} to={`/w/${slug}/tasks/${task.id}`}
              className="flex items-start gap-2 group">
              <div className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center">
                {icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-gray-700 truncate group-hover:text-primary-600">{task.title}</p>
                <p className="text-[10px] text-gray-400">{text} · {time}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function QuickActionsPanel({ tasks, onCreateTask }: { tasks: WorkspaceTask[]; onCreateTask: () => void }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <h4 className="text-[12px] font-semibold text-gray-700 mb-3">Quick Actions</h4>
      <div className="space-y-2">
        <button
          onClick={() => exportTasksToCSV(tasks)}
          className="w-full flex items-center gap-2 px-3 py-2 text-[11.5px] font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Download size={13} className="text-gray-400" />
          Export Tasks (CSV)
        </button>
        <button
          onClick={onCreateTask}
          className="w-full flex items-center gap-2 px-3 py-2 text-[11.5px] font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
        >
          <Plus size={13} className="text-primary-500" />
          New Task
        </button>
      </div>
    </div>
  );
}
