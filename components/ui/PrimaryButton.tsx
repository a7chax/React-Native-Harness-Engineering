import { StyleSheet, Text, TouchableOpacity } from 'react-native';

interface PrimaryButtonProps {
  testID: string;
  title: string;
  onPress: () => void;
  disabled?: boolean;
}

export function PrimaryButton({ testID, title, onPress, disabled }: PrimaryButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, disabled ? styles.buttonDisabled : null]}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      activeOpacity={0.8}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={testID}>
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    marginTop: 12,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#0a7ea4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
