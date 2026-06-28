import { useState, useEffect } from 'react';
import { X, Plus, Trash2, GripVertical, LayoutTemplate, ChevronDown, Lock, Layers, Users, Clock, Award, GitMerge, AlertTriangle, Star } from 'lucide-react';
import { workspacesApi } from '../../api/workspaces';
import apiClient from '../../api/apiClient';
import type { WorkspaceTaskType, WorkspaceTask, WorkspaceTaskSection, WorkspaceMembers } from '../../types';

interface Deliverable { title: string; description: string }
interface RubricCriteria { title: string; description: string; max_points: number }
interface SelfAssessQuestion { text: string }

const TASK_TYPES: { val: WorkspaceTaskType; label: string; desc: string }[] = [
  { val: 'assignment', label: 'Assignment', desc: 'A specific task to complete and submit' },
  { val: 'project',    label: 'Project',    desc: 'A larger multi-step project' },
  { val: 'resource',   label: 'Resource',   desc: 'Reading, video, or material to go through' },
  { val: 'quiz',       label: 'Quiz',       desc: 'Questions or a test to complete' },
];

export default function CreateTaskModal({
  workspaceId,
  onClose,
  onCreated,
  onUpdated,
  existingTasks = [],
  initialTask,
  taskId,
}: {
  workspaceId: number;
  onClose: () => void;
  onCreated: () => void;
  onUpdated?: () => void;
  existingTasks?: WorkspaceTask[];
  initialTask?: WorkspaceTask;
  taskId?: number;
}) {
  const isEdit = !!taskId;
  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType]       = useState<WorkspaceTaskType>('assignment');
  const [dueDate, setDueDate]         = useState('');
  const [availableFrom, setAvailableFrom]   = useState('');
  const [availableUntil, setAvailableUntil] = useState('');
  const [peerVisible, setPeerVisible] = useState(false);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([{ title: '', description: '' }]);
  const [prerequisiteIds, setPrerequisiteIds] = useState<number[]>([]);
  const [rubricCriteria, setRubricCriteria] = useState<RubricCriteria[]>([]);
  const [sectionId, setSectionId]       = useState<number | null>(null);
  const [assignAll, setAssignAll]       = useState(true);
  const [assignedIds, setAssignedIds]   = useState<number[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [showConfirm, setShowConfirm]   = useState(false);
  const [showConfirm2, setShowConfirm2] = useState(false);

  // Feature 16
  const [peerReviewEnabled, setPeerReviewEnabled] = useState(false);
  const [peerReviewCount, setPeerReviewCount]     = useState(1);
  // Feature 17
  const [latePolicy, setLatePolicy]               = useState<'accept' | 'reject' | 'penalty'>('accept');
  const [gracePeriodHours, setGracePeriodHours]   = useState(0);
  // Feature 20
  const [selfAssessQuestions, setSelfAssessQuestions] = useState<SelfAssessQuestion[]>([]);

  const [templates, setTemplates]       = useState<WorkspaceTask[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [sections, setSections]         = useState<WorkspaceTaskSection[]>([]);
  const [members, setMembers]           = useState<WorkspaceMembers | null>(null);

  useEffect(() => {
    workspacesApi.getTaskTemplates(workspaceId).then(setTemplates).catch(() => {}).finally(() => setLoadingTemplates(false));
    workspacesApi.getSections(workspaceId).then(setSections).catch(() => {});
    workspacesApi.getMembers(workspaceId).then(setMembers).catch(() => {});
    setLoadingTemplates(true);
  }, [workspaceId]);

  // Pre-populate fields when editing an existing task
  useEffect(() => {
    if (!initialTask) return;
    setTitle(initialTask.title);
    setDescription(initialTask.description ?? '');
    setTaskType(initialTask.task_type);
    setDueDate(initialTask.due_date ? initialTask.due_date.slice(0, 10) : '');
    setAvailableFrom(initialTask.available_from ? initialTask.available_from.slice(0, 10) : '');
    setAvailableUntil(initialTask.available_until ? initialTask.available_until.slice(0, 10) : '');
    setPeerVisible(initialTask.peer_visible);
    setSectionId(initialTask.section ?? null);
    setAssignAll(initialTask.assigned_member_ids.length === 0);
    setAssignedIds(initialTask.assigned_member_ids);
    setPrerequisiteIds(initialTask.prerequisite_ids);
    setDeliverables(
      initialTask.deliverables?.length
        ? initialTask.deliverables.map(d => ({ title: d.title, description: d.description ?? '' }))
        : [{ title: '', description: '' }]
    );
    if (initialTask.rubric_criteria?.length) {
      setRubricCriteria(initialTask.rubric_criteria.map(c => ({ title: c.title, description: c.description, max_points: c.max_points })));
    }
    setPeerReviewEnabled(initialTask.peer_review_enabled);
    setPeerReviewCount(initialTask.peer_review_count);
    setLatePolicy(initialTask.late_policy);
    setGracePeriodHours(initialTask.grace_period_hours);
    if (initialTask.self_assess_questions?.length) {
      setSelfAssessQuestions(initialTask.self_assess_questions.map(q => ({ text: q.text })));
    }
  }, [initialTask]);

  const applyTemplate = (tpl: WorkspaceTask) => {
    setTitle(tpl.title);
    setDescription(tpl.description ?? '');
    setTaskType(tpl.task_type);
    setPeerVisible(tpl.peer_visible);
    setDeliverables(
      tpl.deliverables.length
        ? tpl.deliverables.map(d => ({ title: d.title, description: d.description ?? '' }))
        : [{ title: '', description: '' }]
    );
    if (tpl.rubric_criteria?.length) {
      setRubricCriteria(tpl.rubric_criteria.map(c => ({ title: c.title, description: c.description, max_points: c.max_points })));
    }
    setShowTemplates(false);
  };

  const addDeliverable = () => setDeliverables(d => [...d, { title: '', description: '' }]);
  const removeDeliverable = (i: number) => setDeliverables(d => d.filter((_, idx) => idx !== i));
  const updateDeliverable = (i: number, field: 'title' | 'description', val: string) =>
    setDeliverables(d => d.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const addCriteria = () => setRubricCriteria(c => [...c, { title: '', description: '', max_points: 10 }]);
  const removeCriteria = (i: number) => setRubricCriteria(c => c.filter((_, idx) => idx !== i));
  const updateCriteria = (i: number, field: keyof RubricCriteria, val: string | number) =>
    setRubricCriteria(c => c.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const addSelfAssessQuestion = () => { if (selfAssessQuestions.length < 3) setSelfAssessQuestions(q => [...q, { text: '' }]); };
  const removeSelfAssessQuestion = (i: number) => setSelfAssessQuestions(q => q.filter((_, idx) => idx !== i));
  const updateSelfAssessQuestion = (i: number, text: string) =>
    setSelfAssessQuestions(q => q.map((item, idx) => idx === i ? { text } : item));

  const togglePrerequisite = (id: number) =>
    setPrerequisiteIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleMember = (id: number) =>
    setAssignedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleCreate = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    setLoading(true); setError('');
    try {
      await apiClient.initCsrf();
      const validDeliverables = deliverables
        .filter(d => d.title.trim())
        .map((d, i) => ({ title: d.title.trim(), description: d.description.trim(), order: i + 1 }));
      const validCriteria = rubricCriteria
        .filter(c => c.title.trim())
        .map((c, i) => ({ title: c.title.trim(), description: c.description.trim(), max_points: c.max_points, order: i + 1 }));

      const payload = {
        title: title.trim(),
        description: description.trim(),
        task_type: taskType,
        due_date: dueDate || null,
        available_from: availableFrom || null,
        available_until: availableUntil || null,
        peer_visible: peerVisible,
        section: sectionId,
        assigned_member_ids: assignAll ? [] : assignedIds,
        deliverables: validDeliverables,
        rubric_criteria: validCriteria,
        prerequisite_ids: prerequisiteIds,
        peer_review_enabled: peerReviewEnabled,
        peer_review_count: peerReviewCount,
        late_policy: latePolicy,
        grace_period_hours: gracePeriodHours,
        self_assess_questions: selfAssessQuestions
          .filter(q => q.text.trim())
          .map((q, i) => ({ text: q.text.trim(), order: i + 1 })),
      };

      if (isEdit && taskId) {
        await workspacesApi.updateTask(workspaceId, taskId, payload);
        onUpdated?.();
      } else {
        await workspacesApi.createTask(workspaceId, payload);
        onCreated();
      }
    } catch {
      setError(`Failed to ${isEdit ? 'update' : 'create'} task. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full px-3.5 py-2.5 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white placeholder-gray-300';
  const publishedTasks = existingTasks.filter(t => t.status === 'published' || t.status === 'draft');
  const approvedMembers = members?.approved ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <p className="text-[15px] font-bold text-gray-900">{isEdit ? 'Edit Task' : 'New Task'}</p>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowTemplates(p => !p)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <LayoutTemplate size={13} />
                Load Template
                <ChevronDown size={11} className={`transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
              </button>
              {showTemplates && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1 max-h-48 overflow-y-auto">
                  {loadingTemplates && <p className="text-[12px] text-gray-400 px-3 py-2">Loading…</p>}
                  {!loadingTemplates && templates.length === 0 && <p className="text-[12px] text-gray-400 px-3 py-2">No templates saved yet.</p>}
                  {templates.map(tpl => (
                    <button key={tpl.id} onClick={() => applyTemplate(tpl)}
                      className="w-full text-left px-3 py-2 text-[12.5px] text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors">
                      <span className="font-medium">{tpl.title}</span>
                      <span className="ml-1.5 text-[10.5px] text-gray-400 capitalize">{tpl.task_type}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={onClose} className="text-gray-300 hover:text-gray-600"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          {/* Title */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Write your personal statement"
              className={inputCls} autoFocus />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Description</label>
            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Optional instructions for your members…"
              className={inputCls + ' resize-none'} />
          </div>

          {/* Type */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {TASK_TYPES.map(t => (
                <button key={t.val} onClick={() => setTaskType(t.val)}
                  className={`text-left px-3.5 py-3 rounded-xl border transition-all ${
                    taskType === t.val ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}>
                  <p className={`text-[12.5px] font-semibold ${taskType === t.val ? 'text-primary-700' : 'text-gray-800'}`}>{t.label}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Section (Feature 12) */}
          {sections.length > 0 && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                <Layers size={10} className="inline mr-1" />Section
              </label>
              <select value={sectionId ?? ''} onChange={e => setSectionId(e.target.value ? Number(e.target.value) : null)}
                className={inputCls}>
                <option value="">No section</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
          )}

          {/* Due date + peer visible */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Due Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
            </div>
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div onClick={() => setPeerVisible(p => !p)}
                  className={`w-9 h-5 rounded-full relative transition-colors ${peerVisible ? 'bg-primary-600' : 'bg-gray-200'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${peerVisible ? 'translate-x-4' : ''}`} />
                </div>
                <span className="text-[12.5px] font-medium text-gray-700">Peer visible</span>
              </label>
              <p className="text-[10.5px] text-gray-400 mt-0.5 ml-11">Students see each other's work after submitting</p>
            </div>
          </div>

          {/* Scheduled Release (Feature 15) */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
              <Clock size={10} className="inline mr-1" />Scheduled Release
            </label>
            <p className="text-[10.5px] text-gray-400 mb-2">Leave blank to make available immediately. Set a range to drip-release this task.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10.5px] text-gray-500 mb-1">Available from</label>
                <input type="datetime-local" value={availableFrom} onChange={e => setAvailableFrom(e.target.value)}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-[10.5px] text-gray-500 mb-1">Available until</label>
                <input type="datetime-local" value={availableUntil} onChange={e => setAvailableUntil(e.target.value)}
                  className={inputCls} />
              </div>
            </div>
          </div>

          {/* Assigned Members (Feature 11) */}
          {approvedMembers.length > 0 && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                <Users size={10} className="inline mr-1" />Assign To
              </label>
              <div className="flex items-center gap-3 mb-2">
                <button onClick={() => setAssignAll(true)}
                  className={`px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors ${assignAll ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  All members
                </button>
                <button onClick={() => setAssignAll(false)}
                  className={`px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors ${!assignAll ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  Specific members
                </button>
              </div>
              {!assignAll && (
                <div className="space-y-1 max-h-36 overflow-y-auto border border-gray-100 rounded-xl p-2">
                  {approvedMembers.map(m => (
                    <label key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox"
                        checked={assignedIds.includes(m.student.id)}
                        onChange={() => toggleMember(m.student.id)}
                        className="accent-primary-600" />
                      <span className="text-[12.5px] text-gray-700">
                        {m.student.user.first_name} {m.student.user.last_name || m.student.user.username}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Prerequisites */}
          {publishedTasks.length > 0 && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                <Lock size={10} className="inline mr-1" />Prerequisites
              </label>
              <p className="text-[10.5px] text-gray-400 mb-2">Students must complete these tasks before this one unlocks.</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {publishedTasks.map(t => (
                  <label key={t.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={prerequisiteIds.includes(t.id)} onChange={() => togglePrerequisite(t.id)}
                      className="accent-primary-600" />
                    <span className="text-[12.5px] text-gray-700">{t.title}</span>
                    <span className="ml-auto text-[10.5px] text-gray-400 capitalize">{t.task_type}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Deliverables */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Deliverables</label>
              <button onClick={addDeliverable} className="flex items-center gap-1 text-[11.5px] text-primary-600 hover:text-primary-800 font-medium">
                <Plus size={12} /> Add item
              </button>
            </div>
            <div className="space-y-2">
              {deliverables.map((d, i) => (
                <div key={i} className="flex items-start gap-2">
                  <GripVertical size={14} className="text-gray-300 mt-3 shrink-0" />
                  <div className="flex-1 space-y-1">
                    <input value={d.title} onChange={e => updateDeliverable(i, 'title', e.target.value)}
                      placeholder={`Deliverable ${i + 1}`}
                      className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white placeholder-gray-300" />
                    <input value={d.description} onChange={e => updateDeliverable(i, 'description', e.target.value)}
                      placeholder="Description (optional)"
                      className="w-full px-3 py-1.5 text-[12px] border border-gray-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-300 bg-gray-50 placeholder-gray-300" />
                  </div>
                  {deliverables.length > 1 && (
                    <button onClick={() => removeDeliverable(i)} className="text-gray-300 hover:text-red-400 mt-2.5 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10.5px] text-gray-400 mt-2">Empty deliverable rows are ignored.</p>
          </div>

          {/* Rubric Criteria (Feature 13) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                <Award size={10} className="inline mr-1" />Rubric Criteria
              </label>
              <button onClick={addCriteria} className="flex items-center gap-1 text-[11.5px] text-primary-600 hover:text-primary-800 font-medium">
                <Plus size={12} /> Add criterion
              </button>
            </div>
            {rubricCriteria.length === 0 && (
              <p className="text-[10.5px] text-gray-400">Optional. Add weighted criteria for structured grading.</p>
            )}
            <div className="space-y-2">
              {rubricCriteria.map((c, i) => (
                <div key={i} className="flex items-start gap-2 border border-gray-100 rounded-xl p-3">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input value={c.title} onChange={e => updateCriteria(i, 'title', e.target.value)}
                        placeholder={`Criterion ${i + 1} title`}
                        className="flex-1 px-3 py-1.5 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white placeholder-gray-300" />
                      <div className="flex items-center gap-1 shrink-0">
                        <input type="number" min={1} max={100} value={c.max_points}
                          onChange={e => updateCriteria(i, 'max_points', Number(e.target.value))}
                          className="w-16 px-2 py-1.5 text-[12.5px] border border-gray-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-primary-400" />
                        <span className="text-[11px] text-gray-400">pts</span>
                      </div>
                    </div>
                    <input value={c.description} onChange={e => updateCriteria(i, 'description', e.target.value)}
                      placeholder="Description (optional)"
                      className="w-full px-3 py-1.5 text-[12px] border border-gray-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-300 bg-gray-50 placeholder-gray-300" />
                  </div>
                  <button onClick={() => removeCriteria(i)} className="text-gray-300 hover:text-red-400 mt-1 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            {rubricCriteria.length > 0 && (
              <p className="text-[10.5px] text-gray-400 mt-1.5">
                Total: {rubricCriteria.reduce((s, c) => s + (c.max_points || 0), 0)} points
              </p>
            )}
          </div>

          {/* Peer Review (Feature 16) */}
          <div className="border border-gray-100 rounded-xl p-4 space-y-3">
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
              <GitMerge size={10} className="inline mr-1" />Peer Review
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <div onClick={() => setPeerReviewEnabled(p => !p)}
                className={`w-9 h-5 rounded-full relative transition-colors ${peerReviewEnabled ? 'bg-violet-600' : 'bg-gray-200'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${peerReviewEnabled ? 'translate-x-4' : ''}`} />
              </div>
              <span className="text-[12.5px] font-medium text-gray-700">Enable peer review</span>
            </label>
            {peerReviewEnabled && (
              <div>
                <label className="block text-[10.5px] text-gray-500 mb-1">Reviewers per submission</label>
                <div className="flex gap-2">
                  {[1, 2].map(n => (
                    <button key={n} onClick={() => setPeerReviewCount(n)}
                      className={`px-4 py-1.5 text-[12.5px] font-medium rounded-lg border transition-colors ${peerReviewCount === n ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-[10.5px] text-gray-400 mt-1.5">Trigger peer review manually after the deadline via the task page.</p>
              </div>
            )}
          </div>

          {/* Late Policy (Feature 17) */}
          <div className="border border-gray-100 rounded-xl p-4 space-y-3">
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
              <AlertTriangle size={10} className="inline mr-1" />Late Submission Policy
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['accept', 'reject', 'penalty'] as const).map(p => (
                <button key={p} onClick={() => setLatePolicy(p)}
                  className={`py-2 text-[12px] font-medium rounded-lg border capitalize transition-colors ${latePolicy === p ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {p === 'accept' ? 'Accept' : p === 'reject' ? 'Reject' : 'Penalty'}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-[10.5px] text-gray-500 mb-1">Grace period (hours after deadline)</label>
              <input type="number" min={0} max={168} value={gracePeriodHours} onChange={e => setGracePeriodHours(Number(e.target.value))}
                className="w-24 px-3 py-1.5 text-[12.5px] border border-gray-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>

          {/* Self-Assessment (Feature 20) */}
          <div className="border border-gray-100 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                <Star size={10} className="inline mr-1" />Self-Assessment (before submit)
              </label>
              {selfAssessQuestions.length < 3 && (
                <button onClick={addSelfAssessQuestion} className="flex items-center gap-1 text-[11.5px] text-primary-600 hover:text-primary-800 font-medium">
                  <Plus size={12} /> Add question
                </button>
              )}
            </div>
            {selfAssessQuestions.length === 0 && (
              <p className="text-[10.5px] text-gray-400">Optional. Students rate themselves 1–5 before submitting (up to 3 questions).</p>
            )}
            <div className="space-y-2">
              {selfAssessQuestions.map((q, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={q.text} onChange={e => updateSelfAssessQuestion(i, e.target.value)}
                    placeholder={`Question ${i + 1} (e.g. "How confident are you in this submission?")`}
                    className="flex-1 px-3 py-2 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white placeholder-gray-300" />
                  <button onClick={() => removeSelfAssessQuestion(i)} className="text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 text-[13px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
            Cancel
          </button>
          <button
            onClick={() => {
              if (isEdit) { setShowConfirm(true); } else { handleCreate(); }
            }}
            disabled={loading || !title.trim()}
            className="flex-1 px-4 py-2.5 text-[13px] font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-60 rounded-xl transition-colors">
            {loading ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Save as Draft')}
          </button>
        </div>
      </div>

      {/* Step 1 — Save changes? */}
      {showConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-[15px] font-bold text-gray-900 mb-2">Save changes?</h3>
            <p className="text-[13px] text-gray-500 leading-relaxed mb-5">
              You're about to save changes to this task. Students who have already started will see the updated version.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2.5 text-[13px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={() => { setShowConfirm(false); setShowConfirm2(true); }}
                className="flex-1 px-4 py-2.5 text-[13px] font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2 — Are you sure? */}
      {showConfirm2 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowConfirm2(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-[15px] font-bold text-gray-900 mb-2">Are you sure?</h3>
            <p className="text-[13px] text-gray-500 leading-relaxed mb-5">
              This cannot be undone. Your changes will be saved and become visible to members immediately.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm2(false)}
                className="flex-1 px-4 py-2.5 text-[13px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={() => { setShowConfirm2(false); handleCreate(); }}
                className="flex-1 px-4 py-2.5 text-[13px] font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors">
                Yes, save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
