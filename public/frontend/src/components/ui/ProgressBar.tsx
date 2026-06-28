interface Props {
  value: number; // 0-100
  label?: string;
  showPercent?: boolean;
  color?: 'primary' | 'green' | 'orange';
}

const COLOR_MAP = {
  primary: 'bg-primary-500',
  green:   'bg-green-500',
  orange:  'bg-orange-400',
};

export default function ProgressBar({
  value,
  label,
  showPercent = true,
  color = 'primary',
}: Props) {
  const clamped = Math.min(100, Math.max(0, value));
  const barColor = COLOR_MAP[color];

  return (
    <div className="w-full">
      {(label || showPercent) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-[12px] text-gray-500">{label}</span>}
          {showPercent && (
            <span className="text-[12px] font-semibold text-gray-700 ml-auto">
              {clamped}%
            </span>
          )}
        </div>
      )}
      <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
