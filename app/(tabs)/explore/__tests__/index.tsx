import { fireEvent, render } from '@testing-library/react-native';
import ExploreScreen from '..';

jest.mock('@/components/parallax-scroll-view', () => {
  const React = require('react');
  const { View } = require('react-native');

  return ({ children }: { children?: React.ReactNode }) => <View>{children}</View>;
});

jest.mock('@/components/external-link', () => {
  const React = require('react');

  return {
    ExternalLink: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  };
});

test('shows intro text', () => {
  const { getByText } = render(<ExploreScreen />);

  expect(getByText('This app includes example code to help you get started.')).toBeTruthy();
});



describe("testing the accordion", () => {
    test('should open the accordion', () => {
        const { getByText } = render(<ExploreScreen />);
        const accordion = getByText('File-based routing');
        fireEvent.press(accordion);
        expect(accordion).toHaveTextContent('File-based routing');
        const content = getByText('This app has two screens: app/(tabs)/index.tsx and app/(tabs)/explore/index.tsx');
        expect(content).toBeTruthy();
    })
})