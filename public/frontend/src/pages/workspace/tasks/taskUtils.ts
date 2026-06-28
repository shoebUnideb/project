import type { WorkspaceTask } from '../../../types';

export function dueDateInfo(due: string | null): { text: string; urgency: 'overdue' | 'today' | 'soon' | 'normal'; daysUntil: number } | null {
  if (!due) return null;
  const d = new Date(due);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0)   return { text: 'Overdue',              urgency: 'overdue', daysUntil: diff };
  if (diff === 0) return { text: 'Due today',            urgency: 'today',   daysUntil: 0 };
  if (diff === 1) return { text: 'Due tomorrow',         urgency: 'soon',    daysUntil: 1 };
  if (diff <= 5)  return { text: `Due in ${diff}d`,      urgency: 'soon',    daysUntil: diff };
  return { text: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), urgency: 'normal', daysUntil: diff };
}

export function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function urgencyBorder(_task: WorkspaceTask, _isOwner: boolean): string {
  return '';
}

export function boardBorderColor(task: WorkspaceTask, isOwner: boolean): string {
  if (isOwner) {
    const done = task.completed_count, total = task.submission_count;
    if (total > 0 && done === total) return '#86efac';
    const due = dueDateInfo(task.due_date);
    if (due?.urgency === 'overdue') return '#f87171';
    if (due?.urgency === 'today')   return '#fb923c';
    if (task.submitted_count > 0)   return '#818cf8';
    return 'transparent';
  }
  const s = task.my_submission_status;
  if (s === 'completed')                         return '#86efac';
  if (s === 'needs_revision')                    return '#fb923c';
  if (s === 'submitted' || s === 'resubmitted')  return '#818cf8';
  if (s === 'in_progress')                       return '#93c5fd';
  if (dueDateInfo(task.due_date)?.urgency === 'overdue') return '#f87171';
  return 'transparent';
}

export function exportTasksToCSV(tasks: WorkspaceTask[]) {
  const headers = ['Title', 'Type', 'Status', 'Due Date', 'Progress %', 'Submissions', 'Completed'];
  const rows = tasks.map(t => [
    `"${t.title.replace(/"/g, '""')}"`,
    t.task_type,
    t.status,
    t.due_date ?? '',
    t.submission_count > 0 ? `${Math.round((t.completed_count / t.submission_count) * 100)}%` : '0%',
    t.submission_count,
    t.completed_count,
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
    download: 'workspace-tasks.csv',
  });
  a.click();
  URL.revokeObjectURL(a.href);
}
