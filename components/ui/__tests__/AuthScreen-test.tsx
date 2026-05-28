import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { render } from '@testing-library/react-native';

// Mock the window-size source so we can simulate small (phone) and large
// (tablet) devices. useWindowDimensions is re-read on every render, so each
// test just sets the value before rendering.
const mockUseWindowDimensions = jest.fn();
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockUseWindowDimensions(),
}));

import { AuthScreen } from '../AuthScreen';

const PHONE = { width: 390, height: 844, scale: 3, fontScale: 1 }; // iPhone 14
const SMALL = { width: 320, height: 568, scale: 2, fontScale: 1 }; // iPhone SE
const TABLET = { width: 1024, height: 1366, scale: 2, fontScale: 1 }; // iPad Pro 12.9"

function renderScene() {
  return render(
    <AuthScreen testID="auth-screen" title="Sign in" subtitle="Welcome back">
      <Text testID="auth-child">child content</Text>
    </AuthScreen>,
  );
}

describe('AuthScreen — responsive layout', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the single-column (narrow) layout on a phone', () => {
    mockUseWindowDimensions.mockReturnValue(PHONE);
    const { getByTestId, queryByTestId } = renderScene();

    expect(getByTestId('auth-screen')).toBeTruthy();
    expect(getByTestId('auth-content-narrow')).toBeTruthy();
    expect(queryByTestId('auth-content-wide')).toBeNull();
    // narrow content fills the width; it is NOT constrained.
    expect(StyleSheet.flatten(getByTestId('auth-content-narrow').props.style).maxWidth).toBeUndefined();
  });

  it('renders the same narrow layout on a very small phone (iPhone SE)', () => {
    mockUseWindowDimensions.mockReturnValue(SMALL);
    const { getByTestId, queryByTestId } = renderScene();

    expect(getByTestId('auth-content-narrow')).toBeTruthy();
    expect(queryByTestId('auth-content-wide')).toBeNull();
  });

  it('renders the constrained, centered (wide) layout on a large device (tablet)', () => {
    mockUseWindowDimensions.mockReturnValue(TABLET);
    const { getByTestId, queryByTestId } = renderScene();

    expect(getByTestId('auth-screen')).toBeTruthy();
    expect(getByTestId('auth-content-wide')).toBeTruthy();
    expect(queryByTestId('auth-content-narrow')).toBeNull();

    // wide content is capped and centered so the form doesn't stretch edge-to-edge.
    const wideStyle = StyleSheet.flatten(getByTestId('auth-content-wide').props.style);
    expect(typeof wideStyle.maxWidth).toBe('number');
    expect(wideStyle.maxWidth).toBeLessThan(TABLET.width);
    expect(wideStyle.alignSelf).toBe('center');
  });

  it('keeps the children rendered in both layouts', () => {
    mockUseWindowDimensions.mockReturnValue(PHONE);
    expect(renderScene().getByTestId('auth-child')).toBeTruthy();

    jest.clearAllMocks();
    mockUseWindowDimensions.mockReturnValue(TABLET);
    expect(renderScene().getByTestId('auth-child')).toBeTruthy();
  });

  describe('breakpoint boundary (768)', () => {
    it('stays narrow at 767px', () => {
      mockUseWindowDimensions.mockReturnValue({ ...PHONE, width: 767 });
      expect(renderScene().getByTestId('auth-content-narrow')).toBeTruthy();
    });

    it('switches to wide at exactly 768px', () => {
      mockUseWindowDimensions.mockReturnValue({ ...PHONE, width: 768 });
      expect(renderScene().getByTestId('auth-content-wide')).toBeTruthy();
    });
  });
});
