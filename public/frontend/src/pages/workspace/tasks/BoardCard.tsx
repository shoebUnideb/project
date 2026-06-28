import { Link } from 'react-router-dom';
import { Calendar, Inbox, GitMerge } from 'lucide-react';
import { boardBorderColor, dueDateInfo } from './taskUtils';
import { STATUS_META } from './taskConstants';
import { TypeBadge } from './TaskBadges';
import type { WorkspaceTask } from '../../../types';

export function BoardCard({ task, slug, isOwner }: { task: WorkspaceTask; slug: string; isOwner: boolean }) {
  const due    = dueDateInfo(task.due_date);
  const total  = task.submission_count;
  const done   = task.completed_count;
  const pct    = total ? Math.round((done / total) * 100) : 0;
  const status = task.my_submission_status;
  const urgencyText: Record<string, string> = { overdue: 'text-red-600 bg-red-50', today: 'text-orange-600 bg-orange-50', soon: 'text-yellow-700 bg-yellow-50', normal: 'text-gray-500 bg-gray-50' };

  return (
    <Link to={`/w/${slug}/tasks/${task.id}`}>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
        style={{ borderLeft: `4px solid ${boardBorderColor(task, isOwner)}` }}>
        <div className="p-4">
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <TypeBadge type={task.task_type} />
            {task.status === 'draft' && <span className="text-[9.5px] font-bold uppercase px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">Draft</span>}
          </div>
          <p className="text-[13px] font-semibold text-gray-900 leading-snug mb-2 group-hover:text-primary-700 transition-colors">{task.title}</p>
          {due && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded mb-2 ${urgencyText[due.urgency]}`}>
              <Calendar size={8} />{due.text}
            </span>
          )}
          {isOwner && total > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-400">{done}/{total}</span>
                <span className="text-[10px] font-bold text-gray-600">{pct}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? '#22c55e' : '#6366f1' }} />
              </div>
              {task.submitted_count > 0 && (
                <p className="text-[10px] text-indigo-500 mt-1.5 flex items-center gap-1">
                  <Inbox size={8} /> {task.submitted_count} to review
                </p>
              )}
            </div>
          )}
          {!isOwner && status && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_META[status].pill}`}>
              {STATUS_META[status].icon}{STATUS_META[status].label}
            </span>
          )}
          {task.peer_review_enabled && (
            <p className="text-[10px] text-violet-500 mt-1.5 flex items-center gap-0.5">
              <GitMerge size={8} /> Peer review
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
