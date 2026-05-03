# Wave 4 — Upload v2

> Master design: `docs/superpowers/specs/2026-05-03-flytok-v2-features-design.md`
> Owner: one frontend-developer agent
> Target: 1 session
> **Depends on**: Wave 1 (`<AppBottomSheet>`).

## Objective

Production-grade upload: optional native trim, music picker (curated
library + user upload from device), real upload progress, post-upload
success screen with explicit next-step CTAs.

## Acceptance criteria

### Trim step

- [ ] `react-native-video-trim` installed via Expo config plugin (the
      library ships its own).
- [ ] Trim step is **optional** — the upload form shows a "Trim" button
      next to the picked video. User can skip.
- [ ] Trim step opens the native trimmer (UIVideoEditorController on iOS,
      native Android picker). Returns the trimmed file URI which replaces
      `uri` state.
- [ ] Aborted trim leaves original video in place.

### Music picker

- [ ] `<MusicPickerSheet>` (built on `<AppBottomSheet>`) with two tabs:
      - **Library** — list of `tracks/*` documents. Each row: title,
        artist, duration. Tap to preview (toggle play/pause), long-press
        to select. Selected track shows a checkmark.
      - **From device** — `expo-document-picker` (audio/*) → upload to
        `audio_user/{uid}/{timestamp}.{ext}`. Show upload progress.
- [ ] Selected track's metadata passes back to the upload form which
      stores it in state.
- [ ] At upload time, the audio is **muxed onto the trimmed video**.
      Implementation: try `react-native-video-trim`'s mux helper first;
      if it doesn't replace audio cleanly, fall back to
      `ffmpeg-kit-react-native` (audio-only command, ~30 MB APK growth —
      decide in W4 only after testing the trim lib's mux).
- [ ] On the video doc:
      - `audioSource: 'library'` + `audioTrackId: trackId` if from library.
      - `audioSource: 'user_upload'` + `audioUserPath: storagePath` if
        from device.
      - `audioSource: 'original'` (no audio swap) when user skips music.
        Default.

### Upload progress

- [ ] `uploadVideo()` accepts a progress callback:
      `onProgress(phase: 'mux'|'upload', percent: number)`.
- [ ] Upload screen shows a real progress bar with phase label.
- [ ] Cancellable mid-upload (storage `task.cancel()`).

### Success screen

- [ ] After upload completes, navigate via `router.replace` to
      `mobile/app/upload/success.tsx` passing `videoId` as a search
      param. (A separate route — not in-place — so the back button
      doesn't return to the half-cleared upload form.)
- [ ] Shows the video poster (still frame).
- [ ] Two CTAs:
      - "Watch your post" → routes to
        `posts/{me.uid}?start={videoId}&source=mine`.
      - "Keep exploring" → routes to `/(tabs)/index` (the feed).
- [ ] Tapping either resets upload state for next time.

### ToS

- [ ] `mobile/app/legal/tos.tsx` (or wherever ToS lives) appends a
      paragraph: "Audio you upload is your responsibility. By uploading,
      you confirm you have the right to use it. We honor takedown
      requests via support@flytok.com (or wherever)."

## Files to touch

**New**
- `mobile/components/upload/TrimButton.tsx`.
- `mobile/components/upload/MusicPickerSheet.tsx`.
- `mobile/components/upload/UploadProgressBar.tsx`.
- `mobile/app/upload/success.tsx` — the post-upload screen.
- `mobile/lib/audio.ts` — track loading, mux helper, upload-from-device.
- `mobile/lib/uploadProgress.ts` — types + helpers.
- `mobile/plugins/withVideoTrim.js` if needed (lib should ship its own).
- `scripts/seed-tracks.mjs` — one-off script to seed ~20 CC0 tracks from
  Pixabay Music into Firestore + Storage. Roman runs once.

**Modified**
- `mobile/app/(tabs)/upload.tsx` — wire trim + music + progress + success.
- `mobile/lib/firestore.ts` — `uploadVideo` signature gains
  `audio?: AudioSelection` and `onProgress?: (phase, percent) => void`.
  Persists `audioSource`, `audioTrackId`, `audioUserPath` fields.
- `firestore.rules` — `videos/{vid}` create rule allows the new fields.
  `tracks/*` read-only to clients. `audio_user/{uid}/*` storage rule
  added.
- `storage.rules` — `audio_library/*` public read, no client write.
  `audio_user/{uid}/*` owner write only.
- `mobile/package.json` — add `react-native-video-trim`.
  (`ffmpeg-kit-react-native` only if needed — DEFERRED until trim mux
  fails.)

## Mux strategy decision tree

```
Does react-native-video-trim's mux replace audio cleanly on both platforms?
├─ YES → use it. Done.
└─ NO  → install ffmpeg-kit-react-native. Add as a dep. Use a single
         command:
         ffmpeg -i video.mp4 -i audio.mp3 -c:v copy -map 0:v:0 -map 1:a:0 \
                -shortest output.mp4
         (`-c:v copy` keeps the trimmed video bitstream as-is; only the
          audio track is re-encoded if needed.)
         Document the +30 MB APK cost in docs/log.md so it's not a
         surprise.
```

## Track seeding plan

Pixabay Music has CC0 tracks tagged "travel", "ambient", "lo-fi". Pick ~20
across categories: chill / upbeat / cinematic / hip-hop / electronic /
acoustic / jazz / world. Roman runs `node scripts/seed-tracks.mjs` once.
Each track lands at `audio_library/{trackId}.mp3` in Storage and a
`tracks/{trackId}` doc in Firestore.

The seed script uses the service account (already configured for
`.deploy-firestore-rules.mjs`). It downloads from Pixabay (their direct
links are permanent), uploads to Storage, writes the doc.

## Definition of done

- Per the master spec's DoD.
- Manual: upload a video, trim it, pick a library track, see real
  progress, land on success screen, tap "Watch", see your video.
- Manual: upload a video, pick a device audio file, complete upload,
  verify the audio plays in the resulting video.
- Manual: skip music + skip trim — uploads as before with
  `audioSource: 'original'`.

## Hand-off

- Append paragraph to `docs/log.md`.
- Mark Wave 4 `[x]` in `prompt.md`.
- Note for Roman: run `node scripts/seed-tracks.mjs` once before testing.
- Note any APK-size jump if `ffmpeg-kit-react-native` was needed.
