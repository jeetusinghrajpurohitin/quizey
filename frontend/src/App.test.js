import { render, screen } from '@testing-library/react';
import React from 'react';

jest.mock(
  'react-router-dom',
  () => ({
    BrowserRouter: ({ children }) => <>{children}</>,
    Link: ({ children, to, ...props }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
    NavLink: ({ children, to, ...props }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
    Navigate: () => null,
    Route: ({ element }) => element,
    Routes: ({ children }) => <>{children}</>,
    useNavigate: () => jest.fn(),
    useParams: () => ({}),
  }),
  { virtual: true }
);

import App from './App';

test('renders hero copy for QuizPulse AI', () => {
  render(<App />);
  expect(screen.getByText(/real-time quizzes/i)).toBeInTheDocument();
});
