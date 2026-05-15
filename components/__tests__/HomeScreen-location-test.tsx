import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import HomeScreen from '../../app/(tabs)/index';

const mockRequestAuthorization = jest.fn();
const mockGetCurrentPosition = jest.fn();

jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: {
    requestAuthorization: (...args: unknown[]) => mockRequestAuthorization(...args),
    getCurrentPosition: (...args: unknown[]) => mockGetCurrentPosition(...args),
  },
}));

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockMapView = ({ children }: { children?: React.ReactNode }) => <View testID="mock-map">{children}</View>;
  const MockMarker = () => <View testID="mock-marker" />;

  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMarker,
  };
});

jest.mock('expo-image', () => ({
  Image: () => null,
}));

jest.mock('expo-router', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');

  const Link = ({ children }: { children?: React.ReactNode }) => <View>{children}</View>;
  Link.Trigger = ({ children }: { children?: React.ReactNode }) => <View>{children}</View>;
  Link.Preview = () => <View />;
  Link.Menu = ({ children }: { children?: React.ReactNode }) => <View>{children}</View>;
  Link.MenuAction = ({ title, onPress }: { title: string; onPress?: () => void }) => (
    <Pressable onPress={onPress}>
      <Text>{title}</Text>
    </Pressable>
  );

  return { Link };
});

jest.mock('../../components/parallax-scroll-view', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ children }: { children?: React.ReactNode }) => <View>{children}</View>;
});

jest.mock('../../components/hello-wave', () => ({
  HelloWave: () => null,
}));

jest.mock('../../components/themed-text', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    ThemedText: ({ children }: { children?: React.ReactNode }) => <Text>{children}</Text>,
  };
});

jest.mock('../../components/themed-view', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    ThemedView: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock('../../components/EmailInput', () => ({
  EmailInput: () => null,
}));

jest.mock('../../components/FlipWebView', () => ({
  FlipWebView: () => null,
}));

jest.mock('../../components/TextHelloWorld', () => () => null);

describe('HomeScreen geolocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows an error when permission is denied', async () => {
    mockRequestAuthorization.mockImplementation((onSuccess: () => void, onError: () => void) => {
      onError();
    });

    const { getByText } = render(<HomeScreen />);

    fireEvent.press(getByText('Load last known location'));

    await waitFor(() => {
      expect(getByText('Location permission was denied.')).toBeTruthy();
    });
  });

  it('shows coordinates when permission is granted and geolocation resolves', async () => {
    mockRequestAuthorization.mockImplementation((onSuccess: () => void) => {
      onSuccess();
    });
    mockGetCurrentPosition.mockImplementation((onSuccess: (position: unknown) => void) => {
      onSuccess({
        coords: {
          latitude: -6.2000012,
          longitude: 106.8166667,
        },
      });
    });

    const { getByText } = render(<HomeScreen />);

    fireEvent.press(getByText('Load last known location'));

    await waitFor(() => {
      expect(getByText('Lat: -6.200001, Lng: 106.816667')).toBeTruthy();
    });
  });
});
