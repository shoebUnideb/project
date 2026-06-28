import { Circle, Loader2, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import type { SubmissionStatus } from '../../../types';

export const STATUS_STYLE: Record<SubmissionStatus, { label: string; icon: React.ReactNode; pill: string }> = {
  not_started:    { label: 'Not Started',    icon: <Circle      size={13} />, pill: 'bg-gray-100 text-gray-500' },
  in_progress:    { label: 'In Progress',    icon: <Loader2     size={13} />, pill: 'bg-primary-50 text-primary-600' },
  submitted:      { label: 'Submitted',      icon: <Clock       size={13} />, pill: 'bg-indigo-50 text-indigo-600' },
  needs_revision: { label: 'Needs Revision', icon: <AlertCircle size={13} />, pill: 'bg-orange-50 text-orange-600' },
  resubmitted:    { label: 'Resubmitted',    icon: <Clock       size={13} />, pill: 'bg-purple-50 text-purple-600' },
  completed:      { label: 'Completed',      icon: <CheckCircle size={13} />, pill: 'bg-green-50 text-green-600' },
};

export function StatusPill({ s }: { s: SubmissionStatus }) {
  const m = STATUS_STYLE[s];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${m.pill}`}>
      {m.icon}{m.label}
    </span>
  );
}
