import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText, Upload, PenLine, Eye, CheckCircle2, Clock,
  AlertCircle, ListChecks, CheckCircle, XCircle, Bell, Download, X,
  CalendarDays, User, ShieldCheck, ChevronRight, ChevronLeft, Plus, Search,
  TrendingUp, MoreVertical, ChevronDown, Users,
} from 'lucide-react';
import { docApi, orgApi, type MemberDocument, type MemberDocStatus, type DocumentTemplate, type DocCategory, type DocGlobalStats, type OrgMember } from '../api/orgApi';
import { useOrg } from '../context/OrgContext';
import PageHelp, { type PageHelpSection } from '../components/PageHelp';

const DOCUMENTS_HELP: PageHelpSection[] = [
  {
    eyebrow: '1 · What are Agreements?',
    bullets: [
      'Documents are files or consent forms you assign to members — contracts, policies, certificates, agreements, and more.',
      'Each document can be an **upload type** (member submits a signed file) or a **consent type** (member clicks "I Agree").',
      'Documents are tracked per member — you can see who has signed, who is pending, and what has expired.',
    ],
  },
  {
    eyebrow: '2 · Assigning Agreements',
    bullets: [
      'Select a member on the left panel, then click **+ Assign Document** to assign from a template or create a new one.',
      'You can also use the **drop zone** at the bottom of the member panel to trigger the assign flow.',
      'Use **Doc Templates** to manage reusable document templates across your org.',
    ],
  },
  {
    eyebrow: '3 · Reviewing Submissions',
    bullets: [
      'When a member uploads a file, the status changes to **Under Review** — click **Review** to approve or reject it.',
      'For consent documents, the status updates automatically when the member clicks "I Agree".',
      'Use the **3-dot menu** on any row to approve, reject, send a reminder, copy the document reference, or delete.',
    ],
  },
  {
    eyebrow: '4 · Member Panel',
    bullets: [
      'The left panel lists all members who have documents assigned. Use **Search all members** to find any org member — even those with no documents yet.',
      'Clicking a member with no documents opens an empty state with a direct **Assign Document** button.',
      'Use **Member Actions** to bulk-remind, export, or navigate to the member\'s profile.',
    ],
  },
  {
    eyebrow: '5 · Export & Filters',
    bullets: [
      'Click **Export** to download a full CSV of all documents across all members.',
      'Use the **search, type, and status filters** in the right panel to narrow down a specific member\'s documents.',
    ],
  },
  {
    eyebrow: 'Tip',
    body: 'Set an expiration date when assigning a document — members will be reminded automatically before it expires, and you\'ll see expiring documents highlighted in the table.',
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<MemberDocStatus, string> = {
  assigned:       'bg-gray-100 text-gray-600',
  uploaded:       'bg-gray-100 text-gray-600',
  pending_review: 'bg-gray-100 text-gray-600',
  approved:       'bg-gray-100 text-gray-700',
  rejected:       'bg-gray-100 text-gray-600',
  signed:         'bg-gray-900 text-white',
};
const STATUS_LABEL: Record<MemberDocStatus, string> = {
  assigned:       'Assigned',
  uploaded:       'Uploaded',
  pending_review: 'Pending Review',
  approved:       'Approved',
  rejected:       'Revision Needed',
  signed:         'Signed',
};

// Admin document table — different label mapping
const ADMIN_STATUS_BADGE: Record<MemberDocStatus, { cls: string; label: string }> = {
  assigned:       { cls: 'bg-gray-100 text-gray-600',  label: 'Pending' },
  uploaded:       { cls: 'bg-gray-100 text-gray-600',  label: 'Under Review' },
  pending_review: { cls: 'bg-gray-100 text-gray-600',  label: 'Under Review' },
  approved:       { cls: 'bg-gray-100 text-gray-700',  label: 'Approved' },
  rejected:       { cls: 'bg-gray-100 text-gray-600',  label: 'Rejected' },
  signed:         { cls: 'bg-gray-900 text-white',     label: 'Signed' },
};

const CAT_BADGE: Record<string, string> = {
  required:    'text-gray-600',
  policy:      'text-gray-600',
  form:        'text-gray-600',
  certificate: 'text-gray-600',
  agreement:   'text-gray-600',
};
const CAT_LABEL: Record<string, string> = {
  required: 'Required', policy: 'Policy', form: 'Form',
  certificate: 'Certificate', agreement: 'Agreement',
};

type TabKey = 'all' | 'pending' | 'signed' | 'expired';

const MEM_STATUS_BADGE: Record<MemberDocStatus, { cls: string; label: string }> = {
  assigned:       { cls: '', label: 'Pending' },
  uploaded:       { cls: '', label: 'Under Review' },
  pending_review: { cls: '', label: 'Under Review' },
  approved:       { cls: '', label: 'Approved' },
  rejected:       { cls: '', label: 'Revision Needed' },
  signed:         { cls: '', label: 'Signed' },
};

function fmtDate(s: string | null) {
  if (!s) return null;
  return new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Action Buttons (shared between card and modal) ─────────────────────────────

function DocActions({ doc, onUploaded, onSigned, compact = false }: {
  doc: MemberDocument;
  onUploaded: (d: MemberDocument) => void;
  onSigned:   (d: MemberDocument) => void;
  compact?: boolean;
}) {
  const [uploading, setUploading]     = useState(false);
  const [signing, setSigning]         = useState(false);
  const [confirmSign, setConfirmSign] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadErr, setUploadErr]     = useState('');
  const [signErr, setSignErr]         = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const confirmUpload = async () => {
    if (!pendingFile) return;
    setUploading(true); setUploadErr('');
    const file = pendingFile; setPendingFile(null);
    try {
      const updated = await docApi.uploadMyDocument(doc.id, file);
      onUploaded(updated);
    } catch { setUploadErr('Upload failed. Please try again.'); }
    finally { setUploading(false); }
  };

  const handleSign = async () => {
    setSigning(true); setSignErr(''); setConfirmSign(false);
    try {
      const updated = await docApi.signMyDocument(doc.id);
      onSigned(updated);
    } catch { setSignErr('Failed to sign. Please try again.'); }
    finally { setSigning(false); }
  };

  const isConsent = doc.requires_signature;
  const isSigned  = doc.status === 'signed';
  const canAgreeSign = isConsent && doc.status === 'assigned';
  const canReSign    = isConsent && isSigned && doc.allow_resign;
  const canUpload    = !isConsent && (doc.status === 'assigned' || doc.status === 'rejected');
  const canSign      = !isConsent && doc.status === 'approved' && !doc.signed_at;

  const btnSm = compact ? 'px-2.5 py-1.5 text-[11.5px]' : 'px-3 py-1.5 text-[12px]';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Template file download */}
        {isConsent && doc.template_file_url && (doc.status === 'assigned' || canReSign) && (
          <a href={doc.template_file_url} target="_blank" rel="noopener noreferrer"
            className={`flex items-center gap-1.5 ${btnSm} font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors`}>
            <Download size={12} /> Download
          </a>
        )}
        {/* View submitted file */}
        {doc.file_url && !isConsent && (
          <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
            className={`flex items-center gap-1.5 ${btnSm} font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors`}>
            <Eye size={12} /> View File
          </a>
        )}
        {/* Upload */}
        {canUpload && (
          <>
            <input type="file" ref={fileRef} className="hidden" onChange={handleFile} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading || !!pendingFile}
              className={`flex items-center gap-1.5 ${btnSm} font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl transition-colors`}>
              <Upload size={12} /> {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </>
        )}
        {/* Upload-mode sign */}
        {canSign && (
          <button onClick={() => setConfirmSign(true)} disabled={signing}
            className={`flex items-center gap-1.5 ${btnSm} font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl transition-colors`}>
            <PenLine size={12} /> {signing ? 'Signing...' : 'Sign'}
          </button>
        )}
        {/* Consent: I Agree & Sign */}
        {canAgreeSign && (
          <button onClick={() => setConfirmSign(true)} disabled={signing}
            className={`flex items-center gap-1.5 ${btnSm} font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-xl transition-colors`}>
            <CheckCircle2 size={12} /> {signing ? 'Signing...' : 'I Agree & Sign'}
          </button>
        )}
        {/* Consent: Re-sign */}
        {canReSign && (
          <button onClick={() => setConfirmSign(true)} disabled={signing}
            className={`flex items-center gap-1.5 ${btnSm} font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl transition-colors`}>
            <PenLine size={12} /> {signing ? 'Signing...' : 'Re-sign'}
          </button>
        )}
      </div>

      {/* Upload confirm popup */}
      {pendingFile && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => !uploading && setPendingFile(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Upload size={20} className="text-gray-600" />
            </div>
            <h3 className="text-[15px] font-bold text-gray-900 text-center mb-1">Upload Agreement</h3>
            <p className="text-[12.5px] text-gray-500 text-center mb-5 leading-relaxed">
              Upload <span className="font-semibold text-gray-700">"{pendingFile.name}"</span> as your submission for <span className="font-semibold text-gray-700">"{doc.title}"</span>?
            </p>
            {uploadErr && <p className="text-[11.5px] text-red-500 text-center mb-3">{uploadErr}</p>}
            <div className="flex gap-2">
              <button onClick={() => setPendingFile(null)} disabled={uploading}
                className="flex-1 px-4 py-2.5 text-[13px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl disabled:opacity-60 transition-colors">
                Cancel
              </button>
              <button onClick={confirmUpload} disabled={uploading}
                className="flex-1 px-4 py-2.5 text-[13px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-xl disabled:opacity-60 transition-colors">
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Sign / consent confirm popup */}
      {confirmSign && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => !signing && setConfirmSign(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <PenLine size={20} className="text-gray-600" />
            </div>
            <h3 className="text-[15px] font-bold text-gray-900 text-center mb-1">
              {isConsent ? 'Sign & Agree' : 'Sign Agreement'}
            </h3>
            <p className="text-[12.5px] text-gray-500 text-center mb-5 leading-relaxed">
              {isConsent
                ? 'By confirming, you agree to the terms of this document. Your consent will be recorded and timestamped.'
                : `Confirm you have read and accept "${doc.title}".`}
            </p>
            {signErr && <p className="text-[11.5px] text-red-500 text-center mb-3">{signErr}</p>}
            <div className="flex gap-2">
              <button onClick={() => setConfirmSign(false)} disabled={signing}
                className="flex-1 px-4 py-2.5 text-[13px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl disabled:opacity-60 transition-colors">
                Cancel
              </button>
              <button onClick={handleSign} disabled={signing}
                className="flex-1 px-4 py-2.5 text-[13px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-xl disabled:opacity-60 transition-colors">
                {signing ? 'Signing…' : 'Confirm & Sign'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Document Detail Modal ──────────────────────────────────────────────────────

function DocDetailModal({ doc, onClose, onUploaded, onSigned }: {
  doc: MemberDocument;
  onClose: () => void;
  onUploaded: (d: MemberDocument) => void;
  onSigned:   (d: MemberDocument) => void;
}) {
  const isConsent = doc.requires_signature;
  const isSigned  = doc.status === 'signed';

  const handleUploaded = (d: MemberDocument) => { onUploaded(d); };
  const handleSigned   = (d: MemberDocument) => { onSigned(d); };

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
              <FileText size={16} className="text-gray-500" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold text-gray-900 leading-snug">{doc.title}</h2>
              {doc.template_name && doc.template_name !== doc.title && (
                <p className="text-[11.5px] text-gray-400 mt-0.5">Template: {doc.template_name}</p>
              )}
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${CAT_BADGE[doc.category] ?? 'text-gray-500'}`}>
                  {CAT_LABEL[doc.category] ?? doc.category}
                </span>
                {isConsent && (
                  <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Consent</span>
                )}
                <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[doc.status]}`}>
                  {STATUS_LABEL[doc.status]}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 shrink-0 ml-2">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4 flex-1 space-y-4">

          {/* Description */}
          {doc.template_description && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Description</p>
              <p className="text-[13px] text-gray-700 leading-relaxed">{doc.template_description}</p>
            </div>
          )}

          {/* Status timeline / meta */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Details</p>
            <div className="bg-gray-50 rounded-xl divide-y divide-gray-100">
              {[
                { icon: <CalendarDays size={12} />, label: 'Assigned on',   value: fmtDate(doc.uploaded_at) },
                doc.reviewed_at
                  ? { icon: <CheckCircle2 size={12} />, label: 'Reviewed on', value: fmtDate(doc.reviewed_at) }
                  : null,
                doc.reviewed_by_name
                  ? { icon: <User size={12} />, label: 'Reviewed by',  value: doc.reviewed_by_name }
                  : null,
                doc.signed_at
                  ? { icon: <PenLine size={12} />, label: 'Signed on',   value: fmtDate(doc.signed_at) }
                  : null,
                doc.expiration_date
                  ? { icon: <Clock size={12} />, label: 'Expires on',  value: fmtDate(doc.expiration_date) }
                  : null,
                isConsent
                  ? { icon: <ShieldCheck size={12} />, label: 'Type',       value: 'Consent — click to agree' }
                  : { icon: <Upload size={12} />, label: 'Type',       value: 'Upload — submit a signed file' },
                doc.allow_resign
                  ? { icon: <PenLine size={12} />, label: 'Re-signing',  value: 'Allowed by admin' }
                  : null,
              ].filter(Boolean).map((row, i) => row && (
                <div key={i} className="flex items-center justify-between px-3 py-2 gap-2">
                  <div className="flex items-center gap-2 text-[11.5px] text-gray-500">
                    <span className="text-gray-400">{row.icon}</span>
                    {row.label}
                  </div>
                  <p className="text-[12px] font-semibold text-gray-800 text-right">{row.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Reviewer note */}
          {doc.reviewer_note && (
            <div className={`flex items-start gap-2.5 px-3.5 py-3 rounded-xl border ${
              'bg-gray-50 border-gray-100'
            }`}>
              <AlertCircle size={14} className={doc.status === 'rejected' ? 'text-gray-500 mt-0.5 shrink-0' : 'text-gray-400 mt-0.5 shrink-0'} />
              <div>
                <p className={`text-[11px] font-semibold mb-0.5 ${'text-gray-600'}`}>
                  {doc.status === 'rejected' ? 'Revision required' : 'Admin note'}
                </p>
                <p className={`text-[12.5px] leading-relaxed ${'text-gray-700'}`}>
                  {doc.reviewer_note}
                </p>
              </div>
            </div>
          )}

          {/* Under-review notice */}
          {!isConsent && (doc.status === 'uploaded' || doc.status === 'pending_review') && (
            <div className="flex items-center gap-2.5 px-3.5 py-3 bg-gray-50 border border-gray-100 rounded-xl">
              <Clock size={14} className="text-gray-500 shrink-0" />
              <div>
                <p className="text-[12.5px] font-semibold text-gray-700">Under review</p>
                <p className="text-[11.5px] text-gray-600 mt-0.5">Your document has been submitted and is being reviewed by the admin.</p>
              </div>
            </div>
          )}

          {/* Signed confirmation */}
          {isSigned && doc.signed_at && (
            <div className="flex items-center gap-2.5 px-3.5 py-3 bg-gray-50 border border-gray-100 rounded-xl">
              <CheckCircle2 size={14} className="text-gray-500 shrink-0" />
              <div>
                <p className="text-[12.5px] font-semibold text-gray-800">Document signed</p>
                <p className="text-[11.5px] text-gray-600 mt-0.5">Signed on {fmtDate(doc.signed_at)}</p>
              </div>
            </div>
          )}

          {/* Approved notice */}
          {doc.status === 'approved' && (
            <div className="flex items-center gap-2.5 px-3.5 py-3 bg-gray-50 border border-gray-100 rounded-xl">
              <CheckCircle2 size={14} className="text-gray-500 shrink-0" />
              <div>
                <p className="text-[12.5px] font-semibold text-gray-800">Document approved</p>
                {doc.reviewed_at && (
                  <p className="text-[11.5px] text-gray-600 mt-0.5">Approved on {fmtDate(doc.reviewed_at)}</p>
                )}
              </div>
            </div>
          )}

          {/* Template file (for consent docs always; for upload docs if exists) */}
          {doc.template_file_url && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Template Agreement</p>
              <a href={doc.template_file_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-3.5 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors group">
                <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0">
                  <FileText size={14} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-semibold text-gray-800 truncate">{doc.template_name ?? doc.title}</p>
                  <p className="text-[11px] text-gray-400">Click to view / download</p>
                </div>
                <Download size={13} className="text-gray-400 group-hover:text-gray-600 shrink-0" />
              </a>
            </div>
          )}

          {/* Submitted file */}
          {doc.file_url && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Your Submitted File</p>
              <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-3.5 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors group">
                <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0">
                  <FileText size={14} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-semibold text-gray-800 truncate">Uploaded document</p>
                  <p className="text-[11px] text-gray-400">Click to view</p>
                </div>
                <Eye size={13} className="text-gray-400 group-hover:text-gray-600 shrink-0" />
              </a>
            </div>
          )}
        </div>

        {/* Footer — actions */}
        <div className="shrink-0 px-5 py-4 border-t border-gray-100">
          <DocActions doc={doc} onUploaded={handleUploaded} onSigned={handleSigned} />
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ── Member Document Card ───────────────────────────────────────────────────────

function DocCard({ doc, onUploaded, onSigned }: {
  doc: MemberDocument;
  onUploaded: (d: MemberDocument) => void;
  onSigned:   (d: MemberDocument) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const isConsent = doc.requires_signature;
  const isSigned  = doc.status === 'signed';

  const handleUploaded = (d: MemberDocument) => { onUploaded(d); setModalOpen(false); };
  const handleSigned   = (d: MemberDocument) => { onSigned(d); };

  // Action summary for the card (read-only glance)
  const actionHint =
    (isConsent && doc.status === 'assigned') ? 'Click to read & sign' :
    (isConsent && isSigned && doc.allow_resign) ? 'Re-sign available' :
    (doc.status === 'assigned' || doc.status === 'rejected') ? 'Click to upload' :
    (doc.status === 'uploaded' || doc.status === 'pending_review') ? 'Under review' :
    null;

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="w-full text-left bg-white rounded-2xl border border-gray-200 p-4 flex flex-col gap-3 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
              <FileText size={15} className="text-gray-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[13.5px] font-bold text-gray-900 truncate leading-snug">{doc.title}</p>
              {doc.template_name && doc.template_name !== doc.title && (
                <p className="text-[11px] text-gray-400 truncate">{doc.template_name}</p>
              )}
            </div>
          </div>
          <span className={`shrink-0 text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[doc.status]}`}>
            {STATUS_LABEL[doc.status]}
          </span>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`text-[10.5px] font-medium px-1.5 py-0.5 rounded-md ${CAT_BADGE[doc.category] ?? 'text-gray-500'}`}>
            {CAT_LABEL[doc.category] ?? doc.category}
          </span>
          {isConsent && (
            <span className="text-[10.5px] font-medium px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600">Consent</span>
          )}
          {isSigned && doc.signed_at && (
            <span className="flex items-center gap-1 text-[10.5px] text-gray-500 font-medium">
              <PenLine size={10} /> Signed {fmtDate(doc.signed_at)}
            </span>
          )}
          {doc.expiration_date && (
            <span className="flex items-center gap-1 text-[10.5px] text-gray-400">
              <Clock size={10} /> Expires {fmtDate(doc.expiration_date)}
            </span>
          )}
        </div>

        {/* Description snippet */}
        {doc.template_description && (
          <p className="text-[11.5px] text-gray-500 leading-relaxed line-clamp-2">{doc.template_description}</p>
        )}

        {/* Reviewer note (rejection) */}
        {doc.reviewer_note && doc.status === 'rejected' && (
          <div className="flex items-start gap-1.5 px-2.5 py-2 bg-gray-50 border border-gray-100 rounded-lg">
            <AlertCircle size={12} className="text-gray-500 mt-0.5 shrink-0" />
            <p className="text-[11.5px] text-gray-700 line-clamp-2">{doc.reviewer_note}</p>
          </div>
        )}

        {/* Action hint */}
        {actionHint && (
          <p className="text-[11px] text-gray-500 font-medium mt-auto">{actionHint} →</p>
        )}
      </button>

      {modalOpen && (
        <DocDetailModal
          doc={doc}
          onClose={() => setModalOpen(false)}
          onUploaded={handleUploaded}
          onSigned={handleSigned}
        />
      )}
    </>
  );
}

// ── Admin Document Detail Modal ────────────────────────────────────────────────

function AdminDocDetailModal({ doc, onClose, onReviewed }: {
  doc: MemberDocument;
  onClose: () => void;
  onReviewed: (updated: MemberDocument) => void;
}) {
  const [confirming, setConfirming] = useState<'approve' | 'reject' | null>(null);
  const [note, setNote]             = useState('');
  const [saving, setSaving]         = useState(false);
  const [reminding, setReminding]   = useState(false);
  const [reminded, setReminded]     = useState(false);
  const [reviewErr, setReviewErr]   = useState('');

  const doReview = async (action: 'approve' | 'reject') => {
    setSaving(true); setReviewErr('');
    try {
      const updated = await docApi.reviewDocument(doc.id, { action, note: note.trim() || undefined });
      onReviewed(updated); setConfirming(null); setNote(''); onClose();
    } catch { setReviewErr('Failed to save review. Please try again.'); }
    finally { setSaving(false); }
  };

  const doRemind = async () => {
    setReminding(true);
    try { await docApi.remindDocument(doc.id); setReminded(true); } catch { /* ignore */ }
    finally { setReminding(false); }
  };

  const isConsent  = doc.requires_signature;
  const isSigned   = doc.status === 'signed';
  const isAwaiting = isConsent && doc.status === 'assigned';
  const canReview  = !isConsent && (doc.status === 'uploaded' || doc.status === 'pending_review');

  const initials = doc.user.display_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
              <FileText size={16} className="text-gray-500" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold text-gray-900 leading-snug">{doc.title}</h2>
              {doc.template_name && doc.template_name !== doc.title && (
                <p className="text-[11.5px] text-gray-400 mt-0.5">Template: {doc.template_name}</p>
              )}
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${CAT_BADGE[doc.category] ?? 'text-gray-500'}`}>
                  {CAT_LABEL[doc.category] ?? doc.category}
                </span>
                {isConsent && (
                  <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Consent</span>
                )}
                <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[doc.status]}`}>
                  {STATUS_LABEL[doc.status]}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 shrink-0 ml-2">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4 flex-1 space-y-4">

          {/* Member profile */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Member</p>
            <div className="flex items-center gap-3 px-3.5 py-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-9 h-9 rounded-lg bg-gray-200 text-gray-700 text-[12px] font-bold flex items-center justify-center shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-gray-900">{doc.user.display_name}</p>
                <p className="text-[11.5px] text-gray-400">{doc.user.email}</p>
              </div>
            </div>
          </div>

          {/* Description */}
          {doc.template_description && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Description</p>
              <p className="text-[13px] text-gray-700 leading-relaxed">{doc.template_description}</p>
            </div>
          )}

          {/* Details grid */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Details</p>
            <div className="bg-gray-50 rounded-xl divide-y divide-gray-100">
              {[
                { icon: <CalendarDays size={12} />, label: 'Assigned on',  value: fmtDate(doc.uploaded_at) },
                doc.reviewed_at
                  ? { icon: <CheckCircle2 size={12} />, label: 'Reviewed on', value: fmtDate(doc.reviewed_at) }
                  : null,
                doc.reviewed_by_name
                  ? { icon: <User size={12} />, label: 'Reviewed by',  value: doc.reviewed_by_name }
                  : null,
                doc.signed_at
                  ? { icon: <PenLine size={12} />, label: 'Signed on',   value: fmtDate(doc.signed_at) }
                  : null,
                doc.expiration_date
                  ? { icon: <Clock size={12} />, label: 'Expires on',  value: fmtDate(doc.expiration_date) }
                  : null,
                isConsent
                  ? { icon: <ShieldCheck size={12} />, label: 'Type', value: 'Consent document' }
                  : { icon: <Upload size={12} />,      label: 'Type', value: 'Upload document' },
                doc.allow_resign
                  ? { icon: <PenLine size={12} />, label: 'Re-signing', value: 'Allowed' }
                  : null,
              ].filter(Boolean).map((row, i) => row && (
                <div key={i} className="flex items-center justify-between px-3 py-2 gap-2">
                  <div className="flex items-center gap-2 text-[11.5px] text-gray-500">
                    <span className="text-gray-400">{row.icon}</span>
                    {row.label}
                  </div>
                  <p className="text-[12px] font-semibold text-gray-800 text-right">{row.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Status banners */}
          {isSigned && doc.signed_at && (
            <div className="flex items-center gap-2.5 px-3.5 py-3 bg-gray-50 border border-gray-100 rounded-xl">
              <CheckCircle2 size={14} className="text-gray-500 shrink-0" />
              <div>
                <p className="text-[12.5px] font-semibold text-gray-800">Signed by member</p>
                <p className="text-[11.5px] text-gray-600 mt-0.5">Signed on {fmtDate(doc.signed_at)}</p>
              </div>
            </div>
          )}
          {isAwaiting && (
            <div className="flex items-center gap-2.5 px-3.5 py-3 bg-gray-50 border border-gray-100 rounded-xl">
              <Clock size={14} className="text-gray-500 shrink-0" />
              <div>
                <p className="text-[12.5px] font-semibold text-gray-700">Awaiting member signature</p>
                <p className="text-[11.5px] text-gray-600 mt-0.5">The member has not yet signed this document.</p>
              </div>
            </div>
          )}
          {doc.status === 'approved' && (
            <div className="flex items-center gap-2.5 px-3.5 py-3 bg-gray-50 border border-gray-100 rounded-xl">
              <CheckCircle2 size={14} className="text-gray-500 shrink-0" />
              <div>
                <p className="text-[12.5px] font-semibold text-gray-800">Approved</p>
                {doc.reviewed_at && <p className="text-[11.5px] text-gray-600 mt-0.5">Approved on {fmtDate(doc.reviewed_at)}</p>}
              </div>
            </div>
          )}
          {doc.status === 'rejected' && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 bg-gray-50 border border-gray-100 rounded-xl">
              <AlertCircle size={14} className="text-gray-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[12.5px] font-semibold text-gray-800">Rejected</p>
                {doc.reviewer_note && <p className="text-[11.5px] text-gray-600 mt-0.5">{doc.reviewer_note}</p>}
              </div>
            </div>
          )}

          {/* Template file */}
          {doc.template_file_url && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Template Agreement</p>
              <a href={doc.template_file_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-3.5 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors group">
                <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0">
                  <FileText size={14} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-semibold text-gray-800 truncate">{doc.template_name ?? doc.title}</p>
                  <p className="text-[11px] text-gray-400">Click to view / download</p>
                </div>
                <Download size={13} className="text-gray-400 group-hover:text-gray-600 shrink-0" />
              </a>
            </div>
          )}

          {/* Member's submitted file */}
          {doc.file_url && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Member's Submitted File</p>
              <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-3.5 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors group">
                <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0">
                  <FileText size={14} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-semibold text-gray-800 truncate">Uploaded document</p>
                  <p className="text-[11px] text-gray-400">Click to view</p>
                </div>
                <Eye size={13} className="text-gray-400 group-hover:text-gray-600 shrink-0" />
              </a>
            </div>
          )}
        </div>

        {/* Footer — admin actions */}
        <div className="shrink-0 px-5 py-4 border-t border-gray-100 space-y-3">
          {/* Remind button */}
          {isAwaiting && (
            <button onClick={doRemind} disabled={reminding || reminded}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl disabled:opacity-60 transition-colors">
              <Bell size={12} />
              {reminding ? 'Sending…' : reminded ? 'Reminder sent ✓' : 'Send Reminder'}
            </button>
          )}

          {/* Approve / reject */}
          {canReview && (
            <div className="flex items-center gap-2">
              <button onClick={() => setConfirming('approve')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl">
                <CheckCircle size={12} /> Approve
              </button>
              <button onClick={() => setConfirming('reject')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl">
                <XCircle size={12} /> Reject
              </button>
            </div>
          )}

          {/* No action needed notice */}
          {!isAwaiting && !canReview && (
            <p className="text-[12px] text-gray-400">
              {isSigned ? 'Member has signed this document — no further action needed.' :
               doc.status === 'approved' ? 'This document has been approved.' :
               doc.status === 'rejected' ? 'This document has been rejected and is awaiting re-submission.' :
               'No action required at this time.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const isApprove = confirming === 'approve';

  const confirmPopup = confirming ? createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[400px] p-6" onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-center w-12 h-12 rounded-full mx-auto mb-4 ${
          'bg-gray-100'
        }`}>
          {isApprove
            ? <CheckCircle size={22} className="text-gray-600" />
            : <XCircle    size={22} className="text-gray-600" />}
        </div>
        <h3 className="text-[15px] font-bold text-gray-900 text-center mb-1">
          {isApprove ? 'Approve Agreement?' : 'Reject Agreement?'}
        </h3>
        <p className="text-[12px] text-gray-400 text-center mb-4">
          {isApprove
            ? `Approving "${doc.title}" for ${doc.user.display_name}`
            : `Rejecting "${doc.title}" and requesting a revision`}
        </p>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={isApprove ? 'Optional note for member…' : 'Reason for rejection (required)'}
          rows={3}
          className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-gray-400 mb-1"
        />
        {reviewErr && <p className="text-[11.5px] text-gray-600 mb-2">{reviewErr}</p>}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => { setConfirming(null); setNote(''); setReviewErr(''); }}
            className="flex-1 px-4 py-2 text-[13px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => doReview(confirming)}
            disabled={saving || (!isApprove && !note.trim())}
            className={`flex-1 px-4 py-2 text-[13px] font-semibold text-white rounded-xl transition-colors disabled:opacity-60 ${
              'bg-gray-900 hover:bg-gray-800'
            }`}
          >
            {saving ? 'Saving…' : isApprove ? 'Yes, Approve' : 'Yes, Reject'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {createPortal(modal, document.body)}
      {confirmPopup}
    </>
  );
}
// ── Admin Review Row ───────────────────────────────────────────────────────────

function AdminDocReviewRow({ doc, onReviewed }: {
  doc: MemberDocument;
  onReviewed: (updated: MemberDocument) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const isConsent  = doc.requires_signature;
  const isSigned   = doc.status === 'signed';
  const isAwaiting = isConsent && doc.status === 'assigned';
  const canReview  = !isConsent && (doc.status === 'uploaded' || doc.status === 'pending_review');

  const initials = doc.user.display_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="w-full text-left bg-white rounded-2xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
      >
        <div className="flex items-start justify-between gap-3">
          {/* Left: member + doc info */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-full bg-gray-200 text-gray-700 text-[12px] font-bold flex items-center justify-center shrink-0 mt-0.5">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <p className="text-[13px] font-bold text-gray-900">{doc.user.display_name}</p>
                <span className="text-[11px] text-gray-400">·</span>
                <p className="text-[12px] text-gray-500 truncate">{doc.title}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${CAT_BADGE[doc.category] ?? 'text-gray-500'}`}>
                  {CAT_LABEL[doc.category] ?? doc.category}
                </span>
                {isConsent && (
                  <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">Consent</span>
                )}
                <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[doc.status]}`}>
                  {STATUS_LABEL[doc.status]}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400 flex-wrap">
                <span>{fmtDate(doc.uploaded_at)}</span>
                {isSigned && doc.signed_at && (
                  <span className="flex items-center gap-1 text-gray-600">
                    <PenLine size={10} /> Signed {fmtDate(doc.signed_at)}
                  </span>
                )}
                {isAwaiting && (
                  <span className="text-gray-600">Awaiting signature</span>
                )}
                {canReview && (
                  <span className="text-gray-600">Needs review</span>
                )}
                {doc.reviewer_note && doc.status === 'rejected' && (
                  <span className="text-gray-600 truncate max-w-[200px]">"{doc.reviewer_note}"</span>
                )}
              </div>
            </div>
          </div>

          {/* Right: quick-action hint + chevron */}
          <div className="flex items-center gap-2 shrink-0">
            {canReview && (
              <span className="text-[11px] font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded-lg hidden sm:block">
                Review
              </span>
            )}
            {isAwaiting && (
              <span className="text-[11px] font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded-lg hidden sm:block">
                Remind
              </span>
            )}
            <ChevronRight size={14} className="text-gray-300" />
          </div>
        </div>
      </button>

      {modalOpen && (
        <AdminDocDetailModal
          doc={doc}
          onClose={() => setModalOpen(false)}
          onReviewed={d => { onReviewed(d); setModalOpen(false); }}
        />
      )}
    </>
  );
}

// ── Assign Document Modal ──────────────────────────────────────────────────────

const CAT_OPTIONS: { value: DocCategory; label: string }[] = [
  { value: 'required',    label: 'Required' },
  { value: 'policy',      label: 'Policy' },
  { value: 'form',        label: 'Form' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'agreement',   label: 'Agreement' },
];

function AssignDocModal({ userId, userName, onClose, onAssigned }: {
  userId:     number;
  userName:   string;
  onClose:    () => void;
  onAssigned: () => void;
}) {
  const [tab, setTab]                         = useState<'template' | 'create'>('template');

  // From Template tab
  const [templates, setTemplates]             = useState<DocumentTemplate[]>([]);
  const [tmplLoading, setTmplLoading]         = useState(true);
  const [tmplSearch, setTmplSearch]           = useState('');
  const [selectedTmpl, setSelectedTmpl]       = useState<DocumentTemplate | null>(null);
  const [assigning, setAssigning]             = useState(false);
  const [assignErr, setAssignErr]             = useState('');
  const [assignDone, setAssignDone]           = useState(false);

  // Create New tab
  const [name, setName]                       = useState('');
  const [category, setCategory]               = useState<DocCategory>('required');
  const [description, setDescription]         = useState('');
  const [requiresSig, setRequiresSig]         = useState(false);
  const [allowResign, setAllowResign]         = useState(false);
  const [file, setFile]                       = useState<File | null>(null);
  const [creating, setCreating]               = useState(false);
  const [createErr, setCreateErr]             = useState('');
  const fileRef                               = useRef<HTMLInputElement>(null);

  useEffect(() => {
    docApi.getDocTemplates()
      .then(setTemplates)
      .catch(() => {})
      .finally(() => setTmplLoading(false));
  }, []);

  const filteredTmpls = templates.filter(t =>
    !tmplSearch ||
    t.name.toLowerCase().includes(tmplSearch.toLowerCase()) ||
    (t.description || '').toLowerCase().includes(tmplSearch.toLowerCase())
  );

  const doAssign = async () => {
    if (!selectedTmpl) return;
    setAssigning(true); setAssignErr('');
    try {
      await docApi.assignDocTemplate(selectedTmpl.id, { user_ids: [userId] });
      setAssignDone(true);
      setTimeout(onAssigned, 700);
    } catch { setAssignErr('Assignment failed. Please try again.'); }
    finally { setAssigning(false); }
  };

  const doCreateAndAssign = async () => {
    if (!name.trim()) return;
    setCreating(true); setCreateErr('');
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('category', category);
      fd.append('description', description.trim());
      fd.append('requires_signature', String(requiresSig));
      fd.append('allow_resign', String(allowResign));
      if (file) fd.append('file', file);
      const tmpl = await docApi.createDocTemplate(fd);
      await docApi.assignDocTemplate(tmpl.id, { user_ids: [userId] });
      setAssignDone(true);
      setTimeout(onAssigned, 700);
    } catch { setCreateErr('Failed to create and assign. Please try again.'); }
    finally { setCreating(false); }
  };

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">Assign Agreement</h2>
            <p className="text-[11.5px] text-gray-400 mt-0.5">to {userName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 shrink-0">
          {([
            { key: 'template' as const, label: 'From Template' },
            { key: 'create'   as const, label: 'Create New'    },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-5 py-2.5 text-[12.5px] font-semibold border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-400 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* ── From Template ───────────────────────────────── */}
          {tab === 'template' && (
            <div className="space-y-3">
              {/* Search */}
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  value={tmplSearch}
                  onChange={e => setTmplSearch(e.target.value)}
                  placeholder="Search templates..."
                  className="w-full pl-8 pr-3 py-1.5 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400/30 placeholder:text-gray-400"
                />
              </div>

              {/* Template list */}
              {tmplLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : filteredTmpls.length === 0 ? (
                <p className="text-center text-[12.5px] text-gray-400 py-8">No templates found</p>
              ) : (
                <div className="space-y-2">
                  {filteredTmpls.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTmpl(prev => prev?.id === t.id ? null : t)}
                      className={`w-full text-left px-3.5 py-3 rounded-xl border transition-all ${
                        selectedTmpl?.id === t.id
                          ? 'border-gray-900 bg-gray-50 ring-1 ring-gray-300'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-gray-900 truncate">{t.name}</p>
                          {t.description && (
                            <p className="text-[11.5px] text-gray-400 mt-0.5 line-clamp-1">{t.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${CAT_BADGE[t.category] ?? 'text-gray-500'}`}>
                            {CAT_LABEL[t.category] ?? t.category}
                          </span>
                          {t.requires_signature && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600">Consent</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {assignErr && <p className="text-[12px] text-gray-600">{assignErr}</p>}
            </div>
          )}

          {/* ── Create New ──────────────────────────────────── */}
          {tab === 'create' && (
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Name <span className="text-gray-400">*</span>
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Intern Contract"
                  className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400/30 placeholder:text-gray-400"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as DocCategory)}
                  className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-400/30"
                >
                  {CAT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Instructions or context for the member..."
                  className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400/30 placeholder:text-gray-400 resize-none"
                />
              </div>

              {/* Requires signature toggle */}
              <div className="flex items-start justify-between gap-3 px-3.5 py-3 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <p className="text-[12.5px] font-semibold text-gray-800">Consent mode</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Member clicks "I Agree" instead of uploading a file</p>
                </div>
                <button
                  onClick={() => { setRequiresSig(v => !v); if (requiresSig) setAllowResign(false); }}
                  className={`w-9 h-5 rounded-full transition-colors shrink-0 mt-0.5 relative ${requiresSig ? 'bg-gray-900' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${requiresSig ? 'left-4' : 'left-0.5'}`} />
                </button>
              </div>

              {/* Allow re-sign (only if consent mode) */}
              {requiresSig && (
                <div className="flex items-start justify-between gap-3 px-3.5 py-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div>
                    <p className="text-[12.5px] font-semibold text-gray-800">Allow re-sign</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Member can sign this document more than once</p>
                  </div>
                  <button
                    onClick={() => setAllowResign(v => !v)}
                    className={`w-9 h-5 rounded-full transition-colors shrink-0 mt-0.5 relative ${allowResign ? 'bg-gray-900' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${allowResign ? 'left-4' : 'left-0.5'}`} />
                  </button>
                </div>
              )}

              {/* File attachment */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Attach File (optional)</label>
                <input type="file" ref={fileRef} className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
                {file ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                    <FileText size={13} className="text-gray-400 shrink-0" />
                    <p className="text-[12px] text-gray-700 truncate flex-1">{file.name}</p>
                    <button onClick={() => setFile(null)} className="text-gray-400 hover:text-gray-600 shrink-0">
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full px-3 py-2 text-[12.5px] font-medium text-gray-500 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors"
                  >
                    + Attach a file
                  </button>
                )}
              </div>

              {createErr && <p className="text-[12px] text-gray-600">{createErr}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-4 border-t border-gray-100">
          {assignDone ? (
            <div className="flex items-center gap-2 text-gray-600 text-[13px] font-semibold">
              <CheckCircle2 size={15} /> Assigned successfully!
            </div>
          ) : tab === 'template' ? (
            <button
              onClick={doAssign}
              disabled={!selectedTmpl || assigning}
              className="w-full py-2 text-[13px] font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-xl transition-colors"
            >
              {assigning ? 'Assigning…' : selectedTmpl ? `Assign "${selectedTmpl.name}"` : 'Select a template above'}
            </button>
          ) : (
            <button
              onClick={doCreateAndAssign}
              disabled={!name.trim() || creating}
              className="w-full py-2 text-[13px] font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-xl transition-colors"
            >
              {creating ? 'Creating & Assigning…' : 'Create & Assign'}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ── Main Page ──────────────────────────────────────────────────────────────────

type DocTabKey = 'all' | 'pending' | 'signed' | 'expired' | 'draft';
const MEMBERS_PER_PAGE = 7;

function computeInsights(docs: MemberDocument[]) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const signed = docs.filter(d => d.signed_at);
  const avgSignDays = signed.length > 0
    ? Math.round(
        signed.reduce((s, d) =>
          s + (new Date(d.signed_at!).getTime() - new Date(d.uploaded_at).getTime()) / 86400000, 0
        ) / signed.length
      )
    : null;
  const completed = docs.filter(d => d.status === 'signed' || d.status === 'approved').length;
  return {
    avgSignDays,
    completionRate: docs.length > 0 ? Math.round(completed / docs.length * 100) : 0,
    expiredCount:   docs.filter(d => d.expiration_date && new Date(d.expiration_date) < today).length,
    totalActions:   docs.filter(d => d.reviewed_at || d.signed_at).length,
  };
}

function daysUntilLabel(dateStr: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const exp   = new Date(dateStr); exp.setHours(0, 0, 0, 0);
  const diff  = Math.round((exp.getTime() - today.getTime()) / 86400000);
  if (diff < 0)  return <span className="text-[10.5px] text-gray-500 font-medium">Expired</span>;
  if (diff === 0) return <span className="text-[10.5px] text-gray-500 font-medium">Expires today</span>;
  if (diff <= 30) return <span className="text-[10.5px] text-gray-500">in {diff} days</span>;
  return <span className="text-[10.5px] text-gray-400">in {diff} days</span>;
}

function exportMemberDocsCsv(docs: MemberDocument[], name: string) {
  const rows = [
    ['DOC REF', 'TITLE', 'CATEGORY', 'STATUS', 'ASSIGNED ON', 'SIGNED ON', 'EXPIRES ON'],
    ...docs.map(d => [
      d.doc_reference ?? '',
      d.title,
      d.category,
      d.status,
      new Date(d.uploaded_at).toLocaleDateString(),
      d.signed_at ? new Date(d.signed_at).toLocaleDateString() : '',
      d.expiration_date ?? '',
    ]),
  ];
  const csv  = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `${name.replace(/\s+/g, '_')}_documents.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function OrgDocuments() {
  const { isSuperadmin, canManageMembers } = useOrg();
  const isAdmin = isSuperadmin || canManageMembers;
  const navigate = useNavigate();

  // ── Shared state
  const [docs, setDocs]         = useState<MemberDocument[]>([]);
  const [allMembers, setAllMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading]   = useState(true);

  // ── Member view state
  const [tab, setTab] = useState<TabKey>('all');
  const [memberDocSearch, setMemberDocSearch]       = useState('');
  const [memberDocTypeFilter, setMemberDocTypeFilter] = useState('all');
  const [memberDocPage, setMemberDocPage]           = useState(1);
  const [memberModalDoc, setMemberModalDoc]         = useState<MemberDocument | null>(null);

  // ── Admin state
  const [stats, setStats]                         = useState<DocGlobalStats | null>(null);
  const [selectedMemberId, setSelectedMemberId]   = useState<number | null>(null);
  const [memberSearch, setMemberSearch]           = useState('');
  const [memberFilterTab, setMemberFilterTab]     = useState<'all' | 'active' | 'inactive'>('all');
  const [memberPage, setMemberPage]               = useState(1);
  const [docTab, setDocTab]                       = useState<DocTabKey>('all');
  const [docSearch, setDocSearch]                 = useState('');
  const [typeFilter, setTypeFilter]               = useState('all');
  const [statusFilter, setStatusFilter]           = useState('all');
  const [memberActionsOpen, setMemberActionsOpen] = useState(false);
  const [memberSearchOpen, setMemberSearchOpen]   = useState(false);
  const [openMenuDocId, setOpenMenuDocId]         = useState<number | null>(null);
  const [menuAnchor, setMenuAnchor]               = useState<{ top: number; right: number } | null>(null);
  const [showAssign, setShowAssign]               = useState(false);
  const [detailModalDoc, setDetailModalDoc]       = useState<MemberDocument | null>(null);
  const [confirmDeleteDoc, setConfirmDeleteDoc]   = useState<MemberDocument | null>(null);
  const memberActionsRef  = useRef<HTMLDivElement>(null);
  const memberSearchRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAdmin) {
      docApi.getMyDocuments().then(setDocs).catch(() => {}).finally(() => setLoading(false));
      return;
    }
    Promise.all([docApi.getDocuments(), docApi.getDocGlobalStats(), orgApi.getMembers({ status: 'active' })])
      .then(([d, s, m]) => { setDocs(d); setStats(s); setAllMembers(m); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateDoc = (updated: MemberDocument) =>
    setDocs(ds => ds.map(d => d.id === updated.id ? updated : d));

  const refreshDocs = () => docApi.getDocuments().then(setDocs).catch(() => {});

  // Close member actions dropdown on outside click
  useEffect(() => {
    if (!memberActionsOpen) return;
    const handler = (e: MouseEvent) => {
      if (!memberActionsRef.current?.contains(e.target as Node)) setMemberActionsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [memberActionsOpen]);

  // Close member search dropdown on outside click
  useEffect(() => {
    if (!memberSearchOpen) return;
    const handler = (e: MouseEvent) => {
      if (!memberSearchRef.current?.contains(e.target as Node)) setMemberSearchOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [memberSearchOpen]);

  // ── Member grouping
  const memberMap = useMemo(() => {
    const map = new Map<number, { user: MemberDocument['user']; docs: MemberDocument[] }>();
    for (const doc of docs) {
      if (!map.has(doc.user.id)) map.set(doc.user.id, { user: doc.user, docs: [] });
      map.get(doc.user.id)!.docs.push(doc);
    }
    return map;
  }, [docs]);

  const filteredMembers = useMemo(() => {
    let list = [...memberMap.values()];
    if (memberFilterTab !== 'all')
      list = list.filter(m =>
        memberFilterTab === 'active'
          ? m.user.member_status === 'active'
          : m.user.member_status !== 'active'
      );
    if (memberSearch.trim()) {
      const q = memberSearch.toLowerCase();
      list = list.filter(m =>
        m.user.display_name.toLowerCase().includes(q) ||
        m.user.email.toLowerCase().includes(q)
      );
    }
    return list;
  }, [memberMap, memberSearch, memberFilterTab]);

  const memberSearchResults = useMemo(() => {
    if (!memberSearch.trim()) return [];
    const q = memberSearch.toLowerCase();
    return allMembers.filter(m =>
      m.user.display_name.toLowerCase().includes(q) ||
      m.user.email.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [allMembers, memberSearch]);

  useEffect(() => setMemberPage(1), [memberSearch, memberFilterTab]);

  const totalMemberPages = Math.max(1, Math.ceil(filteredMembers.length / MEMBERS_PER_PAGE));
  const pagedMembers     = filteredMembers.slice(
    (memberPage - 1) * MEMBERS_PER_PAGE,
    memberPage * MEMBERS_PER_PAGE
  );

  // ── Per-member doc data
  const todayDate = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const isExpiredDoc = (d: MemberDocument) =>
    !!d.expiration_date && new Date(d.expiration_date) < todayDate;

  const memberDocs = useMemo(
    () => selectedMemberId ? (memberMap.get(selectedMemberId)?.docs ?? []) : [],
    [memberMap, selectedMemberId]
  );

  const tabCounts = useMemo((): Record<DocTabKey, number> => ({
    all:     memberDocs.length,
    pending: memberDocs.filter(d => ['assigned', 'uploaded', 'pending_review', 'rejected'].includes(d.status)).length,
    signed:  memberDocs.filter(d => ['signed', 'approved'].includes(d.status)).length,
    expired: memberDocs.filter(isExpiredDoc).length,
    draft:   0,
  }), [memberDocs]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayedDocs = useMemo(() => {
    let list = [...memberDocs];
    if (docTab === 'pending')       list = list.filter(d => ['assigned', 'uploaded', 'pending_review', 'rejected'].includes(d.status));
    else if (docTab === 'signed')   list = list.filter(d => ['signed', 'approved'].includes(d.status));
    else if (docTab === 'expired')  list = list.filter(isExpiredDoc);
    if (docSearch.trim()) {
      const q = docSearch.toLowerCase();
      list = list.filter(d => d.title.toLowerCase().includes(q) || (d.doc_reference ?? '').toLowerCase().includes(q));
    }
    if (typeFilter !== 'all')   list = list.filter(d => d.category === typeFilter);
    if (statusFilter !== 'all') list = list.filter(d => d.status === statusFilter);
    return list;
  }, [memberDocs, docTab, docSearch, typeFilter, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Member view ────────────────────────────────────────────────────────────
  if (!isAdmin) {
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const pendingDocs = docs.filter(d => ['assigned', 'rejected', 'uploaded', 'pending_review'].includes(d.status));
    const signedDocs  = docs.filter(d => ['signed', 'approved'].includes(d.status));
    const expiredDocs = docs.filter(d => !!d.expiration_date && new Date(d.expiration_date) < today);

    const tabFiltered =
      tab === 'pending' ? pendingDocs :
      tab === 'signed'  ? signedDocs  :
      tab === 'expired' ? expiredDocs :
      docs;

    const filtered = tabFiltered.filter(d => {
      const q = memberDocSearch.toLowerCase();
      const matchSearch = !q || d.title.toLowerCase().includes(q) || d.doc_reference.toLowerCase().includes(q);
      const matchType = memberDocTypeFilter === 'all' || d.category === memberDocTypeFilter;
      return matchSearch && matchType;
    });

    const MEMBER_PAGE_SIZE = 5;
    const totalDocPages = Math.max(1, Math.ceil(filtered.length / MEMBER_PAGE_SIZE));
    const pagedDocs = filtered.slice((memberDocPage - 1) * MEMBER_PAGE_SIZE, memberDocPage * MEMBER_PAGE_SIZE);

    // Sidebar: expiring soon
    const expiringSoon = docs
      .filter(d => !!d.expiration_date && new Date(d.expiration_date) >= today)
      .sort((a, b) => new Date(a.expiration_date!).getTime() - new Date(b.expiration_date!).getTime())
      .slice(0, 3);

    // Sidebar: recent activity
    const activity = [...docs].map(doc => {
      if (doc.signed_at)   return { doc, date: new Date(doc.signed_at),   kind: 'signed'  as const };
      if (doc.reviewed_at) return { doc, date: new Date(doc.reviewed_at), kind: 'updated' as const };
      return { doc, date: new Date(doc.uploaded_at), kind: 'assigned' as const };
    }).sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 4);

    // Donut chart
    const total        = docs.length;
    const signedCount  = signedDocs.length;
    const pendingCount = pendingDocs.length;
    const expiredCount = expiredDocs.length;
    const getDeg = (n: number) => total > 0 ? (n / total) * 360 : 0;
    const s = getDeg(signedCount), p = getDeg(pendingCount), e = getDeg(expiredCount);
    const donutStyle = {
      background: total === 0
        ? '#e5e7eb'
        : `conic-gradient(#111827 0deg ${s}deg, #6b7280 ${s}deg ${s+p}deg, #9ca3af ${s+p}deg ${s+p+e}deg, #e5e7eb ${s+p+e}deg 360deg)`,
    };

    function timeAgo(d: Date) {
      const days = Math.floor((Date.now() - d.getTime()) / 86400000);
      if (days === 0) return 'Today';
      if (days === 1) return '1d ago';
      return `${days}d ago`;
    }
    function daysUntil(iso: string) {
      const d = new Date(iso); d.setHours(0,0,0,0);
      return Math.round((d.getTime() - today.getTime()) / 86400000);
    }
    function getActionLabel(doc: MemberDocument) {
      if (['assigned', 'rejected'].includes(doc.status)) return 'Review';
      if (doc.status === 'approved' && !doc.signed_at)   return 'Sign';
      return 'View';
    }
    function getActionStyle(doc: MemberDocument) {
      if (['assigned', 'rejected'].includes(doc.status))
        return 'bg-gray-900 text-white hover:bg-gray-800';
      return 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50';
    }

    const TABS_CFG = [
      { key: 'all'     as TabKey, label: 'All',     count: docs.length },
      { key: 'pending' as TabKey, label: 'Pending', count: pendingDocs.length },
      { key: 'signed'  as TabKey, label: 'Signed',  count: signedDocs.length },
      { key: 'expired' as TabKey, label: 'Expired', count: expiredDocs.length },
    ];

    if (loading) {
      return (
        <div className="flex gap-6">
          <div className="flex-1 space-y-4">
            <div className="h-8 w-40 bg-gray-100 rounded-xl animate-pulse" />
            <div className="grid grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
            <div className="h-[400px] bg-gray-100 rounded-2xl animate-pulse" />
          </div>
          <div className="w-[280px] shrink-0 space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-start gap-4">

        {/* ── Main content ── */}
        <div className="flex-1 min-w-0 space-y-3">

          {/* Header */}
          <div>
            <h1 className="text-[16px] font-bold text-gray-900">Agreements</h1>
            <p className="text-[12px] text-gray-500 mt-0.5">View, sign, and manage your organisation agreements</p>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-gray-200">
            {TABS_CFG.map(t => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setMemberDocPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-semibold transition-colors border-b-2 -mb-px ${
                  tab === t.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
                {t.count > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10.5px] font-bold bg-gray-100 text-gray-600">{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Search + filter */}
          <div className="flex items-stretch gap-3">
            <div className="flex-1 relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={memberDocSearch}
                onChange={e => { setMemberDocSearch(e.target.value); setMemberDocPage(1); }}
                placeholder="Search agreements..."
                className="w-full h-full pl-8 pr-3 py-2.5 text-[12.5px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>
            <select
              value={memberDocTypeFilter}
              onChange={e => { setMemberDocTypeFilter(e.target.value); setMemberDocPage(1); }}
              className="px-3 py-2.5 text-[12.5px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 text-gray-700"
            >
              <option value="all">All Types</option>
              {Object.entries(CAT_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {pagedDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <FileText size={36} className="text-gray-200 mb-3" />
                <p className="text-[13px] font-semibold text-gray-600">No agreements found</p>
                <p className="text-[12px] text-gray-400 mt-1">
                  {memberDocSearch || memberDocTypeFilter !== 'all'
                    ? 'Try adjusting your filters.'
                    : 'Your admin will assign agreements when needed.'}
                </p>
              </div>
            ) : (
              <>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60">
                      {['AGREEMENT', 'TYPE', 'STATUS', 'SIGNED ON', 'EXPIRES ON', 'ACTIONS'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedDocs.map((doc, i) => {
                      const badge = MEM_STATUS_BADGE[doc.status];
                      const du = doc.expiration_date ? daysUntil(doc.expiration_date) : null;
                      return (
                        <tr key={doc.id} onClick={() => setMemberModalDoc(doc)} className={`cursor-pointer hover:bg-gray-50/80 transition-colors ${i < pagedDocs.length - 1 ? 'border-b border-gray-100' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                <FileText size={13} className="text-gray-500" />
                              </div>
                              <div>
                                <p className="text-[13px] font-semibold text-gray-900">{doc.title}</p>
                                <p className="text-[11px] text-gray-400">{doc.doc_reference}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-[12.5px] text-gray-700">
                              {CAT_LABEL[doc.category] ?? doc.category}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-[12.5px] text-gray-700 whitespace-nowrap">
                              {badge.label}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            {doc.signed_at ? (
                              <div>
                                <p className="text-[12.5px] font-medium text-gray-800 whitespace-nowrap">{fmtDate(doc.signed_at)}</p>
                                <p className="text-[11px] text-gray-400">by {doc.user.display_name}</p>
                              </div>
                            ) : (
                              <div>
                                <p className="text-[13px] text-gray-300">—</p>
                                <p className="text-[11px] text-gray-400">Not signed yet</p>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {doc.expiration_date ? (
                              <div>
                                <p className="text-[12.5px] font-medium text-gray-800 whitespace-nowrap">
                                  {new Date(doc.expiration_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                                {du !== null && (
                                  <p className="text-[11px] font-medium text-gray-400">
                                    {du < 0 ? `${Math.abs(du)}d ago` : `in ${du} days`}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-[13px] text-gray-300">—</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={e => { e.stopPropagation(); setMemberModalDoc(doc); }}
                              className={`px-3.5 py-1.5 text-[12px] font-semibold rounded-lg transition-colors ${getActionStyle(doc)}`}
                            >
                              {getActionLabel(doc)}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination */}
                {filtered.length > MEMBER_PAGE_SIZE && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                    <p className="text-[12px] text-gray-500">
                      Showing {(memberDocPage - 1) * MEMBER_PAGE_SIZE + 1} to {Math.min(memberDocPage * MEMBER_PAGE_SIZE, filtered.length)} of {filtered.length} agreements
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setMemberDocPage(p => Math.max(1, p - 1))}
                        disabled={memberDocPage === 1}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                      >
                        <ChevronLeft size={13} />
                      </button>
                      {Array.from({ length: Math.min(totalDocPages, 5) }, (_, i) => i + 1).map(n => (
                        <button
                          key={n}
                          onClick={() => setMemberDocPage(n)}
                          className={`w-7 h-7 flex items-center justify-center rounded-lg text-[12px] font-semibold transition-colors ${
                            n === memberDocPage ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                      <button
                        onClick={() => setMemberDocPage(p => Math.min(totalDocPages, p + 1))}
                        disabled={memberDocPage === totalDocPages}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                      >
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div className="w-[260px] shrink-0 space-y-3 sticky top-6">

          {/* Your Status */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-[12.5px] font-bold text-gray-900 mb-3">Your Status</p>
            <div className="flex items-center gap-3">
              <div className="relative w-20 h-20 shrink-0">
                <div className="w-full h-full rounded-full" style={donutStyle} />
                <div className="absolute inset-[9px] bg-white rounded-full flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-[15px] font-bold text-gray-900 leading-none">{total}</p>
                    <p className="text-[9px] text-gray-400 mt-0.5">Total</p>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5 flex-1 min-w-0">
                {[
                  { color: '#111827', label: 'Signed',  count: signedCount },
                  { color: '#6b7280', label: 'Pending', count: pendingCount },
                  { color: '#9ca3af', label: 'Expired', count: expiredCount },
                  { color: '#e5e7eb', label: 'Draft',   count: 0 },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                    <span className="text-[11px] text-gray-600 flex-1">{item.label}</span>
                    <span className="text-[11px] font-semibold text-gray-700">
                      {item.count} ({total > 0 ? Math.round(item.count / total * 100) : 0}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Expiring Soon */}
          {expiringSoon.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[12.5px] font-bold text-gray-900">Expiring Soon</p>
                <button onClick={() => setTab('all')} className="text-[11px] font-semibold text-gray-500 hover:underline">View all →</button>
              </div>
              <div className="space-y-2">
                {expiringSoon.map(doc => (
                  <div key={doc.id} className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                      <CalendarDays size={11} className="text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11.5px] font-semibold text-gray-800 truncate">{doc.title}</p>
                      <p className="text-[10.5px] text-gray-400">Expires on {fmtDate(doc.expiration_date)}</p>
                    </div>
                    <span className="text-[11px] font-semibold text-gray-500 shrink-0 mt-0.5">
                      in {daysUntil(doc.expiration_date!)}d
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          {activity.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[12.5px] font-bold text-gray-900">Recent Activity</p>
                <button className="text-[11px] font-semibold text-gray-500 hover:underline">View all →</button>
              </div>
              <div className="space-y-2">
                {activity.map(({ doc, date, kind }) => (
                  <div key={doc.id} className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-gray-100">
                      {kind === 'signed'
                        ? <CheckCircle size={10} className="text-gray-500" />
                        : <Clock size={10} className="text-gray-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11.5px] font-semibold text-gray-800 truncate">{doc.title}</p>
                      <p className="text-[10.5px] text-gray-400">
                        {kind === 'signed'  ? `Signed on ${fmtDate(doc.signed_at)}` :
                         kind === 'updated' ? `Updated on ${fmtDate(doc.reviewed_at)}` :
                         'Pending your signature'}
                      </p>
                    </div>
                    <span className="text-[11px] text-gray-400 shrink-0 mt-0.5">{timeAgo(date)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* DocDetailModal for table row actions */}
        {memberModalDoc && (
          <DocDetailModal
            doc={memberModalDoc}
            onClose={() => setMemberModalDoc(null)}
            onUploaded={d => { updateDoc(d); setMemberModalDoc(d); }}
            onSigned={d => { updateDoc(d); setMemberModalDoc(d); }}
          />
        )}
      </div>
    );
  }

  // ── Admin view ────────────────────────────────────────────────────────────
  const selectedMemberData = selectedMemberId ? memberMap.get(selectedMemberId) : undefined;
  const selectedMemberUser = selectedMemberId !== null
    ? (selectedMemberData?.user ?? allMembers.find(m => m.user.id === selectedMemberId)?.user ?? null)
    : null;

  const pendingMemberDocs = memberDocs.filter(d =>
    d.status === 'assigned' || d.status === 'uploaded' || d.status === 'pending_review'
  );

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-8 bg-gray-100 rounded-xl animate-pulse w-48" />
        <div className="grid grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
        <div className="h-[500px] bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-[16px] font-bold text-gray-900">Agreements</h1>
            <PageHelp title="How Agreements Work" sections={DOCUMENTS_HELP} />
          </div>
          <p className="text-[12px] text-gray-500 mt-0.5">Manage member agreements and track status</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => docApi.exportDocuments().catch(() => {})}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <Download size={13} /> Export
          </button>
          <Link
            to="/org/doc-templates"
            state={{ from: 'agreements' }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <FileText size={13} /> Agreement Templates
          </Link>
          <button
            onClick={() => selectedMemberId !== null && setShowAssign(true)}
            disabled={selectedMemberId === null}
            title={selectedMemberId === null ? 'Select a member first' : 'Assign an agreement'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <Plus size={13} /> Assign Agreement
          </button>
        </div>
      </div>

      {/* ── Split panel ── */}
      <div className="flex bg-white rounded-2xl border border-gray-200 overflow-hidden"
           style={{ height: 'calc(100vh - 148px)', minHeight: 480 }}>

        {/* LEFT: Member list */}
        <div className="w-[340px] shrink-0 border-r border-gray-100 flex flex-col">
          {/* Header row 1: title + filter pills — aligns with right panel member header */}
          <div className="px-4 border-b border-gray-100 shrink-0 flex items-center min-h-[52px]">
            <p className="text-[12.5px] font-bold text-gray-800">Members ({filteredMembers.length})</p>
          </div>
          {/* Header row 2: search — aligns with right panel filter bar */}
          <div className="px-4 py-2 border-b border-gray-100 shrink-0 min-h-[42px] flex items-center">
            <div className="relative w-full" ref={memberSearchRef}>
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
              <input
                value={memberSearch}
                onChange={e => { setMemberSearch(e.target.value); setMemberSearchOpen(true); }}
                onFocus={() => setMemberSearchOpen(true)}
                onKeyDown={e => { if (e.key === 'Escape') { setMemberSearchOpen(false); setMemberSearch(''); } }}
                placeholder="Search all members..."
                className="w-full pl-7 pr-3 py-1.5 text-[11.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400/30 placeholder:text-gray-400"
              />
              {/* Search dropdown */}
              {memberSearchOpen && memberSearchResults.length > 0 && createPortal((() => {
                const rect = memberSearchRef.current?.getBoundingClientRect();
                if (!rect) return null;
                return (
                  <div
                    className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-xl py-1 overflow-y-auto"
                    style={{ top: rect.bottom + 4, left: rect.left, width: rect.width, maxHeight: 280 }}
                  >
                    {memberSearchResults.map(m => {
                      const docsForMember = memberMap.get(m.user.id);
                      const docCount = docsForMember?.docs.length ?? 0;
                      const initials = `${m.user.first_name?.[0] ?? ''}${m.user.last_name?.[0] ?? ''}`.toUpperCase() || m.user.username[0].toUpperCase();
                      return (
                        <button
                          key={m.user.id}
                          onMouseDown={e => {
                            e.preventDefault();
                            setSelectedMemberId(m.user.id);
                            setDocTab('all');
                            setDocSearch('');
                            setTypeFilter('all');
                            setStatusFilter('all');
                            setMemberSearch('');
                            setMemberSearchOpen(false);
                          }}
                          className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-gray-50 text-left transition-colors"
                        >
                          {m.user.profile_picture
                            ? <img src={m.user.profile_picture} className="w-6 h-6 rounded-lg object-cover shrink-0" alt="" />
                            : <div className="w-6 h-6 rounded-lg bg-gray-200 text-gray-600 text-[9px] font-bold flex items-center justify-center shrink-0">{initials}</div>
                          }
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-gray-900 truncate">{m.user.display_name}</p>
                            <p className="text-[10px] text-gray-400 truncate">{m.user.email}</p>
                          </div>
                          <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 whitespace-nowrap">
                            {docCount > 0 ? `${docCount} doc${docCount !== 1 ? 's' : ''}` : 'No docs'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })(), document.body)}
              {memberSearchOpen && memberSearch.trim() && memberSearchResults.length === 0 && createPortal((() => {
                const rect = memberSearchRef.current?.getBoundingClientRect();
                if (!rect) return null;
                return (
                  <div
                    className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-xl py-3 px-4"
                    style={{ top: rect.bottom + 4, left: rect.left, width: rect.width }}
                  >
                    <p className="text-[11.5px] text-gray-400 text-center">No members found</p>
                  </div>
                );
              })(), document.body)}
            </div>
          </div>

          {/* Member rows */}
          <div className="flex-1 overflow-y-auto">
            {pagedMembers.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-[12px] text-gray-400">No members found</div>
            ) : pagedMembers.map(({ user: u, docs: mDocs }) => {
              const pendingCount = mDocs.filter(d =>
                ['assigned', 'uploaded', 'pending_review'].includes(d.status)
              ).length;
              const initials = u.display_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
              const isSelected = selectedMemberId === u.id;
              return (
                <button key={u.id}
                  onClick={() => {
                    setSelectedMemberId(u.id);
                    setDocTab('all');
                    setDocSearch('');
                    setTypeFilter('all');
                    setStatusFilter('all');
                  }}
                  className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors border-l-2 ${
                    isSelected ? 'bg-gray-100 border-l-gray-900' : 'border-l-transparent hover:bg-gray-50'
                  }`}>
                  {u.profile_picture
                    ? <img src={u.profile_picture} className="w-7 h-7 rounded-lg object-cover shrink-0" alt="" />
                    : (
                      <div className="w-7 h-7 rounded-lg bg-gray-200 text-gray-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                    )
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-gray-900 truncate">{u.display_name}</p>
                    <p className="text-[10.5px] text-gray-400 truncate">{u.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] text-gray-400">{mDocs.length} docs</p>
                    <p className={`text-[10.5px] font-semibold ${pendingCount > 0 ? 'text-gray-700' : 'text-gray-400'}`}>
                      {pendingCount} pending
                    </p>
                  </div>
                </button>
              );
            })}

          </div>

          {/* Pagination */}
          {totalMemberPages > 1 && (
            <div className="shrink-0 flex items-center justify-between px-4 py-2 border-t border-gray-100 text-[11px] text-gray-500">
              <span>{(memberPage - 1) * MEMBERS_PER_PAGE + 1}–{Math.min(memberPage * MEMBERS_PER_PAGE, filteredMembers.length)} of {filteredMembers.length}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setMemberPage(p => Math.max(1, p - 1))} disabled={memberPage === 1}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"><ChevronLeft size={13} /></button>
                <button onClick={() => setMemberPage(p => Math.min(totalMemberPages, p + 1))} disabled={memberPage === totalMemberPages}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"><ChevronRight size={13} /></button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Detail panel */}
        <div className="flex-1 min-w-0 overflow-y-auto flex flex-col">
          {selectedMemberId === null ? (
            /* Empty state — no member selected */
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300 gap-3">
              <FileText size={48} className="opacity-20" />
              <p className="text-[13.5px] font-semibold text-gray-400">Select a member to view their agreements</p>
              <p className="text-[11.5px] text-gray-300">Use the search bar to find any member</p>
            </div>
          ) : !selectedMemberUser ? (
            /* Fallback while data loads */
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300 gap-3">
              <FileText size={48} className="opacity-20" />
              <p className="text-[13.5px] font-semibold text-gray-400">Loading…</p>
            </div>
          ) : (
            <>
              {/* Member header */}
              <div className="shrink-0 px-6 border-b border-gray-100 flex items-center min-h-[52px]">
                <div className="flex items-center gap-3 w-full">
                  {/* Avatar */}
                  {selectedMemberUser.profile_picture
                    ? <img src={selectedMemberUser.profile_picture} className="w-8 h-8 rounded-lg object-cover shrink-0" alt="" />
                    : (
                      <div className="w-8 h-8 rounded-lg bg-gray-200 text-gray-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                        {selectedMemberUser.display_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                    )
                  }
                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-gray-900">{selectedMemberUser.display_name}</p>
                    <p className="text-[11.5px] text-gray-400">{selectedMemberUser.email}</p>
                  </div>
                  {/* Member Actions dropdown */}
                  <div className="relative shrink-0" ref={memberActionsRef}>
                    <button
                      onClick={() => setMemberActionsOpen(o => !o)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      Member Actions <ChevronDown size={12} />
                    </button>
                    {memberActionsOpen && (
                      <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-30 py-1">
                        <button onClick={() => { setMemberActionsOpen(false); setShowAssign(true); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50 text-left">
                          <Plus size={13} /> Assign Agreement
                        </button>
                        <button onClick={() => {
                          setMemberActionsOpen(false);
                          Promise.allSettled(pendingMemberDocs.map(d => docApi.remindDocument(d.id)));
                        }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50 text-left">
                          <Bell size={13} /> Send Reminder (All Pending)
                        </button>
                        <button onClick={() => { setMemberActionsOpen(false); exportMemberDocsCsv(memberDocs, selectedMemberUser.display_name); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50 text-left">
                          <Download size={13} /> Export Member Docs
                        </button>
                        <div className="border-t border-gray-100 my-1" />
                        <button onClick={() => { setMemberActionsOpen(false); navigate(`/org/members/${selectedMemberId}`); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50 text-left">
                          <User size={13} /> View Member Profile
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {memberDocs.length === 0 ? (
                /* Zero-doc member selected */
                <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <FileText size={26} className="text-gray-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-[14px] font-bold text-gray-800">No agreements assigned yet</p>
                    <p className="text-[12px] text-gray-400 mt-1">Assign the first agreement to {selectedMemberUser.display_name}</p>
                  </div>
                  <button
                    onClick={() => setShowAssign(true)}
                    className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-xl transition-colors"
                  >
                    <Plus size={14} /> Assign Agreement
                  </button>
                </div>
              ) : (
                <>
              {/* Filter bar */}
              <div className="shrink-0 flex items-center gap-2 px-6 py-2 border-b border-gray-100 min-h-[42px]">
                <div className="relative flex-1">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input value={docSearch} onChange={e => setDocSearch(e.target.value)}
                    placeholder="Search agreements..."
                    className="w-full pl-7 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400/30 placeholder:text-gray-400" />
                </div>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none">
                  <option value="all">All Types</option>
                  <option value="required">Required</option>
                  <option value="policy">Policy</option>
                  <option value="form">Form</option>
                  <option value="certificate">Certificate</option>
                  <option value="agreement">Agreement</option>
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none">
                  <option value="all">All Status</option>
                  <option value="assigned">Pending</option>
                  <option value="uploaded">Under Review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="signed">Signed</option>
                </select>
              </div>

              {/* Document table */}
              <div className="flex-1 overflow-y-auto">
                {displayedDocs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 text-gray-400">
                    <FileText size={32} className="opacity-20 mb-2" />
                    <p className="text-[13px]">No agreements match this filter</p>
                  </div>
                ) : (
                  <table className="w-full text-[12px]">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        {['Document', 'Type', 'Status', 'Assigned On', 'Signed On', 'Expires On', 'Actions'].map(h => (
                          <th key={h} className="px-4 py-2 text-left text-[9px] font-bold text-gray-400 uppercase tracking-[0.1em] whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {displayedDocs.map(doc => {
                        const badge = ADMIN_STATUS_BADGE[doc.status];
                        const canReview = !doc.requires_signature && (doc.status === 'uploaded' || doc.status === 'pending_review');
                        const isAwaiting = doc.requires_signature && doc.status === 'assigned';
                        const primaryLabel = canReview ? 'Review' : isAwaiting ? 'Remind' : 'View';
                        const primaryAction = canReview || !isAwaiting
                          ? () => setDetailModalDoc(doc)
                          : () => docApi.remindDocument(doc.id).catch(() => {});
                        return (
                          <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                            {/* Document */}
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                  <FileText size={12} className="text-gray-400" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[12px] font-semibold text-gray-900 truncate max-w-[160px]">{doc.title}</p>
                                  <p className="text-[10px] text-gray-400">{doc.doc_reference ?? ''}</p>
                                </div>
                              </div>
                            </td>
                            {/* Type */}
                            <td className="px-4 py-2 whitespace-nowrap">
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600 capitalize">
                                {doc.category}
                              </span>
                            </td>
                            {/* Status */}
                            <td className="px-4 py-2 whitespace-nowrap">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
                                {badge.label}
                              </span>
                            </td>
                            {/* Assigned On */}
                            <td className="px-4 py-2 whitespace-nowrap">
                              <p className="text-[11.5px] text-gray-800">{fmtDate(doc.uploaded_at)}</p>
                              <p className="text-[10px] text-gray-400">by {doc.assigned_by_name ?? 'Admin'}</p>
                            </td>
                            {/* Signed On */}
                            <td className="px-4 py-2 whitespace-nowrap">
                              {doc.signed_at ? (
                                <>
                                  <p className="text-[11.5px] text-gray-800">{fmtDate(doc.signed_at)}</p>
                                  <p className="text-[10px] text-gray-400">by {doc.user.display_name}</p>
                                </>
                              ) : (
                                <>
                                  <p className="text-[11.5px] text-gray-400">—</p>
                                  <p className="text-[10px] text-gray-400">Not signed yet</p>
                                </>
                              )}
                            </td>
                            {/* Expires On */}
                            <td className="px-4 py-2 whitespace-nowrap">
                              {doc.expiration_date ? (
                                <>
                                  <p className="text-[11.5px] text-gray-800">{fmtDate(doc.expiration_date)}</p>
                                  {daysUntilLabel(doc.expiration_date)}
                                </>
                              ) : (
                                <p className="text-[11.5px] text-gray-400">—</p>
                              )}
                            </td>
                            {/* Actions */}
                            <td className="px-4 py-2 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => canReview || !isAwaiting ? setDetailModalDoc(doc) : primaryAction()}
                                  className="px-2.5 py-1 text-[11.5px] font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors">
                                  {primaryLabel}
                                </button>
                                <button
                                  onClick={e => {
                                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                    setMenuAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                    setOpenMenuDocId(id => id === doc.id ? null : doc.id);
                                  }}
                                  className="p-1 rounded hover:bg-gray-100 transition-colors">
                                  <MoreVertical size={13} className="text-gray-400" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); setShowAssign(true); }}
                onClick={() => setShowAssign(true)}
                className="shrink-0 mx-6 my-2 border-2 border-dashed border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-xl px-4 py-3.5 text-center cursor-pointer transition-colors"
              >
                <Upload size={14} className="mx-auto text-gray-300 mb-1" />
                <p className="text-[11.5px] text-gray-400">
                  Drop files here or <span className="text-gray-700 font-semibold">click to assign agreement</span>
                </p>
                <p className="text-[10px] text-gray-300 mt-0.5">Supports PDF, DOC, DOCX (Max 20MB)</p>
              </div>
            </>
          )}
            </>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {/* Doc row 3-dot portal menu */}
      {openMenuDocId !== null && menuAnchor && (() => {
        const doc = displayedDocs.find(d => d.id === openMenuDocId);
        if (!doc) return null;
        return createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpenMenuDocId(null)} />
            <div
              className="fixed z-50 w-52 bg-white border border-gray-200 rounded-xl shadow-xl py-1"
              style={{ top: menuAnchor.top, right: menuAnchor.right }}
            >
              <button onClick={() => { setDetailModalDoc(doc); setOpenMenuDocId(null); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50">
                <Eye size={12} /> View Agreement
              </button>
              {(doc.status === 'uploaded' || doc.status === 'pending_review') && (
                <button onClick={() => {
                  docApi.reviewDocument(doc.id, { action: 'approve' })
                    .then(() => { refreshDocs(); setOpenMenuDocId(null); }).catch(() => {});
                }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-gray-600 hover:bg-gray-50">
                  <CheckCircle size={12} /> Approve
                </button>
              )}
              {(doc.status === 'uploaded' || doc.status === 'pending_review') && (
                <button onClick={() => {
                  docApi.reviewDocument(doc.id, { action: 'reject' })
                    .then(() => { refreshDocs(); setOpenMenuDocId(null); }).catch(() => {});
                }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50">
                  <XCircle size={12} /> Reject
                </button>
              )}
              <div className="border-t border-gray-100 my-1" />
              <button onClick={() => { docApi.remindDocument(doc.id).catch(() => {}); setOpenMenuDocId(null); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50">
                <Bell size={12} /> Send Reminder
              </button>
              <button onClick={() => { navigator.clipboard.writeText(doc.doc_reference ?? ''); setOpenMenuDocId(null); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50">
                <ListChecks size={12} /> Copy Reference
              </button>
              {doc.file_url && (
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" onClick={() => setOpenMenuDocId(null)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50">
                  <Download size={12} /> Download File
                </a>
              )}
              <div className="border-t border-gray-100 my-1" />
              <button onClick={() => { setConfirmDeleteDoc(doc); setOpenMenuDocId(null); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50">
                <XCircle size={12} /> Delete Agreement
              </button>
            </div>
          </>,
          document.body
        );
      })()}
      {showAssign && selectedMemberId !== null && (() => {
        const user = selectedMemberData?.user
          ?? allMembers.find(m => m.user.id === selectedMemberId)?.user;
        if (!user) return null;
        return (
          <AssignDocModal
            userId={user.id}
            userName={user.display_name}
            onClose={() => setShowAssign(false)}
            onAssigned={() => { setShowAssign(false); refreshDocs(); orgApi.getMembers({ status: 'active' }).then(setAllMembers).catch(() => {}); }}
          />
        );
      })()}

      {detailModalDoc && (
        <AdminDocDetailModal
          doc={detailModalDoc}
          onClose={() => setDetailModalDoc(null)}
          onReviewed={d => { updateDoc(d); setDetailModalDoc(null); }}
        />
      )}

      {/* ── Delete confirmation ── */}
      {confirmDeleteDoc && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-[380px] p-6">
            <div className="flex items-center justify-center w-11 h-11 rounded-full bg-gray-100 mx-auto mb-4">
              <XCircle size={22} className="text-gray-600" />
            </div>
            <h3 className="text-[15px] font-bold text-gray-900 text-center mb-1">Delete Agreement?</h3>
            <p className="text-[12.5px] text-gray-500 text-center mb-1">
              You're about to permanently delete
            </p>
            <p className="text-[13px] font-semibold text-gray-800 text-center mb-4">
              "{confirmDeleteDoc.title}"
            </p>
            <p className="text-[11.5px] text-gray-400 text-center mb-6">
              This will remove it for everyone and cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteDoc(null)}
                className="flex-1 px-4 py-2 text-[13px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  docApi.deleteDocument(confirmDeleteDoc.id)
                    .then(() => { refreshDocs(); setConfirmDeleteDoc(null); })
                    .catch(() => {});
                }}
                className="flex-1 px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-xl transition-colors"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
