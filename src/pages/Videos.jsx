import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Image as ImageIcon } from 'lucide-react';
import { videosRepo } from '@/lib/repositories';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

function fmtDate(ts) {
  if (!ts) return '—';
  const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  return format(date, 'MMM d, yyyy');
}

const fmtNum = (n) => (n ?? 0).toLocaleString();

export default function Videos() {
  const { data: videos = [], isLoading, error } = useQuery({
    queryKey: ['videos', 'list'],
    queryFn: () => videosRepo.list({ pageSize: 50 }),
  });

  return (
    <div className="p-8">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-semibold text-zinc-100">Videos</h1>
        <div className="text-sm text-zinc-500">
          {isLoading ? 'Loading…' : `${videos.length} shown`}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-md p-3 mb-4 text-sm">
          {error.message}
        </div>
      )}

      {!isLoading && videos.length === 0 ? (
        <EmptyState message="No videos yet." />
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-zinc-800">
                <TableHead className="text-zinc-400">Video</TableHead>
                <TableHead className="text-zinc-400">Author</TableHead>
                <TableHead className="text-zinc-400">Uploaded</TableHead>
                <TableHead className="text-zinc-400 text-right">Views</TableHead>
                <TableHead className="text-zinc-400 text-right">Likes</TableHead>
                <TableHead className="text-zinc-400 text-right">Comments</TableHead>
                <TableHead className="text-zinc-400">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {videos.map((v) => (
                <TableRow key={v.id} className="border-zinc-800 hover:bg-zinc-800/40">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-14 rounded bg-zinc-800 overflow-hidden flex items-center justify-center flex-shrink-0">
                        {v.thumbnailUrl ? (
                          <img src={v.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-zinc-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-zinc-100 truncate max-w-[280px]">
                          {v.caption ?? '— no caption —'}
                        </div>
                        <div className="text-xs text-zinc-500 truncate font-mono">{v.id}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-zinc-400">
                    {v.authorUsername ?? v.authorId ?? '—'}
                  </TableCell>
                  <TableCell className="text-zinc-400">{fmtDate(v.createdAt)}</TableCell>
                  <TableCell className="text-zinc-400 text-right">{fmtNum(v.viewCount)}</TableCell>
                  <TableCell className="text-zinc-400 text-right">{fmtNum(v.likeCount)}</TableCell>
                  <TableCell className="text-zinc-400 text-right">{fmtNum(v.commentCount)}</TableCell>
                  <TableCell>
                    <Badge variant={v.status === 'banned' ? 'destructive' : 'secondary'}>
                      {v.status ?? 'active'}
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
