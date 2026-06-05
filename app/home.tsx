import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AuthScreen } from '@/components/ui/AuthScreen';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import type { SeedEntry } from '@/lib/storage/demoData';
import {
  seedDemoStorage,
  type DemoStorageSnapshot,
} from '@/lib/storage/seedDemoStorage';

export default function HomeScreen() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<DemoStorageSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Seed MMKV once when the authenticated Home screen mounts.
    try {
      setSnapshot(seedDemoStorage());
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Failed to seed MMKV. Run a native build to enable the native module.',
      );
    }
  }, []);

  return (
    <AuthScreen testID="home-screen" title="Home" subtitle="You're signed in.">
      <ThemedText testID="home-welcome" type="subtitle">
        You&apos;re logged in 🎉
      </ThemedText>

      {error ? (
        <ThemedText testID="mmkv-error" style={styles.error}>
          {error}
        </ThemedText>
      ) : null}

      {snapshot ? (
        <View testID="mmkv-demo" style={styles.demo}>
          <StorageSection
            title={`Encrypted (${snapshot.encrypted.length})`}
            prefix="encrypted"
            entries={snapshot.encrypted}
          />
          <StorageSection
            title={`Plain (${snapshot.plain.length})`}
            prefix="plain"
            entries={snapshot.plain}
          />
        </View>
      ) : null}

      <PrimaryButton
        testID="logout-button"
        title="Log out"
        onPress={() => router.replace('/')}
      />
    </AuthScreen>
  );
}

interface StorageSectionProps {
  title: string;
  prefix: 'encrypted' | 'plain';
  entries: SeedEntry[];
}

function StorageSection({ title, prefix, entries }: StorageSectionProps) {
  return (
    <View style={styles.section} testID={`mmkv-${prefix}-section`}>
      <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      {entries.map(({ key, value }) => (
        <View key={key} style={styles.row} testID={`mmkv-${prefix}-${key}`}>
          <ThemedText style={styles.key}>{key}</ThemedText>
          <ThemedText style={styles.value} numberOfLines={1}>
            {value}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  demo: {
    marginTop: 16,
    gap: 20,
  },
  section: {
    gap: 6,
  },
  sectionTitle: {
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  key: {
    opacity: 0.7,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
  },
  error: {
    marginTop: 8,
    color: '#c0392b',
  },
});
