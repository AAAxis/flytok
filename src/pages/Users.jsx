import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { usersRepo } from '@/lib/repositories';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

function fmtDate(ts) {
  if (!ts) return '—';
  const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  return format(date, 'MMM d, yyyy');
}

export default function Users() {
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['users', 'list'],
    queryFn: () => usersRepo.list({ pageSize: 50 }),
  });

  return (
    <div className="p-8">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-semibold text-zinc-100">Users</h1>
        <div className="text-sm text-zinc-500">
          {isLoading ? 'Loading…' : `${users.length} shown`}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-md p-3 mb-4 text-sm">
          {error.message}
        </div>
      )}

      {!isLoading && users.length === 0 ? (
        <EmptyState message="No users yet." />
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-zinc-800">
                <TableHead className="text-zinc-400">User</TableHead>
                <TableHead className="text-zinc-400">Email</TableHead>
                <TableHead className="text-zinc-400">Joined</TableHead>
                <TableHead className="text-zinc-400 text-right">Videos</TableHead>
                <TableHead className="text-zinc-400 text-right">Followers</TableHead>
                <TableHead className="text-zinc-400">Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} className="border-zinc-800 hover:bg-zinc-800/40">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={u.avatarUrl} alt="" />
                        <AvatarFallback className="bg-zinc-800 text-zinc-300 text-xs">
                          {(u.displayName ?? u.email ?? '?').toString()[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="text-zinc-100 truncate">
                          {u.displayName ?? '—'}
                        </div>
                        <div className="text-xs text-zinc-500 truncate">
                          @{u.username ?? '—'}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-zinc-400">{u.email ?? '—'}</TableCell>
                  <TableCell className="text-zinc-400">{fmtDate(u.createdAt)}</TableCell>
                  <TableCell className="text-zinc-400 text-right">{u.videoCount ?? 0}</TableCell>
                  <TableCell className="text-zinc-400 text-right">{u.followerCount ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                      {u.role ?? 'user'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center text-zinc-500">
      {message}
    </div>
  );
}
