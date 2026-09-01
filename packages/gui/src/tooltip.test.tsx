import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Tooltip } from './ui';

/**
 * Tooltip (audit A9) — behavioral contract:
 * - Keyboard focus opens instantly, blur closes, and the tip is linked
 *   via aria-describedby so screen readers announce it.
 * - The child's native `title` is suppressed (no double tooltips).
 * - Long-press on touch opens the tip; a quick tap does not.
 * - Esc closes an open tip.
 */

describe('Tooltip', () => {
  it('shows the hint on keyboard focus and links it to the trigger', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Edit the raw config file">
        <button type="button">Edit</button>
      </Tooltip>
    );

    const trigger = screen.getByRole('button', { name: 'Edit' });
    await user.tab(); // keyboard focus → :focus-visible matches in jsdom

    const tip = await screen.findByRole('tooltip');
    expect(tip).toHaveTextContent('Edit the raw config file');
    // linked for screen readers
    expect(trigger).toHaveAttribute('aria-describedby', tip.id);
  });

  it('mirrors string content into the native title (queryable + AT fallback)', () => {
    render(
      <Tooltip content="Copy model id">
        <button type="button">X</button>
      </Tooltip>
    );
    expect(screen.getByRole('button', { name: 'X' })).toHaveAttribute('title', 'Copy model id');
  });

  it('hides on blur', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <>
        <Tooltip content="hint text">
          <button type="button">Edit</button>
        </Tooltip>
        <button type="button">Elsewhere</button>
      </>
    );

    await user.tab();
    await screen.findByRole('tooltip');
    await user.tab(); // focus moves away
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument(), {
      timeout: 1500,
    });
    expect(container).toBeTruthy();
  });

  it('opens after a long-press (touch) but not on a quick tap', async () => {
    render(
      <Tooltip content="touch hint">
        <button type="button">Edit</button>
      </Tooltip>
    );

    const trigger = screen.getByRole('button', { name: 'Edit' });
    // Quick tap: fires touchstart → click → touchend before the 500ms
    // touch threshold. (userEvent's click also dispatches hover events,
    // which open the tip via the hover path in jsdom — so we assert the
    // TOUCH path alone here: no tip before the long-press timer fires.)
    fireEvent.touchStart(trigger);
    fireEvent.touchEnd(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // Long-press: touchstart, wait past 500ms, then touchend.
    fireEvent.touchStart(trigger);
    await act(() => new Promise((r) => setTimeout(r, 600)));
    fireEvent.touchEnd(trigger);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('touch hint');
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="esc hint">
        <button type="button">Edit</button>
      </Tooltip>
    );
    await user.tab();
    await screen.findByRole('tooltip');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  });
});
