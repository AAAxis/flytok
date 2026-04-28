import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Image as ImageIcon, Plus, Upload, X } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LocationPicker } from '@/components/admin/LocationPicker';

function fmtDate(ts) {
  if (!ts) return '—';
  const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  return format(date, 'MMM d, yyyy');
}

const fmtNum = (n) => (n ?? 0).toLocaleString();

export default function Videos() {
  const [uploading, setUploading] = useState(false);

  const { data: videos = [], isLoading, error } = useQuery({
    queryKey: ['videos', 'list'],
    queryFn: () => videosRepo.list({ pageSize: 50 }),
  });

  return (
    <div className="p-8">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-semibold text-zinc-100">Videos</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500">
            {isLoading ? 'Loading…' : `${videos.length} shown`}
          </span>
          <Button onClick={() => setUploading(true)} className="gap-1">
            <Plus className="w-4 h-4" /> Upload video
          </Button>
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
                        ) : v.downloadURL ? (
                          <video
                            src={v.downloadURL}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                          />
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
                  <TableCell className="text-zinc-100">
                    {v.ownerEmail ?? v.authorUsername ?? v.ownerId ?? v.authorId ?? '—'}
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

      {uploading && <UploadVideoModal onClose={() => setUploading(false)} />}
    </div>
  );
}

function UploadVideoModal({ onClose }) {
  const qc = useQueryClient();
  const fileInput = useRef(null);
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);
  const [location, setLocation] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const upload = useMutation({
    mutationFn: () =>
      videosRepo.upload({ file, caption, location, tags, onProgress: setProgress }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['videos'] });
      onClose();
    },
    onError: (err) => setError(err?.message ?? 'Upload failed'),
  });

  const previewUrl = file ? URL.createObjectURL(file) : null;

  function submit(e) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError('Pick a video file first');
      return;
    }
    upload.mutate();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 w-full max-w-md space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-zinc-100 text-base font-medium">Upload video</h2>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          {previewUrl ? (
            <div className="relative bg-zinc-950 rounded-md overflow-hidden aspect-[9/16] max-h-[260px] mx-auto flex items-center justify-center">
              <video
                src={previewUrl}
                className="max-h-full max-w-full"
                controls
                playsInline
              />
              <button
                type="button"
                onClick={() => setFile(null)}
                className="absolute top-2 right-2 bg-black/70 text-zinc-100 text-xs px-2 py-1 rounded"
              >
                Change
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="w-full aspect-[9/16] max-h-[260px] mx-auto flex flex-col items-center justify-center gap-2 bg-zinc-950 border border-dashed border-zinc-800 rounded-md text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
            >
              <Upload className="w-6 h-6" />
              <span className="text-sm">Pick a video file</span>
              <span className="text-xs text-zinc-600">MP4, MOV, WebM</span>
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-zinc-400">Caption</Label>
          <Input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Say something about this place…"
            className="bg-zinc-950 border-zinc-800 text-zinc-100"
            disabled={upload.isPending}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-zinc-400">Tags</Label>
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ',' || e.key === ' ') && tagInput.trim()) {
                e.preventDefault();
                const t = tagInput.trim().replace(/^#/, '').toLowerCase();
                if (t && !tags.includes(t)) setTags([...tags, t]);
                setTagInput('');
              } else if (e.key === 'Backspace' && !tagInput && tags.length) {
                setTags(tags.slice(0, -1));
              }
            }}
            placeholder="travel, beach, japan… (Enter or comma to add)"
            className="bg-zinc-950 border-zinc-800 text-zinc-100"
            disabled={upload.isPending}
          />
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 bg-sky-500/10 text-sky-300 text-xs px-2 py-1 rounded-md"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => setTags(tags.filter((x) => x !== t))}
                    className="hover:text-sky-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-zinc-400">Location</Label>
          <LocationPicker value={location} onChange={setLocation} />
        </div>

        {upload.isPending && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-zinc-400">
              <span>Uploading…</span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-500 transition-[width] duration-150"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {error && <div className="text-sm text-red-400">{error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={upload.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={!file || upload.isPending}>
            {upload.isPending ? 'Uploading…' : 'Upload'}
          </Button>
        </div>
      </form>
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
