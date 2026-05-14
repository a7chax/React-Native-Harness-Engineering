import React, { useState } from 'react';
import { TextInput, View, Text, StyleSheet } from 'react-native';

interface EmailInputProps {
  value: string;
  onChangeText: (text: string) => void;
}

const validateEmail = (email: string) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

export const EmailInput: React.FC<EmailInputProps> = ({ value, onChangeText }) => {
  const [error, setError] = useState<string | null>(null);

  const handleTextChange = (text: string) => {
    onChangeText(text);
    if (text.length > 0 && !validateEmail(text)) {
      setError('Invalid email format');
    } else {
      setError(null);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={[styles.input, error && styles.inputError]}
        value={value}
        onChangeText={handleTextChange}
        placeholder="Enter your email"
        placeholderTextColor="#999"
        keyboardType="email-address"
        autoCapitalize="none"
        testID="email-input"
        accessibilityLabel="email-input"
      />
      {error && (
        <Text style={styles.errorText} testID="email-error">
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    width: '100%',
  },
  input: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    color: '#000',
  },
  inputError: {
    borderColor: 'red',
  },
  errorText: {
    color: 'red',
    marginTop: 5,
    fontSize: 12,
  },
});
