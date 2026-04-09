# Phase 4: TriggerEditor UI/UX Improvements

## Overview
Redesign the TriggerEditor page with improved visual hierarchy and a modal-based source picker for field mappings.

## Completed Items

### 1. Visual Structure & Sections
- Split form into 3 distinct card sections with headers
- "Basic Configuration" section for name, template, connection
- "Field Mappings" section with status summary
- "Test Trigger" section (edit mode only)

### 2. Required Field Indicators
- Red asterisks (*) on required form fields
- Required badge on connection fields with red highlight
- Validation prevents submission if required mappings missing

### 3. Mapping Status Summary
- Status bar showing: mapped (green), unmapped (amber), required missing (red)
- Real-time updates as mappings change

### 4. Test Section Improvements
- Collapsible details for request/response
- Success/failure badges with HTTP status
- Loading spinner during test

### 5. Quick Actions
- "Auto-map" and "Clear all" buttons
- Toast notifications on actions

### 6. Visual Feedback for Mappings
- Green background for mapped fields
- Red background for unmapped required fields
- Gray background for optional unmapped fields

## In Progress: Modal-Based Source Picker

### Current Issue
- Source selection uses a dropdown select box
- No structured view of available fields
- Cannot see which fields are already used

### Proposed Design

#### 1. Replace Select Box with Button + Label
- **Mapped state**: Show styled label with source name (e.g., `$extracted_data.amount`)
- **Unmapped state**: Show "+ Add Source" button
- Click opens modal to select source

#### 2. SourcePickerModal Structure
```
┌─────────────────────────────────────────────┐
│  Select Source                          [×] │
├─────────────────────────────────────────────┤
│                                             │
│  ▼ $extracted_data                          │
│    ┌─────────────────────────────────────┐  │
│    │ amount        [Add]                 │  │
│    │ account_no    [Add]                 │  │
│    │ transaction_id (already used)       │  │
│    └─────────────────────────────────────┘  │
│                                             │
│  ▼ $email                                   │
│    ┌─────────────────────────────────────┐  │
│    │ received_at   [Add]                 │  │
│    │ from_email    [Add]                 │  │
│    │ to_email      [Add]                 │  │
│    │ subject       [Add]                 │  │
│    └─────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

#### 3. Field Filtering
- Fields already mapped to other connection fields show "(already used)" label
- Disabled/grayed out, cannot be selected again
- Optional: Show which connection field uses it

#### 4. Implementation Plan

**Step 1: Create SourcePickerModal Component**
```jsx
function SourcePickerModal({ 
  isOpen, 
  onClose, 
  onSelect, 
  templateFields,
  currentTarget,      // The connection field being mapped
  existingMappings    // All current mappings to filter
}) {
  // Build available sources list
  const extractedDataFields = templateFields.map(f => ({
    value: `$extracted_data.${f.name || f}`,
    label: f.name || f,
    usedBy: findUsedBy(existingMappings, `$extracted_data.${f.name || f}`)
  }));
  
  const emailFields = [
    { value: '$email.received_at', label: 'received_at' },
    { value: '$email.from_email', label: 'from_email' },
    { value: '$email.to_email', label: 'to_email' },
    { value: '$email.subject', label: 'subject' }
  ];
  
  // Render structured list
}
```

**Step 2: Update Mapping Row in TriggerEditor**
```jsx
// Instead of select dropdown:
{mapping.source ? (
  <div className="flex items-center gap-2 px-3 py-2 bg-white border rounded-md">
    <span className="text-sm text-gray-700">{mapping.source}</span>
    <button onClick={() => updateMappingByTarget(connField.name, '')}>
      <XIcon className="w-4 h-4 text-gray-400" />
    </button>
  </div>
) : (
  <button 
    onClick={() => openModalFor(connField.name)}
    className="px-3 py-2 text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50"
  >
    + Add Source
  </button>
)}
```

**Step 3: Modal State Management**
```jsx
const [modalOpen, setModalOpen] = useState(false);
const [modalTarget, setModalTarget] = useState(null);

const openModalFor = (targetFieldName) => {
  setModalTarget(targetFieldName);
  setModalOpen(true);
};

const handleSourceSelect = (sourceValue) => {
  updateMappingByTarget(modalTarget, sourceValue);
  setModalOpen(false);
  setModalTarget(null);
};
```

**Step 4: Filter Logic**
```jsx
const isFieldUsed = (sourceValue) => {
  return fieldMappings.some(m => 
    m.source === sourceValue && m.target !== currentTarget
  );
};

const getUsedByField = (sourceValue) => {
  const mapping = fieldMappings.find(m => 
    m.source === sourceValue && m.target !== currentTarget
  );
  return mapping?.target;
};
```

### Design Specifications

#### Modal Styling
- Centered overlay with backdrop
- Width: 400px max
- Rounded corners, shadow
- Close button in header

#### Source Field List
- Group headers collapsible (accordion style)
- Each field row: name + status + action button
- Available: Blue "Add" button
- Used: Gray label "used by {field_name}"

#### Selected Source Display
- Show full path (e.g., `$extracted_data.amount`)
- Small "×" remove button on right
- Truncate long names if needed

### Files to Modify
- `/frontend/src/pages/TriggerEditor.jsx` - Add modal, replace select
- Optionally create `/frontend/src/components/SourcePickerModal.jsx` - Separate component

### Testing Checklist
- [ ] Modal opens on button click
- [ ] Modal closes on X or backdrop click
- [ ] Source selection updates mapping
- [ ] Used fields show correct status
- [ ] Remove button clears mapping
- [ ] Auto-map still works
- [ ] Form validation still works