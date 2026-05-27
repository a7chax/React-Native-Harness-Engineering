import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));

import RegisterScreen from '../register';

describe('RegisterScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the register form on its own screen', () => {
    const { getByTestId } = render(<RegisterScreen />);
    expect(getByTestId('register-screen')).toBeTruthy();
    expect(getByTestId('register-form')).toBeTruthy();
  });

  it('exposes all register fields and the submit button', () => {
    const { getByTestId } = render(<RegisterScreen />);
    expect(getByTestId('register-name-input')).toBeTruthy();
    expect(getByTestId('register-email-input')).toBeTruthy();
    expect(getByTestId('register-password-input')).toBeTruthy();
    expect(getByTestId('register-confirm-password-input')).toBeTruthy();
    expect(getByTestId('register-submit-button')).toBeTruthy();
  });

  it('navigates to /home after a valid registration', () => {
    const { getByTestId } = render(<RegisterScreen />);
    fireEvent.changeText(getByTestId('register-name-input'), 'John Doe');
    fireEvent.changeText(getByTestId('register-email-input'), 'john@example.com');
    fireEvent.changeText(getByTestId('register-password-input'), 'password1');
    fireEvent.changeText(getByTestId('register-confirm-password-input'), 'password1');
    fireEvent.press(getByTestId('register-submit-button'));
    expect(mockReplace).toHaveBeenCalledWith('/home');
  });
});
