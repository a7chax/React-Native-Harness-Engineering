import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type KeyboardTypeOptions,
} from 'react-native';

import {
  type RegisterFormErrors,
  type RegisterFormValues,
  isRegisterFormValid,
  validateRegisterForm,
} from './validation';

type FieldKey = keyof RegisterFormValues;

interface RegisterFormProps {
  onSubmit?: (values: RegisterFormValues) => void;
  /** Show the built-in "Create Account" heading. Defaults to true. */
  showTitle?: boolean;
}

interface FieldOptions {
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'words';
}

const EMPTY_VALUES: RegisterFormValues = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
};

const ALL_TOUCHED: Record<FieldKey, boolean> = {
  name: true,
  email: true,
  password: true,
  confirmPassword: true,
};

// `confirmPassword` -> `confirm-password` so testIDs stay readable / kebab-cased.
const testIdBase = (field: FieldKey) =>
  `register-${field === 'confirmPassword' ? 'confirm-password' : field}`;

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSubmit, showTitle = true }) => {
  const [values, setValues] = useState<RegisterFormValues>(EMPTY_VALUES);
  const [touched, setTouched] = useState<Record<FieldKey, boolean>>({
    name: false,
    email: false,
    password: false,
    confirmPassword: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [success, setSuccess] = useState(false);

  const errors = useMemo<RegisterFormErrors>(() => validateRegisterForm(values), [values]);

  const handleChange = (field: FieldKey) => (text: string) => {
    setValues((prev) => ({ ...prev, [field]: text }));
    setTouched((prev) => ({ ...prev, [field]: true }));
    setSuccess(false);
  };

  const handleSubmit = () => {
    setSubmitted(true);
    setTouched(ALL_TOUCHED);

    if (isRegisterFormValid(errors)) {
      onSubmit?.(values);
      setSuccess(true);
    } else {
      setSuccess(false);
    }
  };

  // Only surface a field's error once the user has touched it or tried to submit.
  const errorFor = (field: FieldKey) =>
    touched[field] || submitted ? errors[field] : null;

  const renderField = (field: FieldKey, label: string, options: FieldOptions) => {
    const error = errorFor(field);
    const base = testIdBase(field);

    return (
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          style={[styles.input, error ? styles.inputError : null]}
          value={values[field]}
          onChangeText={handleChange(field)}
          placeholder={options.placeholder}
          placeholderTextColor="#999"
          secureTextEntry={options.secureTextEntry}
          keyboardType={options.keyboardType}
          autoCapitalize={options.autoCapitalize ?? 'none'}
          autoCorrect={false}
          testID={`${base}-input`}
          accessibilityLabel={`${base}-input`}
        />
        {error ? (
          <Text style={styles.errorText} testID={`${base}-error`}>
            {error}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container} testID="register-form">
      {showTitle ? <Text style={styles.title}>Create Account</Text> : null}
      {renderField('name', 'Full name', {
        placeholder: 'Enter your full name',
        autoCapitalize: 'words',
      })}
      {renderField('email', 'Email', {
        placeholder: 'Enter your email',
        keyboardType: 'email-address',
      })}
      {renderField('password', 'Password', {
        placeholder: 'Create a password',
        secureTextEntry: true,
      })}
      {renderField('confirmPassword', 'Confirm password', {
        placeholder: 'Re-enter your password',
        secureTextEntry: true,
      })}

      <TouchableOpacity
        style={styles.button}
        onPress={handleSubmit}
        testID="register-submit-button"
        accessibilityRole="button"
        accessibilityLabel="register-submit-button">
        <Text style={styles.buttonText}>Register</Text>
      </TouchableOpacity>

      {success ? (
        <Text style={styles.successText} testID="register-success">
          Account created successfully!
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  field: {
    marginVertical: 6,
    width: '100%',
  },
  label: {
    fontSize: 13,
    color: '#444',
    marginBottom: 4,
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
  button: {
    marginTop: 10,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#0a7ea4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  successText: {
    color: 'green',
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
  },
});
