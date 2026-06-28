import { Construction } from 'lucide-react';

export default function OrgComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mb-4">
        <Construction size={28} className="text-teal-400" />
      </div>
      <h1 className="text-[22px] font-bold text-gray-900 mb-1">{title}</h1>
      <p className="text-[14px] text-gray-500 max-w-sm leading-relaxed">
        This section is currently under construction and will be available soon.
      </p>
    </div>
  );
}
