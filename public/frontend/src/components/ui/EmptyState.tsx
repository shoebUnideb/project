import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-12 h-12 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center mb-4">
        {icon ?? <Inbox size={22} />}
      </div>
      <p className="text-[15px] font-semibold text-gray-700 mb-1">{title}</p>
      {description && <p className="text-[13px] text-gray-400 max-w-xs mb-4">{description}</p>}
      {action}
    </div>
  );
}
