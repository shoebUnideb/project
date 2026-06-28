import { useState, useRef, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Send, Calendar, Clock, Users, X,
  Pencil, Copy, GitMerge, LayoutTemplate, Star, ChevronDown, RotateCcw,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useApi } from '../../hooks/useApi';
import { workspacesApi } from '../../api/workspaces';
import apiClient from '../../api/apiClient';
import type { WorkspaceTask, WorkspaceTaskSubmissionSummary } from '../../types';
import CreateTaskModal from '../../components/ui/CreateTaskModal';
import { MentorOverviewTab } from './task-detail/MentorOverviewTab';
import { SubmissionsTab }    from './task-detail/SubmissionsTab';
import { ReportsTab }        from './task-detail/ReportsTab';
import { ActivityLogTab }    from './task-detail/ActivityLogTab';
import { SubmissionDrawer }  from './task-detail/SubmissionDrawer';
import { StudentTaskDetailView } from './task-detail/StudentTaskDetailView';

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const TYPE_LABEL_MAP: Record<string, string> = {
  assignment: 'Assignment', project: 'Project', resource: 'Resource', quiz: 'Quiz',
};
const TYPE_COLOR_MAP: Record<string, string> = {
  assignment: 'bg-violet-100 text-violet-700',
  project:    'bg-primary-100 text-primary-700',
  resource:   'bg-green-100 text-green-700',
  quiz:       'bg-orange-100 text-orange-700',
};

type Tab = 'overview' | 'submissions' | 'reports' | 'activity';

export default function WorkspaceTaskDetailPage() {
  const { taskId }             = useParams<{ taskId: string }>();
  const { workspace, isOwner, isMentor } = useWorkspace();
  const navigate               = useNavigate();

  const workspaceId = workspace?.id ?? 0;
  const { data: task, loading, refetch } = useApi<WorkspaceTask>(
    () => workspacesApi.getTask(workspaceId, Number(taskId)),
    [workspaceId, taskId],
  );

  const [tab, setTab]               = useState<Tab>('overview');
  const [drawerSub, setDrawerSub]   = useState<WorkspaceTaskSubmissionSummary | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [savingTpl, setSavingTpl]   = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [triggeringPR, setTriggeringPR] = useState(false);
  const [editingTask, setEditingTask]   = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const moreActionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreActionsOpen) return;
    const h = (e: MouseEvent) => {
      if (!moreActionsRef.current?.contains(e.target as Node)) setMoreActionsOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [moreActionsOpen]);

  if (loading) return <p className="text-[13px] text-gray-400 py-20 text-center">Loading…</p>;
  if (!task || !workspace) return <p className="text-[13px] text-gray-400 py-20 text-center">Task not found.</p>;

  if (!isOwner && !isMentor) return <StudentTaskDetailView workspaceId={workspaceId} task={task} />;

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.publishTask(workspaceId, task.id, 'all');
      refetch();
    } finally { setPublishing(false); }
  };

  const handleArchive = async () => {
    await apiClient.initCsrf();
    await workspacesApi.updateTask(workspaceId, task.id, { status: 'archived' });
    refetch();
  };

  const handleUnarchive = async () => {
    await apiClient.initCsrf();
    await workspacesApi.updateTask(workspaceId, task.id, { status: 'draft' });
    refetch();
  };

  const handleSaveAsTemplate = async () => {
    setSavingTpl(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.saveAsTemplate(workspaceId, task.id);
      alert('Saved as template! You can now load it from the "Load Template" button when creating a new task.');
    } catch {
      alert('Failed to save as template.');
    } finally { setSavingTpl(false); }
  };

  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      await apiClient.initCsrf();
      const newTask = await workspacesApi.duplicateTask(workspaceId, task.id);
      navigate(`/w/${workspace.slug}/tasks/${newTask.id}`);
    } catch {
      alert('Failed to duplicate task.');
    } finally { setDuplicating(false); }
  };

  const handleTriggerPeerReview = async () => {
    setTriggeringPR(true);
    try {
      await apiClient.initCsrf();
      const result = await workspacesApi.triggerPeerReview(workspaceId, task.id);
      alert(`Peer review triggered. ${result.assigned} assignments created.`);
      refetch();
    } catch {
      alert('Failed to trigger peer review. Make sure submitted students have enough peers.');
    } finally { setTriggeringPR(false); }
  };

  const creatorName = task.created_by
    ? (`${task.created_by.first_name || ''} ${task.created_by.last_name || ''}`.trim() || task.created_by.username)
    : null;

  return (
    <div className="max-w-[1200px]">
      <Link to={`/w/${workspace.slug}/tasks`}
        className="inline-flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-gray-800 mb-5">
        <ArrowLeft size={14} /> Back to Tasks
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-widest ${TYPE_COLOR_MAP[task.task_type] ?? 'bg-gray-100 text-gray-500'}`}>
              {TYPE_LABEL_MAP[task.task_type]}
            </span>
            {task.status !== 'published' && (
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                task.status === 'draft' ? 'bg-gray-100 text-gray-500' : 'bg-red-50 text-red-400'
              }`}>{task.status}</span>
            )}
          </div>
          <h1 className="text-[26px] font-bold text-gray-900 leading-tight">{task.title}</h1>
          {task.description && (
            <p className="text-[13.5px] text-gray-500 mt-1.5 leading-relaxed line-clamp-2">{task.description}</p>
          )}
          <div className="flex items-center gap-7 mt-4 flex-wrap">
            {creatorName && (
              <div className="flex items-center gap-2">
                <Users size={14} className="text-gray-400 shrink-0" />
                <div>
                  <p className="text-[10.5px] text-gray-400 font-medium">Created by</p>
                  <p className="text-[12.5px] font-semibold text-gray-800">{creatorName}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-gray-400 shrink-0" />
              <div>
                <p className="text-[10.5px] text-gray-400 font-medium">Created on</p>
                <p className="text-[12.5px] font-semibold text-gray-800">{fmtDate(task.created_at)}</p>
              </div>
            </div>
            {task.due_date && (
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-gray-400 shrink-0" />
                <div>
                  <p className="text-[10.5px] text-gray-400 font-medium">Due date</p>
                  <p className="text-[12.5px] font-semibold text-gray-800">{fmtDate(task.due_date)}</p>
                </div>
              </div>
            )}
            {task.available_from && (
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-gray-400 shrink-0" />
                <div>
                  <p className="text-[10.5px] text-gray-400 font-medium">Opens</p>
                  <p className="text-[12.5px] font-semibold text-gray-800">{fmtDate(task.available_from)}</p>
                </div>
              </div>
            )}
            {task.available_until && (
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-gray-400 shrink-0" />
                <div>
                  <p className="text-[10.5px] text-gray-400 font-medium">Closes</p>
                  <p className="text-[12.5px] font-semibold text-gray-800">{fmtDate(task.available_until)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0 mt-1 flex-wrap justify-end">
          {task.status !== 'archived' && (
            <button
              onClick={task.status === 'draft' ? handlePublish : undefined}
              disabled={publishing || task.status !== 'draft'}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-colors ${
                task.status === 'draft'
                  ? 'bg-green-600 hover:bg-green-700 text-white disabled:opacity-50'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}>
              <Send size={14} /> {publishing ? 'Publishing…' : task.status === 'published' ? 'Published' : 'Publish'}
            </button>
          )}
          <div ref={moreActionsRef} className="relative">
            <button
              onClick={() => setMoreActionsOpen(v => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[13px] font-semibold transition-colors">
              <Star size={14} /> More Actions
              <ChevronDown size={13} className={`transition-transform ${moreActionsOpen ? 'rotate-180' : ''}`} />
            </button>
            {moreActionsOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden z-50">
                <div className="p-1.5">
                  <button
                    onClick={() => { setEditingTask(true); setMoreActionsOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] text-gray-700 hover:bg-gray-50 transition-colors text-left">
                    <Pencil size={14} className="text-gray-400 shrink-0" /> Edit Task
                  </button>
                  <button
                    onClick={() => { handleDuplicate(); setMoreActionsOpen(false); }}
                    disabled={duplicating}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] text-gray-700 hover:bg-gray-50 transition-colors text-left disabled:opacity-50">
                    <Copy size={14} className="text-gray-400 shrink-0" /> {duplicating ? 'Duplicating…' : 'Duplicate'}
                  </button>
                  <div className="my-1 border-t border-gray-100" />
                  {task.peer_review_enabled && task.status === 'published' && (
                    <button
                      onClick={() => { handleTriggerPeerReview(); setMoreActionsOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] text-gray-700 hover:bg-gray-50 transition-colors text-left">
                      <GitMerge size={14} className="text-violet-500 shrink-0" /> Trigger Peer Review
                    </button>
                  )}
                  <button
                    onClick={() => { handleSaveAsTemplate(); setMoreActionsOpen(false); }}
                    disabled={savingTpl}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] text-gray-700 hover:bg-gray-50 transition-colors text-left disabled:opacity-50">
                    <LayoutTemplate size={14} className="text-primary-500 shrink-0" /> {savingTpl ? 'Saving…' : 'Save as Template'}
                  </button>
                  {(task.status === 'published' || task.status === 'draft') && (
                    <button
                      onClick={() => { handleArchive(); setMoreActionsOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] text-red-600 hover:bg-red-50 transition-colors text-left">
                      <X size={14} className="shrink-0" /> Archive
                    </button>
                  )}
                  {task.status === 'archived' && (
                    <button
                      onClick={() => { handleUnarchive(); setMoreActionsOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] text-amber-600 hover:bg-amber-50 transition-colors text-left">
                      <RotateCcw size={14} className="shrink-0" /> Move to Draft
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {([
          { key: 'overview',    label: 'Overview' },
          { key: 'submissions', label: `Submissions (${task.submission_count})` },
          { key: 'reports',     label: 'Reports' },
          { key: 'activity',    label: 'Activity Log' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <MentorOverviewTab
          workspaceId={workspaceId}
          task={task}
          workspaceName={workspace.name}
          onViewSubmissions={() => setTab('submissions')}
          onViewReports={() => setTab('reports')}
        />
      )}
      {tab === 'submissions' && (
        <SubmissionsTab workspaceId={workspaceId} taskId={task.id} onOpenSubmission={setDrawerSub} />
      )}
      {tab === 'reports' && (
        <ReportsTab workspaceId={workspaceId} taskId={task.id} />
      )}
      {tab === 'activity' && (
        <ActivityLogTab workspaceId={workspaceId} task={task} />
      )}

      {drawerSub && (
        <SubmissionDrawer
          workspaceId={workspaceId}
          taskId={task.id}
          submissionId={drawerSub.id}
          criteria={task.rubric_criteria ?? []}
          onClose={() => setDrawerSub(null)}
          onReviewed={() => { setDrawerSub(null); refetch(); }}
        />
      )}

      {editingTask && (
        <CreateTaskModal
          workspaceId={workspaceId}
          onClose={() => { setEditingTask(false); refetch(); }}
          existingTasks={[]}
          initialTask={task}
          taskId={task.id}
        />
      )}
    </div>
  );
}
