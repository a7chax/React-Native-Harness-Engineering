import { render } from '@testing-library/react-native';
import ExploreScreen from '..';

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
