# Hopthu Frontend Theme Convention

> The UI theme is **neutral gray**, migrated from the original Gmail-blue styling.
> All new components and pages MUST follow these conventions. Styling is done with
> **Tailwind CSS v4 utility classes only** — no component libraries, no hardcoded hex
> colors in JSX (see [Exceptions](#exceptions)).

---

## Core Palette

| Role | Class / Value | Notes |
|------|---------------|-------|
| Primary surface (buttons, selected) | `bg-gray-700` | Main brand color |
| Primary hover | `hover:bg-gray-600` | Hover is **lighter** than base |
| Selected row / active nav item | `bg-gray-200` | Lists, sidebars |
| Hover row / hover nav item | `hover:bg-gray-50` … `hover:bg-gray-100` | Subtle, on white backgrounds |
| Focus ring | `focus:ring-gray-400` (inputs), `focus:ring-gray-600` (checkboxes) | |
| Spinner | `border-gray-700 border-t-transparent` | With `animate-spin` |
| Link text | `text-[var(--color-primary)]` | Resolves to gray-700 |

### Blue → Gray migration map (for reference when touching legacy code)

| Old (do not reintroduce) | New |
|--------------------------|-----|
| `bg-blue-500` | `bg-gray-700` |
| `hover:bg-blue-400` | `hover:bg-gray-600` |
| `disabled:hover:bg-blue-500` | `disabled:hover:bg-gray-700` |
| `focus:ring-blue-400` / `focus:ring-blue-500` | `focus:ring-gray-400` / `focus:ring-gray-600` |
| `text-blue-600` (checkbox accent) | `accent-gray-700 text-gray-700` |
| `bg-[#c2dbff]`, `bg-[#d3e3fd]` (selection) | `bg-gray-200` |
| `bg-[#f2f6fc]`, `bg-[#e9eef6]` (row hover) | `hover:bg-gray-50` / `hover:bg-gray-100` |
| `border-blue-600` (spinner) | `border-gray-700` |

---

## Component Recipes

### Button typography (all buttons)

Every button uses **`text-xs font-semibold`** — no `text-sm`/`text-base` buttons,
no light/medium weights. Standard sizing/shape tokens:

| Token | Value |
|-------|-------|
| Typography | `text-xs font-semibold` |
| Padding | `p-1 px-2` (compact: `p-1`; block: add `w-full`) |
| Radius | `rounded-sm` |
| Disabled | `disabled:opacity-50 disabled:hover:bg-<base>` |

Recommended class order: `layout → padding → radius → weight → bg/hover → text color → size → state`.

**Exception — icon-only buttons** (no label text): keep compact `p-1`/`p-2` padding;
typography tokens don't apply (e.g. the trash/edit icon buttons in `TemplateDetail`).

### Primary button

```jsx
<button class="p-1 px-2 rounded-sm font-semibold bg-gray-700 hover:bg-gray-600 text-white text-xs disabled:opacity-50 disabled:hover:bg-gray-700">
```

### Secondary / neutral button

```jsx
<button class="p-1 px-2 rounded-sm font-semibold bg-neutral-200 text-black text-xs hover:bg-neutral-300">
```

### Checkbox

Native checkboxes must include `accent-gray-700` — `text-*` alone does not color a
native input without the Tailwind forms plugin.

```jsx
<input type="checkbox" class="h-4 w-4 rounded border-gray-300 accent-gray-700 text-gray-700 focus:ring-gray-600" />
```

### Text input

```jsx
<input class="w-full px-2 py-1 text-sm rounded-sm border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-gray-400" />
```

### Selectable list row

```jsx
<div className={`px-3 py-2 cursor-pointer transition-colors ${
    isSelected ? "bg-gray-200" : "hover:bg-gray-50"
}`} />
```

### Sidebar nav item

```jsx
<Link className={`... transition-colors ${
    isActive ? "bg-gray-200 text-gray-900" : "text-gray-700 hover:bg-gray-100"
}`} />
```

### Loading spinner

```jsx
<div className="animate-spin w-6 h-6 border-2 border-gray-700 border-t-transparent rounded-full" />
```

### Toast (`components/Toast.jsx`)

| Type | Palette |
|------|---------|
| `info` | gray: `bg-gray-100` / `border-gray-300` / `text-gray-800` / icon `bg-gray-200` `text-gray-600` |
| `success` | green (`emerald`) — **semantic, keep** |
| `error` | red — **semantic, keep** |

---

## CSS Variables (`frontend/src/index.css`)

Use these instead of raw hex values for borders, muted surfaces, and focus outlines:

```css
--color-primary: #374151;          /* gray-700 — links, focus outline */
--color-background: #ffffff;
--color-foreground: #0f172a;
--color-muted: #f3f4f6;            /* gray-100 */
--color-muted-foreground: #6b7280; /* gray-500 */
--color-border: #e5e7eb;           /* gray-200 */
--color-border-hover: #d1d5db;     /* gray-300 */
--color-ring: #374151;             /* gray-700 */
```

Referenced in JSX via arbitrary values, e.g. `border-[var(--color-border)]`,
`text-[var(--color-primary)]`.

Keep `index.css` lean: only global styles (body, scrollbar, focus-visible,
reduced-motion, toast `slide-in` animation). Do **not** add component-specific
classes to `index.css` — style components with Tailwind utilities inline.

---

## Exceptions

Color is allowed **only when it carries meaning** (semantic color coding), not as
theme chrome:

1. **HTTP method badges** — `pages/settings/connectionUtils.js` `METHOD_COLORS`
   (GET=blue, POST=emerald, PUT=amber, PATCH=purple, DELETE=red), Postman-style.
2. **Toast success/error** — green/red palettes.
3. **Destructive actions** — red text/hover (e.g. `hover:text-red-600 hover:bg-red-50`
   on remove buttons).

---

## Checklist for new UI

- [ ] No `*-blue-*` Tailwind classes and no hardcoded hex colors in JSX (semantic exceptions aside)
- [ ] Primary actions use `bg-gray-700 hover:bg-gray-600 text-white`
- [ ] Buttons use `text-xs font-semibold`, `p-1 px-2`, `rounded-sm`
- [ ] Selection uses `bg-gray-200`; hover uses `gray-50`/`gray-100`
- [ ] Inputs use `focus:ring-gray-400`; checkboxes include `accent-gray-700`
- [ ] Shared surfaces/borders use the `--color-*` CSS variables
- [ ] `cd frontend && npm run build` passes
