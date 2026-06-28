import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, List, LayoutGrid,
  ChevronLeft, ChevronRight,
  BarChart2, AlertTriangle,
  TableProperties, Search, X,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { useApiList } from '../../hooks/useApi';
import { workspacesApi } from '../../api/workspaces';
import type { WorkspaceTask, WorkspaceTaskType, WorkspaceTaskSection } from '../../types';
import CreateTaskModal from '../../components/ui/CreateTaskModal';

import { ConfirmDialog }        from './tasks/ConfirmDialog';
import { BoardCard }            from './tasks/BoardCard';
import { MentorStatsStrip, StudentStatsStrip } from './tasks/TaskStatsStrip';
import { TableHeader, MentorTableRow, StudentTableRow, SectionGroup } from './tasks/TaskRows';
import { TaskOverviewPanel, UpcomingDeadlinesPanel, RecentActivityPanel, QuickActionsPanel } from './tasks/TaskSidebarPanels';

const PAGE_SIZE = 10;

type ViewMode = 'list' | 'board';
type StatusFilter = 'all' | 'draft' | 'published' | 'archived';

export default function WorkspaceTasksPage() {
  const { workspace, isOwner, isMentor } = useWorkspace();
  const { user } = useAuth();
  const [view, setView]         = useState<ViewMode>('list');
  const [filter, setFilter]     = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<WorkspaceTaskType | 'all'>('all');
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());

  const [editTask,       setEditTask]       = useState<WorkspaceTask | null>(null);
  const [confirmAction,  setConfirmAction]  = useState<{
    type: 'archive' | 'unarchive' | 'publish' | 'delete';
    task: WorkspaceTask;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError,   setActionError]   = useState('');

  const workspaceId = workspace?.id ?? 0;
  const { data: tasks, refetch } = useApiList<WorkspaceTask>(
    () => workspacesApi.getTasks(workspaceId), [workspaceId],
  );
  const { data: sections } = useApiList<WorkspaceTaskSection>(
    () => workspacesApi.getSections(workspaceId), [workspaceId],
  );

  if (!workspace) return null;

  const handleConfirm = async () => {
    if (!confirmAction) return;
    setActionLoading(true); setActionError('');
    try {
      const { type, task } = confirmAction;
      if (type === 'delete') {
        await workspacesApi.deleteTask(workspaceId, task.id);
      } else if (type === 'archive') {
        await workspacesApi.updateTask(workspaceId, task.id, { status: 'archived' });
      } else if (type === 'unarchive') {
        await workspacesApi.updateTask(workspaceId, task.id, { status: 'draft' });
      } else if (type === 'publish') {
        await workspacesApi.publishTask(workspaceId, task.id, 'all');
      }
      await refetch();
      setConfirmAction(null);
    } catch {
      setActionError('Action failed. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = useMemo(() => tasks.filter(t => {
    if (filter !== 'all' && t.status !== filter) return false;
    if (typeFilter !== 'all' && t.task_type !== typeFilter) return false;
    if (search.trim() && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [tasks, filter, typeFilter, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSection = (id: number) =>
    setCollapsedSections(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const sectionGroups: { section: WorkspaceTaskSection | null; tasks: WorkspaceTask[] }[] = [];
  const tasksInSections = new Set<number>();
  sections.forEach(sec => {
    const secTasks = paginated.filter(t => t.section === sec.id);
    if (secTasks.length > 0) { sectionGroups.push({ section: sec, tasks: secTasks }); secTasks.forEach(t => tasksInSections.add(t.id)); }
  });
  const unsectioned = paginated.filter(t => !tasksInSections.has(t.id));
  if (unsectioned.length > 0) sectionGroups.push({ section: null, tasks: unsectioned });
  const hasSections = sections.length > 0 && sectionGroups.some(g => g.section !== null);

  const draftCount     = tasks.filter(t => t.status === 'draft').length;
  const publishedCount = tasks.filter(t => t.status === 'published').length;
  const hasActiveFilters = filter !== 'all' || typeFilter !== 'all' || search.trim() !== '';

  const clearFilters = () => { setFilter('all'); setTypeFilter('all'); setSearch(''); setPage(1); };

  return (
    <div className="max-w-7xl">

      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-4">
        <div>
          <h2 className="text-[17px] font-bold text-gray-900">Tasks</h2>
          <p className="text-[12px] text-gray-400 mt-0.5">
            {isOwner
              ? 'Create, assign and track all tasks in your workspace.'
              : isMentor
              ? 'Create and manage tasks for workspace members.'
              : 'View and complete your assigned tasks.'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(isOwner || isMentor) && (
            <Link to={`/w/${workspace.slug}/gradebook`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors shadow-sm">
              <TableProperties size={13} /> Gradebook
            </Link>
          )}
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <button onClick={() => setView('list')}
              className={`p-1.5 transition-colors ${view === 'list' ? 'bg-primary-600 text-white' : 'bg-white text-gray-400 hover:text-gray-700'}`}
              title="List view"><List size={14} /></button>
            <button onClick={() => setView('board')}
              className={`p-1.5 transition-colors ${view === 'board' ? 'bg-primary-600 text-white' : 'bg-white text-gray-400 hover:text-gray-700'}`}
              title="Board view"><LayoutGrid size={14} /></button>
          </div>
          {(isOwner || isMentor) && (
            <button onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-[12.5px] font-semibold rounded-lg transition-colors shadow-sm">
              <Plus size={14} /> New Task
            </button>
          )}
        </div>
      </div>

      {/* Stats strip */}
      {(isOwner || isMentor)
        ? tasks.length > 0 && <MentorStatsStrip tasks={tasks} />
        : tasks.length > 0 && <StudentStatsStrip tasks={tasks} />}

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search tasks…"
            className="w-full pl-7 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white shadow-sm"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
              <X size={12} />
            </button>
          )}
        </div>

        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value as WorkspaceTaskType | 'all'); setPage(1); }}
          className="px-2.5 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white shadow-sm text-gray-600"
        >
          <option value="all">All Types</option>
          <option value="assignment">Assignment</option>
          <option value="project">Project</option>
          <option value="resource">Resource</option>
          <option value="quiz">Quiz</option>
        </select>

        {(isOwner || isMentor) && (
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {(['all', 'published', 'draft', 'archived'] as StatusFilter[]).map(f => (
              <button key={f} onClick={() => { setFilter(f); setPage(1); }}
                className={`px-2.5 py-1 text-[11.5px] font-medium rounded-md transition-colors capitalize ${
                  filter === f ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {f}{f === 'published' ? ` (${publishedCount})` : f === 'draft' ? ` (${draftCount})` : ''}
              </button>
            ))}
          </div>
        )}

        {hasActiveFilters && (
          <button onClick={clearFilters}
            className="flex items-center gap-1 px-2 py-1.5 text-[11.5px] font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={11} /> Clear
          </button>
        )}

        <span className="text-[11px] text-gray-400 ml-auto shrink-0">
          {filtered.length} task{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-4 items-start">

        {/* Main content */}
        <div className="flex-1 min-w-0">

          {filtered.length === 0 && (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm py-14 text-center">
              <BarChart2 size={30} className="text-gray-200 mx-auto mb-3" />
              <p className="text-[14px] font-semibold text-gray-400">
                {hasActiveFilters ? 'No tasks match your filters' : isOwner ? 'No tasks yet' : 'No tasks assigned yet'}
              </p>
              {hasActiveFilters
                ? <button onClick={clearFilters} className="mt-2 text-[12px] text-primary-600 hover:underline">Clear filters</button>
                : isOwner && <p className="text-[12px] text-gray-400 mt-1">Create a task and assign it to your members.</p>}
            </div>
          )}

          {view === 'board' && filtered.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {paginated.map(task => <BoardCard key={task.id} task={task} slug={workspace.slug} isOwner={isOwner || isMentor} />)}
            </div>
          )}

          {view === 'list' && filtered.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
              <TableHeader isOwner={isOwner || isMentor} />
              {hasSections ? (
                sectionGroups.map(g => (
                  <SectionGroup
                    key={g.section?.id ?? 'unsectioned'}
                    section={g.section}
                    tasks={g.tasks}
                    slug={workspace.slug}
                    isOwner={isOwner || isMentor}
                    collapsed={g.section ? collapsedSections.has(g.section.id) : false}
                    onToggle={() => g.section && toggleSection(g.section.id)}
                    showHeader={hasSections}
                    onTaskEdit={setEditTask}
                    onTaskPublish={t => setConfirmAction({ type: 'publish', task: t })}
                    onTaskArchive={t => setConfirmAction({ type: t.status === 'archived' ? 'unarchive' : 'archive', task: t })}
                    onTaskDelete={t => setConfirmAction({ type: 'delete', task: t })}
                    canEditTask={t => isOwner || t.created_by?.id === user?.id}
                  />
                ))
              ) : (
                paginated.map((task, i) =>
                  (isOwner || isMentor)
                    ? <MentorTableRow key={task.id} task={task} slug={workspace.slug} index={i + 1}
                        onEdit={() => setEditTask(task)}
                        onPublish={() => setConfirmAction({ type: 'publish', task })}
                        onArchive={() => setConfirmAction({ type: task.status === 'archived' ? 'unarchive' : 'archive', task })}
                        onDelete={() => setConfirmAction({ type: 'delete', task })}
                        canEdit={isOwner || task.created_by?.id === user?.id}
                      />
                    : <StudentTableRow key={task.id} task={task} slug={workspace.slug} index={i + 1} />
                )
              )}
            </div>
          )}

          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-3 px-1">
              <span className="text-[11.5px] text-gray-400 tabular-nums">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={13} />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-7 h-7 text-[12px] rounded-lg border transition-colors ${
                        p === page ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}>{p}</button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        {view === 'list' && tasks.length > 0 && (
          <div className="w-72 shrink-0 space-y-3 hidden lg:block">
            <TaskOverviewPanel tasks={tasks} isOwner={isOwner || isMentor} />
            <UpcomingDeadlinesPanel tasks={tasks} slug={workspace.slug} />
            <RecentActivityPanel tasks={tasks} slug={workspace.slug} />
            {isOwner && <QuickActionsPanel tasks={tasks} onCreateTask={() => setCreateOpen(true)} />}
          </div>
        )}
      </div>

      {createOpen && (
        <CreateTaskModal
          workspaceId={workspace.id}
          existingTasks={tasks}
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); refetch(); }}
        />
      )}

      {editTask && (
        <CreateTaskModal
          workspaceId={workspace.id}
          existingTasks={tasks.filter(t => t.id !== editTask.id)}
          initialTask={editTask}
          taskId={editTask.id}
          onClose={() => setEditTask(null)}
          onCreated={() => {}}
          onUpdated={() => { setEditTask(null); refetch(); }}
        />
      )}

      {confirmAction && (
        <ConfirmDialog
          title={
            confirmAction.type === 'delete'    ? 'Delete task?' :
            confirmAction.type === 'archive'   ? 'Archive task?' :
            confirmAction.type === 'unarchive' ? 'Unarchive task?' :
            'Publish task?'
          }
          message={
            confirmAction.type === 'delete'
              ? `"${confirmAction.task.title}" and all its submissions will be permanently deleted. This cannot be undone.`
              : confirmAction.type === 'archive'
              ? `"${confirmAction.task.title}" will be archived and hidden from students.`
              : confirmAction.type === 'unarchive'
              ? `"${confirmAction.task.title}" will be moved back to draft.`
              : `"${confirmAction.task.title}" will be published and assigned to all workspace members.`
          }
          confirmLabel={
            confirmAction.type === 'delete'    ? 'Delete' :
            confirmAction.type === 'archive'   ? 'Archive' :
            confirmAction.type === 'unarchive' ? 'Unarchive' :
            'Publish'
          }
          variant={confirmAction.type === 'delete' ? 'danger' : 'warning'}
          loading={actionLoading}
          onConfirm={handleConfirm}
          onCancel={() => { setConfirmAction(null); setActionError(''); }}
        />
      )}

      {actionError && (
        <div className="fixed bottom-4 right-4 z-[80] bg-red-50 border border-red-200 text-red-700 text-[12.5px] font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2">
          <AlertTriangle size={13} />
          {actionError}
          <button onClick={() => setActionError('')} className="ml-1 text-red-400 hover:text-red-600"><X size={12} /></button>
        </div>
      )}
    </div>
  );
}
