import type { ReactNode } from 'react';

interface Props {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: string;
  trendUp?: boolean;
  accent?: 'blue' | 'green' | 'orange' | 'purple';
}

const ACCENT = {
  blue:   'bg-primary-50   text-primary-600',
  green:  'bg-green-50  text-green-600',
  orange: 'bg-orange-50 text-orange-500',
  purple: 'bg-purple-50 text-purple-600',
};

export default function MetricCard({ label, value, icon, trend, trendUp, accent = 'blue' }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start gap-4">
      {icon && (
        <div className={`rounded-lg p-2.5 shrink-0 ${ACCENT[accent]}`}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        {trend && (
          <p className={`text-[11px] mt-1 font-medium ${trendUp ? 'text-green-600' : 'text-gray-400'}`}>
            {trend}
          </p>
        )}
      </div>
    </div>
  );
}
