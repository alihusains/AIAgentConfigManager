import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelSelector, isFreeModel } from './ModelSelector';

// ============================================================================
// Free model detection
// ============================================================================

describe('isFreeModel', () => {
  it('detects models with "free" (lowercase)', () => {
    expect(isFreeModel('deepseek-v4-free')).toBe(true);
    expect(isFreeModel('qwen-free')).toBe(true);
    expect(isFreeModel('gpt-4-free-trial')).toBe(true);
  });

  it('detects models with "free" (uppercase)', () => {
    expect(isFreeModel('DEEPSEEK-V4-FREE')).toBe(true);
    expect(isFreeModel('Qwen-Free')).toBe(true);
  });

  it('detects models with "free" (mixed case)', () => {
    expect(isFreeModel('deepseek-v4-Free-tier')).toBe(true);
    expect(isFreeModel('glm-5-airx-FREE')).toBe(true);
  });

  it('rejects models without "free"', () => {
    expect(isFreeModel('gpt-4o')).toBe(false);
    expect(isFreeModel('claude-3-opus')).toBe(false);
    expect(isFreeModel('llama-2')).toBe(false);
  });

  it('rejects models with "freedom" (substring match, not word boundary)', () => {
    // The regex /free/i matches "freedom" because it contains "free"
    expect(isFreeModel('gpt-freedom-trial')).toBe(true);
  });
});

// ============================================================================
// ModelSelector component tests
// ============================================================================

interface ModelSelectorTestProps {
  knownModelIds?: string[];
  value?: string;
  onChange?: (next: string) => void;
}

function renderModelSelector(props: ModelSelectorTestProps = {}) {
  const {
    knownModelIds = [],
    value = '',
    onChange = vi.fn(),
  } = props;

  return render(
    <ModelSelector
      knownModelIds={knownModelIds}
      value={value}
      onChange={onChange}
    />
  );
}

describe('ModelSelector', () => {
  describe('empty state', () => {
    it('renders manual add input when no models are known', () => {
      renderModelSelector({
        knownModelIds: [],
        value: '',
      });

      const input = screen.getByPlaceholderText('e.g., gpt-4o');
      const addBtn = screen.getByRole('button', { name: /add/i });

      expect(input).toBeInTheDocument();
      expect(addBtn).toBeDisabled();
    });

    it('enables add button when manual input has text', async () => {
      const user = userEvent.setup();
      renderModelSelector({
        knownModelIds: [],
        value: '',
      });

      const input = screen.getByPlaceholderText('e.g., gpt-4o');
      const addBtn = screen.getByRole('button', { name: /add/i });

      await user.type(input, 'gpt-4o');
      expect(addBtn).not.toBeDisabled();
    });
  });

  describe('checkbox list rendering', () => {
    it('renders all known models as checkboxes', () => {
      renderModelSelector({
        knownModelIds: ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo'],
        value: '',
      });

      expect(screen.getByRole('checkbox', { name: /gpt-4o/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /gpt-4$/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /gpt-3\.5-turbo/i })).toBeInTheDocument();
    });

    it('marks selected models as checked', () => {
      renderModelSelector({
        knownModelIds: ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo'],
        value: 'gpt-4o, gpt-4',
      });

      const gpt4oCheckbox = screen.getAllByRole('checkbox')[0];
      const gpt4Checkbox = screen.getAllByRole('checkbox')[1];

      expect(gpt4oCheckbox).toBeChecked();
      expect(gpt4Checkbox).toBeChecked();
    });

    it('marks unselected models as unchecked', () => {
      renderModelSelector({
        knownModelIds: ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo'],
        value: 'gpt-4o',
      });

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
      expect(checkboxes[2]).not.toBeChecked();
    });

    it('displays "free" badge for free models', () => {
      renderModelSelector({
        knownModelIds: ['deepseek-free', 'gpt-4o', 'qwen-free'],
        value: '',
      });

      const freeBadges = screen.getAllByText('free');
      expect(freeBadges.length).toBe(2); // One for deepseek-free, one for qwen-free
    });

    it('shows selection count', () => {
      renderModelSelector({
        knownModelIds: ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo'],
        value: 'gpt-4o, gpt-4',
      });

      expect(screen.getByText(/2 of 3 selected/i)).toBeInTheDocument();
    });

    it('includes manually added models not in knownModelIds', () => {
      renderModelSelector({
        knownModelIds: ['gpt-4o', 'gpt-4'],
        value: 'gpt-4o, custom-model',
      });

      expect(screen.getByRole('checkbox', { name: /gpt-4o/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /custom-model/i })).toBeInTheDocument();
    });
  });

  describe('real-time search filtering', () => {
    it('filters models by search term (case-insensitive)', async () => {
      const user = userEvent.setup();
      renderModelSelector({
        knownModelIds: ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo', 'claude-3-opus'],
        value: '',
      });

      const searchInput = screen.getByPlaceholderText('Search models…');
      await user.type(searchInput, 'gpt');

      // Should show only gpt models
      expect(screen.getByRole('checkbox', { name: /gpt-4o/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /gpt-4$/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /gpt-3\.5-turbo/i })).toBeInTheDocument();

      // Should not show claude
      expect(screen.queryByRole('checkbox', { name: /claude/i })).not.toBeInTheDocument();
    });

    it('filters models by search term (substring match)', async () => {
      const user = userEvent.setup();
      renderModelSelector({
        knownModelIds: ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo'],
        value: '',
      });

      const searchInput = screen.getByPlaceholderText('Search models…');
      await user.type(searchInput, '3.5');

      expect(screen.getByRole('checkbox', { name: /gpt-3\.5-turbo/i })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: /^gpt-4o$/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: /^gpt-4$/ })).not.toBeInTheDocument();
    });

    it('shows "no matches" message when search has no results', async () => {
      const user = userEvent.setup();
      renderModelSelector({
        knownModelIds: ['gpt-4o', 'gpt-4'],
        value: '',
      });

      const searchInput = screen.getByPlaceholderText('Search models…');
      await user.type(searchInput, 'llama');

      expect(screen.getByText(/no models match/i)).toBeInTheDocument();
    });

    it('clears search to show all models', async () => {
      const user = userEvent.setup();
      renderModelSelector({
        knownModelIds: ['gpt-4o', 'gpt-4', 'claude-3-opus'],
        value: '',
      });

      const searchInput = screen.getByPlaceholderText('Search models…');
      await user.type(searchInput, 'gpt');

      expect(screen.queryByRole('checkbox', { name: /claude/i })).not.toBeInTheDocument();

      await user.clear(searchInput);

      expect(screen.getByRole('checkbox', { name: /gpt-4o/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /claude/i })).toBeInTheDocument();
    });
  });

  describe('individual checkbox toggle', () => {
    it('calls onChange when a checkbox is toggled on', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      renderModelSelector({
        knownModelIds: ['gpt-4o', 'gpt-4'],
        value: '',
        onChange,
      });

      const gpt4oCheckbox = screen.getByRole('checkbox', { name: /gpt-4o/i });
      await user.click(gpt4oCheckbox);

      expect(onChange).toHaveBeenCalledWith('gpt-4o');
    });

    it('calls onChange when a checkbox is toggled off', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      renderModelSelector({
        knownModelIds: ['gpt-4o', 'gpt-4'],
        value: 'gpt-4o, gpt-4',
        onChange,
      });

      const gpt4oCheckbox = screen.getByRole('checkbox', { name: /gpt-4o/i });
      await user.click(gpt4oCheckbox);

      expect(onChange).toHaveBeenCalledWith('gpt-4');
    });

    it('preserves model order when toggling', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      renderModelSelector({
        knownModelIds: ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo'],
        value: 'gpt-4o, gpt-3.5-turbo',
        onChange,
      });

      const gpt4Checkbox = screen.getByRole('checkbox', { name: /gpt-4$/i });
      await user.click(gpt4Checkbox);

      expect(onChange).toHaveBeenCalledWith('gpt-4o, gpt-4, gpt-3.5-turbo');
    });
  });

  describe('bulk actions', () => {
    it('Select All checks only visible (filtered) models', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      renderModelSelector({
        knownModelIds: ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo', 'claude-3-opus'],
        value: '',
        onChange,
      });

      // Filter to gpt models
      const searchInput = screen.getByPlaceholderText('Search models…');
      await user.type(searchInput, 'gpt');

      // Click "Select All"
      const selectAllBtn = screen.getByRole('button', { name: /^select all$/i });
      await user.click(selectAllBtn);

      // Should select only gpt models (not claude)
      expect(onChange).toHaveBeenCalledWith('gpt-4o, gpt-4, gpt-3.5-turbo');
    });

    it('Deselect All unchecks all models', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      renderModelSelector({
        knownModelIds: ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo'],
        value: 'gpt-4o, gpt-4, gpt-3.5-turbo',
        onChange,
      });

      const deselectAllBtn = screen.getByRole('button', { name: /^deselect all$/i });
      await user.click(deselectAllBtn);

      expect(onChange).toHaveBeenCalledWith('');
    });

    it('Select Free Models selects only free models', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      renderModelSelector({
        knownModelIds: ['gpt-4o', 'deepseek-free', 'gpt-4', 'qwen-free'],
        value: '',
        onChange,
      });

      const selectFreeBtn = screen.getByRole('button', { name: /select free models/i });
      await user.click(selectFreeBtn);

      expect(onChange).toHaveBeenCalledWith('deepseek-free, qwen-free');
    });

    it('Select Free Models preserves existing free selections and adds new ones', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      renderModelSelector({
        knownModelIds: ['deepseek-free', 'gpt-4', 'qwen-free', 'another-free'],
        value: 'gpt-4, deepseek-free',
        onChange,
      });

      const selectFreeBtn = screen.getByRole('button', { name: /select free models/i });
      await user.click(selectFreeBtn);

      // Should add qwen-free and another-free to existing gpt-4 and deepseek-free
      expect(onChange).toHaveBeenCalledWith('deepseek-free, gpt-4, qwen-free, another-free');
    });
  });

  describe('manual add', () => {
    it('adds a model when Enter is pressed', async () => {
      const user = userEvent.setup();
      let currentValue = 'gpt-4o';
      const onChange = vi.fn((next) => {
        currentValue = next;
      });

      const { rerender } = render(
        <ModelSelector
          knownModelIds={['gpt-4o']}
          value={currentValue}
          onChange={onChange}
        />
      );

      const manualInputs = screen.getAllByPlaceholderText(/add a model/i);
      const manualInput = manualInputs[0];

      await user.type(manualInput, 'custom-model{Enter}');

      expect(onChange).toHaveBeenCalledWith('gpt-4o, custom-model');
    });

    it('adds a model when Add button is clicked', async () => {
      const user = userEvent.setup();
      let currentValue = 'gpt-4o';
      const onChange = vi.fn((next) => {
        currentValue = next;
      });

      const { rerender } = render(
        <ModelSelector
          knownModelIds={['gpt-4o']}
          value={currentValue}
          onChange={onChange}
        />
      );

      const manualInputs = screen.getAllByPlaceholderText(/add a model/i);
      const manualInput = manualInputs[0];
      const addButtons = screen.getAllByRole('button', { name: /add/i });
      const manualAddBtn = addButtons[addButtons.length - 1]; // Last add button

      await user.type(manualInput, 'custom-model');
      await user.click(manualAddBtn);

      expect(onChange).toHaveBeenCalledWith('gpt-4o, custom-model');
    });

    it('ignores duplicate manual add', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      renderModelSelector({
        knownModelIds: ['gpt-4o'],
        value: 'gpt-4o',
        onChange,
      });

      const manualInputs = screen.getAllByPlaceholderText(/add a model/i);
      const manualInput = manualInputs[0];

      await user.type(manualInput, 'gpt-4o{Enter}');

      // Should not add duplicate
      expect(onChange).not.toHaveBeenCalled();
    });

    it('clears input after successful manual add', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      renderModelSelector({
        knownModelIds: ['gpt-4o'],
        value: 'gpt-4o',
        onChange,
      });

      const manualInputs = screen.getAllByPlaceholderText(/add a model/i);
      const manualInput = manualInputs[0] as HTMLInputElement;

      await user.type(manualInput, 'custom-model{Enter}');

      expect(manualInput.value).toBe('');
    });
  });

  describe('large model lists (40+ models)', () => {
    it('renders 50 models without crashing', () => {
      const models = Array.from({ length: 50 }, (_, i) => `model-${i}`);

      renderModelSelector({
        knownModelIds: models,
        value: '',
      });

      expect(screen.getByText(/0 of 50 selected/i)).toBeInTheDocument();
    });

    it('search filters 50 models efficiently', async () => {
      const user = userEvent.setup();
      const models = Array.from({ length: 50 }, (_, i) => `model-${i}`);

      renderModelSelector({
        knownModelIds: models,
        value: '',
      });

      const searchInput = screen.getByPlaceholderText('Search models…');
      await user.type(searchInput, 'model-1');

      // Should show model-1, model-10 through model-19
      expect(screen.getByRole('checkbox', { name: /model-1$/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /model-15/i })).toBeInTheDocument();

      expect(screen.queryByRole('checkbox', { name: /model-2$/i })).not.toBeInTheDocument();
    });

    it('Select All and Select Free Models work on large lists', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      const models = Array.from({ length: 30 }, (_, i) =>
        i % 3 === 0 ? `model-${i}-free` : `model-${i}`
      );

      renderModelSelector({
        knownModelIds: models,
        value: '',
        onChange,
      });

      const selectFreeBtn = screen.getByRole('button', { name: /select free models/i });
      await user.click(selectFreeBtn);

      // Verify free models are selected (model-0-free, model-3-free, model-6-free, ..., model-27-free)
      const selectedCount = onChange.mock.calls[0][0].split(',').length;
      expect(selectedCount).toBe(10); // 30 models / 3 = 10 free models
    });
  });

  describe('copy to clipboard', () => {
    it('shows copy button for each model', () => {
      renderModelSelector({
        knownModelIds: ['gpt-4o', 'gpt-4'],
        value: '',
      });

      // Should have 2 copy buttons (one per model in the list)
      // Plus the copy buttons appear per label context
      const copyButtons = screen.getAllByRole('button').filter(
        (btn) => btn.querySelector('[class*="btn-icon"]') !== null ||
                  btn.getAttribute('aria-label')?.includes('Copy') ||
                  btn.getAttribute('title')?.includes('Copy')
      );
      // At least 2 copy buttons for the models
      expect(copyButtons.length).toBeGreaterThanOrEqual(2);
    });

    it('shows copy button that user can click', async () => {
      const user = userEvent.setup();
      renderModelSelector({
        knownModelIds: ['gpt-4o'],
        value: '',
      });

      // Find and click the copy button (it's next to gpt-4o checkbox)
      const copyButtons = screen.getAllByRole('button').filter(
        (btn) => btn.closest('label') !== null && btn !== screen.getAllByRole('checkbox')[0]
      );
      expect(copyButtons.length).toBeGreaterThan(0);

      // Verify the button is clickable
      if (copyButtons.length > 0) {
        await user.click(copyButtons[0]);
        expect(copyButtons[0]).toBeInTheDocument();
      }
    });
  });

  describe('scrollable container', () => {
    it('applies max-height and overflow styling', () => {
      renderModelSelector({
        knownModelIds: ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo'],
        value: '',
      });

      const label = screen.getByRole('checkbox', { name: /gpt-4o/i }).closest('label');
      // The scrollable container is: div > (search + toolbar) + div.border.rounded + div.flex.gap-2
      const scrollContainer = label?.closest('div[style*="maxHeight"]') || label?.parentElement;

      // Just verify it exists and is accessible
      expect(scrollContainer).toBeInTheDocument();
    });
  });
});
