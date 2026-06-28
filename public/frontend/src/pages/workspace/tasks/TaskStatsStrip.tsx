import { ClipboardList, TrendingUp, Inbox, AlertTriangle, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { dueDateInfo } from './taskUtils';
import type { WorkspaceTask } from '../../../types';

export function MentorStatsStrip({ tasks }: { tasks: WorkspaceTask[] }) {
  const published  = tasks.filter(t => t.status === 'published');
  const totalSubs  = published.reduce((s, t) => s + t.submission_count, 0);
  const totalDone  = published.reduce((s, t) => s + t.completed_count, 0);
  const awaiting   = published.reduce((s, t) => s + t.submitted_count, 0);
  const overdue    = published.filter(t => dueDateInfo(t.due_date)?.urgency === 'overdue' && t.completed_count < t.submission_count).length;
  const pct        = totalSubs > 0 ? Math.round((totalDone / totalSubs) * 100) : 0;
  const weekAgo    = new Date(Date.now() - 7 * 86400000);
  const newThisWeek = tasks.filter(t => new Date(t.created_at) > weekAgo).length;

  const stats = [
    { label: 'Published Tasks',  value: published.length,  sub: newThisWeek > 0 ? `+${newThisWeek} this week` : 'total tasks',     icon: <ClipboardList size={14} />, color: 'text-gray-700',   bg: 'bg-white',      border: 'border-gray-200', subColor: newThisWeek > 0 ? 'text-emerald-500' : 'text-gray-400' },
    { label: 'Completion Rate',  value: `${pct}%`,         sub: `${totalDone} of ${totalSubs} subs`,                               icon: <TrendingUp    size={14} />, color: 'text-indigo-700', bg: 'bg-indigo-50',  border: 'border-indigo-100', subColor: 'text-indigo-400' },
    { label: 'Awaiting Review',  value: awaiting,          sub: awaiting > 0 ? 'need attention' : 'none pending',                  icon: <Inbox         size={14} />, color: awaiting > 0 ? 'text-violet-700' : 'text-gray-400', bg: awaiting > 0 ? 'bg-violet-50' : 'bg-white', border: awaiting > 0 ? 'border-violet-100' : 'border-gray-200', subColor: awaiting > 0 ? 'text-violet-400' : 'text-gray-400' },
    { label: 'Overdue',          value: overdue,           sub: overdue > 0 ? 'need follow-up' : 'all on track',                   icon: <AlertTriangle size={14} />, color: overdue > 0 ? 'text-red-700' : 'text-gray-400', bg: overdue > 0 ? 'bg-red-50' : 'bg-white', border: overdue > 0 ? 'border-red-100' : 'border-gray-200', subColor: overdue > 0 ? 'text-red-400' : 'text-gray-400' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
      {stats.map(s => (
        <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl px-3 py-1.5 shadow-sm flex items-center gap-2.5`}>
          <span className={`${s.color} shrink-0`}>{s.icon}</span>
          <p className={`text-[20px] font-bold leading-none ${s.color} tabular-nums shrink-0`}>{s.value}</p>
          <div className="min-w-0">
            <p className="text-[10.5px] text-gray-600 font-semibold leading-tight truncate">{s.label}</p>
            <p className={`text-[10px] font-medium leading-tight ${s.subColor} truncate`}>{s.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function StudentStatsStrip({ tasks }: { tasks: WorkspaceTask[] }) {
  const total     = tasks.length;
  const completed = tasks.filter(t => t.my_submission_status === 'completed').length;
  const inReview  = tasks.filter(t => ['submitted', 'resubmitted'].includes(t.my_submission_status ?? '')).length;
  const needsWork = tasks.filter(t => t.my_submission_status === 'needs_revision').length;
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

  const stats = [
    { label: 'Total Tasks',    value: total,     sub: `${total - completed} remaining`,        icon: <ClipboardList size={14} />, color: 'text-gray-700',   bg: 'bg-white',      border: 'border-gray-200', subColor: 'text-gray-400' },
    { label: 'Completed',      value: completed, sub: `${pct}% of all tasks`,                  icon: <CheckCircle   size={14} />, color: 'text-emerald-700',bg: 'bg-emerald-50', border: 'border-emerald-100', subColor: 'text-emerald-500' },
    { label: 'In Review',      value: inReview,  sub: inReview > 0 ? 'awaiting feedback' : 'none pending',  icon: <Clock size={14} />, color: 'text-indigo-700', bg: inReview > 0 ? 'bg-indigo-50' : 'bg-white', border: inReview > 0 ? 'border-indigo-100' : 'border-gray-200', subColor: 'text-indigo-400' },
    { label: 'Needs Revision', value: needsWork, sub: needsWork > 0 ? 'action required' : 'all good', icon: <AlertCircle size={14} />, color: needsWork > 0 ? 'text-orange-600' : 'text-gray-400', bg: needsWork > 0 ? 'bg-orange-50' : 'bg-white', border: needsWork > 0 ? 'border-orange-100' : 'border-gray-200', subColor: needsWork > 0 ? 'text-orange-400' : 'text-gray-400' },
  ];

  return (
    <div className="space-y-2 mb-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {stats.map(s => (
          <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl px-3 py-1.5 shadow-sm flex items-center gap-2.5`}>
            <span className={`${s.color} shrink-0`}>{s.icon}</span>
            <p className={`text-[20px] font-bold leading-none ${s.color} tabular-nums shrink-0`}>{s.value}</p>
            <div className="min-w-0">
              <p className="text-[10.5px] text-gray-600 font-semibold leading-tight truncate">{s.label}</p>
              <p className={`text-[10px] font-medium leading-tight ${s.subColor} truncate`}>{s.sub}</p>
            </div>
          </div>
        ))}
      </div>
      {total > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl px-3 py-1.5 shadow-sm flex items-center gap-3">
          <span className="text-[11px] font-semibold text-gray-600 shrink-0">Overall Progress</span>
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: pct === 100 ? '#22c55e' : pct >= 60 ? '#6366f1' : '#cf6535' }} />
          </div>
          <span className="text-[11px] font-bold text-gray-700 tabular-nums shrink-0">{pct}%</span>
          <span className="text-[10px] text-gray-400 shrink-0 hidden sm:inline">{completed}/{total}</span>
        </div>
      )}
    </div>
  );
}
