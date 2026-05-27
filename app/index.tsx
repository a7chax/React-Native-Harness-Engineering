import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Link, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AuthScreen } from '@/components/ui/AuthScreen';
import { FormTextInput } from '@/components/ui/FormTextInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import {
  PASSWORD_REQUIRED_ERROR,
  validateEmail,
  validateRequired,
} from '@/lib/authValidation';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const emailError = validateEmail(email);
  const passwordError = validateRequired(password, PASSWORD_REQUIRED_ERROR);

  const handleSubmit = () => {
    setSubmitted(true);
    if (!emailError && !passwordError) {
      // Mock auth: any valid email + non-empty password "logs in".
      router.replace('/home');
    }
  };

  return (
    <AuthScreen testID="login-screen" title="Welcome back" subtitle="Log in to continue">
      <FormTextInput
        testID="login-email"
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={submitted ? emailError : null}
        placeholder="you@example.com"
        keyboardType="email-address"
      />
      <FormTextInput
        testID="login-password"
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={submitted ? passwordError : null}
        placeholder="Your password"
        secureTextEntry
      />
      <PrimaryButton testID="login-submit-button" title="Log in" onPress={handleSubmit} />

      <Link href="/forgot-password" asChild>
        <Pressable testID="login-to-forgot" accessibilityRole="link" style={styles.link}>
          <ThemedText type="link">Forgot password?</ThemedText>
        </Pressable>
      </Link>
      <Link href="/register" asChild>
        <Pressable testID="login-to-register" accessibilityRole="link" style={styles.link}>
          <ThemedText type="link">Create an account</ThemedText>
        </Pressable>
      </Link>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  link: {
    marginTop: 16,
    alignItems: 'center',
  },
});
