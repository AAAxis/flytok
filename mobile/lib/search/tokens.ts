/**
 * Tokeniser shared between upload (`uploadVideo`) and the search screen
 * (`searchVideos`). Lowercases, splits on non-letter/non-number characters,
 * drops anything shorter than 3 chars, dedupes, and caps the array at 30
 * entries so caption-spam can't bloat the doc.
 *
 * Firestore has no full-text search; the array is a denormalised
 * `array-contains` index. Each token has to match exactly to be found.
 *
 * Lives in its own module (with no Firestore deps) so `firestore.ts` and
 * `lib/search/queries.ts` can both import it without creating a cycle.
 */
export function captionTokens(caption: string): string[] {
  if (!caption) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const matches = caption.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu);
  if (!matches) return [];
  for (const t of matches) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 30) break;
  }
  return out;
}
