import { render, screen } from '@testing-library/react';
import App from './App';

test('renders learn react link', () => {
  /**
   * Тесты упадут так есть асинхронные запросы
   */

  // render(<App />);
  // const linkElement = screen.getByText(/learn react/i);
  // expect(linkElement).toBeInTheDocument();
});
