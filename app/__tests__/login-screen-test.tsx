import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { EMAIL_ERROR, PASSWORD_REQUIRED_ERROR } from '../../lib/authValidation';

const mockReplace = jest.fn();

jest.mock('expo-router', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
    Link: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
  };
});

import LoginScreen from '../index';

describe('LoginScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders email/password fields and the submit button', () => {
    const { getByTestId } = render(<LoginScreen />);
    expect(getByTestId('login-screen')).toBeTruthy();
    expect(getByTestId('login-email-input')).toBeTruthy();
    expect(getByTestId('login-password-input')).toBeTruthy();
    expect(getByTestId('login-submit-button')).toBeTruthy();
  });

  it('shows no errors initially', () => {
    const { queryByTestId } = render(<LoginScreen />);
    expect(queryByTestId('login-email-error')).toBeNull();
    expect(queryByTestId('login-password-error')).toBeNull();
  });

  it('shows validation errors and does not navigate on empty submit', () => {
    const { getByTestId, getByText } = render(<LoginScreen />);
    fireEvent.press(getByTestId('login-submit-button'));
    expect(getByText(EMAIL_ERROR)).toBeTruthy();
    expect(getByText(PASSWORD_REQUIRED_ERROR)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('navigates to /home on a valid login', () => {
    const { getByTestId } = render(<LoginScreen />);
    fireEvent.changeText(getByTestId('login-email-input'), 'john@example.com');
    fireEvent.changeText(getByTestId('login-password-input'), 'secret123');
    fireEvent.press(getByTestId('login-submit-button'));
    expect(mockReplace).toHaveBeenCalledWith('/home');
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<LoginScreen />);
    expect(toJSON()).toMatchSnapshot();
  });
});
