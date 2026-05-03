/* eslint-disable react-compiler/react-compiler */
'use no memo';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  type BottomSheetBackdropProps,
  type BottomSheetModalProps,
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';

export type AppBottomSheetHandle = {
  present: () => void;
  dismiss: () => void;
};

type Props = {
  /** Controlled visibility — flips imperatively on each change. */
  visible: boolean;
  onClose: () => void;

  /** Snap points. Defaults to a single ~70% snap. Strings or numbers per gorhom. */
  snapPoints?: (string | number)[];

  /** Pin the sheet to its content height instead of using snapPoints. */
  enableDynamicSizing?: boolean;

  /** Show a small top header with title + close button. */
  title?: string;

  /** Show the small drag handle pill at the top. Defaults to true. */
  showHandle?: boolean;

  /** Keyboard interplay. Defaults to 'interactive' (sheet follows keyboard). */
  keyboardBehavior?: BottomSheetModalProps['keyboardBehavior'];
  keyboardBlurBehavior?: BottomSheetModalProps['keyboardBlurBehavior'];

  /** Tap on backdrop dismisses by default; pass false to disable. */
  dismissOnBackdropTap?: boolean;

  children: ReactNode;
};

/**
 * Brand-styled wrapper around `@gorhom/bottom-sheet`'s `BottomSheetModal`.
 *
 * Designed to make migrations from raw `<Modal>` mechanical: callers keep their
 * `visible`/`onClose` props and pass content as children. Snap points default
 * to a single 70% stop; pass `enableDynamicSizing` for content-sized sheets
 * (settings/report) or custom `snapPoints` for taller layouts (comments / AI).
 */
export const AppBottomSheet = forwardRef<AppBottomSheetHandle, Props>(function AppBottomSheet(
  {
    visible,
    onClose,
    snapPoints,
    enableDynamicSizing,
    title,
    showHandle = true,
    keyboardBehavior = 'interactive',
    keyboardBlurBehavior = 'restore',
    dismissOnBackdropTap = true,
    children,
  },
  ref,
) {
  const sheetRef = useRef<BottomSheetModal>(null);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  // Drive present/dismiss off the controlled `visible` prop so callers can keep
  // their existing useState patterns. Defer one frame so the BottomSheetModal
  // has time to register with BottomSheetModalProvider before we call into it
  // — gorhom v5's modal API only works once the provider has the ref in its
  // map, and registration happens in the modal's mount effect.
  useEffect(() => {
    if (visible) {
      try {
        const handle = requestAnimationFrame(() => {
          try {
            sheetRef.current?.present();
          } catch (err) {
            console.warn('[AppBottomSheet] present() failed:', err);
          }
        });
        return () => cancelAnimationFrame(handle);
      } catch (err) {
        console.warn('[AppBottomSheet] schedule present failed:', err);
      }
    } else {
      try {
        sheetRef.current?.dismiss();
      } catch (err) {
        console.warn('[AppBottomSheet] dismiss() failed:', err);
      }
    }
  }, [visible]);

  const resolvedSnaps = useMemo(() => {
    if (enableDynamicSizing) return undefined;
    return snapPoints ?? ['70%'];
  }, [snapPoints, enableDynamicSizing]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.5}
        pressBehavior={dismissOnBackdropTap ? 'close' : 'none'}
      />
    ),
    [dismissOnBackdropTap],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={resolvedSnaps}
      enableDynamicSizing={enableDynamicSizing}
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={showHandle ? styles.handle : styles.handleHidden}
      handleStyle={showHandle ? styles.handleArea : styles.handleHidden}
      keyboardBehavior={keyboardBehavior}
      keyboardBlurBehavior={keyboardBlurBehavior}
      android_keyboardInputMode="adjustResize"
      enablePanDownToClose
    >
      {title ? (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}
      {children}
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  handle: {
    backgroundColor: colors.borderAlt,
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  handleArea: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  handleHidden: {
    height: 0,
    paddingVertical: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
});
