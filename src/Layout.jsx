import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Video,
  Flag,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from '@/components/common/Logo';
import TopBar from '@/components/admin/TopBar';
import CommandPalette from '@/components/admin/CommandPalette';

const NAV = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/videos', label: 'Videos', icon: Video },
  { to: '/admin/reports', label: 'Reports', icon: Flag, badge: null },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
];

export default function Layout({ children }) {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      <aside className="w-60 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <Logo size="md" />
          <div className="text-xs text-zinc-500 mt-1 ml-11">Admin</div>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon, exact, badge }) => {
            const active = exact
              ? location.pathname === to
              : location.pathname === to || location.pathname.startsWith(to + '/');
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  active
                    ? 'bg-sky-500/10 text-sky-300'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="flex-1">{label}</span>
                {badge != null && (
                  <span className="text-[10px] font-medium bg-zinc-800 text-zinc-300 rounded-full px-2 py-0.5">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-zinc-800">
          <div className="text-[10px] text-zinc-600 text-center">Roamrez Admin · v0.1</div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>

      <CommandPalette />
    </div>
  );
}
