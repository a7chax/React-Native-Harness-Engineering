import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AuthScreen } from '@/components/ui/AuthScreen';
import { PrimaryButton } from '@/components/ui/PrimaryButton';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <AuthScreen testID="home-screen" title="Home" subtitle="You're signed in.">
      <ThemedText testID="home-welcome" type="subtitle">
        You're logged in 🎉
      </ThemedText>
      <PrimaryButton
        testID="logout-button"
        title="Log out"
        onPress={() => router.replace('/')}
      />
    </AuthScreen>
  );
}
