import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

export type PickedImage = {
  uri: string;
  width: number;
  height: number;
  mimeType: string;
};

const MAX_LONG_SIDE = 1600;
const JPEG_QUALITY = 0.8;

/**
 * Launches the OS image library and post-processes the chosen image:
 * resizes to a max long-side of 1600px, re-encodes as JPEG @0.8. Returns
 * `null` if the user cancelled or permission was denied.
 *
 * The 8 MB Storage rule is the hard ceiling — this just avoids dragging
 * 12-megapixel originals through a chat upload.
 */
export async function pickImageAttachment(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(
      'Photo access needed',
      'Enable photo access in Settings to attach an image.',
    );
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 1,
    selectionLimit: 1,
  });
  if (res.canceled || !res.assets || res.assets.length === 0) return null;
  const asset = res.assets[0];

  const longSide = Math.max(asset.width ?? 0, asset.height ?? 0);
  const actions: ImageManipulator.Action[] = [];
  if (longSide > MAX_LONG_SIDE) {
    if ((asset.width ?? 0) >= (asset.height ?? 0)) {
      actions.push({ resize: { width: MAX_LONG_SIDE } });
    } else {
      actions.push({ resize: { height: MAX_LONG_SIDE } });
    }
  }

  try {
    const out = await ImageManipulator.manipulateAsync(asset.uri, actions, {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return {
      uri: out.uri,
      width: out.width,
      height: out.height,
      mimeType: 'image/jpeg',
    };
  } catch {
    // Fallback to the raw asset if manipulation fails (rare — but better to
    // try uploading the original than to lose the user's input).
    return {
      uri: asset.uri,
      width: asset.width ?? 0,
      height: asset.height ?? 0,
      mimeType: asset.mimeType ?? 'image/jpeg',
    };
  }
}
