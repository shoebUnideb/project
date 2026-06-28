import {
  ClipboardList, FolderOpen, BookOpen, HelpCircle,
  Circle, Loader2, Clock, AlertCircle, CheckCircle,
} from 'lucide-react';
import type { WorkspaceTaskType, SubmissionStatus } from '../../../types';

export const TYPE_META: Record<WorkspaceTaskType, { label: string; icon: React.ReactNode; color: string }> = {
  assignment: { label: 'Assignment', icon: <ClipboardList size={11} />, color: 'bg-primary-50 text-primary-700 border border-primary-100' },
  project:    { label: 'Project',    icon: <FolderOpen    size={11} />, color: 'bg-violet-50 text-violet-700 border border-violet-100' },
  resource:   { label: 'Resource',   icon: <BookOpen      size={11} />, color: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
  quiz:       { label: 'Quiz',       icon: <HelpCircle    size={11} />, color: 'bg-amber-50 text-amber-700 border border-amber-100' },
};

export const STATUS_META: Record<SubmissionStatus, { label: string; icon: React.ReactNode; pill: string }> = {
  not_started:    { label: 'Not Started',    icon: <Circle      size={11} />, pill: 'bg-gray-100 text-gray-500' },
  in_progress:    { label: 'In Progress',    icon: <Loader2     size={11} />, pill: 'bg-primary-50 text-primary-600' },
  submitted:      { label: 'Submitted',      icon: <Clock       size={11} />, pill: 'bg-indigo-50 text-indigo-600' },
  needs_revision: { label: 'Needs Revision', icon: <AlertCircle size={11} />, pill: 'bg-orange-50 text-orange-600' },
  resubmitted:    { label: 'Resubmitted',    icon: <Clock       size={11} />, pill: 'bg-purple-50 text-purple-600' },
  completed:      { label: 'Completed',      icon: <CheckCircle size={11} />, pill: 'bg-green-50 text-green-600' },
};

export const SECTION_COLORS: Record<string, { header: string; bar: string }> = {
  gray:    { header: 'bg-gray-100 text-gray-600 border-gray-200',         bar: '#94a3b8' },
  blue:    { header: 'bg-primary-50 text-primary-700 border-primary-100', bar: '#6366f1' },
  violet:  { header: 'bg-violet-50 text-violet-700 border-violet-100',    bar: '#8b5cf6' },
  emerald: { header: 'bg-emerald-50 text-emerald-700 border-emerald-100', bar: '#10b981' },
  amber:   { header: 'bg-amber-50 text-amber-700 border-amber-100',       bar: '#f59e0b' },
  rose:    { header: 'bg-rose-50 text-rose-700 border-rose-100',          bar: '#f43f5e' },
};

export const STUDENT_COLS = 'grid-cols-[32px_1fr_140px_140px_170px_44px]';
export const MENTOR_COLS  = 'grid-cols-[32px_1fr_140px_140px_170px_110px_44px]';

export const STUDENT_STATUS_DISPLAY: Record<SubmissionStatus, { icon: React.ReactNode; label: string; cls: string }> = {
  not_started:    { icon: <Circle      size={14} />, label: 'Not Started',    cls: 'text-gray-400' },
  in_progress:    { icon: <Loader2     size={14} />, label: 'In Progress',    cls: 'text-primary-600' },
  submitted:      { icon: <Clock       size={14} />, label: 'Submitted',      cls: 'text-indigo-600' },
  needs_revision: { icon: <AlertCircle size={14} />, label: 'Needs Revision', cls: 'text-orange-500' },
  resubmitted:    { icon: <Clock       size={14} />, label: 'Resubmitted',    cls: 'text-purple-600' },
  completed:      { icon: <CheckCircle size={14} />, label: 'Completed',      cls: 'text-green-600' },
};
