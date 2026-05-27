import { useRouter } from 'expo-router';

import { RegisterForm } from '@/components/RegisterForm';
import { AuthScreen } from '@/components/ui/AuthScreen';

export default function RegisterScreen() {
  const router = useRouter();

  return (
    <AuthScreen testID="register-screen" title="Create account" subtitle="Sign up to get started">
      {/* Mock auth: a valid submission "creates the account" and lands on Home. */}
      <RegisterForm showTitle={false} onSubmit={() => router.replace('/home')} />
    </AuthScreen>
  );
}
