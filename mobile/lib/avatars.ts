/**
 * DiceBear avatar helpers for the profile customizer (W2).
 *
 * `default` means "use the user's uploaded photoURL (or fallback person glyph)".
 * The other styles render via DiceBear's HTTPS API using the user's uid as the
 * deterministic seed.
 */

export const AVATAR_STYLES = [
  'default',
  'adventurer',
  'robot',
  'emoji',
  'portrait',
  'pixel',
] as const;

export type AvatarStyle = (typeof AVATAR_STYLES)[number];

const DICEBEAR_VERSION = '7.x';

const STYLE_ENDPOINTS: Record<Exclude<AvatarStyle, 'default'>, string> = {
  adventurer: 'adventurer',
  robot: 'bottts',
  emoji: 'fun-emoji',
  portrait: 'avataaars',
  pixel: 'pixel-art',
};

export const AVATAR_STYLE_LABEL: Record<AvatarStyle, string> = {
  default: 'Photo',
  adventurer: 'Adventurer',
  robot: 'Robot',
  emoji: 'Emoji',
  portrait: 'Portrait',
  pixel: 'Pixel',
};

export function dicebearURL(style: AvatarStyle, seed: string, size = 256): string | null {
  if (style === 'default') return null;
  const endpoint = STYLE_ENDPOINTS[style];
  if (!endpoint) return null;
  const params = new URLSearchParams({
    seed,
    size: String(size),
    backgroundType: 'gradientLinear',
  });
  return `https://api.dicebear.com/${DICEBEAR_VERSION}/${endpoint}/png?${params.toString()}`;
}
