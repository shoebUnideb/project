import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import OrgTopbar from './OrgTopbar';
import OrgSidebar from './OrgSidebar';
import { OrgProvider } from '../context/OrgContext';
import OrgFooter from '../components/OrgFooter';

export const SIDEBAR_W_OPEN     = 220;
export const SIDEBAR_W_COLLAPSED = 56;

export default function OrgShell() {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarW = collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W_OPEN;

  return (
    <OrgProvider>
      <div className="min-h-screen bg-gray-50 font-sans">
        <OrgTopbar />
        <OrgSidebar collapsed={collapsed} onToggle={() => setCollapsed(p => !p)} />
        <div
          className="mt-10 min-h-[calc(100vh-40px)] transition-all duration-200"
          style={{ marginLeft: sidebarW }}
        >
          <main className="p-6">
            <Outlet />
          </main>
          <OrgFooter />
        </div>
      </div>
    </OrgProvider>
  );
}
