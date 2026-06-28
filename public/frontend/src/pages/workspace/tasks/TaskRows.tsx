import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight, ChevronDown, ChevronUp, Layers,
  Lock, Users, Star, Inbox, GitMerge,
  MoreHorizontal, Pencil, Archive, Trash2, SendHorizontal,
} from 'lucide-react';
import { SECTION_COLORS, MENTOR_COLS, STUDENT_COLS, STUDENT_STATUS_DISPLAY } from './taskConstants';
import { dueDateInfo, urgencyBorder } from './taskUtils';
import { TypeBadge, ScheduledBadge } from './TaskBadges';
import type { WorkspaceTask, WorkspaceTaskSection } from '../../../types';

export function TableHeader({ isOwner }: { isOwner: boolean }) {
  const base = 'px-6 py-3 text-[10.5px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 bg-gray-50/70 rounded-t-xl';
  if (isOwner) {
    return (
      <div className={`grid ${MENTOR_COLS} items-center ${base}`}>
        <span className="text-center">#</span>
        <span>Task</span>
        <span className="hidden sm:block">Type</span>
        <span className="hidden md:block">Due Date</span>
        <span className="hidden md:block">Progress</span>
        <span className="hidden lg:block">Status</span>
        <span />
      </div>
    );
  }
  return (
    <div className={`grid ${STUDENT_COLS} items-center ${base}`}>
      <span className="text-center">#</span>
      <span>Task</span>
      <span className="hidden sm:block">Type</span>
      <span className="hidden md:block">Due Date</span>
      <span className="hidden sm:block">My Status</span>
      <span />
    </div>
  );
}

export function TaskActionMenu({
  task, onEdit, onPublish, onArchive, onDelete, canEdit = true,
}: {
  task: WorkspaceTask;
  onEdit: () => void;
  onPublish: () => void;
  onArchive: () => void;
  onDelete: () => void;
  canEdit?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const setClose = () => setOpen(false);

  const menuItem = (label: string, icon: React.ReactNode, action: () => void, cls = '') => (
    <button
      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); action(); setClose(); }}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] font-medium text-left hover:bg-gray-50 transition-colors rounded-lg ${cls}`}
    >
      {icon}{label}
    </button>
  );

  return (
    <div ref={ref} className="relative shrink-0" onClick={e => e.preventDefault()}>
      <button
        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setOpen(v => !v); }}
        className={`p-1.5 rounded-lg transition-colors ${open ? 'bg-gray-100 text-gray-700' : 'text-gray-300 hover:text-gray-600 hover:bg-gray-100'}`}
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 px-1.5 w-44 space-y-0.5">
          {canEdit && menuItem('Edit', <Pencil size={13} className="text-gray-400" />, onEdit)}
          {task.status === 'draft' && menuItem(
            'Publish', <SendHorizontal size={13} className="text-emerald-500" />, onPublish, 'text-emerald-700',
          )}
          {task.status === 'archived'
            ? menuItem('Unarchive', <Archive size={13} className="text-amber-500" />, onArchive, 'text-amber-700')
            : menuItem('Archive',   <Archive size={13} className="text-amber-400" />, onArchive, 'text-amber-600')}
          {canEdit && <div className="border-t border-gray-100 my-1" />}
          {canEdit && menuItem('Delete', <Trash2 size={13} className="text-red-400" />, onDelete, 'text-red-600')}
        </div>
      )}
    </div>
  );
}

export function MentorTableRow({ task, slug, index, onEdit, onPublish, onArchive, onDelete, canEdit = true }: {
  task: WorkspaceTask; slug: string; index: number;
  onEdit: () => void; onPublish: () => void; onArchive: () => void; onDelete: () => void;
  canEdit?: boolean;
}) {
  const total   = task.submission_count;
  const done    = task.completed_count;
  const pending = task.submitted_count;
  const pct     = total ? Math.round((done / total) * 100) : 0;
  const due     = dueDateInfo(task.due_date);
  const border  = urgencyBorder(task, true);

  const taskStatusMeta =
    task.status === 'draft'    ? { label: 'Draft',     cls: 'text-gray-400',   bg: 'bg-gray-100' } :
    task.status === 'archived' ? { label: 'Archived',  cls: 'text-red-400',    bg: 'bg-red-50'   } :
                                 { label: 'Published', cls: 'text-emerald-600', bg: 'bg-emerald-50' };

  const urgencyStyle: Record<string, string> = {
    overdue: 'text-red-500', today: 'text-orange-500', soon: 'text-yellow-600', normal: 'text-gray-500',
  };

  return (
    <Link to={`/w/${slug}/tasks/${task.id}`}>
      <div className={`grid ${MENTOR_COLS} items-center px-6 py-4 border-b border-gray-50 hover:bg-primary-50/20 transition-colors group ${border} bg-white`}>
        <span className="text-[11px] font-semibold text-gray-400 text-center">{index}</span>
        <div className="min-w-0 pr-3">
          {(task.status !== 'published' || task.peer_review_enabled) && (
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              {task.status !== 'published' && (
                <span className={`text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${taskStatusMeta.bg} ${taskStatusMeta.cls}`}>
                  {taskStatusMeta.label}
                </span>
              )}
              {task.peer_review_enabled && (
                <span className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold text-violet-500">
                  <GitMerge size={8} /> PR
                </span>
              )}
              <ScheduledBadge task={task} />
            </div>
          )}
          <p className="text-[14px] font-bold text-gray-900 truncate group-hover:text-primary-700 leading-snug">{task.title}</p>
          <div className="flex items-center gap-2.5 mt-1">
            <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
              <Users size={10} /> {total} {total === 1 ? 'student' : 'students'}
            </span>
            {pending > 0 && (
              <span className="text-[11px] font-semibold text-indigo-500 flex items-center gap-0.5">
                <Inbox size={10} /> {pending} to review
              </span>
            )}
            {task.rubric_criteria.length > 0 && (
              <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
                <Star size={10} /> {task.rubric_criteria.reduce((s, c) => s + c.max_points, 0)} pts
              </span>
            )}
          </div>
        </div>
        <div className="hidden sm:block">
          <TypeBadge type={task.task_type} />
        </div>
        <div className="hidden md:block">
          {due ? (
            <span className={`text-[12.5px] font-semibold ${urgencyStyle[due.urgency]}`}>{due.text}</span>
          ) : (
            <span className="text-[13px] text-gray-300 font-light">—</span>
          )}
        </div>
        <div className="hidden md:block pr-3">
          {total > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10.5px] text-gray-400 tabular-nums">{done}/{total}</span>
                <span className="text-[10.5px] font-bold text-gray-600 tabular-nums">{pct}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: pct === 100 ? '#22c55e' : '#6366f1' }} />
              </div>
            </div>
          ) : (
            <span className="text-[12px] text-gray-300">No submissions</span>
          )}
        </div>
        <div className="hidden lg:flex items-center gap-1.5">
          <span className={`text-[12.5px] font-semibold ${taskStatusMeta.cls}`}>{taskStatusMeta.label}</span>
        </div>
        <TaskActionMenu task={task} onEdit={onEdit} onPublish={onPublish} onArchive={onArchive} onDelete={onDelete} canEdit={canEdit} />
      </div>
    </Link>
  );
}

export function StudentTableRow({ task, slug, index }: { task: WorkspaceTask; slug: string; index: number }) {
  const due    = dueDateInfo(task.due_date);
  const status = task.my_submission_status;
  const border = urgencyBorder(task, false);

  const urgencyStyle: Record<string, string> = {
    overdue: 'text-red-500', today: 'text-orange-500', soon: 'text-yellow-600', normal: 'text-gray-500',
  };

  if (task.is_locked) {
    return (
      <div className={`grid ${STUDENT_COLS} items-center px-6 py-4 border-b border-gray-50 bg-gray-50/40`}>
        <span className="text-[11px] font-semibold text-gray-400 text-center">{index}</span>
        <div className="min-w-0 pr-3">
          <p className="text-[14px] font-bold text-gray-400 truncate">{task.title}</p>
          <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-1">
            <Lock size={9} /> Complete prerequisites to unlock
          </p>
        </div>
        <div className="hidden sm:block"><TypeBadge type={task.task_type} /></div>
        <div className="hidden md:block" />
        <div className="hidden sm:flex items-center gap-1.5 text-gray-400">
          <Lock size={13} />
          <span className="text-[12.5px] font-semibold">Locked</span>
        </div>
        <div />
      </div>
    );
  }

  return (
    <Link to={`/w/${slug}/tasks/${task.id}`}>
      <div className={`grid ${STUDENT_COLS} items-center px-6 py-4 border-b border-gray-50 hover:bg-primary-50/20 transition-colors group ${border} bg-white`}>
        <span className="text-[11px] font-semibold text-gray-400 text-center">{index}</span>
        <div className="min-w-0 pr-3">
          {task.peer_review_enabled && (
            <div className="mb-1">
              <span className="text-[9.5px] font-semibold text-violet-500 flex items-center gap-0.5 w-fit">
                <GitMerge size={8} /> Peer Review
              </span>
            </div>
          )}
          <p className="text-[14px] font-bold text-gray-900 truncate group-hover:text-primary-700 leading-snug">{task.title}</p>
        </div>
        <div className="hidden sm:block">
          <TypeBadge type={task.task_type} />
        </div>
        <div className="hidden md:block">
          {due ? (
            <span className={`text-[12.5px] font-semibold ${urgencyStyle[due.urgency]}`}>{due.text}</span>
          ) : (
            <span className="text-[13px] text-gray-300 font-light">—</span>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          {status ? (
            <span className={`flex items-center gap-1.5 text-[12.5px] font-semibold ${STUDENT_STATUS_DISPLAY[status].cls}`}>
              {STUDENT_STATUS_DISPLAY[status].icon}
              {STUDENT_STATUS_DISPLAY[status].label}
            </span>
          ) : (
            <span className="text-[13px] text-gray-300 font-light">—</span>
          )}
        </div>
        <ChevronRight size={15} className="text-gray-300 group-hover:text-gray-500 transition-colors justify-self-end" />
      </div>
    </Link>
  );
}

export function SectionGroup({
  section, tasks, slug, isOwner, collapsed, onToggle, showHeader,
  onTaskEdit, onTaskPublish, onTaskArchive, onTaskDelete, canEditTask,
}: {
  section: WorkspaceTaskSection | null;
  tasks: WorkspaceTask[];
  slug: string;
  isOwner: boolean;
  collapsed: boolean;
  onToggle: () => void;
  showHeader: boolean;
  onTaskEdit: (t: WorkspaceTask) => void;
  onTaskPublish: (t: WorkspaceTask) => void;
  onTaskArchive: (t: WorkspaceTask) => void;
  onTaskDelete: (t: WorkspaceTask) => void;
  canEditTask?: (t: WorkspaceTask) => boolean;
}) {
  const colorKey = section?.color ?? 'gray';
  const meta = SECTION_COLORS[colorKey] ?? SECTION_COLORS.gray;
  const publishedTasks = isOwner ? tasks.filter(t => t.status === 'published') : tasks;
  const totalSubs     = isOwner ? publishedTasks.reduce((s, t) => s + t.submission_count, 0) : publishedTasks.length;
  const completedSubs = isOwner
    ? publishedTasks.reduce((s, t) => s + t.completed_count, 0)
    : publishedTasks.filter(t => t.my_submission_status === 'completed').length;
  const sectionPct = totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 0;

  return (
    <div>
      {section && showHeader && (
        <div className={`border rounded-lg mb-0 overflow-hidden ${meta.header}`}>
          <button onClick={onToggle} className="w-full flex items-center gap-2 px-4 py-2">
            <Layers size={12} />
            <span className="text-[11.5px] font-bold flex-1 text-left">{section.title}</span>
            {section.description && <span className="text-[10.5px] opacity-60 hidden sm:block truncate max-w-[140px]">{section.description}</span>}
            <span className="text-[10.5px] opacity-60 shrink-0">{tasks.length}</span>
            {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
          {totalSubs > 0 && (
            <div className="px-4 pb-2 flex items-center gap-3">
              <div className="flex-1 h-1 bg-black/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${sectionPct}%`, backgroundColor: sectionPct === 100 ? '#22c55e' : meta.bar }} />
              </div>
              <span className="text-[10px] font-semibold opacity-70 shrink-0">{sectionPct}%</span>
            </div>
          )}
        </div>
      )}
      {!collapsed && tasks.map((task, i) =>
        isOwner
          ? <MentorTableRow key={task.id} task={task} slug={slug} index={i + 1}
              onEdit={() => onTaskEdit(task)}
              onPublish={() => onTaskPublish(task)}
              onArchive={() => onTaskArchive(task)}
              onDelete={() => onTaskDelete(task)}
              canEdit={canEditTask ? canEditTask(task) : true}
            />
          : <StudentTableRow key={task.id} task={task} slug={slug} index={i + 1} />
      )}
    </div>
  );
}
