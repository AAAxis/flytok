import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Pencil, Trash2, Plus } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function fmtDate(ts) {
  if (!ts) return '—';
  const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  return format(date, 'MMM d, yyyy');
}

const EMPTY_FORM = {
  id: '',
  email: '',
  displayName: '',
  username: '',
  avatarUrl: '',
  role: 'user',
};

export default function Users() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null); // null | 'new' | userObject
  const [confirmDelete, setConfirmDelete] = useState(null);

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['users', 'list'],
    queryFn: () => usersRepo.list({ pageSize: 50 }),
  });

  const createMut = useMutation({
    mutationFn: (fields) => usersRepo.create(fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setEditing(null);
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, fields }) => usersRepo.update(id, fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setEditing(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => usersRepo.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setConfirmDelete(null);
    },
  });

  return (
    <div className="p-8">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-semibold text-zinc-100">Users</h1>
        <div className="flex items-center gap-3">
          <div className="text-sm text-zinc-500">
            {isLoading ? 'Loading…' : `${users.length} shown`}
          </div>
          <Button size="sm" onClick={() => setEditing('new')} className="gap-1">
            <Plus className="w-4 h-4" /> New user
          </Button>
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
                <TableHead className="text-zinc-400 text-right">Actions</TableHead>
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
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing(u)}
                        className="gap-1"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmDelete(u)}
                        className="gap-1 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <UserFormDialog
        open={editing !== null}
        mode={editing === 'new' ? 'create' : 'edit'}
        user={editing && editing !== 'new' ? editing : null}
        onOpenChange={(open) => !open && setEditing(null)}
        pending={createMut.isPending || updateMut.isPending}
        error={createMut.error ?? updateMut.error}
        onSubmit={(form) => {
          if (editing === 'new') {
            const { id, ...fields } = form;
            createMut.mutate({ id: id.trim(), ...fields });
          } else {
            const { id, ...fields } = form;
            updateMut.mutate({ id: editing.id, fields });
          }
        }}
      />

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the Firestore profile for{' '}
              <span className="text-zinc-200">
                {confirmDelete?.displayName ?? confirmDelete?.email ?? confirmDelete?.id}
              </span>
              . The Firebase Auth account (if any) is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteMut.error && (
            <div className="text-sm text-red-400">{deleteMut.error.message}</div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMut.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelete) deleteMut.mutate(confirmDelete.id);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMut.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UserFormDialog({ open, mode, user, onOpenChange, onSubmit, pending, error }) {
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && user) {
      setForm({
        id: user.id ?? '',
        email: user.email ?? '',
        displayName: user.displayName ?? '',
        username: user.username ?? '',
        avatarUrl: user.avatarUrl ?? '',
        role: user.role ?? 'user',
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, mode, user]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Create user' : 'Edit user'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Creates a Firestore profile only. To create a real Firebase Auth account, use a backend with the Admin SDK.'
              : 'Updates the Firestore profile document.'}
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(form);
          }}
        >
          <Field label="User ID" required={mode === 'create'}>
            <Input
              value={form.id}
              onChange={set('id')}
              disabled={mode === 'edit'}
              placeholder="firebase uid or custom id"
              required={mode === 'create'}
            />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Display name">
            <Input value={form.displayName} onChange={set('displayName')} />
          </Field>
          <Field label="Username">
            <Input value={form.username} onChange={set('username')} />
          </Field>
          <Field label="Avatar URL">
            <Input value={form.avatarUrl} onChange={set('avatarUrl')} />
          </Field>
          <Field label="Role">
            <select
              value={form.role}
              onChange={set('role')}
              className="bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm rounded-md px-3 py-2"
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </Field>

          {error && (
            <div className="text-sm text-red-400">{error.message}</div>
          )}

          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, children }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-zinc-400 text-xs">
        {label}
        {required && <span className="text-red-400"> *</span>}
      </Label>
      {children}
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
