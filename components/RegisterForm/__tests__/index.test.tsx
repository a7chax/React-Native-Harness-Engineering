import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RegisterForm } from '../index';
import {
  CONFIRM_PASSWORD_ERROR,
  EMAIL_ERROR,
  NAME_ERROR,
  PASSWORD_ERROR,
} from '../validation';

const fillValidForm = (getByTestId: ReturnType<typeof render>['getByTestId']) => {
  fireEvent.changeText(getByTestId('register-name-input'), 'John Doe');
  fireEvent.changeText(getByTestId('register-email-input'), 'john@example.com');
  fireEvent.changeText(getByTestId('register-password-input'), 'password1');
  fireEvent.changeText(getByTestId('register-confirm-password-input'), 'password1');
};

describe('RegisterForm', () => {
  it('renders all fields and the submit button', () => {
    const { getByTestId } = render(<RegisterForm />);
    expect(getByTestId('register-name-input')).toBeTruthy();
    expect(getByTestId('register-email-input')).toBeTruthy();
    expect(getByTestId('register-password-input')).toBeTruthy();
    expect(getByTestId('register-confirm-password-input')).toBeTruthy();
    expect(getByTestId('register-submit-button')).toBeTruthy();
  });

  it('shows no errors and no success message initially', () => {
    const { queryByTestId } = render(<RegisterForm />);
    expect(queryByTestId('register-name-error')).toBeNull();
    expect(queryByTestId('register-email-error')).toBeNull();
    expect(queryByTestId('register-password-error')).toBeNull();
    expect(queryByTestId('register-confirm-password-error')).toBeNull();
    expect(queryByTestId('register-success')).toBeNull();
  });

  it('shows an inline error after a field is edited with an invalid value', () => {
    const { getByTestId, getByText } = render(<RegisterForm />);
    fireEvent.changeText(getByTestId('register-email-input'), 'not-an-email');
    expect(getByTestId('register-email-error')).toBeTruthy();
    expect(getByText(EMAIL_ERROR)).toBeTruthy();
  });

  it('clears an inline error once the field becomes valid', () => {
    const { getByTestId, queryByTestId } = render(<RegisterForm />);
    fireEvent.changeText(getByTestId('register-password-input'), 'short');
    expect(getByTestId('register-password-error')).toBeTruthy();
    fireEvent.changeText(getByTestId('register-password-input'), 'password1');
    expect(queryByTestId('register-password-error')).toBeNull();
  });

  it('surfaces the mismatch error when confirmation differs from password', () => {
    const { getByTestId, getByText } = render(<RegisterForm />);
    fireEvent.changeText(getByTestId('register-password-input'), 'password1');
    fireEvent.changeText(getByTestId('register-confirm-password-input'), 'password2');
    expect(getByText(CONFIRM_PASSWORD_ERROR)).toBeTruthy();
  });

  it('shows every error and no success when submitting an empty form', () => {
    const { getByTestId, getByText, queryByTestId } = render(<RegisterForm />);
    fireEvent.press(getByTestId('register-submit-button'));
    expect(getByText(NAME_ERROR)).toBeTruthy();
    expect(getByText(EMAIL_ERROR)).toBeTruthy();
    expect(getByText(PASSWORD_ERROR)).toBeTruthy();
    expect(queryByTestId('register-success')).toBeNull();
  });

  it('calls onSubmit with the values and shows success for a valid submission', () => {
    const onSubmit = jest.fn();
    const { getByTestId, queryByTestId } = render(<RegisterForm onSubmit={onSubmit} />);

    fillValidForm(getByTestId);
    fireEvent.press(getByTestId('register-submit-button'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'password1',
      confirmPassword: 'password1',
    });
    expect(getByTestId('register-success')).toBeTruthy();
    expect(queryByTestId('register-name-error')).toBeNull();
  });

  it('does not call onSubmit for an invalid submission', () => {
    const onSubmit = jest.fn();
    const { getByTestId } = render(<RegisterForm onSubmit={onSubmit} />);
    fireEvent.press(getByTestId('register-submit-button'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<RegisterForm />);
    expect(toJSON()).toMatchSnapshot();
  });
});
