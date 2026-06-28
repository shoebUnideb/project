import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Plus, Pencil, Trash2, Copy, X, Settings2,
  Info, FileText, Upload, CheckCircle2, Calendar,
  ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
  Building2, AlertCircle, ListChecks, GripVertical, Link, Paperclip,
  Search, SlidersHorizontal, Eye, Download, MoreVertical,
  FileCode2, Users, BarChart3, ClockIcon, Sparkles, ChevronRight as CRight,
} from 'lucide-react';
import { useOrg } from '../context/OrgContext';
import PageHelp, { type PageHelpSection } from '../components/PageHelp';
import {
  orgApi, formBuilderApi,
  type OnboardingTemplate, type TaskTemplateItem, type TaskType, type AssigneeType,
  type Department, type TemplateFormField, type FormFieldType,
} from '../api/orgApi';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  info: 'Information', form: 'Form', upload: 'Upload',
  approval: 'Approval', meeting: 'Meeting',
};
const TASK_TYPE_COLORS: Record<TaskType, string> = {
  info: 'bg-blue-50 text-blue-700', form: 'bg-purple-50 text-purple-700',
  upload: 'bg-amber-50 text-amber-700', approval: 'bg-emerald-50 text-emerald-700',
  meeting: 'bg-teal-50 text-teal-700',
};
const TASK_TYPE_ICONS: Record<TaskType, React.ReactNode> = {
  info: <Info size={13} />, form: <FileText size={13} />, upload: <Upload size={13} />,
  approval: <CheckCircle2 size={13} />, meeting: <Calendar size={13} />,
};
const ASSIGNEE_LABELS: Record<AssigneeType, string> = {
  new_hire: 'New Hire', manager: 'Manager', buddy: 'Buddy',
  hr: 'HR', it: 'IT', dept_admin: 'Dept Admin',
};

const CATEGORY_OPTIONS = ['General', 'Internship', 'Volunteer', 'Leadership', 'Offboarding', 'Technical', 'Remote'];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? 's' : ''} ago`;
}

// ── Task Modal ────────────────────────────────────────────────────────────────

function TaskModal({
  item, onClose, onSaved, templateId, nextOrder,
}: {
  item: TaskTemplateItem | null;
  onClose: () => void;
  onSaved: (t: TaskTemplateItem) => void;
  templateId: number;
  nextOrder: number;
}) {
  const editing = !!item;
  const [title, setTitle]             = useState(item?.title ?? '');
  const [desc, setDesc]               = useState(item?.description ?? '');
  const [type, setType]               = useState<TaskType>(item?.task_type ?? 'info');
  const [phase, setPhase]             = useState(item?.phase ?? '');
  const [contentUrl, setContentUrl]   = useState(item?.content_url ?? '');
  const [contentBody, setContentBody] = useState(item?.content_body ?? '');
  const [contentFile, setContentFile] = useState<File | null>(null);
  const [offset, setOffset]           = useState(item?.due_offset_days ?? 0);
  const [required, setRequired]       = useState(item?.required ?? true);
  const [approval, setApproval]       = useState(item?.approval_required ?? false);
  const [assignee, setAssignee]       = useState<AssigneeType>(item?.assignee_type ?? 'new_hire');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    setSaving(true); setError('');
    try {
      const base = {
        title: title.trim(), description: desc.trim(), task_type: type,
        phase: phase.trim(), content_url: contentUrl.trim(), content_body: contentBody,
        order: item?.order ?? nextOrder, due_offset_days: offset,
        required, approval_required: approval, assignee_type: assignee,
      };
      let result: TaskTemplateItem;
      if (editing) {
        if (contentFile) {
          const fd = new FormData();
          Object.entries(base).forEach(([k, v]) => fd.append(k, String(v)));
          fd.append('content_file', contentFile);
          result = await orgApi.updateTaskItem(item!.id, fd);
        } else {
          result = await orgApi.updateTaskItem(item!.id, base);
        }
      } else {
        result = await orgApi.addTaskItem(templateId, base);
        if (contentFile) {
          const fd = new FormData();
          fd.append('content_file', contentFile);
          result = await orgApi.updateTaskItem(result.id, fd);
        }
      }
      onSaved(result);
      onClose();
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string } };
      setError(err?.data?.detail ?? 'Failed to save task.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-[540px] max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[15px] font-bold text-gray-900">{editing ? 'Edit Task' : 'Add Task'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={15} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Title <span className="text-red-400">*</span></label>
            <input value={title} onChange={e => setTitle(e.target.value)} autoFocus
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Instructions or details..."
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 resize-none" />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Phase <span className="text-gray-400 font-normal">(optional group)</span></label>
            <input value={phase} onChange={e => setPhase(e.target.value)} list="phase-suggestions"
              placeholder="e.g. Pre-arrival, Day 1, Week 1, Month 1"
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
            <datalist id="phase-suggestions">
              <option value="Pre-arrival" /><option value="Day 1" /><option value="Week 1" />
              <option value="Month 1" /><option value="Ongoing" />
            </datalist>
          </div>
          {type === 'info' && (
            <div className="border border-blue-100 bg-blue-50/40 rounded-xl p-4 space-y-3">
              <p className="text-[11.5px] font-bold text-blue-700 uppercase tracking-wide flex items-center gap-1.5">
                <Info size={12} /> Rich Content <span className="font-normal text-blue-400 normal-case">(optional)</span>
              </p>
              <div>
                <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
                  <Link size={11} /> Link or Video URL
                </label>
                <input value={contentUrl} onChange={e => setContentUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5">Body Text</label>
                <textarea value={contentBody} onChange={e => setContentBody(e.target.value)} rows={3}
                  placeholder="Detailed instructions..."
                  className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none" />
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
                  <Paperclip size={11} /> Attachment
                </label>
                <input ref={fileRef} type="file" className="hidden" onChange={e => setContentFile(e.target.files?.[0] ?? null)} />
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg">
                    <Upload size={12} /> {contentFile ? 'Change file' : 'Upload file'}
                  </button>
                  {contentFile && <span className="text-[11.5px] text-gray-600 truncate max-w-[160px]">{contentFile.name}</span>}
                  {!contentFile && item?.content_file_url && <span className="text-[11.5px] text-teal-600">File already attached</span>}
                </div>
              </div>
            </div>
          )}
          {type === 'meeting' && (
            <div className="border border-gray-200 bg-gray-50 rounded-xl p-4 space-y-3">
              <p className="text-[11.5px] font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                <Link size={12} /> Meeting Details <span className="font-normal text-gray-400 normal-case">(optional)</span>
              </p>
              <div>
                <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
                  <Link size={11} /> Meeting Link
                </label>
                <input value={contentUrl} onChange={e => setContentUrl(e.target.value)}
                  placeholder="https://zoom.us/j/... or https://meet.google.com/..."
                  className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-400/20 focus:border-gray-400" />
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5">Agenda / Notes</label>
                <textarea value={contentBody} onChange={e => setContentBody(e.target.value)} rows={3}
                  placeholder="What to discuss, who attends, prep work..."
                  className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-400/20 focus:border-gray-400 resize-none" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Task Type</label>
              <select value={type} onChange={e => setType(e.target.value as TaskType)}
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400">
                {(Object.entries(TASK_TYPE_LABELS) as [TaskType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Assignee</label>
              <select value={assignee} onChange={e => setAssignee(e.target.value as AssigneeType)}
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400">
                {(Object.entries(ASSIGNEE_LABELS) as [AssigneeType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Due (days after start)</label>
              <input type="number" min={0} value={offset} onChange={e => setOffset(Number(e.target.value))}
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
            </div>
            <div className="flex flex-col justify-end pb-0.5">
              <button type="button" onClick={() => setRequired(r => !r)}
                className="flex items-center gap-2 text-[12.5px] font-medium text-gray-700">
                {required ? <ToggleRight size={20} className="text-teal-600" /> : <ToggleLeft size={20} className="text-gray-300" />}
                Required
              </button>
            </div>
            <div className="flex flex-col justify-end pb-0.5">
              <button type="button" onClick={() => setApproval(a => !a)}
                className="flex items-center gap-2 text-[12.5px] font-medium text-gray-700">
                {approval ? <ToggleRight size={20} className="text-teal-600" /> : <ToggleLeft size={20} className="text-gray-300" />}
                Needs Approval
              </button>
            </div>
          </div>
        </div>
        {error && <p className="mt-3 text-[12.5px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2.5 mt-5">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 text-[13px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2 text-[13px] font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl disabled:opacity-50">
            {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Form Builder Modal ────────────────────────────────────────────────────────

const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: 'Short Text', textarea: 'Long Text', choice: 'Multiple Choice',
  boolean: 'Yes / No', date: 'Date', number: 'Number',
};

function FormBuilderModal({ task, onClose, onUpdated }: {
  task: TaskTemplateItem; onClose: () => void;
  onUpdated: (fields: TemplateFormField[]) => void;
}) {
  const [fields, setFields] = useState<TemplateFormField[]>(task.form_fields ?? []);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [question, setQuestion]   = useState('');
  const [fieldType, setFieldType] = useState<FormFieldType>('text');
  const [options, setOptions]     = useState('');
  const [required, setRequired]   = useState(true);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');

  const resetEditor = () => { setAdding(false); setEditId(null); setQuestion(''); setFieldType('text'); setOptions(''); setRequired(true); setErr(''); };
  const openAdd  = () => { resetEditor(); setAdding(true); };
  const openEdit = (f: TemplateFormField) => { setAdding(false); setEditId(f.id); setQuestion(f.question); setFieldType(f.field_type); setOptions(f.options.join('\n')); setRequired(f.required); setErr(''); };

  const saveField = async () => {
    if (!question.trim()) { setErr('Question is required.'); return; }
    setSaving(true); setErr('');
    const payload = {
      question: question.trim(), field_type: fieldType,
      options: fieldType === 'choice' ? options.split('\n').map(o => o.trim()).filter(Boolean) : [],
      required, order: editId ? (fields.find(f => f.id === editId)?.order ?? fields.length) : fields.length,
    };
    try {
      if (editId) {
        const updated = await formBuilderApi.updateTemplateField(editId, payload);
        const next = fields.map(f => f.id === editId ? updated : f);
        setFields(next); onUpdated(next);
      } else {
        const created = await formBuilderApi.addTemplateField(task.id, payload);
        const next = [...fields, created];
        setFields(next); onUpdated(next);
      }
      resetEditor();
    } catch { setErr('Failed to save. Please try again.'); }
    finally { setSaving(false); }
  };

  const deleteField = async (id: number) => {
    try {
      await formBuilderApi.deleteTemplateField(id);
      const next = fields.filter(f => f.id !== id);
      setFields(next); onUpdated(next);
    } catch { /* ignore */ }
  };

  const isEditing = adding || editId !== null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="text-[15px] font-bold text-gray-900">Form Builder</p>
            <p className="text-[12px] text-gray-400 mt-0.5 truncate max-w-[300px]">{task.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 shrink-0"><X size={15} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {fields.length === 0 && !adding && (
            <div className="py-8 text-center text-[12.5px] text-gray-400">No questions yet. Click "+ Add Question" to start.</div>
          )}
          {fields.map(f => (
            <div key={f.id} className={`flex items-start gap-2 p-3 rounded-xl border ${editId === f.id ? 'border-teal-300 bg-teal-50/30' : 'border-gray-100 bg-gray-50'}`}>
              <GripVertical size={14} className="text-gray-300 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-semibold text-gray-800">{f.question}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {FIELD_TYPE_LABELS[f.field_type]}
                  {f.required && <span className="text-red-400 ml-1.5">Required</span>}
                  {f.options.length > 0 && <span className="ml-1.5">· {f.options.length} options</span>}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openEdit(f)} className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50"><Pencil size={12} /></button>
                <button onClick={() => deleteField(f.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
          {isEditing && (
            <div className="border border-teal-200 bg-teal-50/30 rounded-xl p-4 space-y-3 mt-2">
              <p className="text-[12px] font-bold text-gray-700">{editId ? 'Edit Question' : 'New Question'}</p>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Question <span className="text-red-400">*</span></label>
                <input value={question} onChange={e => setQuestion(e.target.value)} autoFocus
                  placeholder="e.g. What is your preferred work schedule?"
                  className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Answer Type</label>
                  <select value={fieldType} onChange={e => setFieldType(e.target.value as FormFieldType)}
                    className="w-full px-2.5 py-2 text-[12.5px] border border-gray-200 rounded-lg bg-white focus:outline-none">
                    {(Object.entries(FIELD_TYPE_LABELS) as [FormFieldType, string][]).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end pb-0.5">
                  <button type="button" onClick={() => setRequired(r => !r)} className="flex items-center gap-2 text-[12px] font-medium text-gray-700">
                    {required ? <ToggleRight size={18} className="text-teal-600" /> : <ToggleLeft size={18} className="text-gray-300" />} Required
                  </button>
                </div>
              </div>
              {fieldType === 'choice' && (
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Options (one per line)</label>
                  <textarea value={options} onChange={e => setOptions(e.target.value)} rows={3}
                    placeholder="Option A&#10;Option B&#10;Option C"
                    className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-lg resize-none" />
                </div>
              )}
              {err && <p className="text-[11.5px] text-red-600">{err}</p>}
              <div className="flex items-center gap-2">
                <button onClick={saveField} disabled={saving}
                  className="px-3.5 py-1.5 text-[12px] font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50">
                  {saving ? 'Saving…' : editId ? 'Update' : 'Add Question'}
                </button>
                <button onClick={resetEditor} disabled={saving}
                  className="px-3.5 py-1.5 text-[12px] font-semibold text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              </div>
            </div>
          )}
        </div>
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
          <button onClick={openAdd} disabled={isEditing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg disabled:opacity-40">
            <Plus size={13} /> Add Question
          </button>
          <p className="text-[11.5px] text-gray-400">{fields.length} question{fields.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
    </div>
  );
}

// ── Template Modal (Create / Edit) ────────────────────────────────────────────

function TemplateModal({ tmpl, departments, onClose, onSaved }: {
  tmpl: OnboardingTemplate | null; departments: Department[];
  onClose: () => void; onSaved: (t: OnboardingTemplate) => void;
}) {
  const editing = !!tmpl;
  const [name, setName]       = useState(tmpl?.name ?? '');
  const [desc, setDesc]       = useState(tmpl?.description ?? '');
  const [category, setCategory] = useState(tmpl?.category ?? '');
  const [deptId, setDeptId]   = useState<number | ''>(tmpl?.department_id ?? '');
  const [active, setActive]   = useState(tmpl?.is_active ?? true);
  const [visibleTo, setVisibleTo]       = useState(tmpl?.visible_to ?? 'All Departments');
  const [assignableBy, setAssignableBy] = useState(tmpl?.assignable_by ?? 'HR Admin, Managers');
  const [taskApproval, setTaskApproval] = useState(tmpl?.task_approval_enabled ?? false);
  const [dueDatePolicy, setDueDatePolicy] = useState(tmpl?.due_date_policy ?? 'Relative to start date');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        name: name.trim(), description: desc.trim(), category: category.trim(),
        department_id: deptId || null, is_active: active,
        visible_to: visibleTo.trim(), assignable_by: assignableBy.trim(),
        task_approval_enabled: taskApproval, due_date_policy: dueDatePolicy.trim(),
      };
      const result = editing
        ? await orgApi.updateTemplate(tmpl!.id, payload)
        : await orgApi.createTemplate(payload);
      onSaved(result);
      onClose();
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string; name?: string[] } };
      setError(err?.data?.detail ?? err?.data?.name?.[0] ?? 'Failed to save.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-[520px] max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[16px] font-bold text-gray-900">{editing ? 'Edit Template' : 'Create Template'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Template Name <span className="text-red-400">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} autoFocus
              placeholder="e.g. General Onboarding, Engineering Track"
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Category</label>
              <input value={category} onChange={e => setCategory(e.target.value)} list="cat-suggestions"
                placeholder="e.g. General, Internship"
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
              <datalist id="cat-suggestions">
                {CATEGORY_OPTIONS.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Department</label>
              <select value={deptId} onChange={e => setDeptId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400">
                <option value="">All Departments</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
              placeholder="What this onboarding track covers..."
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 resize-none" />
          </div>

          {/* Template Settings */}
          <div className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50/50">
            <p className="text-[11.5px] font-bold text-gray-500 uppercase tracking-wide">Template Settings</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11.5px] font-semibold text-gray-600 mb-1">Visible To</label>
                <input value={visibleTo} onChange={e => setVisibleTo(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-gray-600 mb-1">Assignable By</label>
                <input value={assignableBy} onChange={e => setAssignableBy(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-gray-600 mb-1">Due Date Policy</label>
                <input value={dueDatePolicy} onChange={e => setDueDatePolicy(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
              </div>
              <div className="flex items-end pb-0.5">
                <button type="button" onClick={() => setTaskApproval(v => !v)}
                  className="flex items-center gap-2 text-[12px] font-medium text-gray-700">
                  {taskApproval ? <ToggleRight size={18} className="text-teal-600" /> : <ToggleLeft size={18} className="text-gray-300" />}
                  Task Approval
                </button>
              </div>
            </div>
          </div>

          <div>
            <button type="button" onClick={() => setActive(a => !a)}
              className="flex items-center gap-2 text-[12.5px] font-medium text-gray-700">
              {active ? <ToggleRight size={22} className="text-teal-600" /> : <ToggleLeft size={22} className="text-gray-300" />}
              Active (available for new onboardings)
            </button>
          </div>
        </div>
        {error && <p className="mt-3 text-[12.5px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2.5 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-[13px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2 text-[13px] font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl disabled:opacity-50">
            {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Task Row ──────────────────────────────────────────────────────────────────

function TaskRow({
  task, idx, total, onMove, onEdit, onDelete, onFormBuilder, deleting,
}: {
  task: TaskTemplateItem; idx: number; total: number;
  onMove: (idx: number, dir: -1 | 1) => void; onEdit: (t: TaskTemplateItem) => void;
  onDelete: (id: number) => void; onFormBuilder: (t: TaskTemplateItem) => void;
  deleting: number | null;
}) {
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-3.5 flex items-start gap-3">
      <div className="flex flex-col gap-0.5 mt-0.5 shrink-0">
        <button onClick={() => onMove(idx, -1)} disabled={idx === 0}
          className="p-0.5 rounded text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronUp size={13} /></button>
        <span className="text-[11px] text-gray-400 text-center font-mono w-4">{idx + 1}</span>
        <button onClick={() => onMove(idx, 1)} disabled={idx === total - 1}
          className="p-0.5 rounded text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronDown size={13} /></button>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md ${TASK_TYPE_COLORS[task.task_type]}`}>
            {TASK_TYPE_ICONS[task.task_type]} {TASK_TYPE_LABELS[task.task_type]}
          </span>
          {task.due_offset_days > 0 && (
            <span className="text-[10.5px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md">Day {task.due_offset_days}</span>
          )}
          {task.required && (
            <span className="text-[10.5px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded-md font-medium">Required</span>
          )}
          <span className="text-[10.5px] text-gray-400 ml-auto">{ASSIGNEE_LABELS[task.assignee_type]}</span>
        </div>
        <p className="text-[13px] font-semibold text-gray-800 mt-1.5 leading-snug">{task.title}</p>
        {task.description && (
          <p className="text-[11.5px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{task.description}</p>
        )}
        {task.task_type === 'form' && (
          <p className="text-[11px] text-purple-500 mt-1 font-medium">
            {(task.form_fields ?? []).length} question{(task.form_fields ?? []).length !== 1 ? 's' : ''}
            {(task.form_fields ?? []).length === 0 && <span className="text-gray-400 font-normal"> — click ✦ to add questions</span>}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        {task.task_type === 'form' && (
          <button onClick={() => onFormBuilder(task)}
            className="p-1.5 rounded-lg text-purple-400 hover:text-purple-700 hover:bg-purple-50"><ListChecks size={12} /></button>
        )}
        <button onClick={() => onEdit(task)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50"><Pencil size={12} /></button>
        <button onClick={() => onDelete(task.id)} disabled={deleting === task.id}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

// ── Modal Task Card (richer card for the popup modal) ────────────────────────

function ModalTaskCard({
  task, idx, total, onMove, onEdit, onDelete, onFormBuilder, deleting,
}: {
  task: TaskTemplateItem; idx: number; total: number;
  onMove: (idx: number, dir: -1 | 1) => void; onEdit: (t: TaskTemplateItem) => void;
  onDelete: (id: number) => void; onFormBuilder: (t: TaskTemplateItem) => void;
  deleting: number | null;
}) {
  const [menuOpen, setMenuOpen]           = useState(false);
  const [menuPos, setMenuPos]             = useState({ top: 0, left: 0 });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const btnRef  = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const estimatedHeight = 260;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < estimatedHeight
      ? Math.max(8, rect.top - estimatedHeight - 4)
      : rect.bottom + 6;
    setMenuPos({ top, left: rect.right - 210 });
    setMenuOpen(true);
    setTimeout(() => {
      const close = (ev: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(ev.target as Node)) {
          setMenuOpen(false);
          document.removeEventListener('mousedown', close);
        }
      };
      document.addEventListener('mousedown', close);
    }, 0);
  };

  const act = (fn: () => void) => { setMenuOpen(false); fn(); };

  const dropdownMenu = (
    <div ref={menuRef}
      className="fixed bg-white rounded-xl border border-gray-150 shadow-2xl py-1.5 z-[9999] min-w-[210px] overflow-hidden"
      style={{ top: menuPos.top, left: menuPos.left }}>
      <button onClick={() => act(() => onEdit(task))}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-[12.5px] font-medium text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors">
        <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
          <Pencil size={13} className="text-teal-600" />
        </div>
        Edit Task
      </button>
      {task.task_type === 'form' && (
        <button onClick={() => act(() => onFormBuilder(task))}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-[12.5px] font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors">
          <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
            <ListChecks size={13} className="text-purple-600" />
          </div>
          Build Form Questions
        </button>
      )}
      {idx > 0 && (
        <button onClick={() => act(() => onMove(idx, -1))}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-[12.5px] font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
            <ChevronUp size={13} className="text-gray-500" />
          </div>
          Move Up
        </button>
      )}
      {idx < total - 1 && (
        <button onClick={() => act(() => onMove(idx, 1))}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-[12.5px] font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
            <ChevronDown size={13} className="text-gray-500" />
          </div>
          Move Down
        </button>
      )}
      <div className="my-1.5 border-t border-gray-100" />
      <button onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-[12.5px] font-medium text-red-600 hover:bg-red-50 transition-colors">
        <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
          <Trash2 size={13} className="text-red-500" />
        </div>
        Delete Task
      </button>
    </div>
  );

  const deleteDialog = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 w-[340px]">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
            <Trash2 size={18} className="text-red-500" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-gray-900">Delete this task?</p>
            <p className="text-[12px] text-gray-500 mt-0.5">This action cannot be undone.</p>
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2 mb-4">
          <p className="text-[12.5px] font-semibold text-gray-700 truncate">"{task.title}"</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setConfirmDelete(false)}
            className="flex-1 py-2 rounded-lg border border-gray-200 text-[12.5px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={() => { setConfirmDelete(false); onDelete(task.id); }}
            disabled={deleting === task.id}
            className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[12.5px] font-semibold disabled:opacity-50 transition-colors">
            {deleting === task.id ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="group bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all p-3">
      {menuOpen  && createPortal(dropdownMenu, document.body)}
      {confirmDelete && createPortal(deleteDialog, document.body)}

      {/* Top meta row */}
      <div className="flex items-center gap-1.5 mb-1.5">
        {/* Reorder handle — subtle, hover-reveal */}
        <div className="flex flex-col gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onMove(idx, -1)} disabled={idx === 0}
            className="p-0.5 rounded text-gray-300 hover:text-gray-600 disabled:opacity-20"><ChevronUp size={11} /></button>
          <button onClick={() => onMove(idx, 1)} disabled={idx === total - 1}
            className="p-0.5 rounded text-gray-300 hover:text-gray-600 disabled:opacity-20"><ChevronDown size={11} /></button>
        </div>
        {/* Index */}
        <span className="text-[10px] font-mono text-gray-300 w-4 shrink-0">{idx + 1}</span>
        {/* Type badge */}
        <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${TASK_TYPE_COLORS[task.task_type]}`}>
          {TASK_TYPE_ICONS[task.task_type]} {TASK_TYPE_LABELS[task.task_type]}
        </span>
        {task.due_offset_days > 0 && (
          <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md">
            Day {task.due_offset_days}
          </span>
        )}
        {task.required && (
          <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-md">Required</span>
        )}
        {/* Assignee */}
        <span className="ml-auto text-[10px] font-medium text-gray-400 shrink-0">{ASSIGNEE_LABELS[task.assignee_type]}</span>
        {/* Single ⋮ menu trigger */}
        <button ref={btnRef} onClick={openMenu}
          className="ml-1 p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 group-hover:text-gray-400 transition-colors shrink-0">
          <MoreVertical size={15} />
        </button>
      </div>

      {/* Title */}
      <p className="text-[12.5px] font-semibold text-gray-900 leading-snug ml-6">{task.title}</p>
      {/* Description */}
      {task.description && (
        <p className="text-[11px] text-gray-500 mt-0.5 ml-6 leading-relaxed line-clamp-2">{task.description}</p>
      )}
      {/* Form fields hint */}
      {task.task_type === 'form' && (
        <p className="text-[11px] text-purple-500 mt-0.5 ml-6 font-medium">
          {(task.form_fields ?? []).length} question{(task.form_fields ?? []).length !== 1 ? 's' : ''}
          {(task.form_fields ?? []).length === 0 && (
            <button onClick={() => onFormBuilder(task)} className="ml-1 text-purple-400 underline underline-offset-2 hover:text-purple-600">
              add questions
            </button>
          )}
        </p>
      )}
    </div>
  );
}

// ── Tasks Panel (popup modal) ─────────────────────────────────────────────────

function TasksPanel({ template, onClose, onTemplateUpdated }: {
  template: OnboardingTemplate; onClose: () => void;
  onTemplateUpdated: (t: OnboardingTemplate) => void;
}) {
  const [tasks, setTasks]         = useState<TaskTemplateItem[]>(template.tasks.slice().sort((a, b) => a.order - b.order));
  const [taskModal, setTaskModal] = useState<TaskTemplateItem | null | 'new'>(null);
  const [deleting, setDeleting]   = useState<number | null>(null);
  const [formBuilderTask, setFormBuilderTask] = useState<TaskTemplateItem | null>(null);

  const reload = async () => {
    try {
      const templates = await orgApi.getTemplates();
      const updated = templates.find(t => t.id === template.id);
      if (updated) { setTasks(updated.tasks.slice().sort((a, b) => a.order - b.order)); onTemplateUpdated(updated); }
    } catch { /* ignore */ }
  };

  const handleTaskSaved = (saved: TaskTemplateItem) => {
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === saved.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
      return [...prev, saved].sort((a, b) => a.order - b.order);
    });
    onTemplateUpdated({ ...template, tasks, task_count: tasks.length });
    reload();
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try { await orgApi.deleteTaskItem(id); setTasks(prev => prev.filter(t => t.id !== id)); reload(); }
    catch { /* ignore */ } finally { setDeleting(null); }
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const next = [...tasks]; const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    const updated = next.map((t, i) => ({ ...t, order: i }));
    setTasks(updated);
    await Promise.all(updated.map(t => orgApi.updateTaskItem(t.id, { order: t.order }).catch(() => {})));
  };

  // Task type breakdown for stats
  const typeCounts = tasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.task_type] = (acc[t.task_type] || 0) + 1;
    return acc;
  }, {});
  const initials = template.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  // Build grouped/flat task list
  const hasPhases = tasks.some(t => t.phase && t.phase.trim());
  let phaseOrder: string[] = [];
  let groups: Record<string, { task: TaskTemplateItem; idx: number }[]> = {};
  if (hasPhases) {
    tasks.forEach((task, idx) => {
      const key = task.phase?.trim() || '—';
      if (!phaseOrder.includes(key)) phaseOrder.push(key);
      if (!groups[key]) groups[key] = [];
      groups[key].push({ task, idx });
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-[5vh]">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-[90vw] h-[90vh] flex flex-col overflow-hidden">

        {/* ── Modal header ── */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-teal-500 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-white">{initials}</span>
            </div>
            <p className="text-[13px] font-bold text-gray-900 truncate">{template.name}</p>
            {template.is_active
              ? <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 shrink-0">Active</span>
              : <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">Inactive</span>
            }
            {template.category && (
              <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 shrink-0">{template.category}</span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 shrink-0"><X size={15} /></button>
        </div>

        {/* ── Body: left info panel + right task list ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Left info panel */}
          <div className="w-1/4 shrink-0 border-r border-gray-100 flex flex-col overflow-y-auto bg-gray-50/40">
            <div className="px-3.5 py-3 space-y-3 flex-1">

              {/* Task stats */}
              <div className="grid grid-cols-3 gap-1.5">
                <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
                  <p className="text-[16px] font-bold text-gray-900">{tasks.length}</p>
                  <p className="text-[9.5px] text-gray-500 mt-0.5">Total</p>
                </div>
                <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
                  <p className="text-[16px] font-bold text-purple-600">{typeCounts['form'] || 0}</p>
                  <p className="text-[9.5px] text-gray-500 mt-0.5">Forms</p>
                </div>
                <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
                  <p className="text-[16px] font-bold text-amber-600">{typeCounts['upload'] || 0}</p>
                  <p className="text-[9.5px] text-gray-500 mt-0.5">Uploads</p>
                </div>
              </div>

              {/* Template info */}
              <div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Template Info</p>
                <div className="space-y-1.5">
                  {[
                    { label: 'Category',    value: template.category || '—' },
                    { label: 'Department',  value: template.department_name || 'All Departments' },
                    { label: 'Used In',     value: `${template.used_in_count} onboarding${template.used_in_count !== 1 ? 's' : ''}` },
                    { label: 'Created By',  value: template.created_by_name || '—' },
                  ].map(r => (
                    <div key={r.label}>
                      <p className="text-[10px] text-gray-400">{r.label}</p>
                      <p className="text-[11.5px] font-semibold text-gray-700">{r.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Type breakdown */}
              <div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Task Breakdown</p>
                <div className="space-y-1">
                  {(Object.entries(TASK_TYPE_LABELS) as [TaskType, string][])
                    .filter(([k]) => typeCounts[k])
                    .map(([k, label]) => (
                      <div key={k} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-0.5 text-[9.5px] font-semibold px-1.5 py-0.5 rounded-md ${TASK_TYPE_COLORS[k]}`}>
                            {TASK_TYPE_ICONS[k]} {label}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-gray-600">{typeCounts[k]}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Description */}
              {template.description && (
                <div>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Description</p>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{template.description}</p>
                </div>
              )}

              {/* Template settings */}
              <div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Settings</p>
                <div className="space-y-1.5">
                  {[
                    { label: 'Visible To',     value: template.visible_to || 'All Departments' },
                    { label: 'Assignable By',  value: template.assignable_by || 'HR Admin' },
                    { label: 'Task Approval',  value: template.task_approval_enabled ? 'Enabled' : 'Disabled' },
                    { label: 'Due Policy',     value: template.due_date_policy || 'Relative' },
                  ].map(r => (
                    <div key={r.label}>
                      <p className="text-[10px] text-gray-400">{r.label}</p>
                      <p className="text-[11px] font-semibold text-gray-700">{r.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Right task list */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Sticky toolbar — always visible */}
            <div className="shrink-0 px-4 py-2 border-b border-gray-100 flex items-center justify-between bg-white">
              <span className="text-[10.5px] font-bold text-gray-400 uppercase tracking-widest">
                {tasks.length} Task{tasks.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setTaskModal('new')}
                className="flex items-center gap-1 px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white text-[11.5px] font-semibold rounded-lg transition-colors"
              >
                <Plus size={12} /> Add Task
              </button>
            </div>

            {/* Scrollable task list */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                  <BookOpen size={20} className="text-gray-300" />
                </div>
                <p className="text-[13.5px] font-semibold text-gray-600">No tasks yet</p>
                <p className="text-[12px] text-gray-400 mt-1">Click "+ Add Task" above to get started.</p>
              </div>
            ) : hasPhases ? (
              <div className="space-y-5">
                {phaseOrder.map(ph => (
                  <div key={ph}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10.5px] font-bold text-gray-500 uppercase tracking-widest">{ph}</span>
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{groups[ph].length}</span>
                    </div>
                    <div className="space-y-2">
                      {groups[ph].map(({ task, idx }) => (
                        <ModalTaskCard key={task.id} task={task} idx={idx} total={tasks.length}
                          onMove={move} onEdit={setTaskModal} onDelete={handleDelete}
                          onFormBuilder={setFormBuilderTask} deleting={deleting} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((task, idx) => (
                  <ModalTaskCard key={task.id} task={task} idx={idx} total={tasks.length}
                    onMove={move} onEdit={setTaskModal} onDelete={handleDelete}
                    onFormBuilder={setFormBuilderTask} deleting={deleting} />
                ))}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {taskModal && (
        <TaskModal item={taskModal === 'new' ? null : taskModal} templateId={template.id}
          nextOrder={tasks.length} onClose={() => setTaskModal(null)} onSaved={handleTaskSaved} />
      )}
      {formBuilderTask && (
        <FormBuilderModal task={formBuilderTask} onClose={() => setFormBuilderTask(null)}
          onUpdated={fields => setTasks(prev => prev.map(t => t.id === formBuilderTask.id ? { ...t, form_fields: fields } : t))} />
      )}
    </div>
  );
}

// ── Delete Confirm ────────────────────────────────────────────────────────────

function DeleteConfirm({ tmpl, onClose, onDeleted }: {
  tmpl: OnboardingTemplate; onClose: () => void; onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState('');

  const handle = async () => {
    setDeleting(true); setError('');
    try { await orgApi.deleteTemplate(tmpl.id); onDeleted(); onClose(); }
    catch (e: unknown) {
      const err = e as { data?: { detail?: string } };
      setError(err?.data?.detail ?? 'Failed to delete template.');
    } finally { setDeleting(false); }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[380px] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <AlertCircle size={18} className="text-red-500" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-gray-900">Delete template?</p>
            <p className="text-[12.5px] text-gray-500 mt-0.5">This cannot be undone.</p>
          </div>
        </div>
        <p className="text-[13px] text-gray-600 mb-4">You are about to delete <strong>{tmpl.name}</strong>.</p>
        {error && <p className="text-[12.5px] text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>}
        <div className="flex gap-2.5">
          <button onClick={onClose} className="flex-1 py-2 text-[13px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl">Cancel</button>
          <button onClick={handle} disabled={deleting}
            className="flex-1 py-2 text-[13px] font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl disabled:opacity-50">
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Row Actions Dropdown ──────────────────────────────────────────────────────

import { createPortal } from 'react-dom';

function RowMenu({ tmpl, onEdit, onDelete, onClone, onManageTasks, onToggleActive, cloning }: {
  tmpl: OnboardingTemplate;
  onEdit: () => void; onDelete: () => void; onClone: () => void;
  onManageTasks: () => void; onToggleActive: () => void; cloning: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const openMenu = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.right - 180 });
    setOpen(true);
    setTimeout(() => {
      const close = (e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          setOpen(false);
          document.removeEventListener('mousedown', close);
        }
      };
      document.addEventListener('mousedown', close);
    }, 0);
  };

  const act = (fn: () => void) => { setOpen(false); fn(); };

  const menu = (
    <div ref={menuRef} className="fixed bg-white rounded-xl border border-gray-200 shadow-xl py-1 z-[9999] min-w-[180px]"
      style={{ top: pos.top, left: pos.left }}>
      <button onClick={() => act(onManageTasks)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12.5px] font-medium text-gray-700 hover:bg-gray-50">
        <Settings2 size={13} className="text-gray-400" /> Manage Tasks
      </button>
      <button onClick={() => act(onEdit)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12.5px] font-medium text-gray-700 hover:bg-gray-50">
        <Pencil size={13} className="text-gray-400" /> Edit Template
      </button>
      <button onClick={() => act(onClone)} disabled={cloning}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12.5px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
        <Copy size={13} className="text-gray-400" /> Duplicate
      </button>
      <button onClick={() => act(onToggleActive)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12.5px] font-medium text-gray-700 hover:bg-gray-50">
        {tmpl.is_active
          ? <><ToggleLeft size={13} className="text-amber-500" /> Deactivate</>
          : <><ToggleRight size={13} className="text-teal-500" /> Activate</>}
      </button>
      <div className="my-1 border-t border-gray-100" />
      <button onClick={() => act(onDelete)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12.5px] font-medium text-red-600 hover:bg-red-50">
        <Trash2 size={13} /> Delete
      </button>
    </div>
  );

  return (
    <>
      {open && createPortal(menu, document.body)}
      <button ref={btnRef} onClick={e => { e.stopPropagation(); openMenu(); }}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
        <MoreVertical size={14} />
      </button>
    </>
  );
}

// ── Right Panel (Template Details) ────────────────────────────────────────────

function TemplateDetailsPanel({ tmpl, onClose, onEdit, onManageTasks, onClone, onToggleActive, onDelete }: {
  tmpl: OnboardingTemplate; onClose: () => void;
  onEdit: () => void; onManageTasks: () => void; onClone: () => void;
  onToggleActive: () => void; onDelete: () => void;
}) {
  return (
    <div className="w-[268px] shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <p className="text-[12.5px] font-bold text-gray-900">Template Details</p>
        <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100"><X size={13} /></button>
      </div>

      <div className="px-4 py-3 space-y-4 flex-1">
        {/* Title */}
        <p className="text-[13.5px] font-bold text-gray-900 leading-snug">{tmpl.name}</p>

        {/* Meta grid */}
        <div className="space-y-2">
          {[
            { label: 'Category', value: tmpl.category || '—' },
            { label: 'Department', value: tmpl.department_name || 'All Departments' },
            { label: 'Tasks', value: String(tmpl.task_count) },
            { label: 'Used In Onboardings', value: String(tmpl.used_in_count) },
            { label: 'Status', value: tmpl.is_active ? 'Active' : 'Inactive' },
            {
              label: 'Last Updated',
              value: tmpl.updated_at
                ? `${timeAgo(tmpl.updated_at)}${tmpl.updated_by_name ? `\nby ${tmpl.updated_by_name}` : ''}`
                : tmpl.created_at
                  ? `${timeAgo(tmpl.created_at)}${tmpl.created_by_name ? `\nby ${tmpl.created_by_name}` : ''}`
                  : '—',
            },
          ].map(row => (
            <div key={row.label} className="flex items-start justify-between gap-2">
              <span className="text-[11.5px] text-gray-500 shrink-0">{row.label}</span>
              <span className="text-[11.5px] font-semibold text-gray-800 text-right whitespace-pre-line">{row.value}</span>
            </div>
          ))}
        </div>

        {/* Description */}
        {tmpl.description && (
          <div>
            <p className="text-[11.5px] font-bold text-gray-700 mb-1.5">Description</p>
            <p className="text-[11.5px] text-gray-500 leading-relaxed">{tmpl.description}</p>
          </div>
        )}

        {/* Template Settings */}
        <div>
          <p className="text-[11.5px] font-bold text-gray-700 mb-1.5">Template Settings</p>
          <div className="space-y-1.5">
            {[
              { label: 'Visible to', value: tmpl.visible_to || 'All Departments' },
              { label: 'Assignable by', value: tmpl.assignable_by || 'HR Admin, Managers' },
              { label: 'Task Approval', value: tmpl.task_approval_enabled ? 'Enabled' : 'Disabled' },
              { label: 'Due Date Policy', value: tmpl.due_date_policy || 'Relative to start date' },
            ].map(row => (
              <div key={row.label} className="flex items-start justify-between gap-2">
                <span className="text-[11px] text-gray-500 shrink-0">{row.label}</span>
                <span className="text-[11px] font-semibold text-gray-700 text-right">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-4 py-3 border-t border-gray-100 space-y-1.5">
        <button onClick={onManageTasks}
          className="w-full flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-[12px] font-semibold text-gray-700 hover:bg-gray-50">
          <Eye size={13} className="text-gray-400" /> Preview Template
        </button>
        <button onClick={onClone}
          className="w-full flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-[12px] font-semibold text-gray-700 hover:bg-gray-50">
          <Copy size={13} className="text-gray-400" /> Duplicate Template
        </button>
        <button onClick={onToggleActive}
          className="w-full flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-[12px] font-semibold text-gray-700 hover:bg-gray-50">
          <ToggleLeft size={13} className="text-gray-400" />
          {tmpl.is_active ? 'Deactivate Template' : 'Activate Template'}
        </button>
        <button onClick={onDelete}
          className="w-full flex items-center gap-2 px-3 py-2 border border-red-100 rounded-lg text-[12px] font-semibold text-red-600 hover:bg-red-50">
          <Trash2 size={13} /> Delete Template
        </button>
      </div>
    </div>
  );
}

// ── Import Modal ──────────────────────────────────────────────────────────────

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: (t: OnboardingTemplate) => void }) {
  const [file, setFile]           = useState<File | null>(null);
  const [parsed, setParsed]       = useState<object | null>(null);
  const [parseErr, setParseErr]   = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importErr, setImportErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f); setParsed(null); setParseErr(null); setImportErr(null);
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (!json.name) { setParseErr('JSON must have a "name" field.'); return; }
        setParsed(json);
      } catch {
        setParseErr('Invalid JSON. Please check your file.');
      }
    };
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (!parsed) return;
    setImporting(true); setImportErr(null);
    try {
      const result = await orgApi.importTemplate(parsed);
      onImported(result);
      onClose();
    } catch {
      setImportErr('Import failed. Please check the file format and try again.');
    } finally { setImporting(false); }
  };

  const previewName = parsed && typeof parsed === 'object' && 'name' in parsed ? String((parsed as { name: string }).name) : null;
  const previewTasks = parsed && typeof parsed === 'object' && 'tasks' in parsed && Array.isArray((parsed as { tasks: unknown[] }).tasks)
    ? (parsed as { tasks: unknown[] }).tasks.length : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-[440px] p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-[15px] font-bold text-gray-900">Import Template</h3>
            <p className="text-[12px] text-gray-400 mt-0.5">Upload a JSON export to create a new template</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={15} /></button>
        </div>

        {/* Drop zone */}
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-teal-300 hover:bg-teal-50/30 transition-colors mb-4"
        >
          <input ref={fileRef} type="file" accept=".json" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <Download size={24} className="mx-auto text-gray-300 mb-2" />
          <p className="text-[13px] font-semibold text-gray-600">Drop a JSON file here, or click to browse</p>
          <p className="text-[11.5px] text-gray-400 mt-1">Accepts .json template exports</p>
        </div>

        {/* Parsed preview */}
        {file && !parseErr && (
          <div className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3 mb-4 space-y-1">
            <p className="text-[12px] font-semibold text-gray-700">{previewName}</p>
            {previewTasks !== null && (
              <p className="text-[11.5px] text-gray-500">{previewTasks} task{previewTasks !== 1 ? 's' : ''} will be imported</p>
            )}
            <p className="text-[11px] text-amber-600">Template will be created as <strong>Inactive</strong> — activate when ready.</p>
          </div>
        )}

        {parseErr && <p className="text-[12.5px] text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-xl mb-4">{parseErr}</p>}
        {importErr && <p className="text-[12.5px] text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-xl mb-4">{importErr}</p>}

        <div className="flex gap-2.5">
          <button onClick={onClose} className="flex-1 py-2 text-[13px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl">Cancel</button>
          <button onClick={handleImport} disabled={!parsed || importing}
            className="flex-1 py-2 text-[13px] font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl disabled:opacity-50">
            {importing ? 'Importing…' : 'Import Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Table Skeleton ────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="space-y-0">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-2.5 border-b border-gray-100">
          <div className="w-4 h-4 bg-gray-100 rounded animate-pulse shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 bg-gray-100 rounded animate-pulse w-48" />
            <div className="h-2.5 bg-gray-100 rounded animate-pulse w-72" />
          </div>
          <div className="h-3 bg-gray-100 rounded animate-pulse w-16" />
          <div className="h-3 bg-gray-100 rounded animate-pulse w-24" />
          <div className="h-3 bg-gray-100 rounded animate-pulse w-8" />
          <div className="h-3 bg-gray-100 rounded animate-pulse w-8" />
          <div className="h-5 bg-gray-100 rounded-full animate-pulse w-14" />
          <div className="h-3 bg-gray-100 rounded animate-pulse w-24" />
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 8;

const TASK_TEMPLATES_HELP: PageHelpSection[] = [
  {
    eyebrow: '1 · What is a Task Template?',
    bullets: [
      'A **template** is a reusable onboarding program — a checklist of tasks you assign to new hires.',
      'Build it once, assign it many times. Each member gets their own copy (instance) so progress is tracked per person.',
      'Templates also act as a **cheatsheet** for recruiters — they import a template, then customize the per-member instance without touching the original.',
    ],
  },
  {
    eyebrow: '2 · Create a Template',
    bullets: [
      'Click **+ Create New Template** to start from scratch, or **Import from Template Hub** to clone a pre-built program.',
      'Give it a name, category (e.g. Engineering, Operations), and optional department restriction.',
      'Mark it **Active** to make it available for assignment.',
    ],
  },
  {
    eyebrow: '3 · Add Tasks',
    bullets: [
      'Open the template and click **Manage Tasks** (or the kebab menu → Manage Tasks).',
      'Add tasks of each kind: **Info** (reference), **Form** (questions), **Upload** (file), **Meeting** (link + agenda), **Approval** (admin sign-off).',
      'Group tasks by **phase** (Day 1, Week 1, Week 2…) — phases keep the timeline scannable.',
      'For **Form** tasks, define the questions inline (text / textarea / choice / boolean / date / number).',
      'For **Info** tasks, attach a file, a link, or rich text — the member sees it inline when they open the task.',
    ],
  },
  {
    eyebrow: '4 · Assign to Members',
    bullets: [
      'Go to **Onboarding Mgmt → + Add New Onboarding** and pick this template.',
      'The template\'s tasks are copied into a per-member instance. Future template edits do **not** change existing instances.',
      'Recruiters can edit the instance (add / remove / edit tasks) without affecting the template.',
    ],
  },
  {
    eyebrow: '5 · Clone, Export, Toggle',
    bullets: [
      'Use the row 3-dot menu to **Clone** (for variations), **Toggle Active/Inactive**, or **Delete** a template.',
      'Inactive templates won\'t appear when assigning new onboardings.',
      'The **Used In** column shows how many active onboardings reference each template.',
    ],
  },
];

export default function OrgTaskTemplates() {
  const { isSuperadmin, canManageMembers } = useOrg();
  const canManage = isSuperadmin || canManageMembers;
  const navigate = useNavigate();

  const [templates, setTemplates]     = useState<OnboardingTemplate[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading]         = useState(true);

  // Modals
  const [editTarget, setEditTarget]     = useState<OnboardingTemplate | null | 'new'>(null);
  const [deleteTarget, setDeleteTarget] = useState<OnboardingTemplate | null>(null);
  const [tasksTarget, setTasksTarget]   = useState<OnboardingTemplate | null>(null);
  const [showImport, setShowImport]     = useState(false);
  const [cloning, setCloning]           = useState<number | null>(null);

  // Right panel
  const [detailPanel, setDetailPanel] = useState<OnboardingTemplate | null>(null);

  // Filters
  const [search, setSearch]       = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]           = useState(1);

  const load = async () => {
    setLoading(true);
    try {
      const [t, d] = await Promise.all([orgApi.getTemplates(), orgApi.getDepartments()]);
      setTemplates(t); setDepartments(d);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Sync detail panel when templates update
  useEffect(() => {
    if (detailPanel) {
      const updated = templates.find(t => t.id === detailPanel.id);
      if (updated) setDetailPanel(updated);
    }
  }, [templates]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClone = async (tmpl: OnboardingTemplate) => {
    setCloning(tmpl.id);
    try {
      const cloned = await orgApi.cloneTemplate(tmpl.id);
      setTemplates(prev => [...prev, cloned]);
    } catch { /* ignore */ } finally { setCloning(null); }
  };

  const handleToggleActive = async (tmpl: OnboardingTemplate) => {
    try {
      const updated = await orgApi.updateTemplate(tmpl.id, { is_active: !tmpl.is_active });
      updateInList(updated);
    } catch { /* ignore */ }
  };

  const updateInList = (updated: OnboardingTemplate) => {
    setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
    if (tasksTarget?.id === updated.id) setTasksTarget(updated);
  };

  // ── Stats ───────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const totalTasks = templates.reduce((s, t) => s + t.task_count, 0);
    const usedIn = templates.filter(t => t.used_in_count > 0).length;
    const mostRecent = templates.reduce<OnboardingTemplate | null>((latest, t) => {
      if (!latest) return t;
      return new Date(t.updated_at) > new Date(latest.updated_at) ? t : latest;
    }, null);
    return { total: templates.length, usedIn, totalTasks, mostRecent };
  }, [templates]);

  // ── Filtering & pagination ──────────────────────────────────────────────────

  const allCategories = useMemo(() => {
    const cats = new Set(templates.map(t => t.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [templates]);

  const filtered = useMemo(() => {
    return templates.filter(t => {
      const q = search.toLowerCase();
      if (q && !t.name.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
      if (catFilter && t.category !== catFilter) return false;
      if (deptFilter) {
        if (deptFilter === '__none__' && t.department_id) return false;
        if (deptFilter !== '__none__' && String(t.department_id) !== deptFilter) return false;
      }
      if (statusFilter === 'active' && !t.is_active) return false;
      if (statusFilter === 'inactive' && t.is_active) return false;
      return true;
    });
  }, [templates, search, catFilter, deptFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageTemplates = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const goPage = (p: number) => setPage(Math.min(Math.max(1, p), totalPages));

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [search, catFilter, deptFilter, statusFilter]);

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-[15px] font-semibold text-gray-700">Access restricted</p>
        <p className="text-[13px] text-gray-400 mt-1">Only admins can manage onboarding templates.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <nav className="flex items-center gap-1 mb-1.5 text-[11.5px]" aria-label="Breadcrumb">
            <button
              onClick={() => navigate('/org/onboarding-mgmt')}
              className="font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              Onboarding Management
            </button>
            <CRight size={11} className="text-gray-300" />
            <span className="font-semibold text-gray-900">Task Templates</span>
          </nav>
          <div className="flex items-center gap-1.5">
            <h1 className="text-[16px] font-bold text-gray-900">Task Templates</h1>
            <PageHelp title="How Task Templates Work" sections={TASK_TEMPLATES_HELP} />
          </div>
          <p className="text-[12px] text-gray-500 mt-0.5">Create, manage and reuse onboarding task templates</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/org/template-hub')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <Sparkles size={13} /> Import from Template Hub
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <Upload size={13} /> Import Template
          </button>
          <button
            onClick={() => setEditTarget('new')}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-[12px] font-semibold rounded-lg transition-colors"
          >
            <Plus size={13} /> Create New Template
          </button>
        </div>
      </div>


      {/* Main content: table + optional right panel */}
      <div className="flex flex-1 min-h-0 gap-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Table area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Filter bar */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100">
            <div className="relative flex-1 max-w-[280px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search templates by name or description..."
                className="w-full pl-8 pr-3 py-1.5 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
              />
            </div>
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
              className="px-3 py-1.5 text-[12.5px] border border-gray-200 rounded-xl bg-white focus:outline-none cursor-pointer">
              <option value="">All Categories</option>
              {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
              className="px-3 py-1.5 text-[12.5px] border border-gray-200 rounded-xl bg-white focus:outline-none cursor-pointer">
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
              <option value="__none__">No Department</option>
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-[12.5px] border border-gray-200 rounded-xl bg-white focus:outline-none cursor-pointer">
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button className="p-1.5 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50">
              <SlidersHorizontal size={14} />
            </button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {loading ? <TableSkeleton /> : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                  <BookOpen size={20} className="text-gray-300" />
                </div>
                <p className="text-[14px] font-semibold text-gray-700">No templates found</p>
                <p className="text-[12.5px] text-gray-400 mt-1">
                  {search || catFilter || deptFilter || statusFilter ? 'Try adjusting your filters.' : 'Create your first template to get started.'}
                </p>
              </div>
            ) : (
              <>
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="w-8 pl-4" />
                      <th className="py-2 px-3 text-[11px] font-semibold text-gray-500">Template Name</th>
                      <th className="py-2 px-3 text-[11px] font-semibold text-gray-500">Category</th>
                      <th className="py-2 px-3 text-[11px] font-semibold text-gray-500">Department</th>
                      <th className="py-2 px-3 text-[11px] font-semibold text-gray-500 text-center">Tasks</th>
                      <th className="py-2 px-3 text-[11px] font-semibold text-gray-500 text-center">Used In</th>
                      <th className="py-2 px-3 text-[11px] font-semibold text-gray-500">Status</th>
                      <th className="py-2 px-3 text-[11px] font-semibold text-gray-500">Last Updated</th>
                      <th className="py-2.5 pr-4 text-[11.5px] font-semibold text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageTemplates.map(tmpl => {
                      const isSelected = detailPanel?.id === tmpl.id;
                      const updatedAt = tmpl.updated_at || tmpl.created_at;
                      const updaterName = tmpl.updated_by_name || tmpl.created_by_name;
                      return (
                        <tr
                          key={tmpl.id}
                          onClick={() => setDetailPanel(isSelected ? null : tmpl)}
                          className={`border-b border-gray-100 cursor-pointer transition-colors ${
                            isSelected ? 'bg-teal-50/60' : 'hover:bg-gray-50'
                          } ${cloning === tmpl.id ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                          <td className="pl-4 pr-0">
                            <GripVertical size={13} className="text-gray-300" />
                          </td>
                          <td className="py-2 px-3">
                            <p className="text-[12.5px] font-semibold text-gray-900 leading-snug">{tmpl.name}</p>
                            {tmpl.description && (
                              <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1 max-w-[260px]">{tmpl.description}</p>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <span className="text-[12px] text-gray-600">{tmpl.category || '—'}</span>
                          </td>
                          <td className="py-2 px-3">
                            <span className="text-[12px] text-gray-600">{tmpl.department_name || 'All Departments'}</span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="text-[12px] font-semibold text-gray-700">{tmpl.task_count}</span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="text-[12px] font-semibold text-gray-700">
                              {tmpl.used_in_count > 0 ? tmpl.used_in_count : '—'}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            {tmpl.is_active
                              ? <span className="inline-block text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Active</span>
                              : <span className="inline-block text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>
                            }
                          </td>
                          <td className="py-2 px-3">
                            {updatedAt ? (
                              <div>
                                <p className="text-[11.5px] font-medium text-gray-600">{timeAgo(updatedAt)}</p>
                                {updaterName && <p className="text-[10.5px] text-gray-400">by {updaterName}</p>}
                              </div>
                            ) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="py-3 pr-3" onClick={e => e.stopPropagation()}>
                            <RowMenu
                              tmpl={tmpl}
                              onEdit={() => setEditTarget(tmpl)}
                              onDelete={() => setDeleteTarget(tmpl)}
                              onClone={() => handleClone(tmpl)}
                              onManageTasks={() => setTasksTarget(tmpl)}
                              onToggleActive={() => handleToggleActive(tmpl)}
                              cloning={cloning === tmpl.id}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100">
                    <p className="text-[12px] text-gray-500">
                      Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} templates
                    </p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => goPage(page - 1)} disabled={page === 1}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
                        <ChevronDown size={13} className="rotate-90" />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                        <button key={p} onClick={() => goPage(p)}
                          className={`w-7 h-7 flex items-center justify-center rounded-lg text-[12.5px] font-semibold transition-colors ${
                            p === page ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}>
                          {p}
                        </button>
                      ))}
                      <button onClick={() => goPage(page + 1)} disabled={page === totalPages}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
                        <ChevronDown size={13} className="-rotate-90" />
                      </button>
                    </div>
                  </div>
                )}
                {totalPages <= 1 && filtered.length > 0 && (
                  <div className="px-4 py-2.5 border-t border-gray-100">
                    <p className="text-[12px] text-gray-500">
                      Showing {filtered.length} of {templates.length} templates
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Template Details right panel */}
        {detailPanel && (
          <TemplateDetailsPanel
            tmpl={detailPanel}
            onClose={() => setDetailPanel(null)}
            onEdit={() => { setEditTarget(detailPanel); }}
            onManageTasks={() => { setTasksTarget(detailPanel); }}
            onClone={() => handleClone(detailPanel)}
            onToggleActive={() => handleToggleActive(detailPanel)}
            onDelete={() => setDeleteTarget(detailPanel)}
          />
        )}
      </div>

      {/* Modals */}
      {editTarget && (
        <TemplateModal
          tmpl={editTarget === 'new' ? null : editTarget}
          departments={departments}
          onClose={() => setEditTarget(null)}
          onSaved={saved => {
            if (editTarget === 'new') setTemplates(prev => [...prev, saved]);
            else updateInList(saved);
          }}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          tmpl={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setTemplates(prev => prev.filter(t => t.id !== deleteTarget.id));
            if (detailPanel?.id === deleteTarget.id) setDetailPanel(null);
          }}
        />
      )}
      {tasksTarget && (
        <TasksPanel
          template={tasksTarget}
          onClose={() => setTasksTarget(null)}
          onTemplateUpdated={updateInList}
        />
      )}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={created => setTemplates(prev => [...prev, created])}
        />
      )}
    </div>
  );
}
