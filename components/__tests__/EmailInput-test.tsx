import React, { useState } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { EmailInput } from '../EmailInput';

// Wrapper component to manage state during testing
const EmailInputWrapper = () => {
  const [email, setEmail] = useState('');
  return <EmailInput value={email} onChangeText={setEmail} />;
};

describe('EmailInput Component', () => {
  it('renders correctly', () => {
    const { getByTestId } = render(<EmailInputWrapper />);
    expect(getByTestId('email-input')).toBeTruthy();
  });

  it('does not show error initially', () => {
    const { queryByTestId } = render(<EmailInputWrapper />);
    expect(queryByTestId('email-error')).toBeNull();
  });

  it('shows error on invalid email', () => {
    const { getByTestId } = render(<EmailInputWrapper />);
    const input = getByTestId('email-input');
    
    fireEvent.changeText(input, 'invalidemail');
    
    expect(getByTestId('email-error')).toBeTruthy();
    expect(getByTestId('email-error').props.children).toBe('Invalid email format');
  });

  it('hides error when email becomes valid', () => {
    const { getByTestId, queryByTestId } = render(<EmailInputWrapper />);
    const input = getByTestId('email-input');
    
    // Make it invalid first
    fireEvent.changeText(input, 'invalidemail');
    expect(getByTestId('email-error')).toBeTruthy();
    
    // Make it valid
    fireEvent.changeText(input, 'test@example.com');
    expect(queryByTestId('email-error')).toBeNull();
  });

  it('hides error when input is cleared', () => {
    const { getByTestId, queryByTestId } = render(<EmailInputWrapper />);
    const input = getByTestId('email-input');
    
    fireEvent.changeText(input, 'invalidemail');
    expect(getByTestId('email-error')).toBeTruthy();
    
    fireEvent.changeText(input, '');
    expect(queryByTestId('email-error')).toBeNull();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<EmailInputWrapper />);
    expect(toJSON()).toMatchSnapshot();
  });
});
