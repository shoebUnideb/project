import { useState, useEffect } from 'react';
import { UserPlus, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock, X } from 'lucide-react';
import { recruitmentApi, type RecruitmentRequest } from '../api/orgApi';
import { useOrg } from '../context/OrgContext';
import ConfirmDialog from '../components/ConfirmDialog';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type RStatus = RecruitmentRequest['status'];

function StatusBadge({ status }: { status: RStatus }) {
  if (status === 'approved') return (
    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
      <CheckCircle2 size={10} /> Approved
    </span>
  );
  if (status === 'rejected') return (
    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
      <XCircle size={10} /> Rejected
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
      <Clock size={10} /> Pending
    </span>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function RecruitmentSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 bg-gray-100 rounded-xl w-40 animate-pulse" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
      ))}
    </div>
  );
}

// ── Review strip ──────────────────────────────────────────────────────────────

function ReviewStrip({
  id,
  onReviewed,
}: {
  id: number;
  onReviewed: (updated: RecruitmentRequest) => void;
}) {
  const [action, setAction]         = useState<'approve' | 'reject' | null>(null);
  const [note, setNote]             = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewErr, setReviewErr]   = useState<string | null>(null);

  const confirm = async () => {
    if (!action) return;
    setSubmitting(true);
    setReviewErr(null);
    try {
      const updated = await recruitmentApi.reviewRequest(id, action, note.trim() || undefined);
      onReviewed(updated);
    } catch {
      setReviewErr('Failed to save review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!action) {
    return (
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
        <button
          onClick={() => setAction('approve')}
          className="px-3 py-1.5 text-[12px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg"
        >
          Approve
        </button>
        <button
          onClick={() => setAction('reject')}
          className="px-3 py-1.5 text-[12px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg"
        >
          Reject
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        disabled={submitting}
        rows={2}
        placeholder="Optional note to submitter…"
        className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none disabled:opacity-60"
      />
      {reviewErr && (
        <p className="text-[12px] text-red-600 bg-red-50 border border-red-100 px-3 py-1.5 rounded-xl">{reviewErr}</p>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={confirm}
          disabled={submitting}
          className={`px-3 py-1.5 text-[12px] font-semibold text-white rounded-lg disabled:opacity-60 ${
            action === 'approve' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'
          }`}
        >
          {submitting ? 'Saving…' : action === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
        </button>
        <button
          onClick={() => { setAction(null); setNote(''); setReviewErr(null); }}
          disabled={submitting}
          className="px-3 py-1.5 text-[12px] font-semibold text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Request card ──────────────────────────────────────────────────────────────

function RequestCard({
  req,
  isAdmin,
  onReviewed,
}: {
  req: RecruitmentRequest;
  isAdmin: boolean;
  onReviewed: (updated: RecruitmentRequest) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMessage = !!req.message;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-[14px] font-bold text-gray-900">{req.candidate_name}</p>
            <StatusBadge status={req.status} />
          </div>
          {req.candidate_email && (
            <p className="text-[12px] text-gray-500">{req.candidate_email}</p>
          )}
          {req.role_suggested && (
            <p className="text-[12px] text-gray-500 mt-0.5">
              <span className="font-semibold">Role:</span> {req.role_suggested}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] text-gray-400">{fmtDate(req.created_at)}</p>
          {isAdmin && (
            <p className="text-[11px] text-gray-500 mt-0.5">
              by <span className="font-semibold">{req.submitted_by_name}</span>
            </p>
          )}
        </div>
      </div>

      {hasMessage && (
        <div className="mt-2">
          <p className={`text-[12.5px] text-gray-600 ${expanded ? '' : 'line-clamp-2'}`}>
            {req.message}
          </p>
          {req.message.length > 100 && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-0.5 text-[11.5px] font-semibold text-teal-600 hover:text-teal-700 mt-0.5"
            >
              {expanded ? <><ChevronUp size={12} /> Less</> : <><ChevronDown size={12} /> More</>}
            </button>
          )}
        </div>
      )}

      {req.status !== 'pending' && (req.reviewed_by_name || req.reviewer_note) && (
        <div className="mt-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100 text-[12px] text-gray-500">
          {req.reviewed_by_name && (
            <span className="font-semibold text-gray-700">{req.reviewed_by_name}</span>
          )}
          {req.reviewer_note && <p className="mt-0.5">{req.reviewer_note}</p>}
        </div>
      )}

      {isAdmin && req.status === 'pending' && (
        <ReviewStrip id={req.id} onReviewed={onReviewed} />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected';

export default function OrgRecruitment() {
  const { isSuperadmin, canManageMembers, orgMember, isLoading: orgLoading } = useOrg();
  const isAdmin = isSuperadmin || canManageMembers;

  const [requests, setRequests] = useState<RecruitmentRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [loadErr, setLoadErr]   = useState(false);
  const [tab, setTab]           = useState<FilterTab>('all');

  // Submit form
  const [showForm,      setShowForm]      = useState(false);
  const [candName,      setCandName]      = useState('');
  const [candEmail,     setCandEmail]     = useState('');
  const [roleHint,      setRoleHint]      = useState('');
  const [msgText,       setMsgText]       = useState('');
  const [submitting,    setSubmitting]    = useState(false);
  const [submitErr,     setSubmitErr]     = useState<string | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  useEffect(() => {
    if (orgLoading) return;
    recruitmentApi.getRequests()
      .then(setRequests)
      .catch(() => setLoadErr(true))
      .finally(() => setLoading(false));
  }, [orgLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (orgLoading || loading) return <RecruitmentSkeleton />;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const resetForm = () => {
    setShowForm(false);
    setCandName('');
    setCandEmail('');
    setRoleHint('');
    setMsgText('');
    setSubmitErr(null);
  };

  const handleSubmit = async () => {
    if (!candName.trim()) return;
    setSubmitting(true);
    setSubmitErr(null);
    try {
      const created = await recruitmentApi.submitRequest({
        candidate_name:  candName.trim(),
        candidate_email: candEmail.trim() || undefined,
        role_suggested:  roleHint.trim() || undefined,
        message:         msgText.trim() || undefined,
      });
      setRequests(prev => [created, ...prev]);
      setLoadErr(false);
      setConfirmSubmit(false);
      resetForm();
    } catch {
      setSubmitErr('Failed to submit referral.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewed = (updated: RecruitmentRequest) => {
    setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
  };

  // ── Filtered lists ───────────────────────────────────────────────────────────

  const counts: Record<FilterTab, number> = {
    all:      requests.length,
    pending:  requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };

  const filtered = isAdmin
    ? (tab === 'all' ? requests : requests.filter(r => r.status === tab))
    : requests;

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'all',      label: 'All' },
    { key: 'pending',  label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <>
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
            <UserPlus size={22} className="text-teal-500" /> Recruitment
          </h1>
          <p className="text-gray-500 text-sm">Refer candidates and track application status</p>
        </div>
        {orgMember && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-semibold text-white bg-teal-500 hover:bg-teal-600 rounded-xl transition-colors"
          >
            <UserPlus size={14} /> Submit Referral
          </button>
        )}
      </div>

      {/* Submit form */}
      {orgMember && showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-bold text-gray-700">New Referral</p>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>

          <div>
            <label className="block text-[11.5px] font-semibold text-gray-500 mb-1">Candidate Name *</label>
            <input
              value={candName}
              onChange={e => setCandName(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-60"
              placeholder="Full name"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11.5px] font-semibold text-gray-500 mb-1">Email (optional)</label>
              <input
                value={candEmail}
                onChange={e => setCandEmail(e.target.value)}
                disabled={submitting}
                type="email"
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-60"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-[11.5px] font-semibold text-gray-500 mb-1">Role Suggested (optional)</label>
              <input
                value={roleHint}
                onChange={e => setRoleHint(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-60"
                placeholder="e.g. Volunteer Coordinator"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11.5px] font-semibold text-gray-500 mb-1">Message (optional)</label>
            <textarea
              value={msgText}
              onChange={e => setMsgText(e.target.value)}
              disabled={submitting}
              rows={3}
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none disabled:opacity-60"
              placeholder="Why are you referring this candidate?"
            />
          </div>

          {submitErr && (
            <p className="text-[12.5px] text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">{submitErr}</p>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSubmitErr(null); setConfirmSubmit(true); }}
              disabled={submitting || !candName.trim()}
              className="px-4 py-2 text-[13px] font-semibold text-white bg-teal-500 hover:bg-teal-600 disabled:opacity-60 rounded-xl transition-colors"
            >
              Submit Referral
            </button>
            <button
              onClick={resetForm}
              disabled={submitting}
              className="px-4 py-2 text-[13px] font-semibold text-gray-600 hover:bg-gray-100 rounded-xl disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Admin filter tabs */}
      {isAdmin && (
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors ${
                tab === t.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              <span className={`ml-1.5 text-[10.5px] font-bold px-1.5 py-0.5 rounded-full ${
                tab === t.key ? 'bg-teal-100 text-teal-700' : 'bg-gray-200 text-gray-500'
              }`}>
                {counts[t.key]}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Member section header */}
      {!isAdmin && (
        <p className="text-[13px] font-semibold text-gray-700">My Referrals</p>
      )}

      {/* List */}
      {loadErr ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-200 text-center">
          <p className="text-[15px] font-semibold text-gray-700">Failed to load referrals</p>
          <p className="text-[13px] text-gray-400 mt-1">Please refresh the page and try again.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-200 text-center">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center mb-3">
            <UserPlus size={26} className="text-teal-400" />
          </div>
          <p className="text-[15px] font-semibold text-gray-700">
            {isAdmin
              ? tab === 'all' ? 'No referrals yet' : `No ${tab} referrals`
              : 'No referrals submitted yet'}
          </p>
          <p className="text-[13px] text-gray-400 mt-1">
            {isAdmin
              ? 'Referrals submitted by members will appear here.'
              : 'Use the button above to refer a candidate.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => (
            <RequestCard
              key={req.id}
              req={req}
              isAdmin={isAdmin}
              onReviewed={handleReviewed}
            />
          ))}
        </div>
      )}
    </div>

      {confirmSubmit && (
        <ConfirmDialog
          title="Submit referral?"
          message={`Submit ${candName.trim()} as a candidate referral? This will be sent to your admin for review.`}
          confirmLabel="Submit Referral"
          loading={submitting}
          onConfirm={handleSubmit}
          onCancel={() => setConfirmSubmit(false)}
        />
      )}
    </>
  );
}
