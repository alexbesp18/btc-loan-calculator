import { render, screen } from '@testing-library/react';
import App from './App';

test('renders main heading when authorized', () => {
  window.localStorage.setItem('authorized', 'true');
  render(<App />);
  const headingElement = screen.getByText(/Inputs & Controls/i);
  expect(headingElement).toBeInTheDocument();
  window.localStorage.removeItem('authorized');
});
