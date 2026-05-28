import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

/** At/above this width we treat the device as a large screen (tablet/landscape). */
const TABLET_MIN_WIDTH = 768;
/** Large screens get a capped, centered column so the form doesn't stretch edge-to-edge. */
const CONTENT_MAX_WIDTH = 480;

interface AuthScreenProps {
  testID: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/** Themed, scrollable, keyboard-aware container shared by the auth screens. */
export function AuthScreen({ testID, title, subtitle, children }: AuthScreenProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= TABLET_MIN_WIDTH;

  return (
    <ThemedView style={styles.container} testID={testID}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <View
            testID={isWide ? 'auth-content-wide' : 'auth-content-narrow'}
            style={[styles.contentInner, isWide ? styles.contentWide : null]}>
            <ThemedText type="title" style={styles.title}>
              {title}
            </ThemedText>
            {subtitle ? <ThemedText style={styles.subtitle}>{subtitle}</ThemedText> : null}
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 64,
    paddingBottom: 48,
  },
  contentInner: {
    width: '100%',
    gap: 4,
  },
  contentWide: {
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 16,
    opacity: 0.7,
  },
});
