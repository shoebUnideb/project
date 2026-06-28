import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { onboardingApi } from '../../api/onboarding';
import type { WorkspaceOnboardingQuestion, WorkspaceOnboardingAnswer } from '../../types';

interface Props {
  workspaceId: number;
  onClose: () => void;
  onSaved?: () => void;
}

export default function WorkspaceOnboardingForm({ workspaceId, onClose, onSaved }: Props) {
  const [questions, setQuestions] = useState<WorkspaceOnboardingQuestion[]>([]);
  const [answers, setAnswers]     = useState<Record<number, string>>({});
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [loading, setLoading]     = useState(true);

  // Auto-close after save, with cleanup on unmount
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(onClose, 800);
    return () => clearTimeout(t);
  }, [saved, onClose]);

  useEffect(() => {
    Promise.all([
      onboardingApi.getQuestions(workspaceId),
      onboardingApi.getMyResponse(workspaceId),
    ]).then(([qs, existing]) => {
      setQuestions(qs);
      const map: Record<number, string> = {};
      existing.forEach((a: WorkspaceOnboardingAnswer) => { map[a.question] = a.answer_text; });
      setAnswers(map);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [workspaceId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = questions.map(q => ({ question: q.id, answer_text: answers[q.id] ?? '' }));
      await onboardingApi.submitMyResponse(workspaceId, payload);
      setSaved(true);
      onSaved?.();
    } catch (_) {
      // noop
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">

        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-[16px] font-bold text-gray-900">Workspace Intake</h2>
            <p className="text-[12px] text-gray-500 mt-0.5">Answer these questions so your coordinator can get to know you.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <p className="text-[13px] text-gray-400 text-center py-4">Loading questions…</p>
          ) : questions.length === 0 ? (
            <p className="text-[13px] text-gray-400 text-center py-4">No questions yet.</p>
          ) : (
            questions.map(q => (
              <div key={q.id}>
                <label className="block text-[12.5px] font-semibold text-gray-800 mb-1.5">
                  {q.question_text}
                  {q.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <textarea
                  rows={3}
                  value={answers[q.id] ?? ''}
                  onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                  className="w-full px-3 py-2 text-[13px] border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
                  placeholder="Your answer…"
                />
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 pb-5">
          <button onClick={onClose} className="px-3 py-2 text-[12.5px] text-gray-500 hover:text-gray-700 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading || saved}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-[12.5px] font-semibold transition-colors"
          >
            <Save size={13} />
            {saved ? 'Saved!' : saving ? 'Saving…' : 'Save answers'}
          </button>
        </div>
      </div>
    </div>
  );
}
