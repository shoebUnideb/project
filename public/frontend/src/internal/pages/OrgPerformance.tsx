import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar,
} from 'recharts';
import {
  Clock, Activity, CheckCircle2, Flame, ListChecks, GraduationCap, TrendingUp,
  Award, Target, Zap, BookOpen, Calendar, ChevronRight, Star,
} from 'lucide-react';
import { performanceApi, type MemberPerformanceData } from '../api/orgApi';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMonth(ym: string) {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-US', { month: 'short', year: '2-digit' });
}

function fmtMonthShort(ym: string) {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-US', { month: 'short' });
}

function computeScore(data: MemberPerformanceData): number {
  let score = 0;
  // Contributions (max 40)
  const hoursScore = Math.min(40, (data.contributions.total_hours / 20) * 40);
  score += hoursScore;
  // Training (max 30)
  score += (data.training.completion_rate / 100) * 30;
  // Check-ins (max 20)
  const streakScore = Math.min(20, (data.checkins.streak / 6) * 20);
  score += streakScore;
  // Onboarding (max 10)
  if (data.onboarding.progress_pct !== null) {
    score += (data.onboarding.progress_pct / 100) * 10;
  } else {
    score += 10;
  }
  return Math.round(Math.min(100, score));
}

function scoreLabel(score: number) {
  if (score >= 85) return { label: 'Excellent', color: 'text-gray-900' };
  if (score >= 65) return { label: 'Good',      color: 'text-gray-700' };
  if (score >= 40) return { label: 'Fair',       color: 'text-gray-500' };
  return { label: 'Getting Started', color: 'text-gray-400' };
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, sub,
}: {
  icon: React.ReactNode; label: string; value: number | string; sub?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col gap-2">
      <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-[24px] font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-[12px] text-gray-400 mt-0.5 font-medium">{label}</p>
        {sub && <p className="text-[11px] text-gray-300 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Score Ring ─────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const { label } = scoreLabel(score);
  const ringData = [{ value: score, fill: '#111827' }, { value: 100 - score, fill: '#F3F4F6' }];
  return (
    <div className="relative flex flex-col items-center justify-center">
      <RadialBarChart
        width={120} height={120}
        cx={60} cy={60}
        innerRadius={40} outerRadius={55}
        startAngle={90} endAngle={-270}
        data={ringData}
        barSize={10}
      >
        <RadialBar dataKey="value" cornerRadius={6} isAnimationActive={false} />
      </RadialBarChart>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[22px] font-bold text-gray-900 leading-none">{score}</span>
        <span className="text-[10px] text-gray-400 font-medium mt-0.5">/ 100</span>
      </div>
      <p className="text-[12px] font-semibold text-gray-500 mt-1">{label}</p>
    </div>
  );
}

// ── Monthly Bar Chart ─────────────────────────────────────────────────────────

interface MonthlyData { month: string; hours: number }

function MonthlyChart({ data }: { data: MonthlyData[] }) {
  const chartData = data.map(m => ({ ...m, label: fmtMonthShort(m.month) }));
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={chartData} barSize={28} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 12 }}
          formatter={(v: number) => [`${v.toFixed(1)} hrs`, 'Hours']}
          labelStyle={{ fontWeight: 600, color: '#374151' }}
        />
        <Bar dataKey="hours" fill="#111827" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Streak Dots ───────────────────────────────────────────────────────────────

function StreakDots({ streak, total }: { streak: number; total: number }) {
  const dots = Math.max(streak, 6);
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-3">
      {Array.from({ length: dots }).map((_, i) => {
        const active = i < streak;
        return (
          <div
            key={i}
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors ${
              active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'
            }`}
          >
            {active ? <Flame size={11} /> : i + 1}
          </div>
        );
      })}
      {total > streak && (
        <p className="text-[11px] text-gray-400 ml-1">{total - streak} more check-ins before streak</p>
      )}
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────────

function ProgressBar({ value, label, sub }: { value: number; label: string; sub?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[13px] font-semibold text-gray-700">{label}</p>
        <span className="text-[12px] font-bold text-gray-900">{value}%</span>
      </div>
      {sub && <p className="text-[11px] text-gray-400 mb-1.5">{sub}</p>}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gray-900 rounded-full transition-all duration-700"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

// ── Insight Row ───────────────────────────────────────────────────────────────

function InsightRow({ icon, text, accent }: { icon: React.ReactNode; text: string; accent?: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${accent ?? 'bg-gray-50'}`}>
        {icon}
      </div>
      <p className="text-[13px] text-gray-600 leading-relaxed pt-0.5">{text}</p>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-100 rounded-xl w-48" />
      <div className="bg-gray-100 rounded-2xl h-36" />
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl" />)}
      </div>
      <div className="bg-gray-100 rounded-2xl h-48" />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OrgPerformance() {
  const [data, setData]       = useState<MemberPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    performanceApi.getMyPerformance()
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton />;

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <TrendingUp size={36} className="text-gray-200 mb-4" />
        <p className="text-[15px] font-semibold text-gray-500">Could not load performance data.</p>
        <p className="text-[13px] text-gray-400 mt-1">Try refreshing the page.</p>
      </div>
    );
  }

  const score         = computeScore(data);
  const { label: scoreLbl } = scoreLabel(score);
  const hasMonthly    = data.contributions.monthly.some(m => m.hours > 0);
  const topMonth      = [...data.contributions.monthly].sort((a, b) => b.hours - a.hours)[0];
  const avgMonthly    = data.contributions.monthly.length
    ? data.contributions.monthly.reduce((s, m) => s + m.hours, 0) / data.contributions.monthly.length
    : 0;

  // ── Insights ──────────────────────────────────────────────────────────────
  const insights: { icon: React.ReactNode; text: string; accent: string }[] = [];

  if (data.contributions.total_hours >= 20) {
    insights.push({
      icon: <Clock size={13} className="text-gray-700" />,
      text: `You've logged ${data.contributions.total_hours.toFixed(1)} approved hours — great commitment to contributions.`,
      accent: 'bg-gray-100',
    });
  } else if (data.contributions.total_hours > 0) {
    insights.push({
      icon: <Clock size={13} className="text-gray-500" />,
      text: `You have ${data.contributions.total_hours.toFixed(1)} approved hours. Keep logging contributions to build your record.`,
      accent: 'bg-gray-50',
    });
  }

  if (data.training.completion_rate >= 80) {
    insights.push({
      icon: <GraduationCap size={13} className="text-gray-700" />,
      text: `Excellent training record — ${data.training.completed} of ${data.training.enrolled} courses completed (${data.training.completion_rate}%).`,
      accent: 'bg-gray-100',
    });
  } else if (data.training.enrolled > 0) {
    const remaining = data.training.enrolled - data.training.completed;
    insights.push({
      icon: <BookOpen size={13} className="text-gray-500" />,
      text: `You have ${remaining} training course${remaining !== 1 ? 's' : ''} in progress. Complete them to improve your score.`,
      accent: 'bg-gray-50',
    });
  }

  if (data.checkins.streak >= 3) {
    insights.push({
      icon: <Flame size={13} className="text-gray-700" />,
      text: `${data.checkins.streak}-month check-in streak — you're staying consistently active.`,
      accent: 'bg-gray-100',
    });
  } else if (data.checkins.total === 0) {
    insights.push({
      icon: <Calendar size={13} className="text-gray-400" />,
      text: 'No check-ins recorded yet. Regular check-ins help track your engagement over time.',
      accent: 'bg-gray-50',
    });
  }

  if (data.onboarding.status === 'completed') {
    insights.push({
      icon: <CheckCircle2 size={13} className="text-gray-700" />,
      text: 'Onboarding fully completed. All tasks signed off.',
      accent: 'bg-gray-100',
    });
  } else if (data.onboarding.status === 'active' && (data.onboarding.progress_pct ?? 0) < 100) {
    insights.push({
      icon: <ListChecks size={13} className="text-gray-500" />,
      text: `Onboarding ${data.onboarding.progress_pct ?? 0}% complete — keep working through your tasks to finish.`,
      accent: 'bg-gray-50',
    });
  }

  if (insights.length === 0) {
    insights.push({
      icon: <Star size={13} className="text-gray-400" />,
      text: 'Start logging contributions, completing training, and checking in regularly to build your performance score.',
      accent: 'bg-gray-50',
    });
  }

  return (
    <div className="space-y-8 pb-8">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          <TrendingUp size={22} className="text-gray-700" /> My Performance
        </h1>
        <p className="text-gray-400 text-sm">Your personal activity and progress overview</p>
      </div>

      {/* ── Score Hero ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center gap-6">
          <ScoreRing score={score} />
          <div className="flex-1">
            <p className="text-[13px] font-bold text-gray-400 uppercase tracking-widest mb-1">Performance Score</p>
            <p className="text-2xl font-bold text-gray-900">{scoreLbl}</p>
            <p className="text-[13px] text-gray-400 mt-1">
              Based on contributions, training completion, check-in consistency, and onboarding progress.
            </p>
            <div className="flex items-center gap-4 mt-3">
              {[
                { label: 'Hours',     v: data.contributions.total_hours.toFixed(1) },
                { label: 'Courses',   v: `${data.training.completed}/${data.training.enrolled}` },
                { label: 'Check-ins', v: data.checkins.total },
              ].map(({ label, v }) => (
                <div key={label} className="text-center">
                  <p className="text-[16px] font-bold text-gray-800 leading-none">{v}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Contributions ───────────────────────────────────────────────────── */}
      <div>
        <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-3">Contributions</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatCard
            icon={<Clock size={16} className="text-gray-600" />}
            label="Total Approved Hours"
            value={data.contributions.total_hours.toFixed(1)}
          />
          <StatCard
            icon={<Activity size={16} className="text-gray-600" />}
            label="Approved Submissions"
            value={data.contributions.approved}
          />
          <StatCard
            icon={<Target size={16} className="text-gray-600" />}
            label="Avg Monthly Hours"
            value={avgMonthly > 0 ? avgMonthly.toFixed(1) : '—'}
          />
          <StatCard
            icon={<Award size={16} className="text-gray-600" />}
            label="Best Month"
            value={topMonth && topMonth.hours > 0 ? `${topMonth.hours.toFixed(1)} hrs` : '—'}
            sub={topMonth && topMonth.hours > 0 ? fmtMonth(topMonth.month) : undefined}
          />
        </div>

        {hasMonthly ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-4">Monthly Hours — Last 6 Months</p>
            <MonthlyChart data={data.contributions.monthly} />
            <div className="mt-4 border-t border-gray-50 pt-4">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="pb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Month</th>
                    <th className="pb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wide text-right">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {data.contributions.monthly.map(m => (
                    <tr key={m.month} className="border-t border-gray-50">
                      <td className="py-2 text-[13px] text-gray-600">{fmtMonth(m.month)}</td>
                      <td className="py-2 text-[13px] text-gray-700 font-semibold text-right">
                        {m.hours > 0 ? m.hours.toFixed(1) : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-2xl border border-gray-100 p-8 text-center">
            <Clock size={28} className="text-gray-200 mx-auto mb-3" />
            <p className="text-[14px] font-semibold text-gray-400">No contribution hours yet</p>
            <p className="text-[12px] text-gray-300 mt-1">Approved contributions will appear here</p>
          </div>
        )}
      </div>

      {/* ── Training ────────────────────────────────────────────────────────── */}
      <div>
        <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-3">Training</p>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatCard icon={<GraduationCap size={16} className="text-gray-600" />} label="Enrolled"   value={data.training.enrolled} />
          <StatCard icon={<CheckCircle2  size={16} className="text-gray-600" />} label="Completed"  value={data.training.completed} />
          <StatCard icon={<TrendingUp    size={16} className="text-gray-600" />} label="Completion" value={`${data.training.completion_rate}%`} />
        </div>

        {data.training.enrolled > 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5">
            <ProgressBar
              value={data.training.completion_rate}
              label="Overall Training Progress"
              sub={`${data.training.completed} of ${data.training.enrolled} courses completed`}
            />
            <div className="grid grid-cols-2 gap-4 pt-1 border-t border-gray-50">
              <div className="text-center py-3">
                <p className="text-[28px] font-bold text-gray-900 leading-none">{data.training.completed}</p>
                <p className="text-[11px] text-gray-400 mt-1 flex items-center justify-center gap-1">
                  <CheckCircle2 size={11} /> Completed
                </p>
              </div>
              <div className="text-center py-3">
                <p className="text-[28px] font-bold text-gray-400 leading-none">
                  {data.training.enrolled - data.training.completed}
                </p>
                <p className="text-[11px] text-gray-400 mt-1 flex items-center justify-center gap-1">
                  <BookOpen size={11} /> In Progress
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-2xl border border-gray-100 p-8 text-center">
            <GraduationCap size={28} className="text-gray-200 mx-auto mb-3" />
            <p className="text-[14px] font-semibold text-gray-400">No training enrolled</p>
            <p className="text-[12px] text-gray-300 mt-1">Enrolled courses will appear here</p>
          </div>
        )}
      </div>

      {/* ── Check-ins ───────────────────────────────────────────────────────── */}
      <div>
        <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-3">Check-ins</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatCard
            icon={<CheckCircle2 size={16} className="text-gray-600" />}
            label="Total Check-ins"
            value={data.checkins.total}
          />
          <StatCard
            icon={<Flame size={16} className="text-gray-600" />}
            label="Current Streak"
            value={data.checkins.streak > 0 ? `${data.checkins.streak} mo` : '—'}
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-semibold text-gray-700">Monthly Streak</p>
            {data.checkins.streak > 0 && (
              <span className="text-[11px] font-bold text-gray-900 bg-gray-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Flame size={10} /> {data.checkins.streak} months in a row
              </span>
            )}
          </div>
          {data.checkins.streak > 0 ? (
            <StreakDots streak={data.checkins.streak} total={data.checkins.total} />
          ) : (
            <div className="text-center py-4">
              <p className="text-[13px] text-gray-400">No active streak yet</p>
              <p className="text-[11px] text-gray-300 mt-1">Complete monthly check-ins to build a streak</p>
            </div>
          )}
          {data.checkins.total > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
              <span className="text-[12px] text-gray-400">Total check-ins submitted</span>
              <span className="text-[13px] font-bold text-gray-700">{data.checkins.total}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Onboarding ──────────────────────────────────────────────────────── */}
      {data.onboarding.status !== null && (
        <div>
          <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-3">Onboarding</p>
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ListChecks size={16} className="text-gray-600" />
                <p className="text-[14px] font-bold text-gray-900">Onboarding Progress</p>
              </div>
              <span className={`text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full border ${
                data.onboarding.status === 'completed' ? 'border-gray-300 text-gray-700 bg-gray-50' :
                data.onboarding.status === 'active'    ? 'border-gray-200 text-gray-600 bg-white' :
                data.onboarding.status === 'paused'    ? 'border-gray-200 text-gray-400 bg-gray-50' :
                'border-gray-100 text-gray-400 bg-gray-50'
              }`}>
                {data.onboarding.status.charAt(0).toUpperCase() + data.onboarding.status.slice(1)}
              </span>
            </div>
            <ProgressBar
              value={data.onboarding.progress_pct ?? 0}
              label=""
              sub={data.onboarding.status === 'completed' ? 'All tasks completed' : `${data.onboarding.progress_pct ?? 0}% of tasks completed`}
            />
            {data.onboarding.status === 'completed' && (
              <div className="mt-4 flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3">
                <Award size={16} className="text-gray-600 shrink-0" />
                <p className="text-[13px] font-semibold text-gray-700">Onboarding complete — full score earned.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Insights ────────────────────────────────────────────────────────── */}
      <div>
        <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-3">Insights</p>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-gray-500" />
            <p className="text-[13px] font-bold text-gray-700">Personalized Summary</p>
          </div>
          {insights.map((ins, i) => (
            <InsightRow key={i} icon={ins.icon} text={ins.text} accent={ins.accent} />
          ))}
        </div>
      </div>

      {/* ── Score Breakdown ─────────────────────────────────────────────────── */}
      <div>
        <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-3">Score Breakdown</p>
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-50">
          {[
            {
              label: 'Contributions',
              icon: <Clock size={14} className="text-gray-500" />,
              score: Math.round(Math.min(40, (data.contributions.total_hours / 20) * 40)),
              max: 40,
              detail: `${data.contributions.total_hours.toFixed(1)} hrs logged`,
            },
            {
              label: 'Training',
              icon: <GraduationCap size={14} className="text-gray-500" />,
              score: Math.round((data.training.completion_rate / 100) * 30),
              max: 30,
              detail: `${data.training.completion_rate}% completion rate`,
            },
            {
              label: 'Check-ins',
              icon: <CheckCircle2 size={14} className="text-gray-500" />,
              score: Math.round(Math.min(20, (data.checkins.streak / 6) * 20)),
              max: 20,
              detail: `${data.checkins.streak}-month streak`,
            },
            {
              label: 'Onboarding',
              icon: <ListChecks size={14} className="text-gray-500" />,
              score: data.onboarding.progress_pct !== null
                ? Math.round((data.onboarding.progress_pct / 100) * 10)
                : 10,
              max: 10,
              detail: data.onboarding.status === null ? 'Not applicable' : `${data.onboarding.progress_pct ?? 0}% complete`,
            },
          ].map(row => (
            <div key={row.label} className="flex items-center gap-4 px-5 py-3.5">
              <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                {row.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[13px] font-semibold text-gray-700">{row.label}</p>
                  <span className="text-[12px] font-bold text-gray-900">{row.score} / {row.max}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gray-800 rounded-full transition-all duration-700"
                    style={{ width: `${(row.score / row.max) * 100}%` }}
                  />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11px] text-gray-400">{row.detail}</p>
              </div>
              <ChevronRight size={13} className="text-gray-200 shrink-0" />
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
