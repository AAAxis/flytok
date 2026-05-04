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
  type BottomSheetFooterProps,
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

  /**
   * Pin the sheet to its content height instead of using snapPoints.
   * Note: gorhom v4 doesn't have a true content-sized mode the way v5 does;
   * we approximate by using a tall snap point and letting children sit at
   * the top with their natural height.
   */
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

  /**
   * Optional sticky footer rendered via gorhom's `BottomSheetFooter`. Use
   * for chat-style composers that must sit just above the keyboard — gorhom
   * animates the footer with `animatedFooterPosition` so it tracks the
   * keyboard regardless of the inner scroll content.
   */
  footerComponent?: (props: BottomSheetFooterProps) => ReactNode;

  children: ReactNode;
};

/**
 * Brand-styled wrapper around `@gorhom/bottom-sheet`'s `BottomSheetModal`.
 *
 * Designed to make migrations from raw `<Modal>` mechanical: callers keep
 * their `visible`/`onClose` props and pass content as children. Snap points
 * default to a single 70% stop; pass `enableDynamicSizing` for content-sized
 * sheets (settings/report — implemented as a 50% snap on v4) or custom
 * `snapPoints` for taller layouts (comments / AI).
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
    footerComponent,
    children,
  },
  ref,
) {
  const sheetRef = useRef<BottomSheetModal>(null);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  // Drive present/dismiss off the controlled `visible` prop. Defer one frame
  // so the BottomSheetModal has time to register with BottomSheetModalProvider
  // before we call into it — gorhom registers in its mount effect, so calling
  // present() in the same tick the parent flips `visible` can race.
  useEffect(() => {
    if (visible) {
      const handle = requestAnimationFrame(() => {
        try {
          sheetRef.current?.present();
        } catch (err) {
          console.warn('[AppBottomSheet] present() failed:', err);
        }
      });
      return () => cancelAnimationFrame(handle);
    }
    try {
      sheetRef.current?.dismiss();
    } catch (err) {
      console.warn('[AppBottomSheet] dismiss() failed:', err);
    }
  }, [visible]);

  const resolvedSnaps = useMemo<(string | number)[]>(() => {
    if (snapPoints && snapPoints.length > 0) return snapPoints;
    // gorhom v4 has no `enableDynamicSizing`; use a moderate 50% snap
    // for "settings-style" sheets and a 70% default for everything else.
    if (enableDynamicSizing) return ['50%'];
    return ['70%'];
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
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={showHandle ? styles.handle : styles.handleHidden}
      handleStyle={showHandle ? styles.handleArea : styles.handleHidden}
      keyboardBehavior={keyboardBehavior}
      keyboardBlurBehavior={keyboardBlurBehavior}
      android_keyboardInputMode="adjustResize"
      enablePanDownToClose
      footerComponent={footerComponent}
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
