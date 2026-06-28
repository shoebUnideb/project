import { Clock } from 'lucide-react';
import { TYPE_META } from './taskConstants';
import type { WorkspaceTaskType, WorkspaceTask } from '../../../types';

export function TypeBadge({ type }: { type: WorkspaceTaskType }) {
  const m = TYPE_META[type];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${m.color}`}>
      {m.icon}{m.label}
    </span>
  );
}

export function ScheduledBadge({ task }: { task: WorkspaceTask }) {
  if (!task.available_from && !task.available_until) return null;
  const now = new Date();
  const from  = task.available_from  ? new Date(task.available_from)  : null;
  const until = task.available_until ? new Date(task.available_until) : null;
  if (from && from > now)   return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold bg-violet-50 text-violet-600 border border-violet-100"><Clock size={8} /> Scheduled</span>;
  if (until && until < now) return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold bg-gray-100 text-gray-400">Closed</span>;
  return null;
}
