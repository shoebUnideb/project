import { CheckCircle2 } from 'lucide-react';

interface Props {
  message: string;
  ctaLabel: string;
  onCta: () => void;
}

export default function OnboardingBanner({ message, ctaLabel, onCta }: Props) {
  return (
    <div className="mx-5 mt-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
      <CheckCircle2 size={16} className="shrink-0 text-amber-500" />
      <p className="flex-1 text-[12.5px] text-amber-800">{message}</p>
      <button
        onClick={onCta}
        className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[12px] font-semibold transition-colors"
      >
        {ctaLabel}
      </button>
    </div>
  );
}
