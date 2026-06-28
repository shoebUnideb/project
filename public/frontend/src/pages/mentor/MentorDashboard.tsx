import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import {
  Users, LayoutGrid, CheckCircle, AlertTriangle, TrendingUp,
  Activity, Medal, AlertCircle, BarChart2, Loader2, ChevronDown, X,
  Download, Zap, CalendarDays, Bell, CheckSquare, Clock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApi, useApiList } from '../../hooks/useApi';
import { profilesApi } from '../../api/profiles';
import { workspacesApi } from '../../api/workspaces';
import apiClient from '../../api/apiClient';
import { relativeTime } from '../../utils/time';
import Avatar from '../../components/ui/Avatar';
import CalendarCard from '../../components/ui/CalendarCard';
import SessionsCard from '../../components/sessions/SessionsCard';
import type {
  MentorAnalytics, MentorAnalyticsTrend,
  AnalyticsStudentBar, AnalyticsTaskBreakdown,
  SubmissionStatus, AnalyticsSubmissionLogRow, ReviewQueueItem, UpcomingDeadline,
} from '../../types';
import type { Workspace } from '../../types';

// ── Status colours ────────────────────────────────────────────────────────────

const STATUS_FILL: Record<SubmissionStatus, string> = {
  not_started:    '#9ca3af',
  in_progress:    '#3b82f6',
  submitted:      '#6366f1',
  needs_revision: '#f97316',
  resubmitted:    '#a855f7',
  completed:      '#22c55e',
};
const STATUS_LABEL: Record<SubmissionStatus, string> = {
  not_started:    'Not started',
  in_progress:    'In progress',
  submitted:      'Submitted',
  needs_revision: 'Needs revision',
  resubmitted:    'Resubmitted',
  completed:      'Completed',
};
const STATUSES: SubmissionStatus[] = [
  'not_started', 'in_progress', 'submitted', 'needs_revision', 'resubmitted', 'completed',
];

type Range = '7d' | '30d' | '90d' | 'all';
type Section = 'overview' | 'students' | 'tasks' | 'workspaces' | 'activity';

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function RangeToggle({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="flex items-center gap-0.5 bg-gray-100 rounded-md p-0.5">
      {(['7d', '30d', '90d', 'all'] as Range[]).map(r => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`px-2.5 py-1 text-[10.5px] font-semibold rounded transition-colors ${
            value === r ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          {r === 'all' ? 'All' : r}
        </button>
      ))}
    </div>
  );
}

function SectionCard({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-[13px] font-bold text-gray-900">{title}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-8 text-center text-gray-400 text-[12px]">{message}</div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SubmissionStatus }) {
  const colors: Record<SubmissionStatus, string> = {
    not_started:    'bg-gray-100 text-gray-400',
    in_progress:    'bg-blue-50 text-blue-500',
    submitted:      'bg-indigo-50 text-indigo-500',
    needs_revision: 'bg-orange-50 text-orange-500',
    resubmitted:    'bg-purple-50 text-purple-500',
    completed:      'bg-green-50 text-green-600',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center shrink-0 text-primary-500">
        {icon}
      </div>
      <div>
        <p className="text-[22px] font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-[11.5px] text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-[10.5px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Section: Overview ─────────────────────────────────────────────────────────

function OverviewSection({
  data, trend, trendRange, setTrendRange,
}: {
  data: MentorAnalytics;
  trend: MentorAnalyticsTrend | null;
  trendRange: Range;
  setTrendRange: (r: Range) => void;
}) {
  const { summary, status_distribution, workspace_completion } = data;

  const pieData = status_distribution.map(d => ({
    name: STATUS_LABEL[d.status as SubmissionStatus],
    value: d.count,
    fill: STATUS_FILL[d.status as SubmissionStatus],
  })).filter(d => d.value > 0);

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard label="Students" value={summary.total_students} icon={<Users size={16} />} />
        <KpiCard label="Published tasks" value={summary.total_tasks} icon={<BarChart2 size={16} />} />
        <KpiCard label="Completion rate" value={`${summary.overall_completion_pct}%`} icon={<CheckCircle size={16} />} />
        <KpiCard label="Active this week" value={summary.active_this_week} sub="students with updates" icon={<Zap size={16} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Status donut */}
        <SectionCard title="Task status distribution">
          {pieData.length === 0 ? (
            <EmptyState message="No submission data yet." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [v, 'submissions']} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* Workspace completion */}
        <SectionCard title="Workspace completion">
          {workspace_completion.length === 0 ? (
            <EmptyState message="No workspaces with task data." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={workspace_completion} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="workspace_name" tick={{ fontSize: 10 }} width={90} />
                <Tooltip formatter={(v: number) => [`${v}%`, 'Completion']} />
                <Bar dataKey="completion_pct" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* Submission trend */}
      <SectionCard title="Submission trend">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11.5px] text-gray-400">Submissions over time</p>
          <RangeToggle value={trendRange} onChange={setTrendRange} />
        </div>
        {(trend?.submission_trend ?? []).length === 0 ? (
          <EmptyState message="No submissions in this period." />
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trend!.submission_trend} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={false} name="Submissions" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </SectionCard>
    </div>
  );
}

// ── Section: Students ─────────────────────────────────────────────────────────

function StudentsSection({ data }: { data: MentorAnalytics }) {
  const { student_bars, student_matrix, leaderboard, at_risk } = data;
  const workspaceSlugs = data.summary.workspaces.map(w => w.slug);

  const barData = student_bars.map(s => ({
    name: s.student_name.split(' ')[0],
    fullName: s.student_name,
    ...s,
  }));

  return (
    <div className="space-y-5">
      {/* Per-student stacked bar */}
      <SectionCard title="Student task completion breakdown">
        {barData.length === 0 ? (
          <EmptyState message="No students enrolled yet." />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, barData.length * 36)}>
            <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={70} />
              <Tooltip
                formatter={(v: number, name: string) => [v, STATUS_LABEL[name as SubmissionStatus] ?? name]}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              {STATUSES.filter(s => barData.some(d => (d as unknown as AnalyticsStudentBar)[s] > 0)).map(s => (
                <Bar key={s} dataKey={s} name={STATUS_LABEL[s]} stackId="a" fill={STATUS_FILL[s]} maxBarSize={18} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      {/* Student × Workspace matrix */}
      <SectionCard title="Student × Workspace completion matrix">
        {student_matrix.length === 0 ? (
          <EmptyState message="No data." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-[11.5px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-2 text-gray-500 font-semibold min-w-[130px]">Student</th>
                  {data.summary.workspaces.map(ws => (
                    <th key={ws.slug} className="px-3 py-2 text-center text-gray-500 font-semibold min-w-[110px]">
                      <div className="truncate max-w-[100px] mx-auto" title={ws.name}>{ws.name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {student_matrix.map(row => (
                  <tr key={row.student_id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <Avatar src={row.student_picture ?? undefined} name={row.student_name} size="xs" />
                        <span className="font-medium text-gray-800 truncate max-w-[100px]">{row.student_name}</span>
                      </div>
                    </td>
                    {workspaceSlugs.map(slug => {
                      const cell = row.workspaces[slug];
                      if (!cell || cell.total === 0) {
                        return <td key={slug} className="px-3 py-2 text-center text-gray-300 text-[10px]">—</td>;
                      }
                      const pct = cell.pct;
                      const bg = pct === 100 ? 'bg-green-100 text-green-700'
                        : pct >= 50 ? 'bg-blue-50 text-blue-600'
                        : pct > 0 ? 'bg-orange-50 text-orange-500'
                        : 'bg-gray-100 text-gray-400';
                      return (
                        <td key={slug} className="px-3 py-2 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${bg}`}>
                            {pct}%
                          </span>
                          <div className="text-[9.5px] text-gray-400 mt-0.5">{cell.completed}/{cell.total}</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Leaderboard */}
        <SectionCard title="Leaderboard">
          {leaderboard.length === 0 ? (
            <EmptyState message="No data yet." />
          ) : (
            <table className="min-w-full text-[11.5px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-1.5 px-2 text-gray-400 font-semibold w-8">#</th>
                  <th className="text-left py-1.5 px-2 text-gray-400 font-semibold">Student</th>
                  <th className="text-center py-1.5 px-2 text-gray-400 font-semibold">Done</th>
                  <th className="text-center py-1.5 px-2 text-gray-400 font-semibold">Score</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map(row => (
                  <tr key={row.student_id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2 px-2">
                      <span className={`text-[11px] font-bold ${row.rank <= 3 ? 'text-amber-500' : 'text-gray-400'}`}>
                        {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : `#${row.rank}`}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <Avatar src={row.student_picture ?? undefined} name={row.student_name} size="xs" />
                        <span className="font-medium text-gray-800 truncate max-w-[110px]">{row.student_name}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-center text-gray-600 font-medium">
                      {row.completed_count}<span className="text-gray-400">/{row.total_tasks}</span>
                    </td>
                    <td className="py-2 px-2 text-center text-gray-600 font-medium">
                      {row.max_score > 0 ? (
                        <>{row.total_score}<span className="text-gray-400">/{row.max_score}</span></>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>

        {/* At-risk students */}
        <SectionCard title="At-risk students">
          <p className="text-[11px] text-gray-400 mb-3">In-progress tasks with no activity for 7+ days</p>
          {at_risk.length === 0 ? (
            <div className="py-6 text-center">
              <CheckCircle size={20} className="text-green-300 mx-auto mb-2" />
              <p className="text-[12px] text-gray-400">No at-risk students — great work!</p>
            </div>
          ) : (
            <table className="min-w-full text-[11.5px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-1.5 px-2 text-gray-400 font-semibold">Student</th>
                  <th className="text-center py-1.5 px-2 text-gray-400 font-semibold">Idle</th>
                  <th className="text-center py-1.5 px-2 text-gray-400 font-semibold">Open</th>
                </tr>
              </thead>
              <tbody>
                {at_risk.map(row => (
                  <tr key={row.student_id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <Avatar src={row.student_picture ?? undefined} name={row.student_name} size="xs" />
                        <div>
                          <p className="font-medium text-gray-800 truncate max-w-[110px]">{row.student_name}</p>
                          <p className="text-[10px] text-gray-400 truncate">{row.workspace_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className="text-orange-500 font-semibold">{row.days_since_last_activity}d</span>
                    </td>
                    <td className="py-2 px-2 text-center text-gray-600 font-medium">{row.in_progress_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// ── Section: Tasks ────────────────────────────────────────────────────────────

function TasksSection({ data }: { data: MentorAnalytics }) {
  const { task_breakdown, problem_tasks, low_engagement } = data;

  const taskBarData = task_breakdown.map((t: AnalyticsTaskBreakdown) => ({
    name: t.task_title.length > 16 ? t.task_title.slice(0, 14) + '…' : t.task_title,
    fullTitle: t.task_title,
    workspace: t.workspace_name,
    ...t,
  }));

  const problemBarData = problem_tasks.map(t => ({
    name: t.task_title.length > 16 ? t.task_title.slice(0, 14) + '…' : t.task_title,
    fullTitle: t.task_title,
    revision_pct: t.revision_pct,
    count: t.needs_revision_count,
  }));

  return (
    <div className="space-y-5">
      {/* Task-level progress breakdown */}
      <SectionCard title="Task progress breakdown">
        {taskBarData.length === 0 ? (
          <EmptyState message="No published tasks." />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, taskBarData.length * 36)}>
            <BarChart data={taskBarData} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
              <Tooltip
                formatter={(v: number, name: string) => [v, STATUS_LABEL[name as SubmissionStatus] ?? name]}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              {STATUSES.filter(s => taskBarData.some(d => (d as unknown as AnalyticsTaskBreakdown)[s] > 0)).map(s => (
                <Bar key={s} dataKey={s} name={STATUS_LABEL[s]} stackId="a" fill={STATUS_FILL[s]} maxBarSize={18} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Problem tasks */}
        <SectionCard title="Problem tasks (needs revision %)">
          {problemBarData.length === 0 ? (
            <div className="py-6 text-center">
              <CheckCircle size={20} className="text-green-300 mx-auto mb-2" />
              <p className="text-[12px] text-gray-400">No tasks flagged for revision — all clear!</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, problemBarData.length * 32)}>
              <BarChart data={problemBarData} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                <Tooltip formatter={(v: number) => [`${v}%`, 'Revision rate']} />
                <Bar dataKey="revision_pct" fill="#f97316" radius={[0, 4, 4, 0]} maxBarSize={16} name="Revision %" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* Low engagement */}
        <SectionCard title="Low engagement tasks">
          <p className="text-[11px] text-gray-400 mb-3">Tasks where fewer than 50% of members have started</p>
          {low_engagement.length === 0 ? (
            <div className="py-6 text-center">
              <CheckCircle size={20} className="text-green-300 mx-auto mb-2" />
              <p className="text-[12px] text-gray-400">All tasks have healthy engagement.</p>
            </div>
          ) : (
            <table className="min-w-full text-[11.5px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-1.5 px-2 text-gray-400 font-semibold">Task</th>
                  <th className="text-center py-1.5 px-2 text-gray-400 font-semibold">Started</th>
                  <th className="text-center py-1.5 px-2 text-gray-400 font-semibold">Rate</th>
                </tr>
              </thead>
              <tbody>
                {low_engagement.map(t => (
                  <tr key={t.task_id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2 px-2">
                      <p className="font-medium text-gray-800 truncate max-w-[150px]">{t.task_title}</p>
                      <p className="text-[10px] text-gray-400 truncate">{t.workspace_name}</p>
                    </td>
                    <td className="py-2 px-2 text-center text-gray-600">
                      {t.started_count}<span className="text-gray-400">/{t.total_members}</span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className="text-red-500 font-semibold">{t.engagement_pct}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// ── Section: Workspaces ───────────────────────────────────────────────────────

const LOG_WORKSPACE_COLORS = ['#6366f1', '#22c55e', '#f97316', '#3b82f6', '#a855f7', '#ec4899'];

function WorkspacesSection({
  data, trend, activityRange, setActivityRange,
}: {
  data: MentorAnalytics;
  trend: MentorAnalyticsTrend | null;
  activityRange: Range;
  setActivityRange: (r: Range) => void;
}) {
  const { submission_log } = data;
  const [logSearch, setLogSearch] = useState('');

  const filteredLog = submission_log.filter(r =>
    r.student_name.toLowerCase().includes(logSearch.toLowerCase()) ||
    r.task_title.toLowerCase().includes(logSearch.toLowerCase()) ||
    r.workspace_name.toLowerCase().includes(logSearch.toLowerCase())
  );

  const exportLogCsv = () => {
    const header = ['Student', 'Task', 'Workspace', 'Status', 'Score', 'Last updated'];
    const rows = filteredLog.map(r => [
      r.student_name, r.task_title, r.workspace_name, r.status,
      r.score != null ? String(r.score) : '-',
      new Date(r.updated_at).toLocaleString(),
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'submission-log.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const activityData = trend?.workspace_activity ?? [];

  const allWeeks = Array.from(new Set(activityData.flatMap(ws => ws.data.map(d => d.date)))).sort();
  const normalizedActivity = allWeeks.map(week => {
    const entry: Record<string, string | number> = { week };
    activityData.forEach(ws => {
      const found = ws.data.find(d => d.date === week);
      entry[ws.workspace_name] = found?.count ?? 0;
    });
    return entry;
  });

  return (
    <div className="space-y-5">
      {/* Weekly activity per workspace */}
      <SectionCard title="Weekly activity per workspace">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11.5px] text-gray-400">Submissions per week</p>
          <RangeToggle value={activityRange} onChange={setActivityRange} />
        </div>
        {normalizedActivity.length === 0 ? (
          <EmptyState message="No submissions in this period." />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={normalizedActivity} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" tick={{ fontSize: 9 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              {activityData.map((ws, i) => (
                <Line
                  key={ws.workspace_slug}
                  type="monotone"
                  dataKey={ws.workspace_name}
                  stroke={LOG_WORKSPACE_COLORS[i % LOG_WORKSPACE_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      {/* Submission log */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-[13px] font-bold text-gray-900">Submission log</p>
          <div className="flex items-center gap-2">
            <input
              value={logSearch}
              onChange={e => setLogSearch(e.target.value)}
              placeholder="Filter…"
              className="px-2.5 py-1 text-[11.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 w-32"
            />
            <button
              onClick={exportLogCsv}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Download size={11} /> CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {filteredLog.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-[12px]">No submissions match your filter.</div>
          ) : (
            <table className="min-w-full text-[11.5px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500 min-w-[130px]">Student</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-gray-500 min-w-[140px]">Task</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-gray-500 min-w-[110px]">Workspace</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-gray-500">Status</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-gray-500">Score</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredLog.map((row, idx) => (
                  <tr key={idx} className={`border-b border-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar src={row.student_picture ?? undefined} name={row.student_name} size="xs" />
                        <span className="font-medium text-gray-800 truncate max-w-[100px]">{row.student_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 truncate max-w-[130px]">{row.task_title}</td>
                    <td className="px-3 py-2.5 text-gray-500 truncate max-w-[100px]">{row.workspace_name}</td>
                    <td className="px-3 py-2.5 text-center"><StatusBadge status={row.status} /></td>
                    <td className="px-3 py-2.5 text-center text-gray-600 font-medium">
                      {row.score != null ? row.score : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-400">{relativeTime(row.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface PendingRequest {
  id: number;
  workspace_id: number;
  workspace_name: string;
  student_name: string;
  requested_at: string;
}

interface PendingFeed {
  workspace_requests: PendingRequest[];
}

// ── Activity Section ──────────────────────────────────────────────────────────

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function ActivitySection({
  submissionLog,
  recentActivity,
  reviewQueue,
  deadlines,
}: {
  submissionLog: AnalyticsSubmissionLogRow[];
  recentActivity: NotifItem[];
  reviewQueue: ReviewQueueItem[];
  deadlines: UpcomingDeadline[];
}) {
  const navigate = useNavigate();

  // Group deadlines by workspace
  const deadlinesByWorkspace = deadlines.reduce<Record<string, { name: string; slug: string; tasks: UpcomingDeadline[] }>>(
    (acc, d) => {
      if (!acc[d.workspace_slug]) {
        acc[d.workspace_slug] = { name: d.workspace_name, slug: d.workspace_slug, tasks: [] };
      }
      acc[d.workspace_slug].tasks.push(d);
      return acc;
    },
    {},
  );
  const workspaceGroups = Object.values(deadlinesByWorkspace);

  // Mirrors urgency system used in WorkspaceTasksPage
  function urgencyKey(days: number): 'today' | 'soon' | 'normal' {
    if (days === 0) return 'today';
    if (days <= 5)  return 'soon';
    return 'normal';
  }

  const URGENCY_ROW:  Record<string, string> = { today: 'bg-orange-50 border-orange-200', soon: 'bg-yellow-50 border-yellow-200', normal: 'bg-gray-50 border-gray-200' };
  const URGENCY_TEXT: Record<string, string> = { today: 'text-orange-600', soon: 'text-yellow-700', normal: 'text-gray-500' };
  const URGENCY_DOT:  Record<string, string> = { today: 'bg-orange-400',   soon: 'bg-yellow-400',   normal: 'bg-gray-300' };
  const URGENCY_LABEL: Record<string, (d: number) => string> = {
    today:  () => 'Due today',
    soon:   (d) => d === 1 ? 'Due tomorrow' : `Due in ${d}d`,
    normal: (d) => `Due in ${d}d`,
  };

  return (
    <div className="space-y-5">
      {/* Needs your review — full width, top priority */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <AlertCircle size={14} className={reviewQueue.length > 0 ? 'text-orange-500' : 'text-gray-400'} />
          <p className="text-[13px] font-bold text-gray-900">Needs Your Review</p>
          {reviewQueue.length > 0 ? (
            <span className="ml-1 text-[11px] font-bold text-white bg-orange-500 rounded-full px-2 py-0.5 leading-none">
              {reviewQueue.length}
            </span>
          ) : (
            <span className="text-[11px] text-gray-400 ml-auto">All caught up!</span>
          )}
        </div>
        {reviewQueue.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <CheckCircle size={20} className="text-green-300 mx-auto mb-2" />
            <p className="text-[12.5px] text-gray-500 font-medium">No submissions waiting for review</p>
            <p className="text-[11.5px] text-gray-400 mt-0.5">All student work has been reviewed.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {reviewQueue.map(item => (
              <button
                key={item.submission_id}
                onClick={() => navigate(`/w/${item.workspace_slug}/tasks/${item.task_id}`)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-50/40 transition-colors text-left"
              >
                <Avatar src={item.student_picture ?? undefined} name={item.student_name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-semibold text-gray-800 truncate">{item.student_name}</p>
                  <p className="text-[11.5px] text-gray-600 truncate">{item.task_title}</p>
                  <p className="text-[11px] text-gray-400 truncate">{item.workspace_name}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-500">
                    Submitted
                  </span>
                  {item.submitted_at && (
                    <p className="text-[10.5px] text-gray-400 mt-1">{relativeTime(item.submitted_at)}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Row 1: Calendar + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Calendar — self-fetching, no props */}
        <CalendarCard />

        {/* Recent Activity */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 shrink-0">
            <Bell size={14} className="text-gray-500" />
            <p className="text-[13px] font-bold text-gray-900">Recent Activity</p>
            <span className="text-[11px] text-gray-400 ml-auto">Last 8</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {recentActivity.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell size={18} className="text-gray-200 mx-auto mb-2" />
                <p className="text-[12px] text-gray-400">No recent activity</p>
              </div>
            ) : recentActivity.map(item => {
              const body = item.body ? stripHtml(item.body) : '';
              return (
                <button
                  key={item.id}
                  onClick={() => item.link && navigate(item.link)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${!item.is_read ? 'bg-primary-50/30' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12.5px] font-semibold text-gray-800 leading-snug line-clamp-1 flex-1">{item.title}</p>
                    {!item.is_read && <span className="w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0 mt-1.5" />}
                  </div>
                  {body && <p className="text-[11.5px] text-gray-500 line-clamp-1 mt-0.5">{body}</p>}
                  <p className="text-[11px] text-gray-400 mt-0.5">{relativeTime(item.created_at)}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 2: Recent Submissions + Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Submissions */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <CheckSquare size={14} className="text-gray-500" />
            <p className="text-[13px] font-bold text-gray-900">Recent Submissions</p>
            <span className="text-[11px] text-gray-400 ml-auto">Last 10</span>
          </div>
          {submissionLog.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <CheckSquare size={18} className="text-gray-200 mx-auto mb-2" />
              <p className="text-[12px] text-gray-400">No submissions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {submissionLog.slice(0, 10).map((row, idx) => (
                <div key={idx} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/50">
                  <Avatar src={row.student_picture ?? undefined} name={row.student_name} size="xs" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-gray-800 truncate">{row.student_name}</p>
                    <p className="text-[11px] text-gray-500 truncate">{row.task_title}</p>
                    <p className="text-[10.5px] text-gray-400 truncate">{row.workspace_name}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusBadge status={row.status} />
                    {row.updated_at && (
                      <span className="text-[10px] text-gray-400">{relativeTime(row.updated_at)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Deadlines — grouped by workspace */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Clock size={14} className={deadlines.length > 0 ? 'text-yellow-500' : 'text-gray-400'} />
            <p className="text-[13px] font-bold text-gray-900">Upcoming Deadlines</p>
            <span className="text-[11px] text-gray-400 ml-1">next 7 days</span>
            {deadlines.length > 0 && (
              <span className="ml-auto text-[11px] font-bold text-white bg-yellow-400 rounded-full px-2 py-0.5 leading-none">
                {deadlines.length}
              </span>
            )}
          </div>
          {deadlines.length === 0 ? (
            <div className="px-4 py-5 text-center">
              <Clock size={16} className="text-gray-200 mx-auto mb-1.5" />
              <p className="text-[12px] text-gray-400">No tasks due in the next 7 days</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 overflow-y-auto">
              {workspaceGroups.map(group => (
                <div key={group.slug} className="px-3 py-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{group.name}</p>
                  <div className="space-y-1.5">
                    {group.tasks.map(task => {
                      const uk = urgencyKey(task.days_until_due);
                      return (
                        <button
                          key={task.task_id}
                          onClick={() => navigate(`/w/${task.workspace_slug}/tasks/${task.task_id}`)}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border text-left hover:opacity-80 transition-opacity ${URGENCY_ROW[uk]}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${URGENCY_DOT[uk]}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-[12px] font-semibold truncate ${URGENCY_TEXT[uk]}`}>{task.task_title}</p>
                            <div className={`flex items-center gap-2.5 text-[10.5px] opacity-75 ${URGENCY_TEXT[uk]}`}>
                              <span>{task.completed}/{task.total} done</span>
                              {task.submitted > 0 && <span>· {task.submitted} to review</span>}
                              {task.needs_revision > 0 && <span>· {task.needs_revision} revision</span>}
                            </div>
                          </div>
                          <span className={`shrink-0 text-[10.5px] font-bold ${URGENCY_TEXT[uk]}`}>
                            {URGENCY_LABEL[uk](task.days_until_due)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function MentorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstName = user?.first_name ?? user?.username ?? 'there';

  const [section, setSection] = useState<Section>('activity');
  const [workspaceFilter, setWorkspaceFilter] = useState<number | null>(null);
  const [trendRange, setTrendRange] = useState<Range>('30d');
  const [activityRange, setActivityRange] = useState<Range>('30d');
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{
    workspaceId: number; membershipId: number; action: 'approve' | 'reject';
    studentName: string; workspaceName: string;
  } | null>(null);

  const { data: allWorkspaces } = useApiList<Workspace>(workspacesApi.list);
  const workspacesList = allWorkspaces.filter(w => w.my_status === 'owner');
  const { data: pending, refetch: refetchPending } = useApi<PendingFeed>(profilesApi.getMentorPendingFeed);
  const { data: notifsData } = useApi<{ results: NotifItem[]; unread: number }>(
    () => apiClient.get('/api/notifications/'),
  );
  const { data: reviewQueue } = useApiList<ReviewQueueItem>(workspacesApi.getReviewQueue);
  const { data: deadlines } = useApiList<UpcomingDeadline>(workspacesApi.getUpcomingDeadlines);
  const { data: analytics, loading } = useApi<MentorAnalytics>(
    () => workspacesApi.getAnalytics(workspaceFilter ?? undefined),
    [workspaceFilter],
  );
  const { data: trend } = useApi<MentorAnalyticsTrend>(
    () => workspacesApi.getAnalyticsTrend(workspaceFilter ?? undefined, trendRange),
    [workspaceFilter, trendRange],
  );
  const { data: activityTrend } = useApi<MentorAnalyticsTrend>(
    () => workspacesApi.getAnalyticsTrend(workspaceFilter ?? undefined, activityRange),
    [workspaceFilter, activityRange],
  );

  const wsRequests = pending?.workspace_requests ?? [];

  const handleMemberAction = async (workspaceId: number, membershipId: number, action: 'approve' | 'reject') => {
    setConfirm(null);
    setActionLoading(membershipId);
    try {
      await workspacesApi.memberAction(workspaceId, membershipId, action);
      refetchPending();
    } finally {
      setActionLoading(null);
    }
  };

  const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: 'activity',    label: 'Activity',    icon: <CalendarDays size={14} /> },
    { id: 'overview',    label: 'Overview',    icon: <TrendingUp size={14} /> },
    { id: 'students',    label: 'Students',    icon: <Users size={14} /> },
    { id: 'tasks',       label: 'Tasks',       icon: <BarChart2 size={14} /> },
    { id: 'workspaces',  label: 'Workspaces',  icon: <Activity size={14} /> },
  ];

  const currentWsName = workspaceFilter
    ? workspacesList.find(w => w.id === workspaceFilter)?.name ?? 'Selected'
    : 'All Workspaces';

  return (
    <>
      {/* ── Compact top strip ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[18px] font-bold text-gray-900 tracking-tight">
            {getGreeting()}, {firstName}!
          </h1>
          <p className="text-[12px] text-gray-400 mt-0.5">Analytics dashboard</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Workspace filter dropdown */}
          <div className="relative">
            <select
              value={workspaceFilter ?? ''}
              onChange={e => setWorkspaceFilter(e.target.value ? Number(e.target.value) : null)}
              className="appearance-none pl-3 pr-8 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white cursor-pointer"
            >
              <option value="">All Workspaces</option>
              {workspacesList.map(ws => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          {/* Requests button */}
          <button
            onClick={() => setRequestsOpen(true)}
            className="relative flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <AlertTriangle size={13} className={wsRequests.length > 0 ? 'text-amber-500' : 'text-gray-400'} />
            Requests
            {wsRequests.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center text-[9px] font-bold text-white bg-amber-500 rounded-full">
                {wsRequests.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Main body: left nav + chart area ──────────────────────────── */}
      <div className="flex gap-5 items-start">
        {/* Left nav */}
        <div className="shrink-0 w-[170px] bg-white border border-gray-200 rounded-xl p-2 sticky top-4">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12.5px] font-semibold transition-colors text-left ${
                section === s.id
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
              }`}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>

        {/* Chart area */}
        <div className="flex-1 min-w-0">
          {/* Activity section renders independently — no analytics dependency */}
          {section === 'activity' ? (
            <ActivitySection
              submissionLog={analytics?.submission_log ?? []}
              recentActivity={notifsData?.results?.slice(0, 8) ?? []}
              reviewQueue={reviewQueue}
              deadlines={deadlines}
            />
          ) : loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 size={24} className="animate-spin text-primary-400" />
            </div>
          ) : !analytics ? (
            <div className="flex items-center justify-center h-64 text-gray-400 text-[13px]">
              No analytics data available yet.
            </div>
          ) : (
            <>
              {section === 'overview' && (
                <OverviewSection
                  data={analytics}
                  trend={trend}
                  trendRange={trendRange}
                  setTrendRange={setTrendRange}
                />
              )}
              {section === 'students' && <StudentsSection data={analytics} />}
              {section === 'tasks'    && <TasksSection data={analytics} />}
              {section === 'workspaces' && (
                <WorkspacesSection
                  data={analytics}
                  trend={activityTrend}
                  activityRange={activityRange}
                  setActivityRange={setActivityRange}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Workspace requests modal ───────────────────────────────────── */}
      {requestsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-500" />
                <p className="text-[14px] font-bold text-gray-900">Workspace requests</p>
                {wsRequests.length > 0 && (
                  <span className="text-[11px] font-bold text-white bg-amber-500 rounded-full px-2 py-0.5">{wsRequests.length}</span>
                )}
              </div>
              <button onClick={() => setRequestsOpen(false)} className="text-gray-400 hover:text-gray-700 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
              {wsRequests.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <CheckCircle size={22} className="text-gray-200 mx-auto mb-2" />
                  <p className="text-[13px] text-gray-500">No pending requests</p>
                </div>
              ) : wsRequests.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <LayoutGrid size={13} className="text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-gray-800 truncate">{r.student_name} wants to join</p>
                    <p className="text-[11px] text-gray-400 truncate">{r.workspace_name} · {relativeTime(r.requested_at)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setConfirm({ workspaceId: r.workspace_id, membershipId: r.id, action: 'approve', studentName: r.student_name, workspaceName: r.workspace_name })}
                      disabled={actionLoading === r.id}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-md transition-colors"
                    >
                      {actionLoading === r.id ? '…' : 'Accept'}
                    </button>
                    <button
                      onClick={() => setConfirm({ workspaceId: r.workspace_id, membershipId: r.id, action: 'reject', studentName: r.student_name, workspaceName: r.workspace_name })}
                      disabled={actionLoading === r.id}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-red-50 disabled:opacity-50 text-red-500 border border-red-200 rounded-md transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmation dialog ─────────────────────────────────────────── */}
      {confirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-[15px] font-bold text-gray-900 mb-1">
              {confirm.action === 'approve' ? 'Accept request?' : 'Decline request?'}
            </h3>
            <p className="text-[13px] text-gray-500 mb-5">
              {confirm.action === 'approve'
                ? <><strong>{confirm.studentName}</strong> will be added to <strong>{confirm.workspaceName}</strong>.</>
                : <>Decline <strong>{confirm.studentName}</strong>'s request to join <strong>{confirm.workspaceName}</strong>?</>
              }
            </p>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setConfirm(null)} className="px-4 py-2 text-[13px] font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={() => handleMemberAction(confirm.workspaceId, confirm.membershipId, confirm.action)}
                className={`px-4 py-2 text-[13px] font-semibold text-white rounded-lg transition-colors ${
                  confirm.action === 'approve' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {confirm.action === 'approve' ? 'Yes, accept' : 'Yes, decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
