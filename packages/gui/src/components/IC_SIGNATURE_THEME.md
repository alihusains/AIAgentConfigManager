# IC Signature Theme Component Library

**Version:** 1.0.0  
**Created:** September 3, 2026  
**Theme:** Professional, minimalist corporate design with dual-pane layouts

---

## 📋 Overview

The IC Signature Theme is a production-ready component library for AIAgentConfigManager that implements professional, efficient dual-pane layouts. Designed for infrastructure control plane screens, it provides:

- ✅ Responsive dual-pane design (desktop side-by-side, mobile stacked)
- ✅ Real-time live previews with instant updates (no animations)
- ✅ High-contrast, WCAG AA accessible components
- ✅ Corporate professional aesthetic
- ✅ Dark mode support via CSS variables
- ✅ TypeScript with full type safety
- ✅ Zero breaking changes to existing components
- ✅ Tailwind CSS + custom CSS classes

---

## 🎯 Core Components

### 1. **DualPaneLayout**
Master container for dual-pane views (controls left/top, preview right/bottom).

**Location:** `packages/gui/src/components/DualPaneLayout.tsx`

**Props:**
```typescript
interface DualPaneLayoutProps {
  controlsPanel: ReactNode;      // Left/top pane content
  previewPane: ReactNode;        // Right/bottom pane content
  instructions?: ReactNode;      // Optional instructions above
  layout?: 'side' | 'stack';     // Layout mode (default: 'side')
  breakpoint?: 'sm' | 'md' | 'lg'; // Responsive breakpoint (default: 'lg')
  spacing?: 'compact' | 'normal' | 'comfortable'; // Gap between panes
  className?: string;            // Additional Tailwind classes
  controlsMinWidth?: string;     // Min width for left pane
  controlsBasis?: string;        // Flex basis for left pane (default: '40%')
  previewBasis?: string;         // Flex basis for right pane (default: '60%')
}
```

**Example:**
```tsx
<DualPaneLayout
  controlsPanel={<ControlPanel>{/* filters, form */}</ControlPanel>}
  previewPane={<PreviewPane>{/* live preview */}</PreviewPane>}
  spacing="comfortable"
  controlsBasis="35%"
  previewBasis="65%"
/>
```

**Features:**
- Responsive: `flex-col` on mobile → `flex-row` on desktop
- Configurable flex basis for left/right panes
- Optional instructions section at top
- Full-height layout with proper accessibility regions

---

### 2. **ControlPanel**
Container for organized form controls and input groups.

**Location:** `packages/gui/src/components/ControlPanel.tsx`

**Props:**
```typescript
interface ControlPanelProps {
  children: ReactNode;        // Form controls, ControlGroups
  title?: string;            // Optional panel title
  description?: string;      // Optional panel description
  className?: string;        // Additional classes
}
```

**Example:**
```tsx
<ControlPanel title="Filters" description="Refine your search">
  <ControlGroup label="Search">
    <input type="text" />
  </ControlGroup>
  <ControlGroup label="Category" showDivider>
    {/* category options */}
  </ControlGroup>
</ControlPanel>
```

**Features:**
- Optional header with title/description
- Organized control groups
- Consistent spacing and styling
- Border dividers between sections

---

### 3. **ControlGroup**
Logical group of controls (filters, inputs, sections).

**Props:**
```typescript
interface ControlGroupProps {
  label?: string;            // Group label (uppercase, semibold)
  children: ReactNode;       // Form controls
  description?: string;      // Helper text below label
  className?: string;        // Additional classes
  showDivider?: boolean;     // Show divider above group
}
```

**Example:**
```tsx
<ControlGroup label="Provider Type" description="Choose one or more">
  <label><input type="checkbox" /> Anthropic</label>
  <label><input type="checkbox" /> OpenAI</label>
</ControlGroup>
```

---

### 4. **PreviewPane**
Container for live preview and results.

**Location:** `packages/gui/src/components/PreviewPane.tsx`

**Props:**
```typescript
interface PreviewPaneProps {
  children?: ReactNode;       // Preview content
  title?: string;            // Optional title
  previewMode?: string;      // Mode label (e.g., "JSON", "HTML")
  isEmpty?: boolean;         // Show empty state
  emptyMessage?: string;     // Empty state message
  emptyIcon?: ReactNode;     // Empty state icon
  className?: string;        // Additional classes
  elevated?: boolean;        // Card elevation (default: true)
  isLoading?: boolean;       // Loading state
  loadingMessage?: string;   // Loading message
}
```

**Example:**
```tsx
<PreviewPane
  title="Live Preview"
  previewMode="JSON"
  isEmpty={!selected}
  emptyMessage="Select an item to view"
>
  {selected && <JsonDisplay data={selected} />}
</PreviewPane>
```

**States:**
- **Content:** Shows children with optional title/mode
- **Loading:** Spinner with loading message
- **Empty:** Centered icon + message

---

### 5. **LivePreview**
Real-time display with instant updates and copy support.

**Location:** `packages/gui/src/components/LivePreview.tsx`

**Props:**
```typescript
interface LivePreviewProps {
  data: unknown;                    // Data to display
  template?: (data: unknown) => ReactNode; // Custom template
  format?: 'json' | 'html' | 'text' | 'custom'; // Display format
  title?: string;                   // Optional title
  showCode?: boolean;              // Show as code block
  copyable?: boolean;              // Enable copy button
  onCopy?: () => void;             // Callback on copy
  className?: string;              // Additional classes
}
```

**Example:**
```tsx
<LivePreview
  data={selectedModel}
  format="json"
  title="Configuration"
  showCode={true}
  copyable={true}
/>
```

**Features:**
- Instant updates on data change (no animations)
- Auto-format JSON, HTML, or text
- Copy-to-clipboard with visual feedback
- Scrollable content with max-height
- "Copied!" confirmation

---

### 6. **ActionButton**
Primary and secondary action buttons with multiple variants.

**Location:** `packages/gui/src/components/ActionButtons.tsx`

**Props:**
```typescript
interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;               // Button label
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; // Style variant
  size?: 'sm' | 'md' | 'lg';        // Button size
  icon?: ReactNode;                  // Left icon
  iconRight?: ReactNode;            // Right icon
  loading?: boolean;                // Show spinner
  fullWidth?: boolean;              // Full width button
}
```

**Variants:**
- **primary:** Filled, branded color (teal), strong shadow
- **secondary:** Outlined, light background, subtle border
- **ghost:** Transparent, minimal styling
- **danger:** Red background, warning styling

**Example:**
```tsx
<ActionButton variant="primary" size="md" icon={<Copy size={16} />}>
  Copy
</ActionButton>

<ActionButton variant="secondary" loading>
  Processing...
</ActionButton>

<ActionButton variant="danger" onClick={handleDelete}>
  Delete
</ActionButton>
```

---

### 7. **ActionButtonGroup**
Container for multiple action buttons.

**Props:**
```typescript
interface ActionButtonGroupProps {
  children: ReactNode;               // ActionButton children
  direction?: 'row' | 'column';     // Layout direction
  spacing?: 'compact' | 'normal' | 'comfortable'; // Spacing
  className?: string;                // Additional classes
}
```

**Example:**
```tsx
<ActionButtonGroup direction="row" spacing="normal">
  <ActionButton variant="primary">Save</ActionButton>
  <ActionButton variant="secondary">Cancel</ActionButton>
</ActionButtonGroup>
```

---

### 8. **StatusIndicator**
Feedback message with icon and text (never color-only).

**Location:** `packages/gui/src/components/StatusIndicator.tsx`

**Props:**
```typescript
interface StatusIndicatorProps {
  status: 'success' | 'error' | 'info' | 'warning' | 'copied'; // Status type
  message: string;                   // Status message
  duration?: number;                // Auto-dismiss (ms, 0 = never)
  icon?: ReactNode;                 // Custom icon
  className?: string;               // Additional classes
  onDismiss?: () => void;           // Callback when dismissed
}
```

**Example:**
```tsx
<StatusIndicator
  status="success"
  message="Configuration saved successfully!"
  duration={3000}
  onDismiss={() => console.log('dismissed')}
/>
```

**Built-in Icons:**
- ✓ **success:** Green checkmark
- ✕ **error:** Red X
- ⓘ **info:** Blue info icon
- ⚠ **warning:** Amber warning icon

---

### 9. **StatusBadge**
Compact inline status badge (small, minimal).

**Props:**
```typescript
interface StatusBadgeProps {
  status: StatusType;        // Status type
  label?: string;           // Override label
  className?: string;       // Additional classes
}
```

**Example:**
```tsx
<StatusBadge status="success" label="Active" />
```

---

### 10. **StatusRow**
Full-width status row (for tables, lists).

**Props:**
```typescript
interface StatusRowProps {
  status: StatusType;         // Status type
  label?: string;            // Override label
  description?: string;      // Additional info
  className?: string;        // Additional classes
}
```

---

### 11. **BannerToggle**
Visual on/off toggle for features or options.

**Location:** `packages/gui/src/components/BannerToggle.tsx`

**Props:**
```typescript
interface BannerToggleProps {
  enabled: boolean;                  // Current state
  onChange: (enabled: boolean) => void; // State callback
  label: string;                     // Toggle label
  description?: string;              // Helper text
  className?: string;               // Additional classes
  disabled?: boolean;               // Disabled state
  icons?: [ReactNode, ReactNode];  // Custom icons [on, off]
}
```

**Example:**
```tsx
<BannerToggle
  enabled={bannerVisible}
  onChange={setBannerVisible}
  label="Show Banner"
  description="Display top announcement banner"
  icons={[<Eye />, <EyeOff />]}
/>
```

**Features:**
- Smooth toggle animation
- Visual On/Off badges
- Optional custom icons
- Disabled state support

---

### 12. **InstructionCard**
Step-by-step guidance with numbered steps.

**Location:** `packages/gui/src/components/InstructionCard.tsx`

**Props:**
```typescript
interface InstructionCardProps {
  steps: Step[];                     // Array of steps
  title?: string;                    // Card title
  description?: string;              // Card description
  className?: string;               // Additional classes
  showNumbers?: boolean;            // Show step numbers (default: true)
  icon?: ReactNode;                 // Card icon
  compact?: boolean;                // Compact spacing
}

interface Step {
  number?: number;                   // Step number (auto-generated)
  title: string;                     // Step title
  description?: string;              // Step details
  icon?: ReactNode;                  // Step icon
  example?: string;                  // Code example
  status?: 'pending' | 'active' | 'completed' | 'error'; // Step status
}
```

**Example:**
```tsx
<InstructionCard
  title="Setup Guide"
  description="Complete these steps to get started"
  steps={[
    {
      title: "Connect Account",
      description: "Authorize your API key",
      status: 'completed'
    },
    {
      title: "Configure Settings",
      description: "Set your preferences",
      status: 'active',
      icon: <Settings />
    },
    {
      title: "Test Connection",
      description: "Verify everything works",
      status: 'pending'
    }
  ]}
/>
```

**Step Statuses:**
- ○ **pending:** Not started (gray)
- ◐ **active:** In progress (blue)
- ✓ **completed:** Done (green)
- ✕ **error:** Failed (red)

---

## 🎨 Styling

All components use:
- **Tailwind CSS** for responsive utility styling
- **CSS Variables** for theme colors (WhatsApp theme)
- **Dark mode** via `dark:` prefix (fully supported)
- **High contrast** for WCAG AA accessibility

### Color Tokens (via CSS Variables)
```css
--bg-primary:           white
--text-primary:         #111b21 (high contrast dark)
--accent-primary:       #00a884 (teal)
--accent-success:       #10b981 (green)
--accent-error:         #ef4444 (red)
--accent-info:          #3b82f6 (blue)
--accent-warning:       #f59e0b (amber)
--border-primary:       #e5ddd5 (warm tone)
```

### Responsive Breakpoints
```typescript
'sm': '640px'
'md': '768px'
'lg': '1024px'
'xl': '1280px'
'2xl': '1536px'
```

---

## 📦 Exports

All components exported from `packages/gui/src/components/index.ts`:

```typescript
export { DualPaneLayout, type DualPaneLayoutProps }
export { ControlPanel, ControlGroup, type ControlPanelProps, type ControlGroupProps }
export { PreviewPane, type PreviewPaneProps }
export { LivePreview, type LivePreviewProps, type PreviewFormat }
export { ActionButton, ActionButtonGroup, CommonActions, type ActionButtonProps, type ActionButtonGroupProps }
export { StatusIndicator, StatusBadge, StatusRow, type StatusType, type StatusIndicatorProps, type StatusBadgeProps, type StatusRowProps }
export { BannerToggle, type BannerToggleProps }
export { InstructionCard, StepList, type InstructionCardProps, type Step, type StepListProps }
```

---

## 🚀 Usage Patterns

### Basic Dual-Pane View
```tsx
import {
  DualPaneLayout,
  ControlPanel,
  ControlGroup,
  PreviewPane,
  ActionButton,
} from './components';

export function MyView() {
  const [selected, setSelected] = useState(null);

  return (
    <DualPaneLayout
      controlsPanel={
        <ControlPanel title="Options">
          <ControlGroup label="Filter">
            {/* search, filters */}
          </ControlGroup>
        </ControlPanel>
      }
      previewPane={
        <PreviewPane
          title="Preview"
          isEmpty={!selected}
          emptyMessage="Select an item"
        >
          {selected && <Details item={selected} />}
        </PreviewPane>
      }
    />
  );
}
```

### With Live Updates
```tsx
export function ConfigEditor() {
  const [config, setConfig] = useState({});
  const [status, setStatus] = useState<StatusType>('pending');

  const handleSave = async () => {
    try {
      await api.saveConfig(config);
      setStatus('success');
    } catch (err) {
      setStatus('error');
    }
  };

  return (
    <>
      <DualPaneLayout
        controlsPanel={
          <ControlPanel title="Configuration">
            <ControlGroup label="Settings">
              {/* form fields */}
            </ControlGroup>
            <ActionButton variant="primary" onClick={handleSave}>
              Save
            </ActionButton>
          </ControlPanel>
        }
        previewPane={
          <PreviewPane title="Live Preview">
            <LivePreview
              data={config}
              format="json"
              showCode={true}
              copyable={true}
            />
          </PreviewPane>
        }
      />
      {status !== 'pending' && (
        <StatusIndicator status={status} message="Operation complete!" />
      )}
    </>
  );
}
```

---

## ♿ Accessibility

All components follow WCAG AA standards:

- ✅ High contrast text (4.5:1 minimum)
- ✅ Semantic HTML (`role="region"`, `aria-label`, etc.)
- ✅ Keyboard navigation support
- ✅ Focus indicators (visible outline)
- ✅ Screen reader friendly (never color-only for status)
- ✅ Responsive text sizing
- ✅ Status messages announced to assistive tech

---

## 🔄 Responsive Design

**Mobile-first approach:**
- Stacked layout on small screens
- Side-by-side on `lg` breakpoint and up
- Configurable via `layout` and `breakpoint` props
- Min-height constraints for preview pane

```tsx
// Force mobile layout
<DualPaneLayout layout="stack" {...} />

// Custom breakpoint
<DualPaneLayout breakpoint="md" {...} />

// Custom basis
<DualPaneLayout controlsBasis="30%" previewBasis="70%" {...} />
```

---

## 🧪 Testing

Components are tested for:
- Type correctness (full TypeScript coverage)
- Responsive behavior (Playwright tests)
- Accessibility compliance (WCAG AA)
- Dark mode support
- Zero regression on existing code

Run tests:
```bash
cd packages/gui
npm run test
npm run test:responsive
```

---

## 📝 Notes

- **No breaking changes** — all new components, zero modifications to existing UI primitives
- **Zero dependencies** — uses existing Tailwind + CSS variables
- **Memoized** — performance-optimized with React.memo where appropriate
- **Fully typed** — complete TypeScript support with exported types
- **Production-ready** — used in live ProvidersViewIC, ModelsViewIC, AgentsViewIC

---

## 📚 Related Files

- **Theme tokens:** `packages/gui/src/theme/tokens.ts`
- **CSS base:** `packages/gui/src/index.css`
- **Tailwind config:** `packages/gui/tailwind.config.ts`
- **Example usage:** `packages/gui/src/components/ProvidersViewIC.tsx`

---

**Last Updated:** September 3, 2026  
**Maintainer:** AI Config Manager Team
