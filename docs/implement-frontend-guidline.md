# Frontend Implementation Guidelines

## Design System

### Colors

Use CSS custom properties for consistent theming:

```css
/* Primary */
--color-primary: #2563EB;
--color-primary-hover: #1D4ED8;
--color-on-primary: #FFFFFF;

/* Semantic */
--color-secondary: #3B82F6;
--color-accent: #DC2626;
--color-destructive: #DC2626;
--color-destructive-hover: #B91C1C;
--color-success: #10B981;
--color-warning: #F59E0B;

/* Surfaces */
--color-background: #FFFFFF;
--color-foreground: #0F172A;
--color-muted: #F1F5FD;
--color-muted-foreground: #64748B;
--color-border: #E4ECFC;
--color-border-hover: #CBD5E1;
--color-ring: #2563EB;
```

### Status Colors

For status badges and indicators:

| Status | Background | Text |
|--------|-----------|------|
| new | `bg-slate-100` | `text-slate-700` |
| extracted | `bg-emerald-100` | `text-emerald-700` |
| ignored | `bg-amber-100` | `text-amber-700` |
| pushed | `bg-blue-100` | `text-blue-700` |

### HTTP Method Badges

| Method | Style |
|--------|-------|
| GET | `bg-blue-100 text-blue-700` |
| POST | `bg-emerald-100 text-emerald-700` |
| PUT | `bg-amber-100 text-amber-700` |
| PATCH | `bg-purple-100 text-purple-700` |
| DELETE | `bg-red-100 text-red-700` |

## Typography

- **Font**: Plus Jakarta Sans (loaded from Google Fonts)
- **Base size**: 16px
- **Line height**: 1.5

### Type Scale

| Element | Size | Weight |
|---------|------|--------|
| H1 (page title) | `text-2xl md:text-3xl` | `font-bold` |
| H2 (section) | `text-lg` | `font-semibold` |
| Body | `text-sm` or `text-base` | `font-normal` |
| Label/Caption | `text-xs` | `font-medium` |
| Button | `text-sm` | `font-medium` |

## Components

### Button

Use the `Button` component with consistent variants:

```jsx
import { Button, IconButton } from '../components/Button';

// Variants
<Button variant="primary">Primary</Button>          // Main actions
<Button variant="secondary">Secondary</Button>      // Secondary actions
<Button variant="ghost">Ghost</Button>              // Low emphasis
<Button variant="danger">Danger</Button>            // Destructive actions

// Sizes
<Button size="sm">Small</Button>
<Button size="md">Medium (default)</Button>
<Button size="lg">Large</Button>

// States
<Button loading>Loading...</Button>
<Button disabled>Disabled</Button>

// With icons
<Button>
  <Plus className="w-4 h-4" />
  Add New
</Button>
```

### Card

Use the `Card` component for content containers:

```jsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/Card';

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Optional description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Main content */}
  </CardContent>
  <CardFooter>
    {/* Actions */}
  </CardFooter>
</Card>
```

### Status Badge

```jsx
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
  <Icon className="w-3.5 h-3.5" />
  <span className="capitalize">status</span>
</span>
```

## Icons

- **Library**: Lucide React (`lucide-react`)
- **Never use emojis** as structural icons
- Import pattern: `import { IconName } from 'lucide-react'`
- Default size: `w-4 h-4` for inline, `w-5 h-5` for navigation

Common icons:
- Navigation: `Inbox`, `FileText`, `Link`, `Settings`
- Actions: `Plus`, `Trash2`, `Edit`, `RefreshCw`, `Search`, `Filter`
- Status: `CheckCircle2`, `XCircle`, `AlertCircle`, `Info`, `Clock`
- UI: `Menu`, `X`, `ChevronLeft`, `ChevronRight`, `CheckSquare`, `Square`

## Responsive Design

### Mobile-First Approach

Always design for mobile first, then enhance for larger screens:

```jsx
// Good: Mobile-first
<div className="p-4 md:p-6">

// Bad: Desktop-first
<div className="p-6 max-md:p-4">
```

### Breakpoints

| Breakpoint | Usage |
|------------|-------|
| `default` | Mobile (0-767px) |
| `sm:` | Small tablets (640px+) |
| `md:` | Tablets (768px+) |
| `lg:` | Desktop (1024px+) |
| `xl:` | Large screens (1280px+) |

### Layout Patterns

**Mobile vs Desktop Views:**

```jsx
{/* Mobile: Card list */}
<div className="md:hidden divide-y divide-[var(--color-border)]">
  {items.map(item => <CardItem key={item.id} {...item} />)}
</div>

{/* Desktop: Table */}
<div className="hidden md:block overflow-x-auto">
  <table className="w-full">...</table>
</div>
```

**Touch Targets:**
- Minimum touch target: 44px × 44px
- Use `h-10` (40px) minimum for buttons
- Add padding to small clickable elements

## Spacing

Use consistent spacing with the 4px base unit:

| Token | Value | Usage |
|-------|-------|-------|
| `p-1` | 4px | Tight spacing |
| `p-2` | 8px | Icon padding |
| `p-3` | 12px | Small components |
| `p-4` | 16px | Standard padding |
| `p-6` | 24px | Section padding |
| `space-y-4` | 16px | Between elements |
| `gap-4` | 16px | Grid/flex gaps |

## Navigation

### Mobile Header

```jsx
<header className="md:hidden bg-white border-b border-[var(--color-border)] sticky top-0 z-50">
  <div className="px-4 h-14 flex items-center justify-between">
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-[var(--color-primary)] rounded-lg flex items-center justify-center">
        <Inbox className="w-4 h-4 text-white" />
      </div>
      <span className="text-lg font-semibold">Hopthu</span>
    </div>
    {/* Hamburger menu button */}
  </div>
</header>
```

### Bottom Navigation (Mobile)

Use for main app navigation on mobile:

```jsx
<nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--color-border)] z-50">
  <div className="flex justify-around items-center h-16">
    {navItems.map((item) => (
      <Link
        key={item.path}
        href={item.path}
        className={`flex flex-col items-center justify-center flex-1 h-full gap-1 ${
          isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted-foreground)]'
        }`}
      >
        <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
        <span className="text-[11px] font-medium">{label}</span>
      </Link>
    ))}
  </div>
</nav>
```

## Forms

### Input Styling

```jsx
<input
  type="text"
  className="w-full px-4 py-2.5 bg-[var(--color-muted)] border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
  placeholder="Placeholder text..."
/>
```

### Select Styling

```jsx
<select className="px-4 py-2.5 bg-white border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
  <option value="">All</option>
  {/* options */}
</select>
```

## Animations & Transitions

### Standard Durations

| Duration | Usage |
|----------|-------|
| `150ms` | Micro-interactions (hover) |
| `200ms` | Standard transitions |
| `300ms` | Complex transitions |

### Easing

- Default: `ease` (ease-in-out)
- Enter: `ease-out`
- Exit: `ease-in`

### Transitions

```jsx
// Standard button hover
className="transition-all duration-200"

// Color only
className="transition-colors duration-150"

// Transform (careful with performance)
className="transition-transform duration-200"
```

## Accessibility

### Focus States

Always visible focus indicators:

```css
*:focus-visible {
  outline: 2px solid var(--color-ring);
  outline-offset: 2px;
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### ARIA Labels

Add to icon-only buttons:

```jsx
<button aria-label="Close menu">
  <X className="w-6 h-6" />
</button>
```

## Common Patterns

### Empty State

```jsx
<Card>
  <CardContent className="p-12 text-center">
    <div className="w-16 h-16 bg-[var(--color-muted)] rounded-full flex items-center justify-center mx-auto mb-4">
      <Icon className="w-8 h-8 text-[var(--color-muted-foreground)]" />
    </div>
    <h3 className="text-lg font-medium text-[var(--color-foreground)] mb-2">No items yet</h3>
    <p className="text-[var(--color-muted-foreground)] mb-6">Description of what to do</p>
    <Button>Create Item</Button>
  </CardContent>
</Card>
```

### Loading State

```jsx
<div className="p-12 text-center">
  <div className="animate-spin w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full mx-auto mb-4" />
  <p className="text-[var(--color-muted-foreground)]">Loading...</p>
</div>
```

### Error State

```jsx
<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
  <AlertCircle className="w-5 h-5 shrink-0" />
  {errorMessage}
</div>
```

## What to Avoid

❌ **Don't use emojis** as icons - use Lucide instead
❌ **Don't use arbitrary Tailwind values** like `pb-[env(...)]` - use inline styles
❌ **Don't use gray-500, gray-900** - use CSS custom properties
❌ **Don't use hardcoded hex colors** - use design tokens
❌ **Don't make touch targets smaller than 44px**
❌ **Don't use desktop-first responsive design**

---

## Modal Implementation

### Blurred Backdrop

To create a modal with a blurred backdrop effect using Tailwind CSS, use the following approach:

#### Recommended Class String

```jsx
<div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
```

#### Breakdown

| Class | Purpose |
|-------|---------|
| `fixed inset-0` | Covers the entire viewport |
| `bg-black/40` | Semi-transparent black background (40% opacity) |
| `backdrop-blur-sm` | Applies blur effect to content behind the modal |
| `flex items-center justify-center` | Centers the modal content |
| `z-50` | Ensures modal appears above other content |
| `p-4` | Adds padding around the modal for smaller screens |

#### Available Blur Intensities

Replace `backdrop-blur-sm` with any of these variants:

| Class | Blur Amount |
|-------|-------------|
| `backdrop-blur-none` | 0px |
| `backdrop-blur-sm` | 4px (recommended) |
| `backdrop-blur-md` | 12px |
| `backdrop-blur-lg` | 16px |
| `backdrop-blur-xl` | 24px |

#### Example Implementation

```jsx
{isOpen && (
  <div
    className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    onClick={onClose}
  >
    <div
      className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-auto"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Modal content */}
    </div>
  </div>
)}
```

#### What to Avoid

❌ **Don't use:** `bg-black bg-opacity-50` or `bg-black bg-opacity-25`

These old patterns don't work as well with the blur effect and are deprecated in favor of the slash opacity syntax (`bg-black/40`).

#### Browser Support

- Requires Tailwind CSS v2.1+ (with JIT) or v3.0+
- Uses CSS `backdrop-filter` property
- Widely supported in modern browsers
