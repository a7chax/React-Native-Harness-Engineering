import React, { useState } from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { FormTextInput } from '../FormTextInput';

const Wrapper = ({ error }: { error?: string | null }) => {
  const [value, setValue] = useState('');
  return (
    <FormTextInput
      testID="field"
      label="Email"
      value={value}
      onChangeText={setValue}
      error={error}
      placeholder="Enter email"
    />
  );
};

describe('FormTextInput', () => {
  it('renders the label and input', () => {
    const { getByTestId, getByText } = render(<Wrapper />);
    expect(getByTestId('field-input')).toBeTruthy();
    expect(getByText('Email')).toBeTruthy();
  });

  it('does not render an error when error is null', () => {
    const { queryByTestId } = render(<Wrapper error={null} />);
    expect(queryByTestId('field-error')).toBeNull();
  });

  it('renders the error message when provided', () => {
    const { getByTestId, getByText } = render(<Wrapper error="Bad email" />);
    expect(getByTestId('field-error')).toBeTruthy();
    expect(getByText('Bad email')).toBeTruthy();
  });

  it('calls onChangeText when the user types', () => {
    const onChangeText = jest.fn();
    const { getByTestId } = render(
      <FormTextInput testID="field" label="Email" value="" onChangeText={onChangeText} />
    );
    fireEvent.changeText(getByTestId('field-input'), 'hello');
    expect(onChangeText).toHaveBeenCalledWith('hello');
  });
});
