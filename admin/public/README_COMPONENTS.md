# Component Documentation - Modern Admin Dashboard

## Quick Reference

### Layout Structure
```
┌────────────────────────────────────────────────────────────┐
│                    TOP HEADER BAR                          │
├────────────────┬──────────────────────────┬────────────────┤
│     SIDEBAR    │      CENTER CANVAS       │    INSPECTOR   │
│   (280px)      │                          │    (320px)     │
│                │                          │                │
│ • Campaign     │ • Campaign Editor        │ • Properties   │
│   Library      │ • Block Cards            │ • Form Fields  │
│ • Search       │ • Add Block Button       │ • Validation   │
│ • Create Btn   │                          │                │
└────────────────┴──────────────────────────┴────────────────┘
```

---

## Component Details

### 1. Sidebar - Campaign Library

**Purpose**: Quick access to all campaigns, organized by type  
**Width**: 280px (responsive)

#### Header Section
```html
<div class="sidebar-header">
  <div class="sidebar-logo">Campaigns</div>
  <div class="sidebar-search">
    <input type="text" id="sidebarSearch" placeholder="Search campaigns..." />
  </div>
  <div class="sidebar-action">
    <button class="btn-create" onclick="createNewCampaign()">+ Create</button>
  </div>
</div>
```

**Key Styles:**
- `.sidebar-logo`: Small caps, accent color, 13px bold
- `.sidebar-search input`: Light background, focus state with accent border
- `.btn-create`: Full width, primary accent color, hover shadow

#### Campaign Groups
```html
<div class="campaign-group">
  <div class="campaign-group-title">Idle</div>
  <div class="campaign-item active">
    <div class="campaign-item-icon">◆</div>
    <div class="campaign-item-name">Welcome Screen</div>
    <span class="campaign-item-badge draft">Draft</span>
  </div>
</div>
```

**Interactions:**
- Hover: Light background, border highlight
- Active: Blue accent background, darker text
- Click: Load campaign into editor

**Badge Colors:**
- `.live`: Green `#dcfce7` bg, `#166534` text
- `.draft`: Gray `#f3f4f6` bg, `#6b7280` text

---

### 2. Center Canvas - Campaign Editor

#### Canvas Header
```html
<header class="canvas-header">
  <div class="canvas-header-top">
    <div class="header-title-block">
      <h1 class="header-title">
        <input type="text" id="campaignNameInput" ... />
      </h1>
    </div>
    <div class="header-actions">
      <button class="btn btn-secondary" id="publishBtn">Publish</button>
      <button class="btn btn-primary" id="saveCampaignBtn">Save</button>
    </div>
  </div>

  <div class="canvas-header-bottom">
    <div class="form-row">
      <label for="builderType">Type:</label>
      <select id="builderType"></select>
    </div>
    <div style="margin-left: auto;">
      <span class="status-indicator" id="statusBadge">Draft</span>
    </div>
  </div>
</header>
```

**Key Features:**
- Editable campaign name inline
- Type selector dropdown
- Status badge (Draft/Ready)
- Primary Save and Publish buttons
- Responsive flexbox layout

#### Block Cards
```html
<div class="block-card selected">
  <div class="block-drag-handle" draggable="true">⋮⋮</div>
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

**State Classes:**
- `.block-card`: Default white background, subtle border
- `.block-card:hover`: Accent border, shadow effect
- `.block-card.selected`: Blue border, light background, outline shadow

**Drag & Drop:**
- Cursor changes to `grab` on handle, `grabbing` when dragging
- Visual feedback with semi-transparent effect
- Drop target shows highlight

#### Add Block Button
```html
<button class="add-block-button" id="addBlockBtn" onclick="showBlockMenu()">
  + Add Block
</button>
```

**Styling:**
- Dashed border in `--border` color
- Hover: Border accent, text accent, light background

---

### 3. Inspector Panel - Context Properties

#### Header
```html
<div class="inspector-header">
  <h3 class="inspector-title">Properties</h3>
</div>
```

#### Campaign Properties Section
```html
<div class="inspector-section">
  <h4 class="section-title">Campaign Settings</h4>
  <div class="form-group">
    <label class="form-label">Name</label>
    <input type="text" class="form-input" ... />
  </div>
  <div class="form-group">
    <label class="form-label">Type</label>
    <select class="form-select">
      <option value="idle">Idle</option>
      <option value="visitor">Visitor</option>
      <option value="student">Student</option>
    </select>
  </div>
</div>
```

#### Block Properties Section
```html
<div class="inspector-section">
  <h4 class="section-title">Block Details</h4>
  <div class="form-group">
    <label class="form-label">Type</label>
    <select class="form-select">
      <option>Text</option>
      <option>Image</option>
      <option>Video</option>
    </select>
  </div>
  <div class="form-group">
    <label class="form-label">Duration (seconds)</label>
    <input type="number" class="form-input" min="1" />
  </div>
</div>

<div class="inspector-section">
  <h4 class="section-title">Content</h4>
  <textarea class="form-input form-textarea"></textarea>
</div>
```

**Form Elements:**
- `.form-group`: 16px margin between groups
- `.form-label`: 12px, 600 weight, uppercase, 0.3px letter-spacing
- `.form-input`: 8px padding, border `--border`, rounded 6px
- `.form-input:focus`: Blue border, light blue shadow

---

## CSS Variables Reference

```css
:root {
  /* Colors */
  --bg-primary: #f8f9fa;      /* Page background */
  --bg-secondary: #ffffff;    /* Card/surface background */
  --border: #e5e7eb;          /* Regular borders */
  --border-light: #f0f1f3;    /* Subtle dividers */
  --text-primary: #111827;    /* Main text */
  --text-secondary: #6b7280;  /* Labels, secondary */
  --text-tertiary: #9ca3af;   /* Muted, disabled */
  
  /* Accent */
  --accent: #3b82f6;          /* Primary action blue */
  --accent-light: #dbeafe;    /* Blue backgrounds */
  --accent-dark: #1e40af;     /* Hover states */
  
  /* Status */
  --success: #10b981;         /* Live/success */
  --danger: #ef4444;          /* Delete/error */
  --warning: #f59e0b;         /* Caution */
  
  /* Layout */
  --sidebar-width: 280px;
  --inspector-width: 320px;
}
```

---

## Button Styles

### Primary Button
```html
<button class="btn btn-primary">Save</button>
```
- Background: `--accent` (`#3b82f6`)
- Text: White
- Hover: `--accent-dark` with shadow

### Secondary Button
```html
<button class="btn btn-secondary">Cancel</button>
```
- Background: `--bg-primary`
- Border: 1px solid `--border`
- Text: `--text-primary`
- Hover: Background white, darker border

---

## Status Indicators

### Campaign Status Badge
```html
<span class="status-indicator live">Live</span>
<span class="status-indicator draft">Draft</span>
```

### Toast Notification
```html
<div id="status" class="status-toast good">
  Campaign saved
</div>
```

**Classes:**
- `.good`: Green background, success colors
- `.bad`: Red background, error colors
- `.show`: Visible state

**Animation:**
- Slides in from bottom (0.3s)
- Auto-hides after 4 seconds

---

## Responsive Breakpoints

### Desktop (>1400px)
- Full three-column layout
- Sidebar: 280px
- Inspector: 320px

### Tablet (1024-1400px)
- Responsive layout
- Sidebar: 240px
- Inspector: 280px

### Mobile (<1024px)
- Single column
- Sidebar & Inspector hidden (modal alternative)
- Canvas full-width

---

## Accessibility Features

### Focus Management
- Tab order: Left to right, top to bottom
- Focus indicators: Blue outline with shadow
- Focus visible on all interactive elements

### ARIA Labels
```html
<button aria-label="Save campaign">💾</button>
<input aria-label="Campaign name" type="text" />
```

### Color Contrast
- All text meets WCAG AA minimum (4.5:1)
- Status never relies on color alone
- Paired with text labels

---

## Animation Principles

### Timing
```css
/* Quick interactions */
transition: all 0.2s ease;

/* Page transitions */
animation: slideIn 0.3s ease-out;
```

### Slide-In Animation
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

## JavaScript Integration Points

### Key Event Handlers
```javascript
// Sidebar
onclick="createNewCampaign()"
onclick="loadCampaignToEditor('idle', 'campaign-id')"

// Canvas Header
onchange="changeCampaignType(this.value)"
onclick="saveBuilderCampaign()"
onclick="publishCampaign()"

// Block Cards
onclick="selectBlock(0)"
ondragstart="startDragBlock(event, 0)"
ondrop="dropBlock(event, 0)"
onclick="showBlockMenu(0)"

// Inspector
onchange="updateBlockField('blocks', 0, 'type', this.value)"
onclick="duplicateBlock(0)"
onclick="removeBlock('blocks', 0)"
```

---

## Best Practices

### Spacing (8px Grid)
- Use multiples of 8px for consistency
- 16px: Small padding (inputs, buttons)
- 20px: Medium padding (sections)
- 24px: Large padding (page)
- 12-16px: Gap between elements

### Borders & Dividers
- Use `--border` for regular borders
- Use `--border-light` for subtle dividers
- Avoid heavy black borders
- Rounded corners 6-10px

### Typography
- Headlines: 600 weight, 14-16px
- Body: 400 weight, 13px
- Labels: 600 weight, 12px, uppercase
- Always use system font stack

### Shadows
- Minimal, subtle shadows
- Use on cards for depth
- Enhance on hover
- Avoid harsh drop shadows

---

## Common Patterns

### Form Group
```html
<div class="form-group">
  <label class="form-label">Label</label>
  <input type="text" class="form-input" />
  <div class="validation-error">Error message (hidden by default)</div>
</div>
```

### Section Header
```html
<div class="inspector-section">
  <h4 class="section-title">Section Title</h4>
  <!-- content -->
</div>
```

### Modal Card
```html
<div class="block-card">
  <!-- content -->
</div>
```

---

**Version**: 1.0  
**Last Updated**: March 1, 2026
