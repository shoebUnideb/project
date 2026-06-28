import { useState, useEffect } from 'react';
import { CalendarCheck, CheckCircle2, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import {
  checkinsApi,
  type CheckIn, type CheckInPeriod,
} from '../api/orgApi';
import { useOrg } from '../context/OrgContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPeriodRange(periodType: CheckInPeriod): { start: string; end: string; label: string } {
  const now = new Date();
  if (periodType === 'weekly') {
    const day = now.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(now);
    mon.setDate(now.getDate() + diff);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return {
      start: fmt(mon),
      end:   fmt(sun),
      label: `Week of ${mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    };
  } else {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return {
      start: fmt(start),
      end:   fmt(end),
      label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    };
  }
}

const WEEKLY_QUESTIONS = [
  { key: 'went_well',   label: 'What went well this week?' },
  { key: 'challenges',  label: 'What challenges did you face?' },
  { key: 'support',     label: 'What support do you need?' },
  { key: 'feedback',    label: 'Any feedback to share?' },
];
const MONTHLY_EXTRA = [
  { key: 'accomplishments', label: 'What were your biggest accomplishments this month?' },
  { key: 'goals',           label: 'What are your goals for next month?' },
];

// ── Past Check-in Card ────────────────────────────────────────────────────────

function PastCheckinCard({ checkin }: { checkin: CheckIn }) {
  const [expanded, setExpanded] = useState(false);
  const questions = checkin.period_type === 'weekly'
    ? WEEKLY_QUESTIONS
    : [...WEEKLY_QUESTIONS, ...MONTHLY_EXTRA];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
            checkin.reviewed_at ? 'bg-emerald-100' : 'bg-gray-100'
          }`}>
            {checkin.reviewed_at
              ? <CheckCircle2 size={13} className="text-emerald-600" />
              : <Clock size={13} className="text-gray-400" />
            }
          </div>
          <div>
            <p className="text-[13px] font-semibold text-gray-900">
              {checkin.period_type === 'weekly' ? 'Weekly' : 'Monthly'} · {' '}
              {new Date(checkin.period_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
              {new Date(checkin.period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
            <p className="text-[11.5px] text-gray-400">
              Submitted {new Date(checkin.submitted_at).toLocaleDateString()} ·{' '}
              {checkin.reviewed_at
                ? <span className="text-emerald-600">Reviewed</span>
                : <span className="text-gray-400">Pending Review</span>
              }
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-gray-400 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          {questions.map(q => (
            <div key={q.key}>
              <p className="text-[11.5px] font-semibold text-gray-500 mb-1">{q.label}</p>
              <p className="text-[13px] text-gray-700 leading-relaxed">
                {checkin.responses[q.key] || <span className="text-gray-300 italic">No response</span>}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Admin Review Row ──────────────────────────────────────────────────────────

function AdminCheckinRow({
  checkin,
  onReviewed,
}: {
  checkin: CheckIn;
  onReviewed: (updated: CheckIn) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [reviewErr, setReviewErr]   = useState('');
  const [expanded, setExpanded]     = useState(false);
  const questions = checkin.period_type === 'weekly'
    ? WEEKLY_QUESTIONS
    : [...WEEKLY_QUESTIONS, ...MONTHLY_EXTRA];

  const doReview = async () => {
    setSaving(true);
    setReviewErr('');
    try {
      const updated = await checkinsApi.reviewCheckin(checkin.id);
      onReviewed(updated);
      setConfirming(false);
    } catch { setReviewErr('Failed to mark as reviewed. Please try again.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${
                checkin.period_type === 'weekly' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
              }`}>
                {checkin.period_type === 'weekly' ? 'Weekly' : 'Monthly'}
              </span>
              {checkin.reviewed_at
                ? <span className="text-[10.5px] font-semibold text-emerald-600 flex items-center gap-0.5"><CheckCircle2 size={10} /> Reviewed</span>
                : <span className="text-[10.5px] text-gray-400">Pending Review</span>
              }
            </div>
            <p className="text-[13px] font-semibold text-gray-900">{checkin.member_name}</p>
            <p className="text-[11.5px] text-gray-400">
              {new Date(checkin.period_start).toLocaleDateString()} – {new Date(checkin.period_end).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={() => setExpanded(e => !e)}
            className="shrink-0 text-[12px] font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
          >
            {expanded ? 'Hide' : 'View'} {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2.5">
            {questions.map(q => (
              <div key={q.key}>
                <p className="text-[11.5px] font-semibold text-gray-500 mb-0.5">{q.label}</p>
                <p className="text-[12.5px] text-gray-700 leading-relaxed">
                  {checkin.responses[q.key] || <span className="text-gray-300 italic">No response</span>}
                </p>
              </div>
            ))}
          </div>
        )}

        {!checkin.reviewed_at && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            {confirming ? (
              <div className="px-3 py-2.5 bg-teal-50 border border-teal-100 rounded-xl space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[12.5px] text-teal-800 font-medium">Mark this check-in as reviewed?</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => { setConfirming(false); setReviewErr(''); }} disabled={saving} className="px-3 py-1.5 text-[12px] font-semibold text-gray-600 hover:bg-white rounded-lg disabled:opacity-60">Cancel</button>
                    <button
                      onClick={doReview}
                      disabled={saving}
                      className="px-3 py-1.5 text-[12px] font-semibold text-white bg-teal-500 hover:bg-teal-600 disabled:opacity-60 rounded-lg"
                    >
                      {saving ? 'Saving…' : 'Confirm'}
                    </button>
                  </div>
                </div>
                {reviewErr && <p className="text-[11.5px] text-red-600">{reviewErr}</p>}
              </div>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl"
              >
                <CheckCircle2 size={12} /> Mark as Reviewed
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Check-in Form ─────────────────────────────────────────────────────────────

function CheckinForm({
  periodType,
  onSubmitted,
}: {
  periodType: CheckInPeriod;
  onSubmitted: (c: CheckIn) => void;
}) {
  const range = getPeriodRange(periodType);
  const questions = periodType === 'weekly'
    ? WEEKLY_QUESTIONS
    : [...WEEKLY_QUESTIONS, ...MONTHLY_EXTRA];

  const [responses, setResponses] = useState<Record<string, string>>({});
  const [confirm, setConfirm]     = useState(false);
  const [submitting, setSubmit]   = useState(false);
  const [error, setError]         = useState('');

  const set = (key: string, val: string) => setResponses(r => ({ ...r, [key]: val }));

  const doSubmit = async () => {
    setSubmit(true);
    setConfirm(false);
    setError('');
    try {
      const created = await checkinsApi.submitCheckin({
        period_type:  periodType,
        period_start: range.start,
        period_end:   range.end,
        responses,
      });
      onSubmitted(created);
      setResponses({});
    } catch {
      setError('Failed to submit. Please try again.');
    } finally {
      setSubmit(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
      <div>
        <p className="text-[14px] font-bold text-gray-900">
          {periodType === 'weekly' ? 'Weekly' : 'Monthly'} Check-in
        </p>
        <p className="text-[12px] text-gray-400 mt-0.5">{range.label}</p>
      </div>

      {error && (
        <p className="text-[12.5px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
      )}

      {questions.map(q => (
        <div key={q.key}>
          <label className="block text-[12.5px] font-semibold text-gray-700 mb-1.5">{q.label}</label>
          <textarea
            value={responses[q.key] ?? ''}
            onChange={e => set(q.key, e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
            placeholder="Write your response..."
          />
        </div>
      ))}

      {!confirm ? (
        <button
          onClick={() => { setError(''); setConfirm(true); }}
          disabled={submitting}
          className="w-full py-2.5 text-[13px] font-semibold text-white bg-teal-500 hover:bg-teal-600 disabled:opacity-60 rounded-xl transition-colors"
        >
          Submit Check-in
        </button>
      ) : (
        <div className="px-3 py-2.5 bg-teal-50 border border-teal-100 rounded-xl space-y-2">
          <p className="text-[12.5px] text-teal-800 font-medium">
            Submit your {periodType === 'weekly' ? 'weekly' : 'monthly'} check-in for{' '}
            <span className="font-bold">{range.label}</span>?
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={doSubmit}
              disabled={submitting}
              className="px-3 py-1.5 text-[12px] font-semibold text-white bg-teal-500 hover:bg-teal-600 disabled:opacity-60 rounded-lg"
            >
              {submitting ? 'Submitting…' : 'Confirm'}
            </button>
            <button onClick={() => setConfirm(false)} className="px-3 py-1.5 text-[12px] font-semibold text-gray-600 hover:bg-gray-100 rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OrgCheckins() {
  const { isSuperadmin, canManageMembers } = useOrg();
  const isAdmin = isSuperadmin || canManageMembers;

  const [checkins, setCheckins]   = useState<CheckIn[]>([]);
  const [loading, setLoading]     = useState(true);
  const [period, setPeriod]       = useState<CheckInPeriod>('weekly');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    checkinsApi.getCheckins()
      .then(setCheckins)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const currentRange = getPeriodRange(period);
  const alreadySubmitted = checkins.some(
    c => c.period_type === period && c.period_start === currentRange.start
  );

  const handleSubmitted = (c: CheckIn) => {
    setCheckins(prev => [c, ...prev]);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  const updateCheckin = (updated: CheckIn) =>
    setCheckins(cs => cs.map(c => c.id === updated.id ? updated : c));

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-100 rounded-xl animate-pulse w-40" />
        {[...Array(2)].map((_, i) => <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Check-ins</h1>
        <p className="text-gray-500 text-sm">
          {isAdmin ? 'Review member check-ins and reflections' : 'Share your weekly or monthly reflections'}
        </p>
      </div>

      {/* Success toast */}
      {submitted && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-2xl">
          <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
          <p className="text-[13px] font-semibold text-emerald-700">Check-in submitted successfully!</p>
        </div>
      )}

      {/* Period toggle + form (member only) */}
      {!isAdmin && (
        <div className="mb-6">
          <div className="flex items-center gap-1 mb-4 p-1 bg-gray-100 rounded-xl w-fit">
            {(['weekly', 'monthly'] as CheckInPeriod[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-1.5 text-[13px] font-semibold rounded-lg transition-colors capitalize ${
                  period === p ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p === 'weekly' ? 'Weekly' : 'Monthly'}
              </button>
            ))}
          </div>

          {alreadySubmitted ? (
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-2xl">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <p className="text-[13px] font-semibold text-emerald-700">
                You've already submitted your {period === 'weekly' ? 'weekly' : 'monthly'} check-in for {currentRange.label}.
              </p>
            </div>
          ) : (
            <CheckinForm periodType={period} onSubmitted={handleSubmitted} />
          )}
        </div>
      )}

      {/* Past check-ins list */}
      <div>
        <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-3">
          {isAdmin ? 'All Check-ins' : 'Past Check-ins'}
        </p>
        {checkins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mb-4">
              <CalendarCheck size={28} className="text-teal-400" />
            </div>
            <p className="text-[15px] font-semibold text-gray-700">No check-ins yet</p>
            <p className="text-[13px] text-gray-400 mt-1">
              {!isAdmin ? 'Submit your first check-in using the form above.' : ''}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {isAdmin
              ? checkins.map(c => <AdminCheckinRow key={c.id} checkin={c} onReviewed={updateCheckin} />)
              : checkins.map(c => <PastCheckinCard key={c.id} checkin={c} />)
            }
          </div>
        )}
      </div>
    </div>
  );
}
