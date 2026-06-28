import { useState, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import apiClient from '../../api/apiClient';
import { onboardingApi } from '../../api/onboarding';

interface Props {
  initialData?: Record<string, string>;
  onComplete: () => void;
  onClose: () => void;
}

const CAREER_STAGES = [
  { value: 'high_school',    label: 'High school student' },
  { value: 'undergraduate',  label: 'Undergraduate student' },
  { value: 'postgraduate',   label: 'Postgraduate student' },
  { value: 'early_career',   label: 'Early career (0–3 years)' },
  { value: 'mid_career',     label: 'Mid career (3–10 years)' },
  { value: 'career_changer', label: 'Career changer' },
  { value: 'other',          label: 'Other' },
];

const STEPS = [
  { key: 'goals',        title: 'Your Goals',          subtitle: 'Help your mentor understand what you want to achieve.' },
  { key: 'background',   title: 'Your Background',     subtitle: 'Share a bit about your academic and professional journey.' },
  { key: 'availability', title: 'Availability',        subtitle: "Let your mentor know when you're free to connect." },
  { key: 'skills',       title: 'Skills & Interests',  subtitle: 'What do you bring to the table, and what excites you?' },
];

export default function GlobalOnboardingModal({ initialData = {}, onComplete, onClose }: Props) {
  const [step, setStep]       = useState(0);
  const [saving, setSaving]   = useState(false);
  const [form, setForm]       = useState<Record<string, string>>({
    mentorship_goals:     initialData.mentorship_goals     ?? '',
    mentor_expectations:  initialData.mentor_expectations  ?? '',
    career_stage:         initialData.career_stage         ?? '',
    university:           initialData.university           ?? '',
    field_of_study:       initialData.field_of_study       ?? '',
    background_experience:initialData.background_experience?? '',
    availability_info:    initialData.availability_info    ?? '',
    skills:               initialData.skills               ?? '',
    interests:            initialData.interests            ?? '',
  });

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const saveStep = useCallback(async (fields: string[]) => {
    const payload: Record<string, string> = {};
    fields.forEach(k => { payload[k] = form[k] ?? ''; });
    await apiClient.patch('/api/student/profile/', payload);
  }, [form]);

  const next = async () => {
    setSaving(true);
    try {
      if (step === 0) await saveStep(['mentorship_goals', 'mentor_expectations']);
      else if (step === 1) await saveStep(['career_stage', 'university', 'field_of_study', 'background_experience']);
      else if (step === 2) await saveStep(['availability_info']);
      else if (step === 3) {
        await saveStep(['skills', 'interests']);
        await onboardingApi.completeGlobal();
        onComplete();
        return;
      }
      setStep(s => s + 1);
    } catch (_) {
      // silently carry on — non-critical
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white';
  const labelCls = 'block text-[12px] font-semibold text-gray-700 mb-1';
  const textareaCls = `${inputCls} resize-none`;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div>
            <p className="text-[11px] font-semibold text-primary-500 uppercase tracking-widest mb-0.5">
              Step {step + 1} of {STEPS.length}
            </p>
            <h2 className="text-[18px] font-bold text-gray-900">{STEPS[step].title}</h2>
            <p className="text-[12.5px] text-gray-500 mt-0.5">{STEPS[step].subtitle}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mx-6 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {step === 0 && (
            <>
              <div>
                <label className={labelCls}>What are you hoping to achieve through mentorship?</label>
                <textarea rows={3} className={textareaCls} placeholder="e.g. Land my first job abroad, build my CV, get guidance on my field…"
                  value={form.mentorship_goals} onChange={e => set('mentorship_goals', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>What are you looking for in a mentor?</label>
                <textarea rows={3} className={textareaCls} placeholder="e.g. Someone who has worked in the same field, regular check-ins…"
                  value={form.mentor_expectations} onChange={e => set('mentor_expectations', e.target.value)} />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <label className={labelCls}>Career stage</label>
                <select className={inputCls} value={form.career_stage} onChange={e => set('career_stage', e.target.value)}>
                  <option value="">Select…</option>
                  {CAREER_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>University / School</label>
                  <input className={inputCls} placeholder="e.g. University of Budapest" value={form.university} onChange={e => set('university', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Field of study</label>
                  <input className={inputCls} placeholder="e.g. International Relations" value={form.field_of_study} onChange={e => set('field_of_study', e.target.value)} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Background & experience</label>
                <textarea rows={3} className={textareaCls} placeholder="Brief description of your academic or work experience…"
                  value={form.background_experience} onChange={e => set('background_experience', e.target.value)} />
              </div>
            </>
          )}

          {step === 2 && (
            <div>
              <label className={labelCls}>When are you available? (hours per week, time zone, preferred days)</label>
              <textarea rows={4} className={textareaCls} placeholder="e.g. Weekday evenings (CET), ~3 hours/week. Available on weekends for async messages."
                value={form.availability_info} onChange={e => set('availability_info', e.target.value)} />
            </div>
          )}

          {step === 3 && (
            <>
              <div>
                <label className={labelCls}>Skills (comma-separated)</label>
                <input className={inputCls} placeholder="e.g. Python, project management, public speaking"
                  value={form.skills} onChange={e => set('skills', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Areas of interest</label>
                <textarea rows={3} className={textareaCls} placeholder="e.g. Sustainability, EdTech, working abroad, youth exchange programs…"
                  value={form.interests} onChange={e => set('interests', e.target.value)} />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 pb-5">
          <button onClick={onClose} className="text-[12px] text-gray-400 hover:text-gray-600 transition-colors">
            Skip for now
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-[12.5px] font-medium text-gray-600 hover:bg-gray-100 transition-colors">
                <ChevronLeft size={14} /> Back
              </button>
            )}
            <button
              onClick={next}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-[12.5px] font-semibold transition-colors"
            >
              {step === STEPS.length - 1 ? (
                <><Check size={14} /> Finish</>
              ) : (
                <>Next <ChevronRight size={14} /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
