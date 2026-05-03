// Shared types + helpers for the upload-progress UI.
//
// `uploadVideo()` calls back during two phases when a music selection requires
// remote work: `mux` (deferred — see `lib/audio.ts` notes) and `upload`
// (Firebase Storage `putFile` byte progress). The picker for a device-uploaded
// audio file also reports an `audio` phase before the video upload starts.
//
// Components consume `UploadPhase` to render the right label + colour without
// having to know which call site fired the callback.

export type UploadPhase = 'idle' | 'audio' | 'mux' | 'upload' | 'finalize';

export type UploadProgressEvent = {
  phase: UploadPhase;
  /** 0–1 for in-progress phases; pass 1 to mark a phase complete. */
  percent: number;
};

export type UploadProgressCallback = (event: UploadProgressEvent) => void;

export const UPLOAD_PHASE_LABELS: Record<UploadPhase, string> = {
  idle: 'Idle',
  audio: 'Uploading audio',
  mux: 'Adding music',
  upload: 'Uploading video',
  finalize: 'Finalising',
};
