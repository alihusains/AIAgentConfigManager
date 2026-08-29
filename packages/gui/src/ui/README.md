# UI primitive library

Thin, typed, memoized building blocks over the app's existing CSS classes.
No duplicated styles, no new dependencies. Named ESM exports → unused
primitives are tree-shaken from the bundle.

## Inventory

| Component       | Wraps                                              | Memo | Purpose |
| --------------- | -------------------------------------------------- | ---- | ------- |
| `Badge`         | `.badge .badge-*`                                  | ✅   | Tinted status pill; optional live-dot; typed `variant` |
| `Button`        | `.btn .btn-*` / `.btn-sm`                          | ✅   | variant/size/icon/loading; forwards ref; spreads native attrs |
| `Card`          | `.card` / `.card-header` / `.card-title`           | —    | Panel with optional header (title + actions slot) |
| `StatCard`      | `.card` + stat layout                              | ✅   | KPI tile: label, tinted value, trend, icon chip (`color-mix`) |
| `EmptyState`    | `.empty-state`                                     | ✅   | Zero-data placeholder: icon / title / message / action |
| `SectionHeader` | utility classes                                    | ✅   | View/group heading: title, description, actions slot |
| `Field`         | `.form-group` / `.form-label` / `.form-help`       | ✅   | Form row: label + control slot + help |
| `Toggle`        | `.switch` / `.switch-row`                          | ✅   | Accessible on/off (`role="switch"`, `aria-checked`) |
| `Modal`         | `.modal-overlay` / `.modal`                        | —    | Dialog via portal; Escape + backdrop close, listener cleaned up |

`✅` = wrapped in `React.memo`. Containers that take `children` (`Card`,
`Modal`) are plain functions — children identity changes every parent render,
so memo would never bail out.

## Usage

```tsx
import { Badge, Button, Card, Field, Modal, StatCard, Toggle } from '../ui';
```

## Low-RAM / performance notes

- No component adds a dependency; all styling reuses existing CSS.
- `Modal` subscribes to `keydown` only while open and removes the listener on
  cleanup (no leaky subscriptions). It renders `null` when closed.
- Memoized leaves bail out on unchanged primitive props, cutting re-render and
  GC pressure in long lists (agents, providers, settings rows).
- Stable typed props; no inline object/array literals required at call sites.
