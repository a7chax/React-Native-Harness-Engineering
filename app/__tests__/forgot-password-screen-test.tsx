import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { EMAIL_ERROR } from '../../lib/authValidation';

jest.mock('expo-router', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Link: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
  };
});

import ForgotPasswordScreen from '../forgot-password';

describe('ForgotPasswordScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the screen, email field, and submit button', () => {
    const { getByTestId } = render(<ForgotPasswordScreen />);
    expect(getByTestId('forgot-screen')).toBeTruthy();
    expect(getByTestId('forgot-email-input')).toBeTruthy();
    expect(getByTestId('forgot-submit-button')).toBeTruthy();
  });

  it('shows no error or success initially', () => {
    const { queryByTestId } = render(<ForgotPasswordScreen />);
    expect(queryByTestId('forgot-email-error')).toBeNull();
    expect(queryByTestId('forgot-success')).toBeNull();
  });

  it('shows the email error and no success on empty submit', () => {
    const { getByTestId, getByText, queryByTestId } = render(<ForgotPasswordScreen />);
    fireEvent.press(getByTestId('forgot-submit-button'));
    expect(getByText(EMAIL_ERROR)).toBeTruthy();
    expect(queryByTestId('forgot-success')).toBeNull();
  });

  it('shows the success message after submitting a valid email', () => {
    const { getByTestId } = render(<ForgotPasswordScreen />);
    fireEvent.changeText(getByTestId('forgot-email-input'), 'john@example.com');
    fireEvent.press(getByTestId('forgot-submit-button'));
    expect(getByTestId('forgot-success')).toBeTruthy();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<ForgotPasswordScreen />);
    expect(toJSON()).toMatchSnapshot();
  });
});
