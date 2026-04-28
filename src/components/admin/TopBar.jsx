import { useEffect, useState } from 'react';
import { Search, Bell, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/lib/AuthContext';

const isProd = import.meta.env.MODE === 'production';

function dispatchCmdK() {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
  );
}

export default function TopBar() {
  const { user, logout } = useAuth();
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);

  const initial = (user?.email ?? '?')[0].toUpperCase();

  return (
    <header className="h-14 flex items-center gap-3 px-4 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-20">
      <button
        onClick={dispatchCmdK}
        className="flex-1 max-w-sm flex items-center gap-2 px-3 h-9 rounded-md bg-zinc-900 border border-zinc-800 text-sm text-zinc-500 hover:bg-zinc-800/80 hover:text-zinc-300 transition-colors"
      >
        <Search className="w-4 h-4" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5">
          {isMac ? '⌘' : 'Ctrl'}K
        </kbd>
      </button>

      <div className="flex-1" />

      <div
        className={`text-[10px] font-medium uppercase tracking-wide px-2 py-1 rounded ${
          isProd
            ? 'bg-red-500/10 text-red-400 border border-red-500/30'
            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
        }`}
      >
        {isProd ? 'prod' : 'dev'}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="relative w-9 h-9 flex items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors">
            <Bell className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="px-2 py-6 text-center text-sm text-zinc-500">
            No notifications.
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 hover:bg-zinc-800 px-2 h-9 rounded-md transition-colors">
            <Avatar className="w-7 h-7">
              <AvatarFallback className="bg-sky-500/20 text-sky-300 text-xs">
                {initial}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="text-xs text-zinc-500">Signed in as</div>
            <div className="text-sm text-zinc-100 truncate">{user?.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="text-red-400 focus:text-red-300">
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
