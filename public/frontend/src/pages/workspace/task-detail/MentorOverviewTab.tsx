import { useState, useMemo } from 'react';
import {
  CheckCircle, Circle, Award, Users, Download, FileText,
  ChevronRight, Check, Send,
} from 'lucide-react';
import { useApi } from '../../../hooks/useApi';
import { workspacesApi } from '../../../api/workspaces';
import type { WorkspaceTask, TaskReport, Gradebook, GradebookCellScore } from '../../../types';
import { MultiSegmentDonut } from '../../../components/workspace/task/MultiSegmentDonut';

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const TYPE_LABEL_MAP: Record<string, string> = { assignment: 'Assignment', project: 'Project', resource: 'Resource', quiz: 'Quiz' };

export function MentorOverviewTab({
  workspaceId, task, workspaceName, onViewSubmissions, onViewReports,
}: {
  workspaceId: number;
  task: WorkspaceTask;
  workspaceName: string;
  onViewSubmissions: () => void;
  onViewReports: () => void;
}) {
  const { data: report }    = useApi<TaskReport>(() => workspacesApi.getTaskReport(workspaceId, task.id), [workspaceId, task.id]);
  const { data: gradebook } = useApi<Gradebook>(() => workspacesApi.getGradebook(workspaceId), [workspaceId]);

  const rubricTotal = (task.rubric_criteria ?? []).reduce((s, c) => s + c.max_points, 0);
  const hasRubric   = rubricTotal > 0;

  const avgScore = useMemo(() => {
    if (!gradebook || !hasRubric) return null;
    const scores = gradebook.rows
      .map(r => r.scores[task.id])
      .filter((s): s is GradebookCellScore => s != null && s.score > 0)
      .map(s => s.score);
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  }, [gradebook, task.id, hasRubric]);

  const counts          = report?.counts;
  const completionPct   = counts?.completion_pct ?? 0;
  const totalStudents   = counts?.total ?? task.submission_count;
  const completedCount  = counts?.completed ?? task.completed_count;
  const inProgressCount = counts?.in_progress ?? 0;
  const submittedCount  = counts?.submitted ?? (task.submitted_count ?? 0);
  const revisionsCount  = counts?.needs_revision ?? 0;
  const notStartedCount = counts?.not_started ?? 0;

  const now      = new Date();
  const isActive = (!task.available_from || new Date(task.available_from) <= now) &&
                   (!task.available_until || new Date(task.available_until) >= now);

  const activityEntries = useMemo(() => {
    if (!report) return [];
    const creatorName = task.created_by
      ? (`${task.created_by.first_name || ''} ${task.created_by.last_name || ''}`.trim() || task.created_by.username)
      : 'Admin';
    type Entry = { label: string; subtitle: string; date: string; type: string };
    const items: Entry[] = [
      { label: 'Task published', subtitle: `by ${creatorName}`, date: task.created_at, type: 'task' },
    ];
    if (task.due_date && task.updated_at !== task.created_at) {
      items.push({ label: `Task due date updated to ${fmtDate(task.due_date)}`, subtitle: '', date: task.updated_at, type: 'info' });
    }
    report.rows.forEach(r => {
      if (r.submitted_at) {
        items.push({ label: `Student ${r.student_name} submitted`, subtitle: '', date: r.submitted_at, type: 'submit' });
      }
      if (r.completed_at && r.status === 'completed') {
        items.push({ label: `${r.student_name} completed`, subtitle: '', date: r.completed_at, type: 'complete' });
      }
    });
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [report, task.created_by, task.created_at, task.due_date, task.updated_at]);

  const [showFullDesc, setShowFullDesc] = useState(false);
  const descLong   = (task.description?.length ?? 0) > 220;
  const displayDesc = descLong && !showFullDesc
    ? (task.description ?? '').slice(0, 220) + '…'
    : (task.description ?? '');

  const statusDonutSegs = [
    { value: completedCount,  color: '#22c55e' },
    { value: inProgressCount, color: '#cf6535' },
    { value: submittedCount,  color: '#818cf8' },
    { value: revisionsCount,  color: '#f97316' },
    { value: notStartedCount, color: '#d1d5db' },
  ];

  return (
    <div className="space-y-6">
      {/* 4 stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <p className="text-[12.5px] font-bold text-gray-700">Task Status</p>
          <div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] font-bold ${
              task.status === 'published' ? 'bg-green-100 text-green-700' :
              task.status === 'draft'     ? 'bg-gray-100 text-gray-600' :
              'bg-red-100 text-red-600'
            }`}>
              {task.status === 'published' ? <CheckCircle size={11} /> : <Circle size={11} />}
              {task.status === 'published' ? 'Published' : task.status === 'draft' ? 'Draft' : 'Archived'}
            </span>
          </div>
          {task.status === 'published' && (
            <p className="text-[12px] text-gray-500">
              Visible to students in <span className="font-semibold text-gray-800">{workspaceName}</span>
            </p>
          )}
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10.5px] font-semibold ${
            isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
          <p className="text-[11px] text-gray-400">Last updated: {fmtDate(task.updated_at)}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-[12.5px] font-bold text-gray-700 mb-1">Submissions Overview</p>
          <p className="text-[30px] font-black text-gray-900 leading-none">{totalStudents}</p>
          <p className="text-[11px] text-gray-400 mb-4">Total Submissions</p>
          <div className="grid grid-cols-2 gap-y-2 gap-x-3">
            {[
              { val: inProgressCount, label: 'In Progress',    cls: 'text-primary-600' },
              { val: submittedCount,  label: 'Submitted',      cls: 'text-indigo-500' },
              { val: revisionsCount,  label: 'Needs Revision', cls: 'text-orange-500' },
              { val: completedCount,  label: 'Completed',      cls: 'text-green-600' },
            ].map(s => (
              <div key={s.label}>
                <span className={`text-[18px] font-bold ${s.cls}`}>{s.val}</span>
                <p className="text-[10.5px] text-gray-400 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-[12.5px] font-bold text-gray-700 mb-3">Completion Rate</p>
          <div className="flex items-center gap-4">
            <MultiSegmentDonut
              segments={[
                { value: completedCount, color: '#22c55e' },
                { value: totalStudents - completedCount, color: '#e5e7eb' },
              ]}
              centerLabel={`${completionPct}%`}
              size={80}
              stroke={12}
            />
            <div className="min-w-0">
              <p className="text-[13.5px] font-bold text-gray-900">{completionPct}%</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{completedCount} / {totalStudents} students completed</p>
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden w-24">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${completionPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-[12.5px] font-bold text-gray-700 mb-1">Average Score</p>
          {hasRubric ? (
            <>
              <div className="flex items-baseline gap-1">
                <span className="text-[30px] font-black text-gray-900 leading-none">
                  {avgScore !== null ? avgScore : '—'}
                </span>
                <span className="text-[14px] font-semibold text-gray-400">/ {rubricTotal}</span>
              </div>
              <p className="text-[11px] text-gray-400 mb-3">Average Score</p>
              <div className="flex items-end gap-0.5 h-8 mt-auto">
                {[40, 55, 48, 70, 62, 85].map((h, i) => (
                  <div key={i} className="flex-1 bg-emerald-200 rounded-sm" style={{ height: `${h}%` }} />
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-20 text-gray-300">
              <Award size={22} className="mb-1" />
              <p className="text-[11px] text-gray-400">No rubric</p>
            </div>
          )}
        </div>
      </div>

      {/* 2-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">

        <div className="space-y-4">
          {task.description && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-[14px] font-bold text-gray-900 mb-2">Description</p>
              <p className="text-[13.5px] text-gray-600 leading-relaxed">{displayDesc}</p>
              {descLong && (
                <button onClick={() => setShowFullDesc(v => !v)}
                  className="mt-2 text-[13px] font-semibold text-primary-600 hover:text-primary-800 transition-colors">
                  {showFullDesc ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          )}

          {task.deliverables.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-[14px] font-bold text-gray-900 mb-3">Deliverables ({task.deliverables.length})</p>
              <div className="space-y-2">
                {task.deliverables.map(d => (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
                    <FileText size={15} className="text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-semibold text-gray-800">{d.title}</p>
                      {d.description && <p className="text-[11.5px] text-gray-400 mt-0.5">{d.description}</p>}
                    </div>
                    <span className="shrink-0 px-2.5 py-1 bg-violet-100 text-violet-700 text-[11px] font-bold rounded-lg">Required</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasRubric && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-[14px] font-bold text-gray-900 mb-3">Rubric ({rubricTotal} pts total)</p>
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-left">
                      <th className="px-4 py-2.5 font-semibold">Criteria</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {task.rubric_criteria.map(c => (
                      <tr key={c.id} className="border-t border-gray-100">
                        <td className="px-4 py-2.5">
                          <p className="font-semibold text-gray-800">{c.title}</p>
                          {c.description && <p className="text-[11px] text-gray-400 mt-0.5">{c.description}</p>}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-gray-600">{c.max_points} pts</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={onViewSubmissions}
                className="mt-3 flex items-center gap-1 text-[12.5px] font-semibold text-primary-600 hover:text-primary-800 transition-colors">
                View full rubric <ChevronRight size={13} />
              </button>
            </div>
          )}

          {activityEntries.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[14px] font-bold text-gray-900">Recent Activity</p>
                <button onClick={onViewReports}
                  className="text-[12px] text-primary-600 font-semibold flex items-center gap-0.5 hover:text-primary-800 transition-colors">
                  View all activity <ChevronRight size={13} />
                </button>
              </div>
              <div className="space-y-3">
                {activityEntries.slice(0, 3).map((ev, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      ev.type === 'complete' ? 'bg-green-100' :
                      ev.type === 'submit'   ? 'bg-indigo-100' :
                      'bg-primary-100'
                    }`}>
                      {ev.type === 'complete' ? <Check size={12} className="text-green-600" /> :
                       ev.type === 'submit'   ? <Send size={11} className="text-indigo-600" /> :
                       <FileText size={11} className="text-primary-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] text-gray-700">{ev.label}</p>
                      {ev.subtitle && <p className="text-[11px] text-gray-400">{ev.subtitle}</p>}
                    </div>
                    <span className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap">
                      {fmtDate(ev.date)}{', '}
                      {new Date(ev.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-[13px] font-bold text-gray-900 mb-4">Task Information</p>
            <div className="space-y-3">
              {[
                { label: 'Type',         value: TYPE_LABEL_MAP[task.task_type] ?? task.task_type },
                { label: 'Total Points', value: rubricTotal > 0 ? `${rubricTotal} pts` : '—' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-[12px] text-gray-500">{row.label}</span>
                  <span className="text-[12.5px] font-medium text-gray-800">{row.value}</span>
                </div>
              ))}
              {hasRubric && (
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-gray-500">Rubric</span>
                  <button onClick={onViewSubmissions} className="text-[12.5px] font-semibold text-primary-600 hover:text-primary-800">
                    {task.rubric_criteria.length} criteria
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-gray-500">Workspace</span>
                <span className="text-[12.5px] font-semibold text-primary-600">{workspaceName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-gray-500">Allow Late Submission</span>
                <span className="text-[12.5px] font-medium text-gray-800">{task.late_policy !== 'reject' ? 'Yes' : 'No'}</span>
              </div>
              {task.late_policy === 'penalty' && (
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-gray-500">Late Penalty</span>
                  <span className="text-[12.5px] font-medium text-gray-800">10% per day</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-gray-500">Max File Upload</span>
                <span className="text-[12.5px] font-medium text-gray-800">10 MB</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-gray-500">Time Limit</span>
                <span className="text-[12.5px] font-medium text-gray-800">No limit</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-[13px] font-bold text-gray-900 mb-4">Submissions by Status</p>
            <div className="flex items-center gap-4">
              <MultiSegmentDonut segments={statusDonutSegs} centerLabel={String(totalStudents)} size={90} stroke={13} />
              <div className="space-y-1.5 flex-1 min-w-0">
                {[
                  { color: 'bg-green-500',    label: 'Completed',      val: completedCount },
                  { color: 'bg-primary-500',  label: 'In Progress',    val: inProgressCount },
                  { color: 'bg-indigo-400',   label: 'Submitted',      val: submittedCount },
                  { color: 'bg-orange-500',   label: 'Needs Revision', val: revisionsCount },
                  { color: 'bg-gray-300',     label: 'Not Started',    val: notStartedCount },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${s.color}`} />
                    <span className="text-[11px] text-gray-600 flex-1 truncate">{s.label}</span>
                    <span className="text-[11px] font-bold text-gray-800">{s.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-[13px] font-bold text-gray-900 mb-3">Quick Actions</p>
            <div className="space-y-0.5">
              <button onClick={onViewSubmissions}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left transition-colors">
                <div className="w-7 h-7 bg-primary-50 rounded-lg flex items-center justify-center shrink-0">
                  <Users size={14} className="text-primary-600" />
                </div>
                <span className="text-[13px] text-gray-700 font-medium">View Submissions</span>
              </button>
              {hasRubric && (
                <button onClick={onViewSubmissions}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left transition-colors">
                  <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center shrink-0">
                    <Award size={14} className="text-violet-600" />
                  </div>
                  <span className="text-[13px] text-gray-700 font-medium">View Rubric</span>
                </button>
              )}
              <a href={workspacesApi.exportTaskReport(workspaceId, task.id)} download
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left transition-colors">
                <div className="w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                  <Download size={14} className="text-green-600" />
                </div>
                <span className="text-[13px] text-gray-700 font-medium">Export Submissions</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
