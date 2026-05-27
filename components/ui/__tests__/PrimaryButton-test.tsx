import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { PrimaryButton } from '../PrimaryButton';

describe('PrimaryButton', () => {
  it('renders its title', () => {
    const { getByText, getByTestId } = render(
      <PrimaryButton testID="submit" title="Log in" onPress={() => {}} />
    );
    expect(getByTestId('submit')).toBeTruthy();
    expect(getByText('Log in')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <PrimaryButton testID="submit" title="Log in" onPress={onPress} />
    );
    fireEvent.press(getByTestId('submit'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <PrimaryButton testID="submit" title="Log in" onPress={onPress} disabled />
    );
    fireEvent.press(getByTestId('submit'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
