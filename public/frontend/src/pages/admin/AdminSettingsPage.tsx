import Card from '../../components/ui/Card';
import PageHeader from '../../components/ui/PageHeader';
import ThemePicker from '../../components/ui/ThemePicker';
import FontPicker from '../../components/ui/FontPicker';
import { Settings } from 'lucide-react';

export default function AdminSettingsPage() {
  return (
    <div className="max-w-xl">
      <PageHeader title="Settings" subtitle="Platform configuration." />
      <Card padding="lg" className="mb-4">
        <p className="text-[10.5px] font-bold uppercase tracking-widest text-gray-400 mb-4 pb-2 border-b border-gray-100">Appearance</p>
        <ThemePicker />
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mt-5 mb-2">Font</p>
        <FontPicker />
      </Card>
      <Card padding="lg">
        <div className="flex items-center gap-3 text-gray-400 py-8 justify-center">
          <Settings size={20} />
          <span className="text-[13px]">More settings — coming in Phase 2.</span>
        </div>
      </Card>
    </div>
  );
}
