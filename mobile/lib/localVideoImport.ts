import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

const IMPORT_DIR = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}picked-videos/`;

export const VIDEO_LIBRARY_PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['videos'],
  allowsEditing: false,
  quality: 1,
  videoMaxDuration: 60,
  // Ask iOS Photos for an exported, compatible file instead of the new fast
  // "current representation" path. That path is quicker, but it can fail for
  // iCloud-only videos before the app receives a usable local URI.
  preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality,
};

function extensionForAsset(asset: ImagePicker.ImagePickerAsset): string {
  const fromName = asset.fileName?.split('.').pop();
  const fromUri = asset.uri.split('?')[0]?.split('.').pop();
  const ext = (fromName || fromUri || 'mp4').toLowerCase();
  return /^[a-z0-9]{2,5}$/.test(ext) ? ext : 'mp4';
}

export async function importPickedVideo(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  if (!asset.uri) throw new Error('Selected video has no local file.');

  await FileSystem.makeDirectoryAsync(IMPORT_DIR, { intermediates: true });
  const dest = `${IMPORT_DIR}${Date.now()}-${Math.random().toString(36).slice(2)}.${extensionForAsset(asset)}`;

  await FileSystem.copyAsync({ from: asset.uri, to: dest });
  const info = await FileSystem.getInfoAsync(dest);
  if (!info.exists || (typeof info.size === 'number' && info.size <= 0)) {
    throw new Error('Selected video could not be copied to local storage.');
  }

  return dest;
}

export function videoImportErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : '';
  const isCloud = /3164|iCloud|cloud|could not be completed|NSItemProvider/i.test(msg);
  if (isCloud) {
    return "iOS couldn't download this clip from Photos. Open it in Photos first so it finishes downloading, then try again.";
  }
  return msg || 'Try a different video.';
}
