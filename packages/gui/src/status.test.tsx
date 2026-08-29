import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Status } from './ui/Status';
import { Skeleton } from './ui/Skeleton';

describe('Status component', () => {
  it('renders connected with a visible text label (not color-only)', () => {
    render(<Status status="connected" />);
    const el = screen.getByRole('status');
    expect(el).toHaveTextContent('Connected');
    expect(el).toBeInTheDocument();
    // The visible text is the accessible indicator — never color alone.
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('renders the canonical labels for every supported status', () => {
    const cases: Array<[string, string]> = [
      ['connected', 'Connected'],
      ['attention', 'Attention'],
      ['failed', 'Failed'],
      ['disabled', 'Disabled'],
      ['not-verified', 'Not verified'],
    ];
    for (const [status, label] of cases) {
      const { unmount } = render(<Status status={status as never} />);
      expect(screen.getByRole('status')).toHaveTextContent(label);
      unmount();
    }
  });

  it('honors a custom label override', () => {
    render(<Status status="connected" label="Live" />);
    expect(screen.getByRole('status')).toHaveTextContent('Live');
  });

  it('falls back to the raw status string for unknown states', () => {
    render(<Status status="degraded" />);
    expect(screen.getByRole('status')).toHaveTextContent('degraded');
  });

  it('renders a status dot alongside the label (not color-only)', () => {
    render(<Status status="attention" />);
    const status = screen.getByRole('status');
    // The dot is present (decorative / aria-hidden) so state is not conveyed
    // by color alone in the accessibility tree.
    expect(status.querySelectorAll('.status-dot').length).toBe(1);
  });
});

describe('Skeleton component', () => {
  it('renders a content-shaped placeholder marked aria-hidden', () => {
    const { container } = render(<Skeleton width={120} height={16} />);
    const sk = container.querySelector('.skeleton');
    expect(sk).toBeInTheDocument();
    expect(sk).toHaveAttribute('aria-hidden', 'true');
    expect(sk).toHaveStyle({ width: '120px', height: '16px' });
  });
});
