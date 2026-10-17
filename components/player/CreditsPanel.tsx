import { Linking, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { Track } from '@/lib/music/catalog';

interface CreditsPanelProps {
  track: Track;
  onClose: () => void;
}

const open = (url: string) => {
  // A device without a browser rejects; there is nothing useful to show then.
  Linking.openURL(url).catch(() => {});
};

/**
 * The track's full attribution with its licence and song page links. An
 * absolutely positioned overlay rather than an RN `Modal`, so it stays in the
 * screen's view tree for RNTL and Appium.
 */
export function CreditsPanel({ track, onClose }: CreditsPanelProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const { licenseUrl, pageUrl } = track;

  return (
    <View testID="credits-panel" style={styles.backdrop}>
      <View style={[styles.sheet, { backgroundColor }]}>
        <ThemedText type="subtitle">Credits</ThemedText>
        <ThemedText testID="credits-attribution">{track.attribution}</ThemedText>
        {licenseUrl ? (
          <View style={styles.link}>
            <ThemedText style={styles.label}>Licence</ThemedText>
            <ThemedText
              testID="credits-license-link"
              type="link"
              accessibilityRole="link"
              onPress={() => open(licenseUrl)}>
              {licenseUrl}
            </ThemedText>
          </View>
        ) : null}
        {pageUrl ? (
          <View style={styles.link}>
            <ThemedText style={styles.label}>Song page</ThemedText>
            <ThemedText
              testID="credits-page-link"
              type="link"
              accessibilityRole="link"
              onPress={() => open(pageUrl)}>
              {pageUrl}
            </ThemedText>
          </View>
        ) : null}
        <PrimaryButton testID="credits-close" title="Close" onPress={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheet: {
    padding: 24,
    paddingBottom: 32,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: 12,
  },
  link: {
    gap: 2,
  },
  label: {
    fontSize: 13,
    opacity: 0.7,
  },
});
