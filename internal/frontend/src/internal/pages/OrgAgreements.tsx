import { useState, useEffect, useRef } from 'react';
import { FileText, CheckCircle2, ChevronDown, ChevronUp, Plus, X, Paperclip } from 'lucide-react';
import { agreementsApi, type OrgAgreement, type AgreementSignature } from '../api/orgApi';
import { useOrg } from '../context/OrgContext';
import ConfirmDialog from '../components/ConfirmDialog';
import PageHelp, { type PageHelpSection } from '../components/PageHelp';

const AGREEMENTS_HELP: PageHelpSection[] = [
  {
    eyebrow: '1 · What are Agreements?',
    bullets: [
      '**Agreements** are binding documents assigned to you by your admin — contracts, NDAs, policy sign-offs, and consent forms.',
      'You must sign each required agreement before you can progress in your role or access certain resources.',
    ],
  },
  {
    eyebrow: '2 · Signing an Agreement',
    bullets: [
      'Click **Sign** on any pending agreement to open the document viewer.',
      'Read the full document, then confirm your signature to lock the record.',
      'A timestamp is generated automatically and the admin is notified.',
    ],
  },
  {
    eyebrow: '3 · Status',
    bullets: [
      '**Pending** — assigned to you, awaiting your signature.',
      '**Signed** — you have signed; the record is locked.',
      '**Approved** — admin has reviewed and accepted your signed copy.',
      '**Expired** — the agreement has passed its expiry date; contact your admin.',
    ],
  },
  {
    eyebrow: '4 · Expiry',
    bullets: [
      'Some agreements have an **expiry date** — you will be notified when one is approaching.',
      'Once expired, the agreement may need to be re-signed with an updated version.',
    ],
  },
  {
    eyebrow: 'Tip',
    body: 'Keep the **Pending** tab clear — unsigned agreements can block access to features or delay onboarding milestones.',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadge({ status }: { status: OrgAgreement['status'] }) {
  const cls =
    status === 'active'   ? 'bg-teal-50 text-teal-700' :
    status === 'archived' ? 'bg-amber-50 text-amber-700' :
                            'bg-gray-100 text-gray-500';
  return (
    <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full capitalize ${cls}`}>
      {status}
    </span>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function AgreementsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 bg-gray-100 rounded-xl w-40 animate-pulse" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OrgAgreements() {
  const { isSuperadmin, canManageMembers, orgMember, isLoading: orgLoading } = useOrg();
  const isAdmin = isSuperadmin || canManageMembers;

  const [agreements, setAgreements] = useState<OrgAgreement[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadErr, setLoadErr]       = useState(false);

  // New agreement form
  const [showForm,   setShowForm]   = useState(false);
  const [formTitle,  setFormTitle]  = useState('');
  const [formDesc,   setFormDesc]   = useState('');
  const [formVer,    setFormVer]    = useState('1.0');
  const [formFile,   setFormFile]   = useState<File | null>(null);
  const [creating,   setCreating]   = useState(false);
  const [createErr,  setCreateErr]  = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Per-card state
  const [signingId,    setSigningId]    = useState<number | null>(null);
  const [signConfirm,  setSignConfirm]  = useState<number | null>(null);
  const [signErr,      setSignErr]      = useState<number | null>(null);
  const [deletingId,   setDeletingId]   = useState<number | null>(null);
  const [deleteConfirm,setDeleteConfirm]= useState<number | null>(null);
  const [togglingId,   setTogglingId]   = useState<number | null>(null);
  const [actionErr,    setActionErr]    = useState<{ id: number; msg: string } | null>(null);
  const [toggleConfirm, setToggleConfirm] = useState<{ id: number; newStatus: 'active' | 'archived' } | null>(null);

  // Signatures drawer
  const [sigsOpen, setSigsOpen]         = useState<number | null>(null);
  const [sigsData, setSigsData]         = useState<Record<number, AgreementSignature[] | null>>({});
  const [sigsLoading, setSigsLoading]   = useState<number | null>(null);

  useEffect(() => {
    if (orgLoading) return;
    agreementsApi.getAgreements()
      .then(setAgreements)
      .catch(() => setLoadErr(true))
      .finally(() => setLoading(false));
  }, [orgLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (orgLoading || loading) return <AgreementsSkeleton />;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const resetForm = () => {
    setShowForm(false);
    setFormTitle('');
    setFormDesc('');
    setFormVer('1.0');
    setFormFile(null);
    setCreateErr(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleCreate = async () => {
    if (!formTitle.trim()) return;
    setCreating(true);
    setCreateErr(null);
    try {
      const fd = new FormData();
      fd.append('title', formTitle.trim());
      fd.append('description', formDesc.trim());
      fd.append('version', formVer.trim() || '1.0');
      if (formFile) fd.append('file', formFile);
      const created = await agreementsApi.createAgreement(fd);
      setLoadErr(false);
      setAgreements(prev => [created, ...prev]);
      resetForm();
    } catch {
      setCreateErr('Failed to create agreement.');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (id: number, newStatus: OrgAgreement['status']) => {
    setTogglingId(id);
    setActionErr(null);
    try {
      const updated = await agreementsApi.updateAgreement(id, { status: newStatus });
      setAgreements(prev => prev.map(a => a.id === id ? updated : a));
    } catch {
      setActionErr({ id, msg: `Failed to ${newStatus === 'active' ? 'activate' : 'archive'} agreement.` });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    setActionErr(null);
    try {
      await agreementsApi.deleteAgreement(id);
      setAgreements(prev => prev.filter(a => a.id !== id));
    } catch {
      setActionErr({ id, msg: 'Failed to delete agreement.' });
    } finally {
      setDeletingId(null);
      setDeleteConfirm(null);
    }
  };

  const handleSign = async (id: number) => {
    setSigningId(id);
    setSignConfirm(null);
    setSignErr(null);
    try {
      await agreementsApi.signAgreement(id);
      setAgreements(prev => prev.map(a =>
        a.id === id ? { ...a, signed_by_me: true, signature_count: a.signature_count + 1 } : a
      ));
      // Clear stale drawer cache so it re-fetches fresh signatures on next open
      setSigsData(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch {
      setSignErr(id);
    } finally {
      setSigningId(null);
    }
  };

  const toggleSignatures = async (id: number) => {
    if (sigsOpen === id) {
      setSigsOpen(null);
      return;
    }
    setSigsOpen(id);
    if (sigsData[id] !== undefined && sigsData[id] !== null) return;
    setSigsLoading(id);
    try {
      const data = await agreementsApi.getSignatures(id);
      setSigsData(prev => ({ ...prev, [id]: data }));
    } catch {
      setSigsData(prev => ({ ...prev, [id]: null }));
    } finally {
      setSigsLoading(null);
    }
  };

  return (
    <>
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText size={22} className="text-teal-500" /> Agreements
            </h1>
            <PageHelp title="How Agreements Work" sections={AGREEMENTS_HELP} />
          </div>
          <p className="text-gray-500 text-sm">Sign and manage your organisation agreements</p>
        </div>
        {isAdmin && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-semibold text-white bg-teal-500 hover:bg-teal-600 rounded-xl transition-colors"
          >
            <Plus size={14} /> New Agreement
          </button>
        )}
      </div>

      {/* New Agreement form */}
      {isAdmin && showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-bold text-gray-700">New Agreement</p>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>

          <div>
            <label className="block text-[11.5px] font-semibold text-gray-500 mb-1">Title *</label>
            <input
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              disabled={creating}
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-60"
              placeholder="e.g. Volunteer Non-Disclosure Agreement"
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-semibold text-gray-500 mb-1">Description</label>
            <textarea
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              disabled={creating}
              rows={2}
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none disabled:opacity-60"
              placeholder="Brief description"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11.5px] font-semibold text-gray-500 mb-1">Version</label>
              <input
                value={formVer}
                onChange={e => setFormVer(e.target.value)}
                disabled={creating}
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-60"
                placeholder="1.0"
              />
            </div>
            <div>
              <label className="block text-[11.5px] font-semibold text-gray-500 mb-1">File (optional)</label>
              <input
                type="file"
                ref={fileRef}
                className="hidden"
                onChange={e => setFormFile(e.target.files?.[0] ?? null)}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={creating}
                className="w-full flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl disabled:opacity-60"
              >
                <Paperclip size={13} />
                {formFile ? formFile.name.slice(0, 18) + '…' : 'Attach file'}
              </button>
            </div>
          </div>

          {createErr && (
            <p className="text-[12.5px] text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">{createErr}</p>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !formTitle.trim()}
              className="px-4 py-2 text-[13px] font-semibold text-white bg-teal-500 hover:bg-teal-600 disabled:opacity-60 rounded-xl transition-colors"
            >
              {creating ? 'Creating…' : 'Create Agreement'}
            </button>
            <button
              onClick={resetForm}
              disabled={creating}
              className="px-4 py-2 text-[13px] font-semibold text-gray-600 hover:bg-gray-100 rounded-xl disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Agreement list */}
      {loadErr ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-200 text-center">
          <p className="text-[15px] font-semibold text-gray-700">Failed to load agreements</p>
          <p className="text-[13px] text-gray-400 mt-1">Please refresh the page and try again.</p>
        </div>
      ) : agreements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-200 text-center">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center mb-3">
            <FileText size={26} className="text-teal-400" />
          </div>
          <p className="text-[15px] font-semibold text-gray-700">No agreements yet</p>
          <p className="text-[13px] text-gray-400 mt-1">
            {isAdmin ? 'Create the first agreement above.' : 'Agreements will appear here once published.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {agreements.map(a => (
            <div key={a.id} className="bg-white rounded-2xl border border-gray-200 p-5">
              {/* Card header */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-[14px] font-bold text-gray-900">{a.title}</p>
                    <span className="text-[10.5px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      v{a.version}
                    </span>
                    {isAdmin && <StatusBadge status={a.status} />}
                  </div>
                  {a.description && (
                    <p className="text-[12.5px] text-gray-500 mt-0.5 line-clamp-2">{a.description}</p>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Signature count pill */}
                    <button
                      onClick={() => toggleSignatures(a.id)}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11.5px] font-semibold text-gray-500 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg"
                    >
                      {a.signature_count} signed
                      {sigsOpen === a.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>
                )}
              </div>

              {/* File link */}
              {a.file_url && (
                <a
                  href={a.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-teal-600 hover:text-teal-700 mb-3"
                >
                  <Paperclip size={12} /> View document
                </a>
              )}

              {/* Signatures drawer (admin only) */}
              {isAdmin && sigsOpen === a.id && (
                <div className="mb-3 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
                  {sigsLoading === a.id ? (
                    <p className="text-[12px] text-gray-400">Loading…</p>
                  ) : sigsData[a.id] === null ? (
                    <p className="text-[12px] text-red-500">Failed to load signatures. Click to retry.</p>
                  ) : !sigsData[a.id] || sigsData[a.id]!.length === 0 ? (
                    <p className="text-[12px] text-gray-400">No signatures yet.</p>
                  ) : (
                    <ul className="space-y-1">
                      {sigsData[a.id]!.map(sig => (
                        <li key={sig.id} className="flex items-center justify-between">
                          <span className="text-[12.5px] font-medium text-gray-700">{sig.member_name}</span>
                          <span className="text-[11px] text-gray-400">{fmtDate(sig.signed_at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Admin action row — only for non-archived statuses */}
              {isAdmin && a.status !== 'archived' && (
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {a.status === 'draft' && (
                    <>
                      <button
                        onClick={() => setToggleConfirm({ id: a.id, newStatus: 'active' })}
                        disabled={togglingId === a.id}
                        className="px-3 py-1.5 text-[12px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg disabled:opacity-60"
                      >
                        Activate
                      </button>
                      {deleteConfirm === a.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleDelete(a.id)}
                            disabled={deletingId === a.id}
                            className="px-3 py-1.5 text-[12px] font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-60"
                          >
                            {deletingId === a.id ? 'Deleting…' : 'Confirm Delete'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            disabled={deletingId === a.id}
                            className="px-3 py-1.5 text-[12px] font-semibold text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(a.id)}
                          disabled={togglingId === a.id}
                          className="px-3 py-1.5 text-[12px] font-semibold text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-60"
                        >
                          Delete
                        </button>
                      )}
                    </>
                  )}
                  {a.status === 'active' && (
                    <button
                      onClick={() => setToggleConfirm({ id: a.id, newStatus: 'archived' })}
                      disabled={togglingId === a.id}
                      className="px-3 py-1.5 text-[12px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg disabled:opacity-60"
                    >
                      Archive
                    </button>
                  )}
                  {actionErr?.id === a.id && (
                    <p className="w-full text-[11.5px] text-red-600 mt-0.5">{actionErr.msg}</p>
                  )}
                </div>
              )}

              {/* Sign row — all users */}
              {(a.signed_by_me || (a.status === 'active' && !!orgMember)) && (
              <div className="border-t border-gray-100 pt-3 mt-1">
                {a.signed_by_me ? (
                  <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-emerald-600">
                    <CheckCircle2 size={14} /> Signed
                  </div>
                ) : (
                  orgMember && (
                  <div className="space-y-1.5">
                    {signConfirm === a.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSign(a.id)}
                          disabled={signingId === a.id}
                          className="px-3 py-1.5 text-[12px] font-semibold text-white bg-teal-500 hover:bg-teal-600 rounded-lg disabled:opacity-60"
                        >
                          {signingId === a.id ? 'Signing…' : 'Confirm Sign'}
                        </button>
                        <button
                          onClick={() => setSignConfirm(null)}
                          className="px-3 py-1.5 text-[12px] font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setSignConfirm(a.id); setSignErr(null); }}
                        disabled={signingId === a.id}
                        className="px-3 py-1.5 text-[12px] font-semibold text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg disabled:opacity-60"
                      >
                        Sign Agreement
                      </button>
                    )}
                    {signErr === a.id && (
                      <p className="text-[11.5px] text-red-600">Failed to sign. Please try again.</p>
                    )}
                  </div>
                  )
                )}
              </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>

      {toggleConfirm && (
        <ConfirmDialog
          title={toggleConfirm.newStatus === 'active' ? 'Activate agreement?' : 'Archive agreement?'}
          message={
            toggleConfirm.newStatus === 'active'
              ? 'This will publish the agreement to all members, who will then be able to sign it.'
              : 'This will hide the agreement from all members. They will no longer be able to sign it.'
          }
          confirmLabel={toggleConfirm.newStatus === 'active' ? 'Activate' : 'Archive'}
          danger={toggleConfirm.newStatus === 'archived'}
          loading={togglingId === toggleConfirm.id}
          onConfirm={() => { handleStatusChange(toggleConfirm.id, toggleConfirm.newStatus); setToggleConfirm(null); }}
          onCancel={() => setToggleConfirm(null)}
        />
      )}
    </>
  );
}
