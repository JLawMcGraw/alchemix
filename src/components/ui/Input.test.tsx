import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './Input';

describe('Input', () => {
  it('should render input field', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('should render with label', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('should call onChange when value changes', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(<Input onChange={handleChange} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'test');

    expect(handleChange).toHaveBeenCalled();
  });

  it('should display error message', () => {
    render(<Input error="This field is required" />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('should apply error styling when error is present', () => {
    render(<Input error="Error message" />);
    const input = screen.getByRole('textbox');
    expect(input.className).toContain('error');
  });

  it('should support different input types', () => {
    const { rerender } = render(<Input type="text" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'text');

    rerender(<Input type="email" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');

    rerender(<Input type="password" />);
    const passwordInput = document.querySelector('input[type="password"]');
    expect(passwordInput).toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('should support controlled input', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    const { rerender } = render(
      <Input value="initial" onChange={handleChange} />
    );

    expect(screen.getByRole('textbox')).toHaveValue('initial');

    rerender(<Input value="updated" onChange={handleChange} />);
    expect(screen.getByRole('textbox')).toHaveValue('updated');
  });

  // TODO: Implement required indicator feature
  // it('should display required indicator', () => {
  //   render(<Input label="Name" required />);
  //   expect(screen.getByText(/\*/)).toBeInTheDocument();
  // });

  // TODO: Implement helperText prop feature
  // it('should support helper text', () => {
  //   render(<Input helperText="Enter your email address" />);
  //   expect(screen.getByText('Enter your email address')).toBeInTheDocument();
  // });

  it('should support maxLength attribute', () => {
    render(<Input maxLength={10} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '10');
  });

  it('should support autoComplete attribute', () => {
    render(<Input autoComplete="email" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('autoComplete', 'email');
  });

  it('should focus input when autoFocus is true', () => {
    render(<Input autoFocus />);
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  // TODO: Implement clearable feature
  // it('should clear input value', async () => {
  //   const handleChange = vi.fn();
  //   const user = userEvent.setup();

  //   render(<Input onChange={handleChange} clearable />);

  //   const input = screen.getByRole('textbox');
  //   await user.type(input, 'test');

  //   const clearButton = screen.getByRole('button', { name: /clear/i });
  //   await user.click(clearButton);

  //   expect(input).toHaveValue('');
  // });

  // TODO: Implement showPasswordToggle feature
  // it('should toggle password visibility', async () => {
  //   const user = userEvent.setup();

  //   render(<Input type="password" showPasswordToggle />);

  //   const input = document.querySelector('input');
  //   expect(input).toHaveAttribute('type', 'password');

  //   const toggleButton = screen.getByRole('button', { name: /show password/i });
  //   await user.click(toggleButton);

  //   expect(input).toHaveAttribute('type', 'text');
  // });

  // TODO: Implement prefixIcon feature
  // it('should support input with prefix icon', () => {
  //   const Icon = () => <span data-testid="prefix-icon">@</span>;
  //   render(<Input prefixIcon={<Icon />} />);
  //   expect(screen.getByTestId('prefix-icon')).toBeInTheDocument();
  // });

  // TODO: Implement suffixIcon feature
  // it('should support input with suffix icon', () => {
  //   const Icon = () => <span data-testid="suffix-icon">✓</span>;
  //   render(<Input suffixIcon={<Icon />} />);
  //   expect(screen.getByTestId('suffix-icon')).toBeInTheDocument();
  // });

  it('should validate input on blur', async () => {
    const handleBlur = vi.fn();
    const user = userEvent.setup();

    render(<Input onBlur={handleBlur} />);

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.tab();

    expect(handleBlur).toHaveBeenCalled();
  });

  it('should be accessible with aria-describedby for error', () => {
    render(<Input error="Error message" aria-describedby="error-id" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-describedby');
  });

  it('should support number input with min and max', () => {
    render(<Input type="number" min={0} max={100} />);
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('max', '100');
  });
});
