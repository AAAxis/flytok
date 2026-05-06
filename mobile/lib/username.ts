// Username (=@handle) rules. The handle is stored separately from
// `displayName`: it is unique, lowercase, and validated on both client and
// the Firestore rules. Single source of truth — the EditProfileSheet input,
// the auto-generation flow, and the Firestore rule regex all read from here.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;

const RESERVED = new Set([
  'admin',
  'support',
  'flytok',
  'roamerz',
  'roamrez',
  'root',
  'me',
  'you',
  'null',
  'undefined',
  'system',
  'staff',
]);

export type UsernameError =
  | 'too_short'
  | 'too_long'
  | 'must_start_with_letter'
  | 'invalid_chars'
  | 'consecutive_dots'
  | 'trailing_dot'
  | 'reserved';

const FIRST_CHAR = /^[a-z]/;
const ALLOWED = /^[a-z0-9._]+$/;

export function validateUsername(raw: string): UsernameError | null {
  const v = raw.trim();
  if (v.length < USERNAME_MIN) return 'too_short';
  if (v.length > USERNAME_MAX) return 'too_long';
  if (!FIRST_CHAR.test(v)) return 'must_start_with_letter';
  if (!ALLOWED.test(v)) return 'invalid_chars';
  if (v.includes('..')) return 'consecutive_dots';
  if (v.endsWith('.')) return 'trailing_dot';
  if (RESERVED.has(v)) return 'reserved';
  return null;
}

export function usernameErrorMessage(err: UsernameError): string {
  switch (err) {
    case 'too_short':
      return `At least ${USERNAME_MIN} characters.`;
    case 'too_long':
      return `At most ${USERNAME_MAX} characters.`;
    case 'must_start_with_letter':
      return 'Must start with a letter.';
    case 'invalid_chars':
      return 'Only lowercase letters, numbers, "." and "_".';
    case 'consecutive_dots':
      return 'No two dots in a row.';
    case 'trailing_dot':
      return 'Cannot end with a dot.';
    case 'reserved':
      return 'That handle is reserved.';
  }
}

export function normaliseUsername(input: string): string {
  return input.trim().toLowerCase();
}

// Build a candidate handle from a display name. Best-effort — the result is
// passed through validateUsername afterwards and a uid suffix is appended for
// uniqueness.
export function slugifyDisplayName(displayName: string | null | undefined): string {
  const base = (displayName ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .replace(/^[^a-z]+/, '')
    .slice(0, USERNAME_MAX);
  return base || 'user';
}

// Combine a base candidate with a short uniqueness suffix. The suffix is
// normalised to lowercase alphanumerics, padded with zeros if necessary,
// and clamped to 4 chars. The base is trimmed so the result fits MAX.
export function withSuffix(base: string, rawSuffix: string): string {
  const cleaned = rawSuffix.toLowerCase().replace(/[^a-z0-9]/g, '');
  const padded = (cleaned + '0000').slice(0, 4);
  const max = USERNAME_MAX - padded.length - 1;
  const trimmed = base.slice(0, Math.max(1, max));
  return `${trimmed}_${padded}`;
}
