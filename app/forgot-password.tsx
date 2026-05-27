import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Link } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AuthScreen } from '@/components/ui/AuthScreen';
import { FormTextInput } from '@/components/ui/FormTextInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { validateEmail } from '@/lib/authValidation';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sent, setSent] = useState(false);

  const emailError = validateEmail(email);

  const handleSubmit = () => {
    setSubmitted(true);
    if (!emailError) {
      // Mock: any valid email "receives" a reset link.
      setSent(true);
    }
  };

  return (
    <AuthScreen
      testID="forgot-screen"
      title="Reset password"
      subtitle="Enter your email and we'll send you a reset link.">
      <FormTextInput
        testID="forgot-email"
        label="Email"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          setSent(false);
        }}
        error={submitted ? emailError : null}
        placeholder="you@example.com"
        keyboardType="email-address"
      />
      <PrimaryButton testID="forgot-submit-button" title="Send reset link" onPress={handleSubmit} />

      {sent ? (
        <ThemedText testID="forgot-success" style={styles.success}>
          If that email exists, a reset link has been sent.
        </ThemedText>
      ) : null}

      <Link href="/" asChild>
        <Pressable testID="forgot-to-login" accessibilityRole="link" style={styles.link}>
          <ThemedText type="link">Back to login</ThemedText>
        </Pressable>
      </Link>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  success: {
    marginTop: 16,
  },
  link: {
    marginTop: 16,
    alignItems: 'center',
  },
});
