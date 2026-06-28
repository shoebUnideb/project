import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, FileText, Activity,
  Download, Search, X, Paperclip, ExternalLink,
  Check, AlertCircle, ArrowRight, Users,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import { useOrg } from '../context/OrgContext';
import { useNavigate } from 'react-router-dom';
import {
  analyticsApi, checkinsApi, docApi,
  type AnalyticsData, type CheckIn, type MemberDocument,
} from '../api/orgApi';
import PageHelp, { type PageHelpSection } from '../components/PageHelp';

const ANALYTICS_HELP: PageHelpSection[] = [
  {
    eyebrow: '1 · What is Reports & Analytics?',
    bullets: [
      'A **single dashboard** that rolls up activity across every module — contributions, training, check-ins, documents.',
      'Use it to spot trends: who\'s most engaged, which courses get completed, what\'s overdue.',
      'Designed for **leadership and HR** — no setup required, all data comes from existing modules.',
    ],
  },
  {
    eyebrow: '2 · Read the Tabs',
    bullets: [
      '**Overview** — high-level KPIs: monthly contribution hours, course completion, top contributors, check-in distribution, document status.',
      '**Contributions** — drilldown on logged hours, approval rates, member-by-member breakdown.',
      '**Training** — per-course completion, enrolment, average score, certificate issuance.',
      '**Check-ins** — attendance patterns, missed days, location/method splits.',
      '**Documents** — document upload status, expiring documents, missing required documents per member.',
    ],
  },
  {
    eyebrow: '3 · Filter & Time Range',
    bullets: [
      'Every chart respects the **date range** you select — last 7 days, 30 days, 6 months, custom.',
      'Filter by **department**, **role**, or **member** to scope the view.',
      'Switch between **count** and **percentage** views where applicable.',
    ],
  },
  {
    eyebrow: '4 · Export & Share',
    bullets: [
      'Click **Export** in the top right to download the current view as CSV.',
      'Each chart has an **export icon** for individual download.',
      'Use the **shareable link** option to send a snapshot to stakeholders without giving them admin access.',
    ],
  },
  {
    eyebrow: '5 · Key Insights',
    bullets: [
      'The **Key Insights** card highlights anomalies — sudden drops, top performers, overdue spikes.',
      'Insights refresh automatically when new data arrives.',
      'Use this as your **morning glance** to catch issues before they escalate.',
    ],
  },
  {
    eyebrow: 'Tip',
    body: 'For **scheduled reports**, configure email digests in Settings → Reports. The platform will email a PDF/CSV snapshot to you (or stakeholders) on the cadence you choose — daily, weekly, monthly.',
  },
];

// ── Constants ─────────────────────────────────────────────────────────────────

const GRAY = ['#111827', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB'];

const DOC_STATUS_LABEL: Record<string, string> = {
  assigned: 'Assigned', uploaded: 'Uploaded', pending_review: 'Pending Review',
  approved: 'Approved', rejected: 'Rejected',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtMonth(ym: string) {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-US', { month: 'short', year: '2-digit' });
}
function initials(name: string) {
  const p = name.trim().split(' ');
  return p.length >= 2 ? `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
}
function exportDocsCSV(list: MemberDocument[]) {
  const rows = [
    ['Member', 'Email', 'Title', 'Category', 'Status', 'Uploaded', 'Reviewed By', 'Reviewed At'],
    ...list.map(d => [d.user?.display_name ?? '', d.user?.email ?? '', d.title, d.category, DOC_STATUS_LABEL[d.status] ?? d.status, d.uploaded_at, d.reviewed_by_name ?? '', d.reviewed_at ?? '']),
  ];
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'documents.csv'; a.click();
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 bg-gray-100 rounded-xl w-56 animate-pulse" />
      <div className="grid grid-cols-6 gap-3">{[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      <div className="grid grid-cols-2 gap-4">{[...Array(2)].map((_, i) => <div key={i} className="h-56 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: AnalyticsData }) {
  const { contributions, training, checkins, documents } = data;

  const trendData = contributions.monthly_hours.map(m => ({
    label: fmtMonth(m.month),
    hours: m.hours,
  }));

  const courseData = training.by_course.map(c => ({
    label: c.course_title.length > 18 ? c.course_title.slice(0, 18) + '…' : c.course_title,
    pct: c.enrolled > 0 ? Math.round(c.completed / c.enrolled * 100) : 0,
    enrolled: c.enrolled,
    completed: c.completed,
  }));

  const docStatusData = [
    { name: 'Approved', value: documents.approved },
    { name: 'Pending', value: documents.pending },
    { name: 'Other', value: Math.max(0, documents.total - documents.approved - documents.pending) },
  ].filter(d => d.value > 0);

  const checkinData = [
    { name: 'Weekly', value: checkins.by_type.weekly },
    { name: 'Monthly', value: checkins.by_type.monthly },
  ].filter(d => d.value > 0);

  const totalCheckinPending = checkins.total - checkins.reviewed;

  // Insights
  const insights: { text: string; sub: string }[] = [];
  if (training.completion_rate > 0) insights.push({ text: `${training.completion_rate}% training completion`, sub: `${training.completed} of ${training.total_enrollments} enrolled` });
  if (checkins.reviewed > 0) insights.push({ text: `${checkins.reviewed} check-ins reviewed`, sub: `${totalCheckinPending} pending review` });
  if (contributions.approved > 0) insights.push({ text: `${contributions.approved} contributions approved`, sub: `${contributions.total_contributions - contributions.approved} pending` });
  if (documents.approved > 0) insights.push({ text: `${documents.approved} documents approved`, sub: `${documents.pending} awaiting review` });

  return (
    <div className="space-y-4">
      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Hours Trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="mb-3">
            <p className="text-[13px] font-bold text-gray-900">Monthly Contribution Hours</p>
            <p className="text-[11.5px] text-gray-400">Approved hours over the last 6 months</p>
          </div>
          {trendData.every(d => d.hours === 0) ? (
            <p className="text-[12.5px] text-gray-400 text-center py-12">No contribution data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={trendData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                <Line type="monotone" dataKey="hours" name="Hours" stroke="#111827" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Training Completion by Course */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="mb-3">
            <p className="text-[13px] font-bold text-gray-900">Training Completion by Course</p>
            <p className="text-[11.5px] text-gray-400">Completion rate per course</p>
          </div>
          {courseData.length === 0 ? (
            <p className="text-[12.5px] text-gray-400 text-center py-12">No training data yet.</p>
          ) : (
            <div className="space-y-2">
              {courseData.slice(0, 6).map(c => (
                <div key={c.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-gray-700 font-medium">{c.label}</span>
                    <span className="text-[11.5px] font-bold text-gray-900">{c.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gray-900 rounded-full" style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Contributors */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-[13px] font-bold text-gray-900">Top Contributors</p>
          <p className="text-[11.5px] text-gray-400">Ranked by approved hours</p>
        </div>
        {contributions.by_member.length === 0 ? (
          <p className="text-[12.5px] text-gray-400 text-center py-8">No contribution data yet.</p>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-5 py-2">#</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-2">Member</th>
                <th className="text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-2">Approved Hours</th>
                <th className="text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-5 py-2">Submissions</th>
              </tr>
            </thead>
            <tbody>
              {contributions.by_member.slice(0, 10).map((m, i) => (
                <tr key={m.member_name} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-2 text-gray-400 font-medium">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600 shrink-0">{initials(m.member_name)}</div>
                      <span className="font-semibold text-gray-900">{m.member_name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-gray-900">{m.total_hours.toFixed(1)}</td>
                  <td className="px-5 py-2 text-right text-gray-500">{m.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Check-in distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[13px] font-bold text-gray-900 mb-3">Check-in Distribution</p>
          {checkinData.length === 0 ? (
            <p className="text-[12.5px] text-gray-400 text-center py-8">No check-in data yet.</p>
          ) : (
            <div className="flex items-center gap-4">
              <PieChart width={110} height={110}>
                <Pie data={checkinData} cx={50} cy={50} innerRadius={28} outerRadius={48} dataKey="value" paddingAngle={2}>
                  {checkinData.map((_, i) => <Cell key={i} fill={GRAY[i % GRAY.length]} />)}
                </Pie>
              </PieChart>
              <div className="space-y-2 flex-1">
                {checkinData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: GRAY[i % GRAY.length] }} />
                      <span className="text-[11.5px] text-gray-600">{d.name}</span>
                    </div>
                    <span className="text-[11.5px] font-semibold text-gray-900">{d.value}</span>
                  </div>
                ))}
                <div className="pt-1.5 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-400">Reviewed</span>
                    <span className="text-[11.5px] font-semibold text-gray-900">{checkins.reviewed}/{checkins.total}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Document Status */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[13px] font-bold text-gray-900 mb-3">Document Status</p>
          {docStatusData.length === 0 ? (
            <p className="text-[12.5px] text-gray-400 text-center py-8">No document data yet.</p>
          ) : (
            <div className="flex items-center gap-4">
              <PieChart width={110} height={110}>
                <Pie data={docStatusData} cx={50} cy={50} innerRadius={28} outerRadius={48} dataKey="value" paddingAngle={2}>
                  {docStatusData.map((_, i) => <Cell key={i} fill={GRAY[i % GRAY.length]} />)}
                </Pie>
              </PieChart>
              <div className="space-y-2 flex-1">
                {docStatusData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: GRAY[i % GRAY.length] }} />
                      <span className="text-[11.5px] text-gray-600">{d.name}</span>
                    </div>
                    <span className="text-[11.5px] font-semibold text-gray-900">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Insights */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[13px] font-bold text-gray-900 mb-3">Key Insights</p>
          {insights.length === 0 ? (
            <p className="text-[12.5px] text-gray-400 text-center py-8">Add more data to see insights.</p>
          ) : (
            <div className="space-y-2">
              {insights.map((ins, i) => (
                <div key={i} className="flex items-start gap-2.5 pb-2.5 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 text-gray-600 text-[10px] font-bold">{i + 1}</div>
                  <div>
                    <p className="text-[12px] font-semibold text-gray-800">{ins.text}</p>
                    <p className="text-[11px] text-gray-400">{ins.sub}</p>
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

// ── Contributions Tab ─────────────────────────────────────────────────────────

function ContributionsTab({ data, onNavigate }: { data: AnalyticsData['contributions']; onNavigate: () => void }) {
  const totalLogged   = data.total_contributions;
  const approvalRate  = totalLogged > 0 ? Math.round(data.approved / totalLogged * 100) : 0;
  const pendingCount  = totalLogged - data.approved;

  return (
    <div className="space-y-4">
      {/* Summary stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Logged',   value: totalLogged,               sub: 'all time' },
          { label: 'Approved',       value: data.approved,             sub: 'contributions' },
          { label: 'Approved Hours', value: data.total_hours.toFixed(1), sub: 'all time' },
          { label: 'Approval Rate',  value: `${approvalRate}%`,        sub: `${pendingCount} pending` },
        ].map(card => (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{card.label}</p>
            <p className="text-[22px] font-bold text-gray-900 leading-tight mt-0.5">{card.value}</p>
            <p className="text-[11px] text-gray-400">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Monthly chart */}
      {data.monthly_hours.some(m => m.hours > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[13px] font-bold text-gray-900 mb-3">Monthly Approved Hours</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={data.monthly_hours.map(m => ({ label: fmtMonth(m.month), hours: m.hours }))} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
              <Bar dataKey="hours" name="Hours" fill="#111827" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top contributors */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-bold text-gray-900">Top Contributors</p>
            <p className="text-[11.5px] text-gray-400">Ranked by approved hours</p>
          </div>
          <button
            onClick={onNavigate}
            className="flex items-center gap-1 text-[12px] font-semibold text-gray-600 hover:text-gray-900 transition-colors"
          >
            Manage contributions <ArrowRight size={13} />
          </button>
        </div>
        {data.by_member.length === 0 ? (
          <p className="text-[12.5px] text-gray-400 text-center py-10">No contribution data yet.</p>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-5 py-2">#</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-2">Member</th>
                <th className="text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-2">Approved Hours</th>
                <th className="text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-5 py-2">Submissions</th>
              </tr>
            </thead>
            <tbody>
              {data.by_member.slice(0, 10).map((m, i) => (
                <tr key={m.member_name} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-2 text-gray-400 font-medium">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600 shrink-0">{initials(m.member_name)}</div>
                      <span className="font-semibold text-gray-900">{m.member_name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-gray-900">{m.total_hours.toFixed(1)}</td>
                  <td className="px-5 py-2 text-right text-gray-500">{m.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Training Tab ──────────────────────────────────────────────────────────────

function TrainingTab({ data }: { data: AnalyticsData['training'] }) {
  return (
    <div className="space-y-4">
      {/* Bar chart */}
      {data.by_course.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[13px] font-bold text-gray-900 mb-3">Enrollment vs Completion by Course</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data.by_course.map(c => ({
              label: c.course_title.length > 20 ? c.course_title.slice(0, 20) + '…' : c.course_title,
              Enrolled: c.enrolled, Completed: c.completed,
            }))} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
              <Bar dataKey="Enrolled"  fill="#D1D5DB" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Completed" fill="#111827" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-gray-300" /><span className="text-[11px] text-gray-500">Enrolled</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-gray-900" /><span className="text-[11px] text-gray-500">Completed</span></div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-[13px] font-bold text-gray-900">Course Breakdown</p>
        </div>
        {data.by_course.length === 0 ? (
          <p className="text-[12.5px] text-gray-400 text-center py-10">No training data yet.</p>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-5 py-2">Course</th>
                <th className="text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-2">Enrolled</th>
                <th className="text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-2">Completed</th>
                <th className="text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-2">Rate</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-5 py-2 min-w-[120px]">Progress</th>
              </tr>
            </thead>
            <tbody>
              {data.by_course.map(c => {
                const pct = c.enrolled > 0 ? Math.round(c.completed / c.enrolled * 100) : 0;
                return (
                  <tr key={c.course_title} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-2 font-medium text-gray-900">{c.course_title}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{c.enrolled}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{c.completed}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900">{pct}%</td>
                    <td className="px-5 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gray-900 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Check-ins Tab ─────────────────────────────────────────────────────────────

function CheckinsTab() {
  const [items, setItems]       = useState<CheckIn[] | null>(null);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<'all' | 'unreviewed' | 'reviewed'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'weekly' | 'monthly'>('all');
  const [search, setSearch]     = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reviewingId, setReviewingId] = useState<number | null>(null);

  useEffect(() => {
    checkinsApi.getCheckins()
      .then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);

  const handleReview = async (id: number) => {
    setReviewingId(id);
    try {
      const updated = await checkinsApi.reviewCheckin(id);
      setItems(p => p ? p.map(c => c.id === id ? updated : c) : p);
    } catch { /* ignore */ } finally { setReviewingId(null); }
  };

  const filtered = useMemo(() => {
    if (!items) return [];
    let list = items;
    if (filter === 'unreviewed') list = list.filter(c => !c.reviewed_at);
    else if (filter === 'reviewed') list = list.filter(c => !!c.reviewed_at);
    if (typeFilter !== 'all') list = list.filter(c => c.period_type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => c.member_name.toLowerCase().includes(q));
    }
    return list;
  }, [items, filter, typeFilter, search]);

  const unreviewed = items?.filter(c => !c.reviewed_at).length ?? 0;

  if (loading) return <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search member…"
            className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}
          className="px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-300">
          <option value="all">All Types</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1">
        {[
          { v: 'all', l: `All (${items?.length ?? 0})` },
          { v: 'unreviewed', l: `Pending Review (${unreviewed})` },
          { v: 'reviewed', l: `Reviewed (${(items?.length ?? 0) - unreviewed})` },
        ].map(t => (
          <button key={t.v} onClick={() => setFilter(t.v as typeof filter)}
            className={`px-3 py-1.5 text-[11.5px] font-semibold rounded-lg whitespace-nowrap transition-colors ${filter === t.v ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Activity size={22} className="text-gray-200 mb-3" />
            <p className="text-[13px] font-semibold text-gray-600">No check-ins found</p>
            <p className="text-[11.5px] text-gray-400 mt-1">{search ? 'Try a different search.' : 'No check-ins in this category.'}</p>
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-5 py-2">Member</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-2">Type</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-2">Period</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-2">Submitted</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-2">Reviewed By</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <>
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>
                    <td className="px-5 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600 shrink-0">{initials(c.member_name)}</div>
                        <span className="font-medium text-gray-900">{c.member_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 capitalize text-gray-600">{c.period_type}</td>
                    <td className="px-3 py-2 text-gray-500">{fmtDate(c.period_start)} – {fmtDate(c.period_end)}</td>
                    <td className="px-3 py-2 text-gray-500">{fmtDate(c.submitted_at)}</td>
                    <td className="px-3 py-2">
                      {c.reviewed_at ? (
                        <span className="text-gray-700 font-medium">{c.reviewed_by_name ?? 'Reviewed'}</span>
                      ) : (
                        <span className="text-gray-400 italic">Pending</span>
                      )}
                    </td>
                    <td className="px-5 py-2 text-right" onClick={e => e.stopPropagation()}>
                      {!c.reviewed_at && (
                        <button onClick={() => handleReview(c.id)} disabled={reviewingId === c.id}
                          className="flex items-center gap-1 px-3 py-1 text-[11px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg disabled:opacity-50">
                          <Check size={11} /> {reviewingId === c.id ? '…' : 'Mark Reviewed'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === c.id && (
                    <tr key={`${c.id}-exp`} className="border-b border-gray-100 bg-gray-50">
                      <td colSpan={6} className="px-5 py-3">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Check-in Responses</p>
                        {Object.keys(c.responses).length === 0 ? (
                          <p className="text-[12px] text-gray-400 italic">No responses recorded.</p>
                        ) : (
                          <div className="space-y-2">
                            {Object.entries(c.responses).map(([question, answer]) => (
                              <div key={question} className="py-2 border-b border-gray-200 last:border-0">
                                <p className="text-[11.5px] font-semibold text-gray-600">{question}</p>
                                <p className="text-[12px] text-gray-800 mt-0.5 whitespace-pre-wrap leading-relaxed">{answer || <span className="italic text-gray-400">No answer</span>}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
        <div className="px-5 py-2 border-t border-gray-100">
          <p className="text-[11px] text-gray-400">Showing {filtered.length} of {items?.length ?? 0} check-ins</p>
        </div>
      </div>
    </div>
  );
}

// ── Documents Tab ─────────────────────────────────────────────────────────────

function DocumentsTab() {
  const [items, setItems]         = useState<MemberDocument[] | null>(null);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<'all' | 'pending_review' | 'approved' | 'rejected'>('all');
  const [search, setSearch]       = useState('');
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: number; note: string } | null>(null);

  useEffect(() => {
    docApi.getDocuments()
      .then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);

  const handleApprove = async (id: number) => {
    setReviewingId(id);
    try {
      const updated = await docApi.reviewDocument(id, { action: 'approve' });
      setItems(p => p ? p.map(d => d.id === id ? updated : d) : p);
    } catch { /* ignore */ } finally { setReviewingId(null); }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    const { id, note } = rejectTarget;
    setReviewingId(id);
    try {
      const updated = await docApi.reviewDocument(id, { action: 'reject', note });
      setItems(p => p ? p.map(d => d.id === id ? updated : d) : p);
      setRejectTarget(null);
    } catch { /* ignore */ } finally { setReviewingId(null); }
  };

  const filtered = useMemo(() => {
    if (!items) return [];
    let list = items;
    if (filter !== 'all') list = list.filter(d => d.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d => (d.user?.display_name ?? '').toLowerCase().includes(q) || d.title.toLowerCase().includes(q));
    }
    return list;
  }, [items, filter, search]);

  const pending  = items?.filter(d => d.status === 'pending_review').length ?? 0;
  const approved = items?.filter(d => d.status === 'approved').length ?? 0;
  const rejected = items?.filter(d => d.status === 'rejected').length ?? 0;

  if (loading) return <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search member or title…"
            className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white" />
        </div>
        <button onClick={() => items && exportDocsCSV(filtered)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 bg-white">
          <Download size={12} /> Export
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1">
        {[
          { v: 'all', l: `All (${items?.length ?? 0})` },
          { v: 'pending_review', l: `Pending Review (${pending})` },
          { v: 'approved', l: `Approved (${approved})` },
          { v: 'rejected', l: `Rejected (${rejected})` },
        ].map(t => (
          <button key={t.v} onClick={() => setFilter(t.v as typeof filter)}
            className={`px-3 py-1.5 text-[11.5px] font-semibold rounded-lg whitespace-nowrap transition-colors ${filter === t.v ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <FileText size={22} className="text-gray-200 mb-3" />
            <p className="text-[13px] font-semibold text-gray-600">No documents found</p>
            <p className="text-[11.5px] text-gray-400 mt-1">{search ? 'Try a different search.' : 'No documents in this category.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-5 py-2">Member</th>
                  <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-2">Title</th>
                  <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-2">Category</th>
                  <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-2">Status</th>
                  <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-2">Uploaded</th>
                  <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-2">File</th>
                  <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-2">Reviewed By</th>
                  <th className="px-5 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(doc => {
                  const statusColor = doc.status === 'approved' ? 'text-gray-900 font-semibold' : doc.status === 'rejected' ? 'text-red-600' : doc.status === 'pending_review' ? 'text-gray-700' : 'text-gray-500';
                  const busy = reviewingId === doc.id;
                  return (
                    <>
                      <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600 shrink-0">
                              {initials(doc.user?.display_name ?? '?')}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 truncate">{doc.user?.display_name ?? '—'}</p>
                              <p className="text-[10px] text-gray-400 truncate">{doc.user?.email ?? ''}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 max-w-[160px]"><p className="font-medium text-gray-900 truncate">{doc.title}</p></td>
                        <td className="px-3 py-2 capitalize text-gray-500">{doc.category}</td>
                        <td className="px-3 py-2"><span className={statusColor}>{DOC_STATUS_LABEL[doc.status] ?? doc.status}</span></td>
                        <td className="px-3 py-2 text-gray-500">{fmtDate(doc.uploaded_at)}</td>
                        <td className="px-3 py-2">
                          {doc.file_url ? (
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11.5px] text-gray-500 hover:text-gray-900">
                              <Paperclip size={11} /> View <ExternalLink size={10} />
                            </a>
                          ) : <span className="text-gray-300 text-[11.5px]">—</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-500">{doc.reviewed_by_name ?? '—'}</td>
                        <td className="px-5 py-2" onClick={e => e.stopPropagation()}>
                          {doc.status === 'pending_review' && (
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => handleApprove(doc.id)} disabled={busy}
                                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg disabled:opacity-50">
                                <Check size={11} /> {busy ? '…' : 'Approve'}
                              </button>
                              <button onClick={() => setRejectTarget({ id: doc.id, note: '' })} disabled={busy}
                                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 rounded-lg disabled:opacity-50">
                                <X size={11} /> Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {rejectTarget?.id === doc.id && (
                        <tr key={`${doc.id}-reject`} className="border-b border-gray-100 bg-gray-50">
                          <td colSpan={8} className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex-1">
                                <input value={rejectTarget.note} onChange={e => setRejectTarget(r => r ? { ...r, note: e.target.value } : r)}
                                  placeholder="Rejection note (optional)…"
                                  className="w-full px-3 py-2 text-[12px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300" />
                              </div>
                              <button onClick={handleReject} disabled={!!reviewingId}
                                className="flex items-center gap-1 px-3 py-1.5 text-[11.5px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-50">
                                {reviewingId === doc.id ? 'Rejecting…' : 'Confirm Reject'}
                              </button>
                              <button onClick={() => setRejectTarget(null)}
                                className="p-1.5 rounded-xl text-gray-400 hover:bg-gray-100"><X size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
            <div className="px-5 py-2 border-t border-gray-100">
              <p className="text-[11px] text-gray-400">Showing {filtered.length} of {items?.length ?? 0} documents</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

type AnalyticsTab = 'overview' | 'contributions' | 'training' | 'checkins' | 'documents';

const TABS: { id: AnalyticsTab; label: string }[] = [
  { id: 'overview',      label: 'Overview' },
  { id: 'contributions', label: 'Contributions' },
  { id: 'training',      label: 'Training' },
  { id: 'checkins',      label: 'Check-ins' },
  { id: 'documents',     label: 'Documents' },
];

export default function OrgAnalytics() {
  const { isSuperadmin, canManageMembers, isLoading: orgLoading } = useOrg();
  const isAdmin = isSuperadmin || canManageMembers;
  const navigate = useNavigate();

  const [data, setData]       = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<AnalyticsTab>('overview');

  useEffect(() => {
    if (orgLoading) return;
    if (!isAdmin) { setLoading(false); return; }
    analyticsApi.getAnalytics()
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [orgLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (orgLoading || loading) return <Skeleton />;

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
          <TrendingUp size={24} className="text-gray-300" />
        </div>
        <p className="text-[14px] font-semibold text-gray-700">Access Denied</p>
        <p className="text-xs text-gray-400 mt-1">Only admins can view org-wide analytics.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle size={24} className="text-gray-300 mb-3" />
        <p className="text-[14px] font-semibold text-gray-500">Could not load analytics data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-[16px] font-bold text-gray-900">Reports & Analytics</h1>
            <PageHelp title="How Reports & Analytics Work" sections={ANALYTICS_HELP} />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Org-wide activity and performance overview</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => navigate('/org/directory', { state: { from: 'analytics' } })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 bg-white">
            <Users size={12} /> View People Detailed Profiles
          </button>
          <button onClick={() => {/* export overview data */ }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 bg-white">
            <Download size={12} /> Export
          </button>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
              tab === t.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview'      && <OverviewTab data={data} />}
      {tab === 'contributions' && <ContributionsTab data={data.contributions} onNavigate={() => navigate('/org/contributions')} />}
      {tab === 'training'      && <TrainingTab data={data.training} />}
      {tab === 'checkins'      && <CheckinsTab />}
      {tab === 'documents'     && <DocumentsTab />}
    </div>
  );
}
