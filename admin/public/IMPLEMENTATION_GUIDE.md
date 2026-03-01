# Implementation Guide - Modern Admin Dashboard

## Quick Start

The admin dashboard has been redesigned with a modern, professional SaaS aesthetic inspired by Linear, Notion, and Stripe. This guide covers the new layout and how to use it.

---

## Layout Overview

### Full Desktop View
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Digital Signage Campaign Builder                    │
├──────────────┬──────────────────────────────────────────────┬───────────────┤
│              │                                              │               │
│  CAMPAIGNS   │         CAMPAIGN EDITOR                     │  PROPERTIES   │
│  ┌────────┐  │  ┌──────────────────────────────────────┐  │ ┌──────────┐  │
│  │ IDLE   │  │  │ Campaign Name Input      [Save]     │  │ │ Block #1 │  │
│  │ ◆ Scr1│  │  │ Type: Idle    Status: Draft          │  │ │          │  │
│  │ ◆ Scr2│  │  │                                      │  │ │ Type:    │  │
│  │        │  │  │ ┌──────────────────────────────────┐│  │ │ Duration │  │
│  │ VISITOR│  │  │ │ ⋮⋮ TEXT Content preview...   ∴ ││  │ │ Content  │  │
│  │ ◇ Prm1│  │  │ │    Duration: 30s               ││  │ │          │  │
│  │        │  │  │ └──────────────────────────────────┘│  │ │ [Delete] │  │
│  │STUDENT│  │  │ ┌──────────────────────────────────┐│  │ └──────────┘  │
│  │ 👤 John│  │  │ │ ⋮⋮ IMAGE Welcome banner  ∴ ││  │                │
│  │ 👤 Jane│  │  │ │    Duration: 12s               ││  │ Select a block│
│  │        │  │  │ └──────────────────────────────────┘│  │ to view      │
│  │ [+ Create]  │  │            + Add Block             │  │ properties   │
│  └────────┘  │  └──────────────────────────────────────┘  │               │
│              │                                              │               │
└──────────────┴──────────────────────────────────────────────┴───────────────┘
```

---

## Sidebar - Campaign Library

### Features

#### Search & Filter
```
┌─────────────────────────┐
│ Campaigns               │
│ ┌─────────────────────┐ │
│ │ 🔍 Search campaigns │ │
│ └─────────────────────┘ │
│                         │
│  [+ Create Campaign]    │
└─────────────────────────┘
```

- Real-time search filters campaigns by name
- "Create" button starts a new campaign
- Always visible for quick access

#### Campaign Organization
```
IDLE
  ◆ Welcome Screen [Draft]
  ◆ Information Board [Live]

VISITOR
  ◇ Visitor Prompt [Live]

STUDENT
  👤 John Doe [Draft]
  👤 Jane Smith [Live]

MENU
  ≡ Menu Campaign [Live]
```

- Campaigns grouped by type
- Color-coded icons for quick identification
- Status badges (Draft/Live)
- Hover highlights, click to load

---

## Center Canvas - Campaign Editor

### Header Section

#### Title & Actions
```
┌───────────────────────────────────────────────────────────┐
│ [Campaign Name Input]           [Publish] [Save]         │
│                                                           │
│ Type: [Idle ▼]    Status: [Draft]                        │
└───────────────────────────────────────────────────────────┘
```

**Components:**
- **Editable Name**: Click to rename campaign
- **Type Selector**: Idle / Visitor / Student dropdown
- **Status Badge**: Visual indicator (Draft/Ready)
- **Action Buttons**: 
  - **Publish**: Makes campaign active
  - **Save**: Persists campaign data

### Block Cards

#### Text Block
```
┌──────────────────────────────────────────────────────────┐
│ ⋮⋮ [TEXT] Welcome to our campus digital...  30s    ∴   │
└──────────────────────────────────────────────────────────┘
```

#### Image Block
```
┌──────────────────────────────────────────────────────────┐
│ ⋮⋮ [IMAGE] Image content preview             12s    ∴   │
└──────────────────────────────────────────────────────────┘
```

#### Video Block
```
┌──────────────────────────────────────────────────────────┐
│ ⋮⋮ [VIDEO] Video content preview             45s    ∴   │
└──────────────────────────────────────────────────────────┘
```

**Card Features:**
- **Drag Handle** (⋮⋮): Reorder blocks
- **Type Badge**: Colored label (TEXT/IMAGE/VIDEO)
- **Preview**: Truncated content
- **Duration**: Display time in seconds
- **Menu** (∴): More options (duplicate, delete)

#### Add Block Button
```
┌──────────────────────────────────────────────────────────┐
│              + Add Block                                 │
└──────────────────────────────────────────────────────────┘
```

- Dashed border design
- Hover animates to accent colors
- Click to add new block

---

## Inspector Panel - Properties

### When Block Selected

```
┌─────────────────────────┐
│ Properties              │
│                         │
│ BLOCK DETAILS           │
│ ┌───────────────────┐   │
│ │ Block ID         │   │
│ │ [xxxxxxxxxxxxxx] │   │
│ └───────────────────┘   │
│ ┌───────────────────┐   │
│ │ Type              │   │
│ │ [Text      ▼]    │   │
│ └───────────────────┘   │
│ ┌───────────────────┐   │
│ │ Duration (sec)    │   │
│ │ [30        ]      │   │
│ └───────────────────┘   │
│                         │
│ CONTENT                 │
│ ┌───────────────────┐   │
│ │ [Text editor]     │   │
│ │ [            ]    │   │
│ │ [            ]    │   │
│ └───────────────────┘   │
│                         │
│ ACTIONS                 │
│ [Duplicate] [Delete]    │
└─────────────────────────┘
```

### When Campaign Selected

```
┌─────────────────────────┐
│ Properties              │
│                         │
│ CAMPAIGN SETTINGS       │
│ ┌───────────────────┐   │
│ │ Name              │   │
│ │ [Name input]      │   │
│ └───────────────────┘   │
│ ┌───────────────────┐   │
│ │ Type              │   │
│ │ [Idle      ▼]    │   │
│ └───────────────────┘   │
│                         │
│ STATUS                  │
│ ┌───────────────────┐   │
│ │ ● Draft           │   │
│ └───────────────────┘   │
└─────────────────────────┘
```

---

## User Workflows

### Create New Campaign

1. **Click "Create"** button in sidebar
2. **Select type** from header dropdown (Idle/Visitor/Student)
3. **Enter campaign name** in header input
4. **Add blocks** using "+ Add Block" button
5. **Configure each block** in inspector panel
6. **Click Save** to persist

**Timeline:** ~2-3 minutes per campaign

### Edit Existing Campaign

1. **Click campaign** in sidebar to load
2. **Select block** to edit
3. **Modify in inspector panel**
4. **Reorder** by dragging blocks
5. **Click Save** when done

**Timeline:** ~1-2 minutes for edits

### Duplicate Campaign

1. **Click campaign** in sidebar
2. **Note the current content**
3. **Create new campaign** from create button
4. **Add same blocks** and content
5. **Modify as needed**
6. **Save as new**

*Alternative:* Copy logic could be built into block kebab menu

---

## Color Scheme

### Semantic Colors
- **Blue** `#3b82f6`: Primary actions (Save, Create)
- **Green** `#10b981`: Success, Live status
- **Red** `#ef4444`: Destructive, Delete
- **Gray**: Secondary, Muted, Disabled

### UI Colors
- **White** `#ffffff`: Surfaces, Cards
- **Light Gray** `#f8f9fa`: Page background
- **Borders** `#e5e7eb`: Dividers, Lines
- **Text** `#111827`: Primary text
- **Muted** `#6b7280`: Labels, Secondary

---

## Keyboard Shortcuts (Future Enhancement)

```
Ctrl+S or Cmd+S     → Save campaign
Ctrl+N or Cmd+N     → New campaign
Ctrl+Z or Cmd+Z     → Undo
Ctrl+Shift+Z        → Redo
Delete              → Remove selected block
Tab                 → Navigate next field
Shift+Tab           → Navigate previous field
```

---

## Responsive Behavior

### Desktop (>1400px)
- Full three-column layout
- Sidebar visible
- Inspector visible
- Optimal for all tasks

### Tablet (1024-1400px)
- Two-column layout (Canvas + Inspector OR Sidebar + Canvas)
- Responsive sidebar width
- Drawer for Inspector
- Good for editing

### Mobile (<1024px)
- Single column
- Full-width canvas
- Sidebar as hamburger drawer
- Inspector as modal
- Optimized for touch

---

## Validation & Error Handling

### Inline Validation
- Only shown when relevant
- Clear, actionable messages
- Below problematic field
- Red text, never just red boxes

### Toast Notifications
- Bottom-right corner
- 4-second auto-hide
- Success (green) and Error (red)
- Non-intrusive

---

## Performance Tips

### For Designers
- Keep block previews concise (<60 chars)
- Use consistent block types
- Limit to 5-10 blocks per campaign
- Regular campaign cleanup

### For Developers
- Debounce search input
- Lazy load campaign thumbnails
- Cache state locally
- Optimize re-renders

---

## Accessibility

### Screen Readers
- All buttons labeled clearly
- Form inputs with associated labels
- Status messages announced
- Focus order logical

### Keyboard Navigation
- Tab through all controls
- Enter to activate buttons
- Arrow keys for selects
- Focus visible on all elements

### Color Blindness
- Never rely on color alone
- Use text labels with badges
- Sufficient contrast (4.5:1)
- Icons complementary

---

## Browser Support

- ✅ Chrome/Chromium 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ⚠️ IE11 (not supported)

---

## Customization

### Changing Colors
Edit CSS variables in `<style>` section:
```css
:root {
  --accent: #3b82f6;           /* Change primary color */
  --bg-primary: #f8f9fa;       /* Change page background */
  --text-primary: #111827;     /* Change text color */
}
```

### Adjusting Spacing
```css
:root {
  --sidebar-width: 280px;      /* Sidebar width */
  --inspector-width: 320px;    /* Inspector width */
}
```

### Dark Mode (Future)
```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #1a1a1a;
    --bg-secondary: #2d2d2d;
    /* ... other dark values */
  }
}
```

---

## Troubleshooting

### Blocks Not Showing
- Ensure campaign has at least 1 block
- Check block data is not empty
- Verify campaign is loaded

### Inspector Empty
- Click a campaign or block to select
- Check browser console for errors
- Verify JavaScript functions

### Sidebar Not Updating
- Refresh page (F5)
- Check that state loaded properly
- Verify campaigns exist in database

---

## What's Next

### Potential Enhancements
1. **Drag & drop from library** to canvas
2. **Block templates** for quick creation
3. **Preview mode** to see blocks live
4. **Keyboard shortcuts** for power users
5. **Undo/redo** functionality
6. **Collaborative editing** with real-time sync
7. **Advanced analytics** for campaign performance
8. **A/B testing** block variations
9. **Scheduling** for automatic activation
10. **Dark mode** support

---

## Support & Documentation

- **Design Guide**: See `DESIGN_GUIDE.md`
- **Components Reference**: See `README_COMPONENTS.md`
- **API Documentation**: See admin backend docs
- **Issues**: Report via GitHub

---

**Version**: 1.0  
**Released**: March 1, 2026  
**Maintained by**: Campaign Builder Team

---

## Version History

### v1.0 (March 1, 2026)
- ✅ New modern three-column layout
- ✅ Sidebar campaign library with search
- ✅ Professional block card design
- ✅ Context-sensitive inspector panel
- ✅ Drag & drop block reordering
- ✅ Responsive design (desktop/tablet/mobile)
- ✅ Modern SaaS aesthetic
- ✅ Comprehensive accessibility support

### Previous (Legacy)
- Single column form-based layout
- Basic styling
- Limited mobile support
