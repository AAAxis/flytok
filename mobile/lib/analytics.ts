import analytics from '@react-native-firebase/analytics';

type EventParams = Record<string, string | number | boolean | null | undefined>;

function clean(params?: EventParams): Record<string, string | number | boolean> | undefined {
  if (!params) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    out[k] = v;
  }
  return out;
}

export async function logEvent(name: string, params?: EventParams) {
  try {
    await analytics().logEvent(name, clean(params));
  } catch {
    // analytics is best-effort; never throw to the caller
  }
}

export async function setUserId(uid: string | null) {
  try {
    await analytics().setUserId(uid);
  } catch {
    // ignore
  }
}

export async function setUserProperty(name: string, value: string | null) {
  try {
    await analytics().setUserProperty(name, value);
  } catch {
    // ignore
  }
}

// Convenience wrappers — use these so event names stay consistent across the app.
export const track = {
  signup: (method: string) => logEvent('sign_up', { method }),
  login: (method: string) => logEvent('login', { method }),
  videoUploaded: (params: { hasLocation: boolean; hashtagCount: number; durationMs?: number }) =>
    logEvent('video_uploaded', {
      has_location: params.hasLocation,
      hashtag_count: params.hashtagCount,
      duration_ms: params.durationMs,
    }),
  videoViewed: (videoId: string) => logEvent('video_viewed', { video_id: videoId }),
  videoLiked: (videoId: string) => logEvent('video_liked', { video_id: videoId }),
  videoSaved: (videoId: string, saved: boolean) =>
    logEvent('video_saved', { video_id: videoId, saved }),
  commentPosted: (videoId: string) => logEvent('comment_posted', { video_id: videoId }),
  followAdded: (targetUid: string) => logEvent('follow_added', { target_uid: targetUid }),
  followRemoved: (targetUid: string) => logEvent('follow_removed', { target_uid: targetUid }),
  chatStarted: (threadId: string) => logEvent('chat_started', { thread_id: threadId }),
  messageSent: (threadId: string, type: 'text' | 'video_card' | 'image') =>
    logEvent('message_sent', { thread_id: threadId, message_type: type }),
  profilePhotoChanged: () => logEvent('profile_photo_changed'),
  reportSubmitted: (kind: string, reason: string) =>
    logEvent('report_submitted', { target_kind: kind, reason }),
  searchPerformed: (kind: 'location' | 'user' | 'hashtag', queryLength: number) =>
    logEvent('search_performed', { kind, query_length: queryLength }),
};
