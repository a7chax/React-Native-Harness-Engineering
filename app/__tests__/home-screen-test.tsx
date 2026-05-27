import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockReplace = jest.fn();

jest.mock('expo-router', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
    Link: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
  };
});

import HomeScreen from '../home';

describe('HomeScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the home screen, welcome text, and logout button', () => {
    const { getByTestId } = render(<HomeScreen />);
    expect(getByTestId('home-screen')).toBeTruthy();
    expect(getByTestId('home-welcome')).toBeTruthy();
    expect(getByTestId('logout-button')).toBeTruthy();
  });

  it('logs out to the login screen when the logout button is pressed', () => {
    const { getByTestId } = render(<HomeScreen />);
    fireEvent.press(getByTestId('logout-button'));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<HomeScreen />);
    expect(toJSON()).toMatchSnapshot();
  });
});
