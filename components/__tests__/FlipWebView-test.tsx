import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { FlipWebView } from '../FlipWebView';

// Mock the webview because it uses native modules that Jest cannot load
jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return {
    WebView: View,
  };
});

describe('FlipWebView Component', () => {
  it('renders correctly', () => {
    const { getByTestId } = render(<FlipWebView />);
    expect(getByTestId('open-flip-button')).toBeTruthy();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<FlipWebView />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('opens and closes the modal', () => {
    const { getByTestId, queryByTestId } = render(<FlipWebView />);
    
    // Note: React Native Modal behaves specially in tests. 
    // In React Native Testing Library, it usually doesn't render its children 
    // until 'visible' is true, or we might need to mock it. 
    // Assuming standard behavior for now.

    // Click to open
    fireEvent.press(getByTestId('open-flip-button'));
    
    // Modal and WebView should be visible
    expect(getByTestId('flip-modal')).toBeTruthy();
    expect(getByTestId('flip-webview')).toBeTruthy();
    
    // Click to close
    fireEvent.press(getByTestId('close-flip-button'));
    
    // Depending on the test renderer, Modal children might still be in the tree 
    // but with visible=false, or unmounted entirely.
    const modal = queryByTestId('flip-modal');
    if (modal) {
      expect(modal.props.visible).toBe(false);
    } else {
      expect(modal).toBeNull();
    }
  });
});
