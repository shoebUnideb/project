import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle, Circle, Clock, Send, Trash2, UploadCloud, Users,
  Check, Calendar, Lock, Award, FileText, ChevronRight, MessageSquare,
  ChevronDown, RotateCcw, History,
  ClipboardList, FolderOpen, BookOpen, HelpCircle,
} from 'lucide-react';
import { useWorkspace } from '../../../context/WorkspaceContext';
import { useApi } from '../../../hooks/useApi';
import { workspacesApi } from '../../../api/workspaces';
import apiClient from '../../../api/apiClient';
import type {
  WorkspaceTask, WorkspaceTaskSubmission, WorkspaceTaskType, SubmissionStatus,
} from '../../../types';
import MentionTextarea from '../../../components/ui/MentionTextarea';
import { STATUS_STYLE, StatusPill } from '../../../components/workspace/task/TaskStatusPill';
import { DocCommentThread } from '../../../components/workspace/task/DocCommentThread';
import { RevisionTimeline } from '../../../components/workspace/task/RevisionTimeline';
import { SelfAssessmentForm, StudentPeerReviewSection } from '../../../components/workspace/task/PeerReviewPanels';

const TYPE_ICON: Record<WorkspaceTaskType, React.ReactNode> = {
  assignment: <ClipboardList size={15} />,
  project:    <FolderOpen    size={15} />,
  resource:   <BookOpen      size={15} />,
  quiz:       <HelpCircle    size={15} />,
};

const STATUS_DOT: Record<SubmissionStatus, string> = {
  not_started:    'bg-gray-400',
  in_progress:    'bg-primary-500',
  submitted:      'bg-indigo-500',
  needs_revision: 'bg-orange-500',
  resubmitted:    'bg-purple-500',
  completed:      'bg-green-500',
};

const STATUS_PILL_STYLE: Record<SubmissionStatus, string> = {
  not_started:    'bg-gray-100 border-gray-200 text-gray-500',
  in_progress:    'bg-primary-50 border-primary-200 text-primary-700',
  submitted:      'bg-indigo-50 border-indigo-200 text-indigo-700',
  needs_revision: 'bg-orange-50 border-orange-200 text-orange-700',
  resubmitted:    'bg-indigo-50 border-indigo-200 text-indigo-700',
  completed:      'bg-green-50 border-green-200 text-green-700',
};

function StatusDropdown({
  sub, workspaceId, taskId, onRefetch, onSwitchToSubmission,
}: {
  sub: WorkspaceTaskSubmission;
  workspaceId: number;
  taskId: number;
  onRefetch: () => void;
  onSwitchToSubmission: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [recalling, setRecalling] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleStart = async () => {
    setStarting(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.startMySubmission(workspaceId, taskId);
      onRefetch();
    } finally { setStarting(false); setOpen(false); }
  };

  const handleRecall = async () => {
    setRecalling(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.recallMySubmission(workspaceId, taskId);
      onRefetch();
    } finally { setRecalling(false); setOpen(false); }
  };

  const STATUS_OPTIONS: { status: SubmissionStatus; label: string; sublabel: string }[] = [
    { status: 'not_started',    label: 'Not Started',    sublabel: 'You haven\'t started yet' },
    { status: 'in_progress',    label: 'In Progress',    sublabel: 'Currently working on this' },
    { status: 'submitted',      label: 'Submitted',      sublabel: 'Awaiting mentor review' },
    { status: 'needs_revision', label: 'Needs Revision', sublabel: 'Mentor requested changes' },
    { status: 'completed',      label: 'Completed',      sublabel: 'Marked complete by mentor' },
  ];

  const canStart    = sub.status === 'not_started';
  const canSubmit   = sub.status === 'in_progress';
  const canResubmit = sub.status === 'needs_revision';
  const canRecall   = sub.status === 'submitted' || sub.status === 'resubmitted';
  const hasAction   = canStart || canSubmit || canResubmit || canRecall;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-[13px] font-semibold transition-colors hover:opacity-90 ${STATUS_PILL_STYLE[sub.status]}`}>
        <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[sub.status]}`} />
        {STATUS_STYLE[sub.status].label}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
          <div className="p-2">
            <p className="text-[10.5px] font-semibold uppercase tracking-widest text-gray-400 px-3 py-1.5">Current Status</p>
            {STATUS_OPTIONS.map(opt => {
              const isCurrent = sub.status === opt.status || (sub.status === 'resubmitted' && opt.status === 'submitted');
              return (
                <div key={opt.status}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${isCurrent ? 'bg-gray-50' : ''}`}>
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[opt.status]}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12.5px] font-semibold ${isCurrent ? 'text-gray-900' : 'text-gray-500'}`}>{opt.label}</p>
                    <p className="text-[11px] text-gray-400">{opt.sublabel}</p>
                  </div>
                  {isCurrent && <Check size={13} className="text-primary-600 shrink-0" />}
                </div>
              );
            })}
          </div>

          {hasAction && (
            <div className="border-t border-gray-100 p-2 space-y-1">
              <p className="text-[10.5px] font-semibold uppercase tracking-widest text-gray-400 px-3 py-1">Quick Actions</p>
              {canStart && (
                <button onClick={handleStart} disabled={starting}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-primary-50 hover:bg-primary-100 text-primary-700 text-[12.5px] font-semibold transition-colors disabled:opacity-50">
                  <Circle size={13} className="shrink-0" />
                  {starting ? 'Starting…' : 'Start Working'}
                </button>
              )}
              {canSubmit && (
                <button onClick={() => { onSwitchToSubmission(); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-primary-50 hover:bg-primary-100 text-primary-700 text-[12.5px] font-semibold transition-colors">
                  <Send size={13} className="shrink-0" />
                  Submit Work
                </button>
              )}
              {canResubmit && (
                <button onClick={() => { onSwitchToSubmission(); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 text-[12.5px] font-semibold transition-colors">
                  <Send size={13} className="shrink-0" />
                  Submit Revision
                </button>
              )}
              {canRecall && (
                <button onClick={handleRecall} disabled={recalling}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 text-[12.5px] font-semibold transition-colors disabled:opacity-50">
                  <RotateCcw size={13} className="shrink-0" />
                  {recalling ? 'Recalling…' : 'Recall Submission'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StudentDonutChart({
  completed, inProgress, pct, size = 130, stroke = 20,
}: {
  completed: number; inProgress: number; pct: number;
  size?: number; stroke?: number;
}) {
  const total = completed + inProgress;
  const r  = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;

  if (total === 0) return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
      <text x={cx} y={cy + 5} textAnchor="middle" style={{ fontSize: 16, fontWeight: 800 }} fill="#111827">0%</text>
    </svg>
  );

  const segs: { v: number; c: string }[] = [
    { v: completed,  c: '#22c55e' },
    { v: inProgress, c: '#cf6535' },
  ];
  let angle = -Math.PI / 2;
  const paths: React.ReactNode[] = [];
  segs.forEach(({ v, c }) => {
    if (v === 0) return;
    const sweep = (v / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    paths.push(
      <path key={c}
        d={`M ${x1} ${y1} A ${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2} ${y2}`}
        fill="none" stroke={c} strokeWidth={stroke}
      />
    );
  });

  return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
      {paths}
      <text x={cx} y={cy - 4} textAnchor="middle" style={{ fontSize: 17, fontWeight: 800 }} fill="#111827">{pct}%</text>
      <text x={cx} y={cy + 13} textAnchor="middle" style={{ fontSize: 10 }} fill="#6b7280">Completed</text>
    </svg>
  );
}

type StudentTab = 'overview' | 'submission' | 'comments' | 'activity';

export function StudentTaskDetailView({ workspaceId, task }: { workspaceId: number; task: WorkspaceTask }) {
  const { workspace } = useWorkspace();
  const [tab, setTab]             = useState<StudentTab>('overview');
  const [comment, setComment]     = useState('');
  const [posting, setPosting]     = useState(false);
  const [acting, setActing]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitNote, setSubmitNote] = useState('');
  const [selfAssess, setSelfAssess] = useState<Record<number, number>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: sub, loading, refetch } = useApi<WorkspaceTaskSubmission>(
    () => workspacesApi.getMySubmission(workspaceId, task.id),
    [workspaceId, task.id],
  );

  const canSubmit  = sub ? ['not_started', 'in_progress', 'needs_revision'].includes(sub.status) : false;
  const isResubmit = sub?.status === 'needs_revision';

  const toggleCheck = async (checkId: number) => {
    await apiClient.initCsrf();
    await workspacesApi.toggleDeliverableCheck(workspaceId, task.id, checkId);
    refetch();
  };

  const handleSubmit = async () => {
    const questions  = task.self_assess_questions ?? [];
    const unanswered = questions.filter(q => !selfAssess[q.id]);
    if (unanswered.length > 0) { alert('Please answer all self-assessment questions.'); return; }
    setActing(true);
    try {
      await apiClient.initCsrf();
      const note      = submitNote.trim();
      const responses = questions.map(q => ({ question_id: q.id, rating: selfAssess[q.id] }));
      if (isResubmit) await workspacesApi.resubmitMySubmission(workspaceId, task.id, note || undefined, responses);
      else            await workspacesApi.submitMySubmission(workspaceId, task.id, note || undefined, responses);
      setSubmitNote('');
      refetch();
    } finally { setActing(false); }
  };

  const postComment = async () => {
    if (!comment.trim() || !sub) return;
    setPosting(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.addComment(workspaceId, task.id, sub.id, comment.trim());
      setComment('');
      refetch();
    } finally { setPosting(false); }
  };

  const uploadDoc = async (file: File) => {
    if (!sub) return;
    setUploading(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.uploadDocument(workspaceId, task.id, sub.id, file, file.name);
      refetch();
    } finally { setUploading(false); }
  };

  const deleteDoc = async (docId: number) => {
    if (!sub) return;
    await apiClient.initCsrf();
    await workspacesApi.deleteDocument(workspaceId, task.id, sub.id, docId);
    setDeleteConfirmId(null);
    refetch();
  };

  const slug = workspace?.slug ?? '';
  const fmt  = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

  const effectiveDue  = sub?.due_date_override ?? task.due_date;
  const isDueExtended = !!(sub?.due_date_override);
  const daysLeft = (() => {
    if (!effectiveDue) return null;
    const diff = Math.ceil((new Date(effectiveDue).getTime() - Date.now()) / 86400000);
    if (diff < 0) return { text: `${Math.abs(diff)} days overdue`, overdue: true };
    if (diff === 0) return { text: 'Due today', overdue: false };
    return { text: `${diff} day${diff !== 1 ? 's' : ''}`, overdue: false };
  })();

  const checksDone  = sub?.checks.filter(c => c.is_done).length ?? 0;
  const checksTotal = sub?.checks.length ?? 0;
  const pct         = checksTotal > 0 ? Math.round((checksDone / checksTotal) * 100) : 0;
  const inProgress  = checksTotal - checksDone;

  const creatorName = task.created_by
    ? (`${task.created_by.first_name || ''} ${task.created_by.last_name || ''}`.trim() || task.created_by.username)
    : null;

  const TYPE_LABEL: Record<string, string> = { assignment: 'Assignment', project: 'Project', resource: 'Resource', quiz: 'Quiz' };
  const TYPE_COLOR: Record<string, string> = {
    assignment: 'bg-violet-100 text-violet-700',
    project:    'bg-primary-100 text-primary-700',
    resource:   'bg-green-100 text-green-700',
    quiz:       'bg-orange-100 text-orange-700',
  };
  const rubricTotal = (task.rubric_criteria ?? []).reduce((s, c) => s + c.max_points, 0);

  const tabs: { key: StudentTab; label: string }[] = [
    { key: 'overview',   label: 'Overview' },
    { key: 'submission', label: 'My Submission' },
    { key: 'comments',   label: `Comments (${sub?.comments.length ?? 0})` },
    { key: 'activity',   label: 'Activity' },
  ];

  if (task.is_locked) return (
    <div>
      <Link to={`/w/${slug}/tasks`} className="inline-flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-gray-800 mb-4">
        <ArrowLeft size={14} /> Back to Tasks
      </Link>
      <div className="p-12 bg-gray-50 border border-gray-200 rounded-xl text-center max-w-md mx-auto mt-10">
        <Lock size={36} className="text-gray-300 mx-auto mb-4" />
        <p className="text-[16px] font-semibold text-gray-500">This task is locked</p>
        <p className="text-[13px] text-gray-400 mt-1">
          Complete the prerequisite {task.prerequisite_ids.length > 1 ? 'tasks' : 'task'} first to unlock this one.
        </p>
      </div>
    </div>
  );

  return (
    <div className="max-w-[1200px]">
      <Link to={`/w/${slug}/tasks`} className="inline-flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-gray-800 mb-5">
        <ArrowLeft size={14} /> Back to Tasks
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-5">
        <div className="flex-1 min-w-0">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-widest mb-2 ${TYPE_COLOR[task.task_type] ?? 'bg-gray-100 text-gray-500'}`}>
            {TYPE_ICON[task.task_type]} {TYPE_LABEL[task.task_type]}
          </span>
          <h1 className="text-[24px] font-bold text-gray-900 leading-tight">{task.title}</h1>
          {task.description && (
            <p className="text-[13.5px] text-gray-500 mt-1.5 leading-relaxed">{task.description}</p>
          )}
          <div className="flex items-center gap-7 mt-4 flex-wrap">
            {creatorName && (
              <div className="flex items-center gap-2">
                <Users size={14} className="text-gray-400 shrink-0" />
                <div>
                  <p className="text-[10.5px] text-gray-400 font-medium">Assigned by</p>
                  <p className="text-[12.5px] font-semibold text-gray-800">{creatorName}</p>
                </div>
              </div>
            )}
            {sub?.assigned_at && (
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-gray-400 shrink-0" />
                <div>
                  <p className="text-[10.5px] text-gray-400 font-medium">Assigned on</p>
                  <p className="text-[12.5px] font-semibold text-gray-800">{fmt(sub.assigned_at)}</p>
                </div>
              </div>
            )}
            {effectiveDue && (
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-gray-400 shrink-0" />
                <div>
                  <p className="text-[10.5px] text-gray-400 font-medium">Due date</p>
                  <p className="text-[12.5px] font-semibold text-gray-800">
                    {fmt(effectiveDue)}
                    {isDueExtended && <span className="ml-1.5 text-[11px] text-orange-500 font-semibold">(extended)</span>}
                  </p>
                </div>
              </div>
            )}
            {task.available_from && (
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-gray-400 shrink-0" />
                <div>
                  <p className="text-[10.5px] text-gray-400 font-medium">Opens</p>
                  <p className="text-[12.5px] font-semibold text-gray-800">{fmt(task.available_from)}</p>
                </div>
              </div>
            )}
            {task.available_until && (
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-gray-400 shrink-0" />
                <div>
                  <p className="text-[10.5px] text-gray-400 font-medium">Closes</p>
                  <p className="text-[12.5px] font-semibold text-gray-800">{fmt(task.available_until)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {sub && !loading && (
          <div className="shrink-0 mt-1">
            <StatusDropdown
              sub={sub}
              workspaceId={workspaceId}
              taskId={task.id}
              onRefetch={refetch}
              onSwitchToSubmission={() => setTab('submission')}
            />
          </div>
        )}
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-gray-200 mb-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="py-12 text-center text-gray-400 text-[13px]">Loading your submission…</div>}

      {/* ── Overview tab ── */}
      {!loading && tab === 'overview' && (
        <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">

          <div className="space-y-5 min-w-0">

            {sub && sub.checks.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-[13px] font-bold text-gray-900 mb-2">Deliverables ({sub.checks.length})</p>
                <div className="space-y-1.5">
                  {sub.checks.map(c => (
                    <button key={c.id}
                      onClick={() => sub.status !== 'completed' && toggleCheck(c.id)}
                      disabled={sub.status === 'completed'}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all disabled:cursor-default ${
                        c.is_done ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:border-primary-300'
                      }`}>
                      <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                        c.is_done ? 'bg-green-500' : 'border-2 border-primary-400 bg-white'
                      }`}>
                        {c.is_done
                          ? <Check size={12} className="text-white" />
                          : <div className="w-2 h-2 rounded-full bg-primary-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[12.5px] font-semibold ${c.is_done ? 'line-through text-green-700' : 'text-gray-800'}`}>
                          {c.deliverable.title}
                        </p>
                        {c.deliverable.description && (
                          <p className="text-[11px] text-gray-400 truncate">{c.deliverable.description}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${
                          c.is_done ? 'bg-green-100 text-green-700' : 'bg-primary-50 text-primary-600'
                        }`}>
                          {c.is_done ? 'Completed' : 'In Progress'}
                        </span>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {c.is_done ? `Submitted on ${fmt(sub.submitted_at)}` : 'Not submitted yet'}
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-1 text-gray-300">
                        <FileText size={13} />
                        <ChevronRight size={13} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {task.rubric_criteria && task.rubric_criteria.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-[14px] font-bold text-gray-900 mb-3">Rubric ({rubricTotal} pts total)</p>
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-left border-b border-gray-100">
                        <th className="px-4 py-2.5 font-semibold">Criteria</th>
                        <th className="px-4 py-2.5 font-semibold"></th>
                        <th className="px-4 py-2.5 font-semibold text-right">Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {task.rubric_criteria.map(c => (
                        <tr key={c.id} className="border-t border-gray-100">
                          <td className="px-4 py-2.5 font-semibold text-gray-800">{c.title}</td>
                          <td className="px-4 py-2.5 text-gray-400 max-w-[220px]">{c.description ?? '—'}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-gray-700">{c.max_points} pts</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {sub && sub.rubric_scores.length > 0 && (
                  <div className="mt-3 p-3 bg-violet-50 rounded-xl border border-violet-100">
                    <p className="text-[11px] font-semibold text-violet-600 mb-1 flex items-center gap-1.5">
                      <Award size={11} /> Your Score
                    </p>
                    <p className="text-[20px] font-bold text-violet-700">{sub.total_score} / {sub.max_score}</p>
                  </div>
                )}
              </div>
            )}

            {sub && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-[14px] font-bold text-gray-900 mb-3">My Submission</p>
                {sub.status !== 'completed' && (
                  <div
                    className="border-2 border-dashed border-gray-200 rounded-lg px-4 py-2.5 flex items-center gap-3 cursor-pointer hover:border-primary-300 hover:bg-primary-50/30 transition-colors mb-3"
                    onClick={() => fileRef.current?.click()}>
                    <UploadCloud size={18} className="shrink-0 text-primary-400" />
                    <div className="flex-1 text-left">
                      <p className="text-[12px] font-semibold text-gray-700 leading-tight">Upload your files here</p>
                      <p className="text-[10.5px] text-gray-400 leading-tight">PDF, DOCX, PPTX, ZIP · Max 10MB</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
                      disabled={uploading}
                      className="shrink-0 px-4 py-1 bg-primary-600 hover:bg-primary-700 text-white text-[11.5px] font-semibold rounded-md transition-colors disabled:opacity-50">
                      {uploading ? 'Uploading…' : 'Choose Files'}
                    </button>
                  </div>
                )}
                {sub.documents.length > 0 && (
                  <div>
                    <p className="text-[11.5px] font-semibold text-gray-500 mb-2">Submitted files</p>
                    <div className="space-y-2">
                      {sub.documents.map(doc => {
                        const ext = doc.file_url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
                        const isPdf = ext === 'pdf';
                        const isStudentUpload = doc.uploaded_by.id === sub.student.user.id;
                        return (
                          <div key={doc.id} className="border border-gray-100 rounded-xl overflow-hidden">
                            <div className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isPdf ? 'bg-red-500' : 'bg-primary-500'}`}>
                                <FileText size={16} className="text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <a href={doc.file_url} target="_blank" rel="noreferrer"
                                    className="text-[13px] font-semibold text-gray-800 hover:text-primary-600 truncate">
                                    {doc.title}
                                  </a>
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                                    isStudentUpload ? 'bg-primary-50 text-primary-600' : 'bg-purple-50 text-purple-600'
                                  }`}>
                                    {isStudentUpload ? 'You' : 'Mentor'}
                                  </span>
                                </div>
                                <p className="text-[11px] text-gray-400">Uploaded on {fmt(doc.created_at)}</p>
                              </div>
                              {sub.status !== 'completed' && isStudentUpload && (
                                <button onClick={() => setDeleteConfirmId(doc.id)}
                                  className="text-gray-400 hover:text-red-500 transition-colors shrink-0">
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                            <div className="px-3 pb-2.5 bg-white">
                              <DocCommentThread
                                workspaceId={workspaceId}
                                taskId={task.id}
                                submissionId={sub.id}
                                docId={doc.id}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {canSubmit && (
                  <div className="mt-4 p-4 bg-primary-50 border border-primary-100 rounded-xl space-y-3">
                    <p className="text-[13px] text-primary-700 font-medium">{isResubmit ? 'Ready to resubmit?' : 'Ready to hand in?'}</p>
                    {(task.self_assess_questions ?? []).length > 0 && (
                      <SelfAssessmentForm
                        questions={task.self_assess_questions!}
                        values={selfAssess}
                        onChange={(qId, rating) => setSelfAssess(prev => ({ ...prev, [qId]: rating }))}
                      />
                    )}
                    <div>
                      <label className="block text-[11px] font-semibold text-primary-600 uppercase tracking-widest mb-1">
                        Cover note <span className="font-normal normal-case text-primary-400">(optional)</span>
                      </label>
                      <textarea rows={2} value={submitNote} onChange={e => setSubmitNote(e.target.value)}
                        placeholder="Anything you'd like your mentor to know…"
                        className="w-full px-3 py-2 text-[12.5px] border border-primary-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white placeholder-primary-300" />
                    </div>
                    <button onClick={handleSubmit} disabled={acting}
                      className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-[13px] font-semibold rounded-xl transition-colors">
                      {acting ? 'Submitting…' : isResubmit ? 'Resubmit' : 'Submit'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {sub && sub.status_events.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[14px] font-bold text-gray-900">Recent Activity</p>
                  <button onClick={() => setTab('activity')}
                    className="text-[12px] text-primary-600 hover:text-primary-800 font-medium flex items-center gap-0.5">
                    View all activity <ChevronRight size={13} />
                  </button>
                </div>
                <div className="space-y-3">
                  {sub.status_events.slice(0, 3).map(ev => (
                    <div key={ev.id} className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        ev.to_status === 'completed'      ? 'bg-green-100' :
                        ev.to_status === 'submitted' || ev.to_status === 'resubmitted' ? 'bg-indigo-100' :
                        ev.to_status === 'needs_revision' ? 'bg-orange-100' : 'bg-gray-100'
                      }`}>
                        {ev.to_status === 'completed'                              ? <Check size={12} className="text-green-600" /> :
                         ev.to_status === 'submitted' || ev.to_status === 'resubmitted' ? <Send size={11} className="text-indigo-600" /> :
                         <Clock size={11} className="text-gray-400" />}
                      </div>
                      <p className="flex-1 text-[12.5px] text-gray-700">
                        {ev.to_status === 'submitted'      ? 'You submitted this task' :
                         ev.to_status === 'resubmitted'    ? 'You resubmitted this task' :
                         ev.to_status === 'completed'      ? `${ev.actor ? (ev.actor.first_name || ev.actor.username) : 'Mentor'} marked as complete` :
                         ev.to_status === 'needs_revision' ? `${ev.actor ? (ev.actor.first_name || ev.actor.username) : 'Mentor'} requested revision` :
                         ev.to_status === 'in_progress'    ? 'Started working' :
                         ev.to_status.replace(/_/g, ' ')}
                      </p>
                      <span className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap">
                        {new Date(ev.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        {', '}
                        {new Date(ev.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4 self-start lg:sticky lg:top-6">
            {sub && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-[13px] font-bold text-gray-900 mb-3">Submission Snapshot</p>
                <div className="flex items-center gap-4">
                  <StudentDonutChart completed={checksDone} inProgress={inProgress} pct={pct} size={110} stroke={16} />
                  <div className="space-y-2">
                    {[
                      { label: 'Completed',   value: checksDone,  color: 'bg-green-500' },
                      { label: 'In Progress', value: inProgress,  color: 'bg-primary-500' },
                      { label: 'Not Started', value: 0,           color: 'bg-gray-300' },
                    ].map(s => (
                      <div key={s.label} className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.color}`} />
                        <span className="text-[12px] text-gray-600 flex-1">{s.label}</span>
                        <span className="text-[12px] font-bold text-gray-800">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {effectiveDue && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[13px] font-bold text-gray-900">Upcoming</p>
                  <span className="text-[12px] text-primary-600 font-medium">View all</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Calendar size={15} className={`shrink-0 mt-0.5 ${daysLeft?.overdue ? 'text-red-500' : 'text-orange-500'}`} />
                  <div>
                    {daysLeft && (
                      <p className={`text-[12.5px] font-semibold ${daysLeft.overdue ? 'text-red-600' : 'text-orange-500'}`}>
                        {daysLeft.overdue ? daysLeft.text : `Due in ${daysLeft.text}`}
                      </p>
                    )}
                    <p className="text-[12px] text-gray-500">
                      {fmt(effectiveDue)}
                      {isDueExtended && <span className="ml-1 text-orange-500">(extended)</span>}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-[13px] font-bold text-gray-900 mb-2">Quick Actions</p>
              <div className="space-y-0.5">
                {task.rubric_criteria.length > 0 && (
                  <button
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-left transition-colors text-[13px] text-gray-700">
                    <Award size={15} className="text-gray-400 shrink-0" />
                    View Rubric
                  </button>
                )}
                <Link to={`/w/${slug}/chat`}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-[13px] text-gray-700">
                  <MessageSquare size={15} className="text-gray-400 shrink-0" />
                  Ask Mentor
                </Link>
                <Link to={`/w/${slug}/chat`}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-[13px] text-gray-700">
                  <Users size={15} className="text-gray-400 shrink-0" />
                  Discussion
                </Link>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-[13px] font-bold text-gray-900 mb-1">Need Help?</p>
              <p className="text-[12px] text-gray-500 mb-3">Stuck on this task? Reach out to your mentor for guidance.</p>
              <Link to={`/w/${slug}/chat`}
                className="flex items-center justify-center gap-2 w-full py-2.5 border border-primary-300 text-primary-700 text-[13px] font-semibold rounded-xl hover:bg-primary-50 transition-colors">
                <Send size={13} />
                Message Mentor
              </Link>
            </div>
          </div>
        </div>

        {/* Full-width Comments on overview */}
        {sub && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/60">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary-100 rounded-xl flex items-center justify-center">
                  <MessageSquare size={15} className="text-primary-600" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-gray-900">Comments</p>
                  <p className="text-[11px] text-gray-400">
                    {sub.comments.length > 0
                      ? `${sub.comments.length} message${sub.comments.length !== 1 ? 's' : ''}`
                      : 'Start the conversation'}
                  </p>
                </div>
              </div>
              {sub.comments.length > 5 && (
                <button onClick={() => setTab('comments')}
                  className="text-[12px] text-primary-600 font-semibold flex items-center gap-0.5 px-3 py-1.5 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors">
                  View all {sub.comments.length} <ChevronRight size={13} />
                </button>
              )}
            </div>
            <div className="px-6 py-5 space-y-4">
              {sub.comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
                    <MessageSquare size={22} className="text-gray-300" />
                  </div>
                  <p className="text-[13.5px] font-semibold text-gray-500 mb-1">No comments yet</p>
                  <p className="text-[12px] text-gray-400">Start the conversation with your mentor below.</p>
                </div>
              ) : (
                sub.comments.slice(-5).map(c => {
                  const isMentor    = c.author.username === task.created_by?.username;
                  const displayName = c.author.first_name
                    ? `${c.author.first_name} ${c.author.last_name || ''}`.trim()
                    : c.author.username;
                  const initials = (c.author.first_name?.[0] ?? c.author.username[0]).toUpperCase();
                  return (
                    <div key={c.id} className="flex gap-3.5">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[13px] font-bold ${
                        isMentor ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`rounded-2xl rounded-tl-sm px-4 py-3 ${
                          isMentor ? 'bg-primary-50 border border-primary-100' : 'bg-gray-50 border border-gray-100'
                        }`}>
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-[12px] font-bold text-gray-900">{displayName}</span>
                            {isMentor && (
                              <span className="px-1.5 py-0.5 bg-primary-100 text-primary-600 text-[9.5px] font-bold uppercase tracking-wide rounded">
                                Mentor
                              </span>
                            )}
                            <span className="text-[10.5px] text-gray-400 ml-auto whitespace-nowrap">
                              {new Date(c.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                              {' · '}
                              {new Date(c.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[13px] text-gray-700 leading-relaxed">{c.text}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="px-6 pb-5 pt-1">
              <div className="bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-primary-300 focus-within:bg-white transition-colors">
                <MentionTextarea
                  value={comment}
                  onChange={setComment}
                  workspaceId={workspaceId}
                  placeholder="Write a comment to your mentor…"
                  rows={2}
                  className="w-full px-4 pt-3 pb-1 text-[13px] bg-transparent focus:outline-none resize-none block"
                />
                <div className="flex justify-end px-3 pb-3">
                  <button
                    onClick={postComment}
                    disabled={posting || !comment.trim()}
                    className="p-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white rounded-xl transition-colors">
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        </div>
      )}

      {/* ── My Submission tab ── */}
      {!loading && tab === 'submission' && (
        <div>
          {!sub ? (
            <p className="text-[13px] text-gray-400 py-8 text-center">Submission not found.</p>
          ) : (
            <div className="space-y-5">
              <div className={`p-4 rounded-xl border ${
                sub.status === 'completed'      ? 'bg-green-50 border-green-100' :
                sub.status === 'needs_revision' ? 'bg-orange-50 border-orange-100' :
                (sub.status === 'submitted' || sub.status === 'resubmitted') ? 'bg-indigo-50 border-indigo-100' :
                'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <StatusPill s={sub.status} />
                  {sub.effective_late && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full uppercase">Late</span>}
                  {sub.effective_due_date && (
                    <span className="text-[11px] text-gray-500 flex items-center gap-1">
                      <Calendar size={10} /> Due {fmt(sub.effective_due_date)}
                      {sub.due_date_override && <span className="ml-1 text-amber-600 font-medium">(extended)</span>}
                    </span>
                  )}
                </div>
                <p className="text-[12.5px] text-gray-600">
                  {sub.status === 'completed'      && 'Your submission has been marked complete.'}
                  {sub.status === 'needs_revision' && 'Your mentor requested changes. Review the feedback and resubmit.'}
                  {(sub.status === 'submitted' || sub.status === 'resubmitted') && 'Submitted — awaiting mentor review.'}
                  {sub.status === 'in_progress'    && "You've started working on this task."}
                  {sub.status === 'not_started'    && 'Check off deliverables as you complete them, then submit.'}
                </p>
              </div>

              {sub.rubric_scores.length > 0 && (
                <div className="p-4 bg-violet-50 border border-violet-100 rounded-xl">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-500 mb-1 flex items-center gap-1.5">
                    <Award size={11} /> Your Score
                  </p>
                  <p className="text-[22px] font-bold text-violet-700">{sub.total_score} / {sub.max_score}</p>
                  <div className="mt-1.5 space-y-1">
                    {sub.rubric_scores.map(rs => (
                      <div key={rs.id} className="flex items-center justify-between text-[12px]">
                        <span className="text-gray-600">{rs.criteria.title}</span>
                        <span className="font-semibold text-gray-800">{rs.points} / {rs.criteria.max_points}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sub.checks.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Deliverables</p>
                  <div className="space-y-2">
                    {sub.checks.map(c => (
                      <button key={c.id} onClick={() => toggleCheck(c.id)}
                        disabled={sub.status === 'completed'}
                        className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all disabled:cursor-default ${
                          c.is_done ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 hover:border-primary-300 text-gray-700'
                        }`}>
                        <span className="shrink-0 mt-0.5">
                          {c.is_done ? <CheckCircle size={15} className="text-green-500" /> : <Circle size={15} className="text-gray-300" />}
                        </span>
                        <div>
                          <p className={`text-[13px] font-medium ${c.is_done ? 'line-through text-green-600' : ''}`}>{c.deliverable.title}</p>
                          {c.deliverable.description && <p className="text-[11.5px] text-gray-400 mt-0.5">{c.deliverable.description}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Documents</p>
                {sub.status !== 'completed' && (
                  <div
                    className="border-2 border-dashed border-gray-200 rounded-lg px-4 py-2.5 flex items-center gap-3 cursor-pointer hover:border-primary-300 hover:bg-primary-50/30 transition-colors mb-3"
                    onClick={() => fileRef.current?.click()}>
                    <UploadCloud size={18} className="shrink-0 text-primary-400" />
                    <div className="flex-1 text-left">
                      <p className="text-[12px] font-semibold text-gray-700 leading-tight">Upload your files here</p>
                      <p className="text-[10.5px] text-gray-400 leading-tight">PDF, DOCX, PPTX, ZIP · Max 10MB</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); fileRef.current?.click(); }} disabled={uploading}
                      className="shrink-0 px-4 py-1 bg-primary-600 hover:bg-primary-700 text-white text-[11.5px] font-semibold rounded-md transition-colors disabled:opacity-50">
                      {uploading ? 'Uploading…' : 'Choose Files'}
                    </button>
                  </div>
                )}
                {sub.documents.length > 0 ? (
                  <div className="space-y-2">
                    {sub.documents.map(doc => {
                      const ext = doc.file_url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
                      const isPdf = ext === 'pdf';
                      const isStudentUpload = doc.uploaded_by.id === sub.student.user.id;
                      return (
                        <div key={doc.id} className="border border-gray-100 rounded-xl overflow-hidden">
                          <div className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isPdf ? 'bg-red-500' : 'bg-primary-500'}`}>
                              <FileText size={16} className="text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <a href={doc.file_url} target="_blank" rel="noreferrer"
                                  className="text-[13px] font-semibold text-gray-800 hover:text-primary-600 truncate">
                                  {doc.title}
                                </a>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                                  isStudentUpload ? 'bg-primary-50 text-primary-600' : 'bg-purple-50 text-purple-600'
                                }`}>
                                  {isStudentUpload ? 'You' : 'Mentor'}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-400">Uploaded on {fmt(doc.created_at)}</p>
                            </div>
                            {sub.status !== 'completed' && isStudentUpload && (
                              <button onClick={() => setDeleteConfirmId(doc.id)}
                                className="text-gray-400 hover:text-red-500 transition-colors shrink-0">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                          <div className="px-3 pb-2.5 bg-white">
                            <DocCommentThread
                              workspaceId={workspaceId}
                              taskId={task.id}
                              submissionId={sub.id}
                              docId={doc.id}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  sub.status === 'completed' && <p className="text-[12px] text-gray-400">No files attached.</p>
                )}
              </div>

              {canSubmit && (
                <div className="p-4 bg-primary-50 border border-primary-100 rounded-xl space-y-3">
                  <p className="text-[13px] text-primary-700 font-medium">{isResubmit ? 'Ready to resubmit?' : 'Ready to hand in?'}</p>
                  {(task.self_assess_questions ?? []).length > 0 && (
                    <SelfAssessmentForm
                      questions={task.self_assess_questions!}
                      values={selfAssess}
                      onChange={(qId, rating) => setSelfAssess(prev => ({ ...prev, [qId]: rating }))}
                    />
                  )}
                  <div>
                    <label className="block text-[11px] font-semibold text-primary-600 uppercase tracking-widest mb-1">
                      Cover note <span className="font-normal normal-case text-primary-400">(optional)</span>
                    </label>
                    <textarea rows={2} value={submitNote} onChange={e => setSubmitNote(e.target.value)}
                      placeholder="Anything you'd like your mentor to know…"
                      className="w-full px-3 py-2 text-[12.5px] border border-primary-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white placeholder-primary-300" />
                  </div>
                  <button onClick={handleSubmit} disabled={acting}
                    className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-[13px] font-semibold rounded-xl transition-colors">
                    {acting ? 'Submitting…' : isResubmit ? 'Resubmit' : 'Submit'}
                  </button>
                </div>
              )}

              <StudentPeerReviewSection
                workspaceId={workspaceId}
                taskId={task.id}
                criteria={task.rubric_criteria ?? []}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Comments tab ── */}
      {!loading && tab === 'comments' && sub && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/60">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-100 rounded-xl flex items-center justify-center">
                <MessageSquare size={15} className="text-primary-600" />
              </div>
              <div>
                <p className="text-[14px] font-bold text-gray-900">Comments</p>
                <p className="text-[11px] text-gray-400">
                  {sub.comments.length > 0
                    ? `${sub.comments.length} message${sub.comments.length !== 1 ? 's' : ''}`
                    : 'Start the conversation'}
                </p>
              </div>
            </div>
          </div>
          <div className="px-6 py-5 space-y-4">
            {sub.comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
                  <MessageSquare size={22} className="text-gray-300" />
                </div>
                <p className="text-[13.5px] font-semibold text-gray-500 mb-1">No comments yet</p>
                <p className="text-[12px] text-gray-400">Start the conversation with your mentor below.</p>
              </div>
            ) : (
              sub.comments.map(c => {
                const isMentor    = c.author.username === task.created_by?.username;
                const displayName = c.author.first_name
                  ? `${c.author.first_name} ${c.author.last_name || ''}`.trim()
                  : c.author.username;
                const initials = (c.author.first_name?.[0] ?? c.author.username[0]).toUpperCase();
                return (
                  <div key={c.id} className="flex gap-3.5">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[13px] font-bold ${
                      isMentor ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`rounded-2xl rounded-tl-sm px-4 py-3 ${
                        isMentor ? 'bg-primary-50 border border-primary-100' : 'bg-gray-50 border border-gray-100'
                      }`}>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-[12px] font-bold text-gray-900">{displayName}</span>
                          {isMentor && (
                            <span className="px-1.5 py-0.5 bg-primary-100 text-primary-600 text-[9.5px] font-bold uppercase tracking-wide rounded">
                              Mentor
                            </span>
                          )}
                          <span className="text-[10.5px] text-gray-400 ml-auto whitespace-nowrap">
                            {new Date(c.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                            {' · '}
                            {new Date(c.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[13px] text-gray-700 leading-relaxed">{c.text}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="px-6 pb-5 pt-1 border-t border-gray-100">
            <div className="bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-primary-300 focus-within:bg-white transition-colors mt-3">
              <MentionTextarea
                value={comment}
                onChange={setComment}
                workspaceId={workspaceId}
                placeholder="Write a comment to your mentor…"
                rows={2}
                className="w-full px-4 pt-3 pb-1 text-[13px] bg-transparent focus:outline-none resize-none block"
              />
              <div className="flex justify-end px-3 pb-3">
                <button
                  onClick={postComment}
                  disabled={posting || !comment.trim()}
                  className="p-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white rounded-xl transition-colors">
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Activity tab ── */}
      {!loading && tab === 'activity' && sub && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center">
                <History size={15} className="text-gray-500" />
              </div>
              <div>
                <p className="text-[14px] font-bold text-gray-900">Activity History</p>
                <p className="text-[11px] text-gray-400">
                  {sub.status_events.length > 0
                    ? `${sub.status_events.length} event${sub.status_events.length !== 1 ? 's' : ''}`
                    : 'No activity yet'}
                </p>
              </div>
            </div>
          </div>
          <div className="px-6 py-5">
            {sub.status_events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
                  <History size={22} className="text-gray-300" />
                </div>
                <p className="text-[13.5px] font-semibold text-gray-500 mb-1">No activity yet</p>
                <p className="text-[12px] text-gray-400">Activity will appear here once you start working on this task.</p>
              </div>
            ) : (
              <RevisionTimeline events={sub.status_events} />
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setDeleteConfirmId(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center gap-4"
            onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-semibold text-gray-900">Delete this file?</p>
              <p className="text-[13px] text-gray-500 mt-1">This action cannot be undone.</p>
            </div>
            <div className="flex gap-3 w-full">
              <button onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[13px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={() => deleteDoc(deleteConfirmId)}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-[13px] font-semibold text-white transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) uploadDoc(f); e.target.value = ''; }} />
    </div>
  );
}
