import { useState, useEffect, useRef, useMemo } from 'react';
import {
  X, ChevronDown, ChevronRight, ChevronLeft,
  GripVertical, Search, MoreHorizontal, Plus,
} from 'lucide-react';
import {
  formsApi, orgApi,
  type StandaloneForm, type StandaloneFormField,
  type StandaloneFormFieldType, type FormResponsesReport,
} from '../api/orgApi';
import { useOrg } from '../context/OrgContext';
import PageHelp, { type PageHelpSection } from '../components/PageHelp';

const FORMS_HELP: PageHelpSection[] = [
  {
    eyebrow: '1 · What is a Form?',
    bullets: [
      'A **form** is a reusable questionnaire — feedback surveys, intake forms, agreements, polls, or audit checklists.',
      'Forms work standalone (shareable link) or **inside onboarding** as a form-type task assigned to a member.',
      'Responses are stored per submitter so you can track who filled what and when.',
    ],
  },
  {
    eyebrow: '2 · Create a Form',
    bullets: [
      'Click **+ Create New Form** and give it a name and short description.',
      'Add **fields**: text, paragraph, multiple choice, checkbox, dropdown, date, file upload, rating, signature.',
      'Mark fields as **required** if a response must include them.',
      'Use **Import Form** to upload a JSON definition you exported from another form.',
    ],
  },
  {
    eyebrow: '3 · Publish & Share',
    bullets: [
      'A form starts as **Draft**. Switch to **Published** to make it live.',
      'Use the row 3-dot menu to **copy the share link**, **assign to members**, or **send via email**.',
      'When you\'re done collecting, switch the form to **Closed** — the link still resolves but no new responses are accepted.',
    ],
  },
  {
    eyebrow: '4 · Analyze Responses',
    bullets: [
      'Click a row to open the **Responses tab** — see per-question summaries, response count, and individual submissions.',
      'Use the **Insights** card at the bottom to track form performance: published count, total responses, average response time, completion rate.',
      'Export responses as CSV from the form detail view.',
    ],
  },
  {
    eyebrow: '5 · Categories & Filtering',
    bullets: [
      'Tag forms by **category** (Onboarding, Feedback, Compliance, etc.) for easy filtering.',
      'Filter by **department** to see forms scoped to a specific team.',
      'Use the **Draft / Published / Closed** tabs at the top to focus on a lifecycle stage.',
    ],
  },
  {
    eyebrow: 'Tip',
    body: 'Forms used inside onboarding (assigned as a form-type task) automatically flow their responses into the member\'s onboarding record — no need to chase responses manually.',
  },
];

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const FIELD_TYPE_LABELS: Record<StandaloneFormFieldType, string> = {
  text:        'Short Text',
  textarea:    'Long Text',
  choice:      'Multiple Choice',
  multiselect: 'Multi-select',
  boolean:     'Yes / No',
  date:        'Date',
  number:      'Number',
  rating:      'Rating Scale',
  file:        'File Upload',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 2)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs  < 24) return `${hrs}h ago`;
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso);
}

function pct(n: number, total: number) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

// ── Response bar chart (monochrome) ──────────────────────────────────────────

function BarChart({ counts, options, total }: { counts: Record<string, number>; options: string[]; total: number }) {
  const keys = options.length ? options : Object.keys(counts);
  return (
    <div className="space-y-1.5">
      {keys.map(k => {
        const count = counts[k] ?? 0;
        const p = pct(count, total);
        return (
          <div key={k} className="flex items-center gap-2 text-xs">
            <span className="w-28 truncate text-gray-500 shrink-0">{k}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-1.5">
              <div className="bg-gray-700 h-1.5 rounded-full" style={{ width: `${p}%` }} />
            </div>
            <span className="text-gray-400 w-14 text-right">{count} · {p}%</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Editable field row ────────────────────────────────────────────────────────

interface DraftField {
  _key: string;
  question: string;
  field_type: StandaloneFormFieldType;
  options: string[];
  required: boolean;
  rating_max: number;
}

function FieldRow({
  field, onChange, onDelete, onDragStart, onDrop,
}: {
  field: DraftField;
  onChange: (f: DraftField) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  const needsOptions = field.field_type === 'choice' || field.field_type === 'multiselect';
  const isRating = field.field_type === 'rating';
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={e => e.preventDefault()}
      onDrop={onDrop}
      className="border border-gray-200 rounded-lg p-3 bg-white space-y-2"
    >
      <div className="flex items-start gap-2">
        <button type="button" className="mt-2 cursor-grab text-gray-300 hover:text-gray-400 shrink-0">
          <GripVertical size={14} />
        </button>
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <input
              className="flex-1 text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-gray-400"
              placeholder="Question"
              value={field.question}
              onChange={e => onChange({ ...field, question: e.target.value })}
            />
            <select
              className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-gray-400 text-gray-600"
              value={field.field_type}
              onChange={e => onChange({ ...field, field_type: e.target.value as StandaloneFormFieldType, options: [] })}
            >
              {(Object.keys(FIELD_TYPE_LABELS) as StandaloneFormFieldType[]).map(t => (
                <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          {needsOptions && (
            <div className="space-y-1 pl-1">
              {field.options.map((opt, i) => (
                <div key={i} className="flex gap-1">
                  <input
                    className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-gray-400"
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={e => {
                      const opts = [...field.options];
                      opts[i] = e.target.value;
                      onChange({ ...field, options: opts });
                    }}
                  />
                  <button type="button" onClick={() => onChange({ ...field, options: field.options.filter((_, j) => j !== i) })} className="text-gray-300 hover:text-gray-500">
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => onChange({ ...field, options: [...field.options, ''] })} className="text-xs text-gray-500 hover:text-gray-800 underline-offset-2 hover:underline">
                + Add option
              </button>
            </div>
          )}
          {isRating && (
            <div className="flex items-center gap-3 pl-1 text-xs text-gray-500">
              <span>Max:</span>
              {[5, 10].map(v => (
                <label key={v} className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" checked={field.rating_max === v} onChange={() => onChange({ ...field, rating_max: v })} />
                  {v}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button type="button" onClick={onDelete} className="text-gray-300 hover:text-gray-600 text-xs">✕</button>
          <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
            <input type="checkbox" checked={field.required} onChange={e => onChange({ ...field, required: e.target.checked })} />
            Req.
          </label>
        </div>
      </div>
    </div>
  );
}

// ── Form Builder Modal ────────────────────────────────────────────────────────

function FormBuilderModal({
  existing, onClose, onSaved,
}: {
  existing: StandaloneForm | null;
  onClose: () => void;
  onSaved: (f: StandaloneForm) => void;
}) {
  const [title, setTitle]         = useState(existing?.title ?? '');
  const [description, setDesc]    = useState(existing?.description ?? '');
  const [formType, setFormType]   = useState<'form' | 'survey'>(existing?.form_type ?? 'form');
  const [dueDate, setDueDate]     = useState(existing?.due_date?.slice(0, 10) ?? '');
  const [showResults, setShowResults] = useState(existing?.show_results_to_members ?? false);
  const [fields, setFields]       = useState<DraftField[]>(
    existing?.fields.map(f => ({ ...f, _key: String(f.id) })) ?? []
  );
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const dragIdx = useRef<number | null>(null);

  function addField() {
    setFields(prev => [...prev, { _key: `new_${Date.now()}`, question: '', field_type: 'text', options: [], required: true, rating_max: 5 }]);
  }

  async function handleSave() {
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true); setError('');
    try {
      let form: StandaloneForm;
      const payload = { title: title.trim(), description, form_type: formType, due_date: dueDate || null, show_results_to_members: showResults };
      if (existing) {
        form = await formsApi.updateForm(existing.id, payload);
        const existingIds = new Set(existing.fields.map(f => f.id));
        const keepIds = new Set(fields.filter(f => !f._key.startsWith('new_') && existingIds.has(Number(f._key))).map(f => Number(f._key)));
        for (const ef of existing.fields) { if (!keepIds.has(ef.id)) await formsApi.deleteField(ef.id); }
        for (let i = 0; i < fields.length; i++) {
          const f = fields[i];
          const fp = { question: f.question, field_type: f.field_type, options: f.options, required: f.required, order: i, rating_max: f.rating_max };
          if (existingIds.has(Number(f._key))) await formsApi.updateField(Number(f._key), fp);
          else await formsApi.createField(form.id, fp);
        }
      } else {
        form = await formsApi.createForm(payload);
        for (let i = 0; i < fields.length; i++) {
          const f = fields[i];
          await formsApi.createField(form.id, { question: f.question, field_type: f.field_type, options: f.options, required: f.required, order: i, rating_max: f.rating_max });
        }
      }
      const refreshed = await formsApi.getForms();
      onSaved(refreshed.find(x => x.id === form.id) ?? form);
    } catch { setError('Failed to save form'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-10 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl mx-4 mb-12 border border-gray-200">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <h2 className="text-[15px] font-semibold text-gray-800">{existing ? 'Edit Form' : 'Create New Form'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3">
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div>
            <p className="text-[11px] text-gray-400 mb-1.5">Type</p>
            <div className="flex gap-2">
              {(['form', 'survey'] as const).map(t => (
                <button key={t} type="button" onClick={() => setFormType(t)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border capitalize transition-colors ${
                    formType === t ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <input
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-gray-400"
            placeholder="Form title *"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <textarea
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-gray-400 resize-none"
            placeholder="Description (optional)"
            rows={2}
            value={description}
            onChange={e => setDesc(e.target.value)}
          />
          <div className="flex gap-4">
            <div className="flex-1">
              <p className="text-[11px] text-gray-400 mb-1">Due Date (optional)</p>
              <input type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-gray-400"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer pt-5">
              <input type="checkbox" checked={showResults} onChange={e => setShowResults(e.target.checked)} />
              Show results to members
            </label>
          </div>
          <div className="border-t border-gray-100 pt-2.5">
            <p className="text-[11px] font-medium text-gray-400 mb-2">Questions</p>
            <div className="space-y-2">
              {fields.map((f, i) => (
                <FieldRow
                  key={f._key} field={f}
                  onChange={updated => setFields(prev => prev.map((x, j) => j === i ? updated : x))}
                  onDelete={() => setFields(prev => prev.filter((_, j) => j !== i))}
                  onDragStart={() => { dragIdx.current = i; }}
                  onDrop={() => {
                    if (dragIdx.current === null || dragIdx.current === i) return;
                    const r = [...fields];
                    const [m] = r.splice(dragIdx.current, 1);
                    r.splice(i, 0, m);
                    setFields(r);
                    dragIdx.current = null;
                  }}
                />
              ))}
            </div>
            <button type="button" onClick={addField} className="mt-2 text-xs text-gray-500 hover:text-gray-800 hover:underline underline-offset-2">
              + Add question
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-2.5 border-t border-gray-100">
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="bg-gray-900 text-white text-xs px-4 py-1.5 rounded-lg hover:bg-gray-800 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Import Form Modal ─────────────────────────────────────────────────────────

function ImportFormModal({ onClose, onImported }: { onClose: () => void; onImported: (f: StandaloneForm) => void }) {
  const [json, setJson]             = useState('');
  const [importing, setImporting]   = useState(false);
  const [error, setError]           = useState('');
  const fileRef                     = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setJson(String(ev.target?.result ?? ''));
    reader.readAsText(file);
  }

  async function handleImport() {
    setError('');
    let parsed: Partial<StandaloneForm & { fields: Partial<StandaloneFormField>[] }>;
    try { parsed = JSON.parse(json); } catch { setError('Invalid JSON.'); return; }
    if (!parsed.title) { setError('JSON must include a "title" field.'); return; }
    setImporting(true);
    try {
      const form = await formsApi.createForm({
        title: parsed.title, description: parsed.description ?? '',
        form_type: parsed.form_type ?? 'form',
        due_date: parsed.due_date ?? null, show_results_to_members: parsed.show_results_to_members ?? false,
      });
      if (Array.isArray(parsed.fields)) {
        for (let i = 0; i < parsed.fields.length; i++) {
          const f = parsed.fields[i];
          await formsApi.createField(form.id, { question: f.question ?? '', field_type: f.field_type ?? 'text', options: f.options ?? [], required: f.required ?? true, order: i, rating_max: f.rating_max ?? 5 });
        }
      }
      const refreshed = await formsApi.getForms();
      onImported(refreshed.find(x => x.id === form.id) ?? form);
    } catch { setError('Import failed.'); }
    finally { setImporting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 border border-gray-200">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <div>
            <h2 className="text-[15px] font-semibold text-gray-800">Import Form</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Paste JSON or upload a .json file</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3">
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => fileRef.current?.click()}
              className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50">
              Browse file
            </button>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
            <span className="text-[11px] text-gray-400">or paste JSON below</span>
          </div>
          <textarea
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-gray-400 resize-y"
            rows={9}
            placeholder={'{\n  "title": "My Form",\n  "form_type": "form",\n  "fields": [...]\n}'}
            value={json}
            onChange={e => setJson(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 px-4 py-2.5 border-t border-gray-100">
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5">Cancel</button>
          <button onClick={handleImport} disabled={importing || !json.trim()}
            className="bg-gray-900 text-white text-xs px-4 py-1.5 rounded-lg hover:bg-gray-800 disabled:opacity-50">
            {importing ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Distribute Modal ──────────────────────────────────────────────────────────

function DistributeModal({ form, onClose, onDistributed }: { form: StandaloneForm; onClose: () => void; onDistributed: (n: number) => void }) {
  const [targetType, setTargetType]   = useState<'org' | 'department' | 'members'>('org');
  const [deptId, setDeptId]           = useState<number | null>(null);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [allMembers, setAllMembers]   = useState<{ id: number; user: { display_name: string } }[]>([]);
  const [selectedMembers, setSelected] = useState<number[]>([]);
  const [memberSearch, setSearch]     = useState('');
  const [sending, setSending]         = useState(false);
  const [error, setError]             = useState('');

  const isRedistribute = form.status === 'published';

  useEffect(() => {
    orgApi.getDepartments().then(setDepartments).catch(() => {});
    orgApi.getMembers().then(setAllMembers).catch(() => {});
  }, []);

  async function handleSend() {
    setSending(true); setError('');
    try {
      const res = await formsApi.distributeForm(form.id, {
        target_type: targetType,
        department_id: targetType === 'department' ? deptId ?? undefined : undefined,
        member_ids: targetType === 'members' ? selectedMembers : undefined,
      });
      onDistributed(res.recipients_notified);
    } catch { setError('Failed to distribute form'); }
    finally { setSending(false); }
  }

  const filteredMembers = allMembers.filter(m => m.user.display_name.toLowerCase().includes(memberSearch.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 border border-gray-200">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <div>
            <h2 className="text-[15px] font-semibold text-gray-800">{isRedistribute ? 'Distribute Again' : 'Distribute'}</h2>
            <p className="text-[11px] text-gray-400 truncate mt-0.5">{form.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3">
          {error && <p className="text-xs text-red-500">{error}</p>}
          {isRedistribute && (
            <p className="text-[11.5px] text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              Members who already submitted will receive a fresh blank form. Their previous responses are preserved for review.
            </p>
          )}
          <div>
            <p className="text-[11px] text-gray-400 mb-1">Send to</p>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-gray-400" value={targetType} onChange={e => setTargetType(e.target.value as typeof targetType)}>
              <option value="org">Whole Organization</option>
              <option value="department">Specific Department</option>
              <option value="members">Specific Members</option>
            </select>
          </div>
          {targetType === 'department' && (
            <select className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-gray-400" value={deptId ?? ''} onChange={e => setDeptId(Number(e.target.value))}>
              <option value="">Select department…</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          {targetType === 'members' && (
            <div className="space-y-2">
              <input className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-gray-400" placeholder="Search members…" value={memberSearch} onChange={e => setSearch(e.target.value)} />
              <div className="max-h-36 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
                {filteredMembers.map(m => (
                  <label key={m.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                    <input type="checkbox" checked={selectedMembers.includes(m.id)} onChange={e => setSelected(prev => e.target.checked ? [...prev, m.id] : prev.filter(id => id !== m.id))} />
                    {m.user.display_name}
                  </label>
                ))}
              </div>
              {selectedMembers.length > 0 && <p className="text-xs text-gray-400">{selectedMembers.length} selected</p>}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-4 py-2.5 border-t border-gray-100">
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5">Cancel</button>
          <button
            onClick={handleSend}
            disabled={sending || (targetType === 'department' && !deptId) || (targetType === 'members' && selectedMembers.length === 0)}
            className="bg-gray-900 text-white text-xs px-4 py-1.5 rounded-lg hover:bg-gray-800 disabled:opacity-50">
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Right Drawer ──────────────────────────────────────────────────────────────

function FormDrawer({ form, initialTab, onClose, onEdit, onDelete, onDistribute }: {
  form: StandaloneForm; initialTab?: 'fields' | 'responses' | 'distribute';
  onClose: () => void; onEdit: () => void; onDelete: () => void; onDistribute: () => void;
}) {
  const [drawerTab, setDrawerTab]         = useState<'fields' | 'responses' | 'distribute'>(initialTab ?? 'fields');
  const [report, setReport]               = useState<FormResponsesReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [showArchived, setShowArchived]   = useState(false);

  useEffect(() => {
    if (drawerTab === 'responses' && !report) {
      setReportLoading(true);
      formsApi.getResponses(form.id).then(setReport).catch(() => {}).finally(() => setReportLoading(false));
    }
  }, [drawerTab, form.id, report]);

  const STATUS_LABEL: Record<string, string> = { draft: 'Draft', published: 'Active', closed: 'Closed' };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col"
        style={{ width: '80vw', height: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-3 border-b border-gray-100 shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-[15px] font-semibold text-gray-800 truncate">{form.title}</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {STATUS_LABEL[form.status]} · {form.form_type} · {form.total_submitted} submitted
            </p>
          </div>
          <div className="flex items-center gap-1 ml-4 shrink-0">
            {form.status === 'draft' && (
              <button onClick={onEdit} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">Edit</button>
            )}
            {form.status === 'draft' && (
              <button onClick={onDelete} className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-gray-100">Delete</button>
            )}
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X size={15} /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6 shrink-0">
          {(['fields', 'responses', 'distribute'] as const).map(t => (
            <button key={t} onClick={() => setDrawerTab(t)}
              className={`py-2.5 px-4 text-xs capitalize font-medium border-b-2 transition-colors ${
                drawerTab === t ? 'border-gray-800 text-gray-800' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {drawerTab === 'fields' && (
            <div className="grid grid-cols-2 gap-3">
              {form.fields.length === 0 && <p className="col-span-2 text-xs text-gray-400 py-12 text-center">No questions yet.</p>}
              {form.fields.map((f, i) => (
                <div key={f.id} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                  <span className="text-[11px] text-gray-400 mt-0.5 w-4 shrink-0">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{f.question}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{FIELD_TYPE_LABELS[f.field_type]}{f.required ? ' · required' : ''}</p>
                    {f.options.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {f.options.map(o => (
                          <span key={o} className="text-[11px] border border-gray-200 rounded px-1.5 py-0.5 text-gray-500">{o}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {drawerTab === 'responses' && (
            <div className="space-y-5">
              {reportLoading && <p className="text-xs text-gray-400 text-center py-12">Loading…</p>}
              {report && (
                <>
                  {/* Summary bar */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-8">
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{report.total_submitted} / {report.total_recipients}</p>
                        <p className="text-xs text-gray-400">{pct(report.total_submitted, report.total_recipients)}% response rate</p>
                      </div>
                      <div className="flex gap-5">
                        <div>
                          <p className="text-[11px] text-gray-400">Questions</p>
                          <p className="text-sm font-semibold text-gray-800">{report.per_question.length}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-gray-400">Pending</p>
                          <p className="text-sm font-semibold text-gray-800">{report.total_recipients - report.total_submitted}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-gray-400">Completion</p>
                          <p className="text-sm font-semibold text-gray-800">{pct(report.total_submitted, report.total_recipients)}%</p>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => window.open(formsApi.exportCsvUrl(form.id), '_blank')}
                      className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50">
                      Export CSV
                    </button>
                  </div>

                  {/* Response table */}
                  {report.per_member.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-r border-gray-200 whitespace-nowrap w-8">#</th>
                            <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-r border-gray-200 whitespace-nowrap min-w-[150px]">Member</th>
                            <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-r border-gray-200 whitespace-nowrap min-w-[120px]">Submitted At</th>
                            {report.per_question.map(q => (
                              <th key={q.field_id} className="text-left px-3 py-2.5 border-b border-r border-gray-200 min-w-[160px] max-w-[220px]">
                                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider truncate">{q.question}</p>
                                <p className="text-[10px] font-normal text-gray-300 normal-case mt-0.5">{FIELD_TYPE_LABELS[q.field_type]}</p>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {report.per_member.map((m, i) => (
                            <tr key={m.member_id} className="hover:bg-gray-50/60 border-b border-gray-100 last:border-b-0">
                              <td className="px-3 py-2.5 text-gray-300 border-r border-gray-100 text-center">{i + 1}</td>
                              <td className="px-3 py-2.5 font-semibold text-gray-800 border-r border-gray-100 whitespace-nowrap">{m.name}</td>
                              <td className="px-3 py-2.5 text-gray-500 border-r border-gray-100 whitespace-nowrap">{fmtDate(m.submitted_at)}</td>
                              {report.per_question.map(q => {
                                const val = m.answers[String(q.field_id)];
                                const isFileUrl = val && (val.startsWith('/') || val.startsWith('http')) && q.field_type === 'file';
                                return (
                                  <td key={q.field_id} className="px-3 py-2.5 text-gray-700 border-r border-gray-100 max-w-[220px]">
                                    {isFileUrl ? (
                                      <a href={val} target="_blank" rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-gray-700 hover:text-gray-900 hover:underline text-xs">
                                        <span>📎</span>
                                        <span className="truncate max-w-[160px]">{val.split('/').pop()}</span>
                                      </a>
                                    ) : (
                                      <span className="block truncate">{val || <span className="text-gray-300">—</span>}</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400 border border-gray-100 rounded-xl">
                      <p className="text-sm">No responses submitted yet.</p>
                    </div>
                  )}

                  {/* Archived / previous-round responses */}
                  {report.archived_members.length > 0 && (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setShowArchived(v => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-semibold text-gray-600">
                            Previous Responses
                          </span>
                          <span className="text-[10.5px] text-gray-400 bg-white border border-gray-200 rounded-md px-1.5 py-0.5">
                            {report.archived_members.length} submission{report.archived_members.length !== 1 ? 's' : ''} before last redistribution
                          </span>
                        </div>
                        <span className="text-gray-400 text-xs">{showArchived ? '▲ Hide' : '▼ Show'}</span>
                      </button>
                      {showArchived && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="bg-gray-50/60">
                                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-r border-gray-200 w-8">#</th>
                                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-r border-gray-200 min-w-[150px]">Member</th>
                                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-r border-gray-200 min-w-[120px]">Originally Submitted</th>
                                {report.per_question.map(q => (
                                  <th key={q.field_id} className="text-left px-3 py-2.5 border-b border-r border-gray-200 min-w-[160px] max-w-[220px]">
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate">{q.question}</p>
                                    <p className="text-[10px] font-normal text-gray-300 normal-case mt-0.5">{FIELD_TYPE_LABELS[q.field_type]}</p>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {report.archived_members.map((m, i) => (
                                <tr key={`${m.member_id}-${i}`} className="hover:bg-gray-50/40 border-b border-gray-100 last:border-b-0">
                                  <td className="px-3 py-2.5 text-gray-300 border-r border-gray-100 text-center">{i + 1}</td>
                                  <td className="px-3 py-2.5 font-semibold text-gray-600 border-r border-gray-100 whitespace-nowrap">{m.name}</td>
                                  <td className="px-3 py-2.5 text-gray-400 border-r border-gray-100 whitespace-nowrap">{fmtDate(m.submitted_at)}</td>
                                  {report.per_question.map(q => {
                                    const val = m.answers[String(q.field_id)];
                                    const isFileUrl = val && (val.startsWith('/') || val.startsWith('http')) && q.field_type === 'file';
                                    return (
                                      <td key={q.field_id} className="px-3 py-2.5 text-gray-500 border-r border-gray-100 max-w-[220px]">
                                        {isFileUrl ? (
                                          <a href={val} target="_blank" rel="noreferrer"
                                            className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 hover:underline text-xs">
                                            <span>📎</span>
                                            <span className="truncate max-w-[160px]">{val.split('/').pop()}</span>
                                          </a>
                                        ) : (
                                          <span className="block truncate">{val || <span className="text-gray-300">—</span>}</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Question summary charts — only for aggregatable types */}
                  {report.per_question.some(q => ['choice', 'multiselect', 'boolean', 'rating'].includes(q.field_type)) && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Question Summary</p>
                      <div className="grid grid-cols-2 gap-3">
                        {report.per_question.filter(q => ['choice', 'multiselect', 'boolean', 'rating'].includes(q.field_type)).map(q => (
                          <div key={q.field_id} className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-2">
                            <p className="text-xs font-medium text-gray-700">{q.question}</p>
                            <BarChart counts={q.counts} options={q.options} total={report.total_submitted} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              {!reportLoading && !report && <p className="text-xs text-gray-400 text-center py-12">No responses yet.</p>}
            </div>
          )}

          {drawerTab === 'distribute' && (
            <div className="max-w-md space-y-3">
              {form.status === 'published' && (
                <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                  This form is published and collecting responses.
                </p>
              )}
              <p className="text-sm text-gray-600">Send this form to org members. Sending will publish the form and notify recipients.</p>
              <button onClick={onDistribute} className="w-full bg-gray-900 text-white text-xs px-4 py-2 rounded-lg hover:bg-gray-800">
                Send to recipients
              </button>
              {form.status === 'published' && (
                <button
                  onClick={async () => { try { await formsApi.updateForm(form.id, { status: 'closed' }); window.location.reload(); } catch {/* */} }}
                  className="w-full text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-4 py-2">
                  Close form (stop collecting)
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Custom Dropdown ───────────────────────────────────────────────────────────

function Dropdown({ label, options, value, onChange }: {
  label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const current = options.find(o => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 bg-white hover:border-gray-400 whitespace-nowrap transition-colors">
        {current?.label ?? label}
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[150px] py-1">
          {options.map(o => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${o.value === value ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Row Actions Dropdown ──────────────────────────────────────────────────────

function RowActions({ form, onView, onViewResponses, onExportCsv, onEdit, onDistribute, onClose: onCloseForm, onReopen, onDuplicate, onDelete }: {
  form: StandaloneForm;
  onView: () => void;
  onViewResponses: () => void;
  onExportCsv: () => void;
  onEdit: () => void;
  onDistribute: () => void;
  onClose: () => void;
  onReopen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  function item(label: string, cb: () => void, danger = false) {
    return (
      <button key={label} onClick={() => { cb(); setOpen(false); }}
        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${danger ? 'text-red-500' : 'text-gray-600'}`}>
        {label}
      </button>
    );
  }
  const sep = <div className="border-t border-gray-100 my-0.5" />;

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[160px]">
          {item('Open', onView)}

          {form.status === 'draft' && (
            <>
              {item('Edit', onEdit)}
              {sep}
              {item('Distribute', onDistribute)}
              {sep}
              {item('Duplicate', onDuplicate)}
              {sep}
              {item('Delete', onDelete, true)}
            </>
          )}

          {form.status === 'published' && (
            <>
              {item('Edit', onEdit)}
              {item('View Responses', onViewResponses)}
              {item('Export CSV', onExportCsv)}
              {sep}
              {item('Distribute Again', onDistribute)}
              {item('Close Form', onCloseForm)}
              {sep}
              {item('Duplicate', onDuplicate)}
              {sep}
              {item('Delete', onDelete, true)}
            </>
          )}

          {form.status === 'closed' && (
            <>
              {item('Edit', onEdit)}
              {item('View Responses', onViewResponses)}
              {item('Export CSV', onExportCsv)}
              {sep}
              {item('Reopen', onReopen)}
              {sep}
              {item('Duplicate', onDuplicate)}
              {item('Delete', onDelete, true)}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── SVG Sparkline ─────────────────────────────────────────────────────────────

function Sparkline({ data }: { data: { week: string; count: number }[] }) {
  if (data.length < 2) return <div className="h-10 flex items-center justify-center text-[11px] text-gray-300">No data</div>;
  const W = 400; const H = 40; const PAD = 6;
  const maxVal = Math.max(...data.map(d => d.count), 1);
  const points = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((d.count / maxVal) * (H - PAD * 2));
    return `${x},${y}`;
  });
  const fp = points[0].split(',');
  const lp = points[points.length - 1].split(',');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-10" preserveAspectRatio="none">
      <polyline points={`${fp[0]},${H} ${points.join(' ')} ${lp[0]},${H}`} fill="rgba(17,24,39,0.06)" stroke="none" />
      <polyline points={points.join(' ')} fill="none" stroke="#374151" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((_, i) => {
        const [x, y] = points[i].split(',');
        return <circle key={i} cx={Number(x)} cy={Number(y)} r={i === data.length - 1 ? 3 : 2} fill={i === data.length - 1 ? '#111827' : '#9ca3af'} />;
      })}
    </svg>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type TabFilter    = 'all' | 'draft' | 'published' | 'closed';
type CatFilter    = 'all' | 'form' | 'survey';
type StatusFilter = 'all' | 'active' | 'draft' | 'closed';

const STATUS_LABEL: Record<string, string> = { draft: 'Draft', published: 'Active', closed: 'Closed' };
const STATUS_COLOR: Record<string, string> = { draft: 'text-gray-400', published: 'text-gray-800', closed: 'text-gray-400' };

export default function OrgForms() {
  const { canManageMembers, isSuperadmin } = useOrg();
  const isAdmin = isSuperadmin || canManageMembers;

  const [forms, setForms]               = useState<StandaloneForm[]>([]);
  const [loading, setLoading]           = useState(true);
  const [insights, setInsights]         = useState<{ week: string; count: number }[]>([]);
  const [tab, setTab]                   = useState<TabFilter>('all');
  const [search, setSearch]             = useState('');
  const [catFilter, setCatFilter]       = useState<CatFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage]                 = useState(1);
  const [selected, setSelected]         = useState<StandaloneForm | null>(null);
  const [selectedInitialTab, setSelectedInitialTab] = useState<'fields' | 'responses' | 'distribute'>('fields');
  const [showBuilder, setShowBuilder]   = useState(false);
  const [editingForm, setEditingForm]   = useState<StandaloneForm | null>(null);
  const [showDistribute, setShowDistribute] = useState(false);
  const [showImport, setShowImport]     = useState(false);
  const [toast, setToast]               = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll]       = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StandaloneForm | null>(null);
  const [deleting, setDeleting]         = useState(false);

  useEffect(() => {
    formsApi.getForms().then(setForms).catch(() => {}).finally(() => setLoading(false));
    formsApi.getInsights().then(setInsights).catch(() => {});
  }, []);

  function showToastMsg(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  async function handleDelete(form: StandaloneForm) {
    setDeleteTarget(form);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await formsApi.deleteForm(deleteTarget.id);
      setForms(prev => prev.filter(f => f.id !== deleteTarget.id));
      if (selected?.id === deleteTarget.id) setSelected(null);
      showToastMsg('Form deleted');
      setDeleteTarget(null);
    } catch { showToastMsg('Failed to delete'); }
    finally { setDeleting(false); }
  }

  async function handleCloseForm(form: StandaloneForm) {
    try { await formsApi.updateForm(form.id, { status: 'closed' }); setForms(prev => prev.map(f => f.id === form.id ? { ...f, status: 'closed' } : f)); if (selected?.id === form.id) setSelected({ ...selected, status: 'closed' }); showToastMsg('Form closed'); }
    catch { showToastMsg('Failed to close'); }
  }

  async function handleReopen(form: StandaloneForm) {
    try {
      await formsApi.updateForm(form.id, { status: 'draft' });
      setForms(prev => prev.map(f => f.id === form.id ? { ...f, status: 'draft' } : f));
      if (selected?.id === form.id) setSelected({ ...selected, status: 'draft' });
      showToastMsg('Form reopened as draft');
    } catch { showToastMsg('Failed to reopen'); }
  }

  async function handleDuplicate(form: StandaloneForm) {
    try {
      const copy = await formsApi.createForm({
        title: `${form.title} (Copy)`, description: form.description,
        form_type: form.form_type, due_date: null, show_results_to_members: form.show_results_to_members,
      });
      for (let i = 0; i < form.fields.length; i++) {
        const f = form.fields[i];
        await formsApi.createField(copy.id, { question: f.question, field_type: f.field_type, options: f.options, required: f.required, order: i, rating_max: f.rating_max });
      }
      const refreshed = await formsApi.getForms();
      setForms(refreshed);
      showToastMsg('Form duplicated');
    } catch { showToastMsg('Failed to duplicate'); }
  }

  const filtered = useMemo(() => {
    let list = forms;
    if (tab !== 'all') list = list.filter(f => f.status === tab);
    if (catFilter !== 'all') list = list.filter(f => f.form_type === catFilter);
    if (statusFilter !== 'all') {
      const map: Record<StatusFilter, string> = { all: '', active: 'published', draft: 'draft', closed: 'closed' };
      list = list.filter(f => f.status === map[statusFilter]);
    }
    if (search) { const q = search.toLowerCase(); list = list.filter(f => f.title.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)); }
    return list;
  }, [forms, tab, catFilter, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [tab, catFilter, statusFilter, search]);

  // Derived stats
  const totalForms      = forms.length;
  const totalResponses  = forms.reduce((s, f) => s + f.total_submitted, 0);
  const publishedForms  = forms.filter(f => f.status === 'published');
  const draftCount      = forms.filter(f => f.status === 'draft').length;
  const avgRate         = publishedForms.length
    ? Math.round((publishedForms.filter(f => f.total_submitted > 0).length / publishedForms.length) * 100)
    : 0;

  // Sidebar
  const recentForms  = [...forms].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
  const maxSubmitted = Math.max(...forms.map(f => f.total_submitted), 1);
  const topForms     = [...forms].filter(f => f.total_submitted > 0).sort((a, b) => b.total_submitted - a.total_submitted).slice(0, 5);

  // Trend (30d vs prev 30d)
  const now = Date.now();
  const last30 = forms.filter(f => now - new Date(f.created_at).getTime() < 30 * 86400000).length;
  const prev30 = forms.filter(f => { const age = now - new Date(f.created_at).getTime(); return age >= 30 * 86400000 && age < 60 * 86400000; }).length;
  const trend  = prev30 > 0 ? Math.round(((last30 - prev30) / prev30) * 100) : 0;

  function clearFilters() { setSearch(''); setCatFilter('all'); setStatusFilter('all'); setTab('all'); }

  if (!isAdmin) return (
    <div className="flex items-center justify-center h-64 text-sm text-gray-400">You do not have permission to access this page.</div>
  );

  return (
    <div className="relative">
      {toast && (
        <div className="fixed top-3 right-4 z-50 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg">{toast}</div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-[380px] mx-4">
            <div className="flex items-start justify-between mb-3">
              <p className="text-[14px] font-bold text-gray-900">Delete Form</p>
              <button onClick={() => setDeleteTarget(null)} className="text-gray-400 hover:text-gray-700 transition-colors">
                <X size={16} />
              </button>
            </div>
            <p className="text-[13px] text-gray-600 mb-1">This will permanently delete the form and all its responses. This action cannot be undone.</p>
            <p className="text-[12px] text-gray-400 mb-5">"{deleteTarget.title}"</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-[12.5px] font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-[12.5px] font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete Form'}
              </button>
            </div>
          </div>
        </div>
      )}

      {(showBuilder || editingForm) && (
        <FormBuilderModal
          existing={editingForm}
          onClose={() => { setShowBuilder(false); setEditingForm(null); }}
          onSaved={saved => {
            setForms(prev => { const i = prev.findIndex(f => f.id === saved.id); return i >= 0 ? prev.map(f => f.id === saved.id ? saved : f) : [saved, ...prev]; });
            if (selected?.id === saved.id) setSelected(saved);
            setShowBuilder(false); setEditingForm(null); showToastMsg('Form saved');
          }}
        />
      )}

      {showDistribute && selected && (
        <DistributeModal form={selected} onClose={() => setShowDistribute(false)}
          onDistributed={count => {
            setShowDistribute(false);
            setForms(prev => prev.map(f => f.id === selected.id ? { ...f, status: 'published' } : f));
            setSelected(prev => prev ? { ...prev, status: 'published' } : prev);
            showToastMsg(`Sent to ${count} member${count !== 1 ? 's' : ''}`);
          }}
        />
      )}

      {showImport && (
        <ImportFormModal onClose={() => setShowImport(false)}
          onImported={f => { setForms(prev => [f, ...prev]); setShowImport(false); showToastMsg('Form imported'); }}
        />
      )}

      {selected && (
        <FormDrawer form={selected} initialTab={selectedInitialTab} onClose={() => setSelected(null)} onEdit={() => setEditingForm(selected)} onDelete={() => handleDelete(selected)} onDistribute={() => setShowDistribute(true)} />
      )}

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-[16px] font-bold text-gray-900">Forms &amp; Surveys</h1>
            <PageHelp title="How Forms & Surveys Work" sections={FORMS_HELP} />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Create, manage and analyze forms and surveys</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 bg-white hover:bg-gray-50 transition-colors">
            Import Form
          </button>
          <button onClick={() => { setEditingForm(null); setShowBuilder(true); }}
            className="flex items-center gap-1 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
            <Plus size={12} /> Create New Form
          </button>
        </div>
      </div>

      {/* ── Two-column body ─────────────────────────────────── */}
      <div className="flex gap-4 items-start">

        {/* Left */}
        <div className="flex-1 min-w-0">

          {/* Search + filter bar */}
          {/* Single unified card — search + tabs + table + footer */}
          <div className="bg-white border border-gray-200 rounded-xl">

            {/* Filter bar */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 flex-wrap rounded-t-xl">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-gray-400"
                  placeholder="Search forms by name or description..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <Dropdown label="All Categories" value={catFilter} onChange={v => setCatFilter(v as CatFilter)}
                options={[{ value: 'all', label: 'All Categories' }, { value: 'form', label: 'Form' }, { value: 'survey', label: 'Survey' }]}
              />
              <Dropdown label="All Departments" value="all" onChange={() => {}}
                options={[{ value: 'all', label: 'All Departments' }]}
              />
              <Dropdown label="All Statuses" value={statusFilter} onChange={v => setStatusFilter(v as StatusFilter)}
                options={[
                  { value: 'all', label: 'All Statuses' }, { value: 'active', label: 'Active' },
                  { value: 'draft', label: 'Draft' }, { value: 'closed', label: 'Closed' },
                ]}
              />
              <button
                onClick={() => showToastMsg('Advanced filters coming soon')}
                className="flex items-center justify-center w-7 h-7 border border-gray-200 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors shrink-0"
                title="Filters"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="14" y2="12"/>
                  <circle cx="5" cy="4" r="1.5" fill="white"/><circle cx="10" cy="8" r="1.5" fill="white"/><circle cx="7" cy="12" r="1.5" fill="white"/>
                </svg>
              </button>
              {(search || catFilter !== 'all' || statusFilter !== 'all' || tab !== 'all') && (
                <button onClick={clearFilters} className="text-[11px] text-gray-400 hover:text-gray-600 px-1">Clear</button>
              )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-4">
              {([
                { key: 'all',       label: 'All Forms',  count: forms.length },
                { key: 'draft',     label: 'Draft',      count: forms.filter(f => f.status === 'draft').length },
                { key: 'published', label: 'Published',  count: forms.filter(f => f.status === 'published').length },
                { key: 'closed',    label: 'Closed',     count: forms.filter(f => f.status === 'closed').length },
              ] as { key: TabFilter; label: string; count: number }[]).map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`py-2 px-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    tab === t.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {t.label}{t.count > 0 ? <span className="ml-1 text-gray-400">{t.count}</span> : null}
                </button>
              ))}
            </div>

            {/* Table body — fixed height so card never resizes */}
            <div className="h-[440px] overflow-hidden">
            {loading ? (
              <div className="h-full flex items-center justify-center">{[...Array(4)].map((_, i) => <div key={i} className="h-12 border-b border-gray-50 animate-pulse bg-gray-50/40" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <p className="text-sm">No forms match your filters.</p>
                <button onClick={clearFilters} className="mt-1.5 text-[11px] text-gray-400 hover:text-gray-700 underline-offset-2 hover:underline">Clear filters</button>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="w-6 pl-4 pr-2 py-2">
                      <input type="checkbox" checked={selectAll} onChange={e => { setSelectAll(e.target.checked); setSelectedRows(e.target.checked ? new Set(paginated.map(f => f.id)) : new Set()); }} className="rounded" />
                    </th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Form Name</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Type</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Responses</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Last Updated</th>
                    <th className="w-10 px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginated.map(form => (
                    <tr key={form.id} onClick={() => { setSelectedInitialTab('fields'); setSelected(form); }} className="hover:bg-gray-50/70 cursor-pointer transition-colors group">
                      <td className="pl-4 pr-2 py-2 w-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <GripVertical size={12} className="text-gray-300 opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
                          <input type="checkbox" checked={selectedRows.has(form.id)} onChange={e => { e.stopPropagation(); setSelectedRows(prev => { const n = new Set(prev); if (e.target.checked) n.add(form.id); else n.delete(form.id); return n; }); }} className="rounded" />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-xs font-semibold text-gray-800">{form.title}</p>
                        {form.description && <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[280px]">{form.description}</p>}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs text-gray-500 capitalize">{form.form_type}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs font-medium text-gray-700">{form.total_submitted > 0 ? form.total_submitted : '—'}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs font-medium ${STATUS_COLOR[form.status]}`}>{STATUS_LABEL[form.status]}</span>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-xs text-gray-700">{fmtRelative(form.updated_at)}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">by {form.created_by_name}</p>
                      </td>
                      <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                        <RowActions
                          form={form}
                          onView={() => { setSelectedInitialTab('fields'); setSelected(form); }}
                          onViewResponses={() => { setSelectedInitialTab('responses'); setSelected(form); }}
                          onExportCsv={() => window.open(formsApi.exportCsvUrl(form.id), '_blank')}
                          onEdit={() => setEditingForm(form)}
                          onDistribute={() => { setSelected(form); setShowDistribute(true); }}
                          onClose={() => handleCloseForm(form)}
                          onReopen={() => handleReopen(form)}
                          onDuplicate={() => handleDuplicate(form)}
                          onDelete={() => handleDelete(form)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            </div>{/* end fixed-height body */}

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 rounded-b-xl">
              <p className="text-[11px] text-gray-400">
                Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} {filtered.length === 1 ? 'form' : 'forms'}
              </p>
              <div className="flex items-center gap-0.5">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded hover:bg-gray-100">
                  <ChevronLeft size={13} />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pg = i + 1;
                  if (totalPages > 5 && page > 3) pg = page - 2 + i;
                  if (pg > totalPages) return null;
                  return (
                    <button key={pg} onClick={() => setPage(pg)}
                      className={`w-6 h-6 text-[11px] rounded ${pg === page ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                      {pg}
                    </button>
                  );
                })}
                {totalPages > 5 && page < totalPages - 2 && (
                  <>
                    <span className="text-[11px] text-gray-400 px-1">…</span>
                    <button onClick={() => setPage(totalPages)} className="w-6 h-6 text-[11px] rounded text-gray-500 hover:bg-gray-100">{totalPages}</button>
                  </>
                )}
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded hover:bg-gray-100">
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* ── Right Sidebar ─────────────────────────────────── */}
        <div className="w-56 shrink-0 space-y-3">

          {/* Recent Creations */}
          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-gray-800">Recent Creations</p>
              <button onClick={() => setTab('all')} className="text-[10px] text-gray-400 hover:text-gray-600">View all</button>
            </div>
            <div className="space-y-1.5">
              {recentForms.length === 0 && <p className="text-[11px] text-gray-400 text-center py-1">No forms yet</p>}
              {recentForms.map(f => (
                <div key={f.id} onClick={() => { setSelectedInitialTab('fields'); setSelected(f); }}
                  className="cursor-pointer hover:bg-gray-50 -mx-1.5 px-1.5 py-1 rounded-lg transition-colors">
                  <p className="text-[11px] font-medium text-gray-700 truncate">{f.title}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 capitalize">{f.form_type} · {fmtDate(f.created_at)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Top Performing */}
          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-gray-800">Top Performing</p>
              <button onClick={() => setTab('published')} className="text-[10px] text-gray-400 hover:text-gray-600">View all</button>
            </div>
            {topForms.length === 0 && <p className="text-[11px] text-gray-400 text-center py-1">No responses yet</p>}
            <div className="space-y-1.5">
              {topForms.map(f => {
                const p = pct(f.total_submitted, maxSubmitted);
                return (
                  <div key={f.id} className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-medium text-gray-700 truncate pr-2">{f.title}</p>
                      <span className="text-[10px] text-gray-500 shrink-0">{p}%</span>
                    </div>
                    <div className="h-1 bg-gray-100 rounded-full">
                      <div className="h-1 bg-gray-600 rounded-full" style={{ width: `${p}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {topForms.length > 0 && <p className="text-[10px] text-gray-300 mt-1.5">Based on response count</p>}
          </div>
        </div>
      </div>

      {/* ── Form Insights ────────────────────────────────────── */}
      <div className="mt-3 bg-white border border-gray-200 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-[11px] font-semibold text-gray-800">Form Insights</h2>
            <p className="text-[10px] text-gray-400 mt-0.5">Overview of form performance over the last 30 days</p>
          </div>
          <div className="flex items-center gap-1 text-[11px] border border-gray-200 rounded-lg px-2.5 py-1 text-gray-500 cursor-default">
            Last 30 days <ChevronDown size={10} className="ml-0.5" />
          </div>
        </div>

        <div className="flex gap-4 items-start">
          <div className="flex gap-5 shrink-0">
            {[
              { label: 'Forms Published',    value: publishedForms.length, sub: trend !== 0 ? `${trend > 0 ? '↑' : '↓'} ${Math.abs(trend)}% vs last 30d` : 'No change' },
              { label: 'Total Responses',    value: totalResponses,        sub: totalResponses > 0 ? `From ${publishedForms.length} active forms` : 'No responses yet' },
              { label: 'Avg. Response Time', value: '—',                   sub: 'Not available' },
              { label: 'Completion Rate',    value: avgRate > 0 ? `${avgRate}%` : '—', sub: publishedForms.length > 0 ? `${publishedForms.length} active forms` : 'No active forms' },
            ].map(item => (
              <div key={item.label}>
                <p className="text-[10px] text-gray-400">{item.label}</p>
                <p className="text-lg font-bold text-gray-900 leading-tight mt-0.5">{item.value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{item.sub}</p>
              </div>
            ))}
          </div>
          <div className="flex-1 min-w-0 self-end pb-1">
            <Sparkline data={insights} />
          </div>
        </div>
      </div>
    </div>
  );
}
