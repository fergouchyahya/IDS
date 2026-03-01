# Digital Signage Campaign Builder - Modern Admin Dashboard

## Design Overview

This document outlines the professional, modern SaaS-inspired design system for the IDS Campaign Builder admin interface.

---

## Visual Hierarchy & Layout

### Three-Panel System
The interface uses a clean three-column layout inspired by Linear, Notion, and Airtable:

```
┌─────────────┬────────────────────────────┬─────────────┐
│   SIDEBAR   │      CANVAS EDITOR         │  INSPECTOR  │
│             │                            │             │
│  Campaign   │   Campaign Name & Status   │  Properties │
│  Library    │                            │  Form Panel │
│             │   Block Cards              │             │
│             │   (Draggable, Editable)    │             │
│             │                            │             │
└─────────────┴────────────────────────────┴─────────────┘
```

### Spacing & Alignment
- **Consistent 8px grid system** for all spacing
- **Padding**: 16px (small), 20px (medium), 24px (large)
- **Gap between sections**: 12px-16px
- **Rounded corners**: 6px (inputs), 8px (buttons), 10px (cards)

---

## Color Palette

### Primary Colors
- **Background**: `#f8f9fa` (soft neutral)
- **Surface**: `#ffffff` (card backgrounds)
- **Border**: `#e5e7eb` (dividers)
- **Border Light**: `#f0f1f3` (subtle lines)

### Text
- **Primary**: `#111827` (headlines, primary text)
- **Secondary**: `#6b7280` (labels, descriptions)
- **Tertiary**: `#9ca3af` (muted, disabled)

### Accent & Status
- **Accent**: `#3b82f6` (primary action - blue)
- **Accent Light**: `#dbeafe` (backgrounds)
- **Accent Dark**: `#1e40af` (hover state)
- **Success**: `#10b981` (live status)
- **Danger**: `#ef4444` (destructive actions)
- **Warning**: `#f59e0b` (alerts)

---

## Component Library

### Left Sidebar - Campaign Library

#### Structure
- **Width**: 280px (responsive: 240px on smaller screens)
- **Header**: Logo, search input, create button
- **Content**: Grouped campaign list with type-based organization

#### Campaign Groups
```
┌─ IDLE
│  ├─ Campaign Name [Draft]
│  └─ Campaign Name [Live]
│
├─ VISITOR
│  └─ Campaign Name [Live]
│
├─ STUDENT
│  ├─ John Doe [Draft]
│  └─ Jane Smith [Live]
│
└─ MENU
   └─ Menu Campaign [Live]
```

#### Campaign Item Styling
- **Hover**: Light background + subtle border
- **Active/Selected**: Blue accent background, darker text
- **Badge**: Status indicator (Draft/Live) with distinct colors
  - Live: Green background `#dcfce7`, dark green text
  - Draft: Gray background `#f3f4f6`, gray text

#### Interactions
- Click to load campaign into editor
- Search filters in real-time
- "Create" button is prominent and always visible

### Center Canvas - Campaign Editor

#### Header Section
- **Height**: Auto, with consistent padding (20px vertical, 24px horizontal)
- **Content**:
  - Editable campaign name input (inline, large font weight 600)
  - Campaign type selector
  - Status badge (Draft/Live)
  - Primary actions: Save & Publish buttons

#### Block Cards
Each block displayed as a professional card:

```
┌─ ⋮⋮ [TEXT] Content Preview...     [∴] ─┐
├─ Duration: 30s                          │
└─────────────────────────────────────────┘
```

**Block Card Components:**
- **Drag Handle**: `⋮⋮` (6 dots) on the left, cursor changes to grab
- **Type Badge**: Colored label (TEXT/IMAGE/VIDEO) in accent color
- **Preview**: Text truncation with ellipsis
- **Duration**: Small badge showing seconds
- **Menu**: Kebab menu `∴` (Duplicate / Delete / Edit)

**Card Styling:**
- Border: 1px solid `#e5e7eb`
- Border radius: 10px
- Hover: Border color changes to accent, subtle shadow
- Selected: Blue accent border, light blue background, 3px shadow outline
- Transition: All 0.2s ease

#### Add Block Button
- Large, dashed border button
- Icon: `+` symbol
- Label: "Add Block"
- Hover state: Border color to accent, text color to accent, light blue background

### Right Inspector Panel

#### Structure
- **Width**: 320px (responsive: 280px)
- **Header**: "Properties" title
- **Content**: Context-sensitive form fields

#### When Campaign Selected
- Campaign name (editable text input)
- Campaign type (dropdown, read-only or with change logic)
- Campaign status (badge display)
- Active campaign toggle (if applicable)

#### When Block Selected
- Block ID (contentId) - text input
- Block type (TEXT/IMAGE/VIDEO) - dropdown
- Duration (in seconds) - number input
- Content/URL (textarea for text, text input for media)
- Upload button (for IMAGE/VIDEO blocks)

#### Form Inputs
- **Border**: 1px solid `#e5e7eb`
- **Border Radius**: 6px
- **Padding**: 8px 10px
- **Font Size**: 13px
- **Focus State**: 
  - Border color → `#3b82f6`
  - Box shadow: `0 0 0 3px #dbeafe`
  - Background → `#ffffff`

#### Form Labels
- Font size: 12px
- Font weight: 600
- Color: `#6b7280`
- Text transform: UPPERCASE
- Letter spacing: 0.3px
- Margin bottom: 6px

#### Validation
- **No aggressive red boxes**
- **Inline errors**: Small text below field, red color `#ef4444`
- **Only show on blur or explicit validation trigger**
- **Clear, actionable messages**

---

## Buttons & Actions

### Button Styles

#### Primary Button (`.btn-primary`)
- Background: `#3b82f6`
- Color: `white`
- Hover: Background `#1e40af`, shadow `0 2px 8px rgba(59, 130, 246, 0.3)`
- Used for: Save, Publish, Create actions

#### Secondary Button (`.btn-secondary`)
- Background: `#f8f9fa`
- Border: 1px solid `#e5e7eb`
- Color: `#111827`
- Hover: Background `#ffffff`, border darker
- Used for: Draft actions, less critical operations

#### Danger Button
- Background: Light red background
- Color: Red text
- Used for: Delete operations

#### Ghost Button
- Background: Transparent
- Border: 1px solid `#e5e7eb`
- Color: Primary text
- Used for: Secondary actions (move, edit)

### Button Sizing
- **Standard**: 8px padding (vertical), 16px padding (horizontal)
- **Font size**: 13px
- **Font weight**: 600
- **Border radius**: 8px
- **Transition**: All 0.2s

---

## Status & Feedback

### Status Badge (Campaign)
- **Live**: Green badge (`#dcfce7` background, `#166534` text)
- **Draft**: Gray badge (`#fef3c7` background, `#92400e` text)
- **Format**: 4px vertical, 10px horizontal padding
- **Font size**: 12px
- **Font weight**: 600
- **Text transform**: Uppercase

### Status Toast (Bottom Right)
- Position: Fixed, bottom right corner
- Padding: 12px 16px
- Border radius: 8px
- Font size: 13px
- Font weight: 500
- Animation: Slide in from bottom (0.3s)
- Box shadow: `0 4px 12px rgba(0, 0, 0, 0.15)`
- **Success**: Green background + border
- **Error**: Red background + border
- **Duration**: Auto-dismiss after 4 seconds (optional)

---

## Interaction Principles

### Hover States
- **Sidebar items**: Light background, border highlight
- **Block cards**: Border accent, subtle shadow
- **Buttons**: Darker shade + enhanced shadow
- **All transitions**: 0.2s ease

### Selection States
- **Active campaign**: Blue accent border, light blue background
- **Selected block**: Thicker border, light background, outline shadow
- **Focus inputs**: Blue border, light blue shadow

### Drag & Drop
- **Cursor**: `grab` on handle, `grabbing` when active
- **Visual feedback**: Semi-transparent overlay, border highlight
- **Placeholder**: Light dashed border showing drop position

### Loading States
- **Buttons**: Disabled state (opacity 0.55)
- **Inputs**: Disabled state (opacity, pointer events none)
- **Global spinner**: Optional, subtle loading indicator

---

## Typography

### Font Family
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", 
             "Oxygen", "Ubuntu", "Cantarell", sans-serif;
```

### Font Weights & Sizes
- **Headlines (h1)**: 16px, weight 600
- **Section titles (h2)**: 14px, weight 700
- **Labels**: 12px, weight 600, uppercase, 0.3px letter-spacing
- **Body text**: 13px, weight 400
- **Small text**: 12px, weight 400, color secondary
- **Mono (code)**: `ui-monospace, SFMono-Regular, Menlo, Consolas`

### Line Height
- Default: 1.5
- Tight (labels): 1.2

---

## Responsive Behavior

### Desktop (>1400px)
- Full three-column layout
- Sidebar: 280px
- Inspector: 320px

### Tablet (1024-1400px)
- Responsive grid
- Sidebar: 240px
- Inspector: 280px
- Canvas expands

### Mobile (<1024px)
- Sidebar & Inspector hidden (modal/drawer alternative)
- Canvas full-width
- Single-column layout
- Stack sections vertically

---

## Accessibility

### Color Contrast
- **Text on backgrounds**: Minimum WCAG AA (4.5:1)
- **Border lines**: Not used as sole indicator
- **Status indicators**: Always paired with text labels

### Keyboard Navigation
- **Tab order**: Left to right, top to bottom
- **Focus indicator**: Blue outline shadow on inputs
- **Button shortcuts**: Optional (e.g., Ctrl+S to save)

### ARIA Labels
- Form inputs: Associated `<label>` elements
- Buttons: Descriptive text
- Icons: `aria-label` where needed
- Status messages: `aria-live="polite"`

---

## Scrollbar Styling

### Custom Webkit Scrollbar
```css
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}
```

---

## Animation & Micro-Interactions

### Timing
- **Quick interactions** (hover, focus): 0.2s
- **Page transitions**: 0.3s
- **Modals/drawers**: 0.3s

### Easing
- Standard: `ease-out`
- Transitions: `ease`

### Slide-In (Toast)
```css
@keyframes slideIn {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
```

---

## Dark Mode (Future Scalability)

The design system uses CSS variables for easy dark mode support:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #1a1a1a;
    --bg-secondary: #2d2d2d;
    --border: #404040;
    --text-primary: #f5f5f5;
    --text-secondary: #b3b3b3;
    --text-tertiary: #808080;
    --accent: #60a5fa;
    /* ... other dark values */
  }
}
```

---

## File Organization

```
admin/
├── public/
│   ├── admin-ui.js          (Core functionality)
│   ├── DESIGN_GUIDE.md      (This file)
│   └── README_COMPONENTS.md (Component code snippets)
├── src/
│   ├── server.js            (HTML generation, endpoints)
│   ├── storage.js           (Data layer)
│   └── index.js             (Server entry point)
└── data/
    ├── state.json           (Persistent state)
    └── uploads/             (Media files)
```

---

## Implementation Notes

### CSS Architecture
- **Single stylesheet**: Embedded in HTML `<style>` tag
- **CSS Variables**: Color, spacing, and dimension values
- **Mobile-first**: Base styles for mobile, media queries for larger screens
- **No external dependencies**: Pure CSS, no frameworks

### JavaScript Integration
- **Vanilla JS**: No jQuery or heavy frameworks
- **Event listeners**: Delegated where possible
- **DOM manipulation**: Minimal, efficient rendering
- **API communication**: Async/await pattern

### Performance Considerations
- **CSS containment**: Optional for performance optimization
- **Will-change**: Applied sparingly to transform heavy elements
- **Debouncing**: For search, resize events
- **Lazy loading**: Images/media in inspector previews (future)

---

## Component Examples

### Block Card HTML
```html
<div class="block-card selected">
  <div class="block-drag-handle">⋮⋮</div>
  <div class="block-content">
    <div class="block-head">
      <span class="block-type-badge">TEXT</span>
      <span class="block-preview">Welcome to our campus...</span>
      <span class="block-duration">30s</span>
    </div>
  </div>
  <div class="block-menu">∴</div>
</div>
```

### Form Group
```html
<div class="form-group">
  <label for="blockDuration" class="form-label">Duration (seconds)</label>
  <input 
    id="blockDuration" 
    type="number" 
    class="form-input" 
    min="1" 
    value="30"
  />
  <div class="validation-error">Duration must be at least 1 second</div>
</div>
```

---

## Design Principles Summary

1. **Clean & Minimal**: Remove visual noise, use spacing effectively
2. **Professional**: Calm, serious aesthetic suitable for education
3. **Accessible**: Clear hierarchy, readable text, intuitive navigation
4. **Efficient**: Professional tools for long work sessions
5. **Modern SaaS**: Inspired by Linear, Notion, Stripe design patterns
6. **Scalable**: CSS variables enable light/dark mode
7. **Responsive**: Gracefully adapts to different screen sizes

---

**Version**: 1.0  
**Last Updated**: March 1, 2026  
**Maintained by**: Campaign Builder Team
