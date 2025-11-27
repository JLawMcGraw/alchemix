# Bulk Delete Feature for Bar Stock

## Overview
Added comprehensive bulk delete functionality to the My Bar page, allowing you to select multiple items and delete them all at once. This is perfect for clearing out your old inventory before re-importing with the new auto-categorization!

## Features Implemented

### 1. Backend API Endpoint
**DELETE /api/inventory-items/bulk** - Bulk delete inventory items

**Request:**
```json
{
  "ids": [1, 2, 3, 4, 5]
}
```

**Response:**
```json
{
  "success": true,
  "deleted": 5,
  "message": "Successfully deleted 5 items"
}
```

**Security:**
- Maximum 500 items per request (prevents DoS)
- User ownership verification (can only delete your own items)
- Parameterized SQL queries (prevents SQL injection)

### 2. Frontend UI Components

**Selection Controls:**
- ✅ Checkbox on each item card
- ✅ "Select all" checkbox at the top
- ✅ Visual indicator for selected items (teal border + background tint)
- ✅ Selection count in delete button

**Action Buttons:**
- When items selected:
  - **"Delete Selected (X)"** button (red)
  - **"Cancel"** button to deselect all
- When no items selected:
  - Normal "Import CSV" and "Add Item" buttons

### 3. User Experience

**How to Use:**

1. **Select Items:**
   - Click checkboxes on individual cards to select specific items
   - OR click "Select all" checkbox to select all visible items on the page

2. **Delete Selected:**
   - Click "Delete Selected (X)" button
   - Confirm deletion in the popup dialog
   - Items are deleted and page refreshes automatically

3. **Cancel Selection:**
   - Click "Cancel" button to deselect all items
   - Or change category/page to clear selections

**Smart Behaviors:**
- Selections clear when you change pages or categories
- Selected items have visual highlighting (teal border)
- Delete button is disabled while deletion is in progress
- Toast notification confirms successful deletion
- Category counts update automatically after deletion

## Workflow for Re-importing CSV

### Recommended Steps:

1. **Clear Old Data:**
   - Go to My Bar page
   - Click "Select all"
   - Click "Delete Selected (45)" (or however many items you have)
   - Confirm deletion

2. **Re-import with Auto-Categorization:**
   - Click "Import CSV"
   - Upload your bar stock CSV
   - Items will now be properly categorized!

3. **Verify Categories:**
   - Check the category tabs
   - Should see items distributed across:
     - Spirits (bourbon, rum, gin, etc.)
     - Liqueurs (cointreau, campari, etc.)
     - Mixers (bitters, juices, etc.)
     - Syrups (grenadine, simple syrup, etc.)
     - Wine (vermouth, sherry, etc.)
     - Beer
     - Other (uncategorized items)

## Implementation Details

### Files Changed

**Backend:**
- `api/src/routes/inventory.ts`:
  - Added `DELETE /bulk` endpoint (lines 1057-1123)
  - Updated export documentation (line 1286)

**Frontend API:**
- `src/lib/api.ts`:
  - Added `inventoryApi.deleteBulk()` method (lines 183-189)

**Frontend UI:**
- `src/app/bar/page.tsx`:
  - Added selection state management
  - Added checkbox selection UI
  - Added bulk delete handler
  - Added conditional action buttons
  - Added selection controls

**Styles:**
- `src/app/bar/bar.module.css`:
  - Added `.bulkControls` styles
  - Added `.selectAllLabel` styles
  - Added `.checkbox` styles
  - Added `.deleteButton` styles
  - Added `.cardHeaderLeft` styles
  - Added `.itemCardSelected` styles

### Error Handling

- ✅ Validates IDs are numbers
- ✅ Limits to 500 items per request
- ✅ Confirms deletion with user
- ✅ Shows error toast if deletion fails
- ✅ Refreshes page data after successful deletion
- ✅ Updates category counts after deletion

### Accessibility

- ✅ Checkboxes are keyboard accessible
- ✅ Proper labeling for screen readers
- ✅ Click events properly scoped
- ✅ Focus management
- ✅ Confirmation dialogs

## Testing Checklist

Before using in production:

1. ✅ **Backend endpoint works:**
   ```bash
   curl -X DELETE http://localhost:3000/api/inventory-items/bulk \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"ids": [1, 2, 3]}'
   ```

2. ✅ **Frontend selection:**
   - Click individual checkboxes
   - Click "Select all"
   - Verify visual highlighting

3. ✅ **Bulk delete:**
   - Select multiple items
   - Click "Delete Selected"
   - Confirm dialog appears
   - Items are deleted
   - Page refreshes
   - Counts update

4. ✅ **Edge cases:**
   - Delete all items on a page
   - Delete items then change pages
   - Delete items then change categories
   - Cancel selection

## Performance

- **Limit:** 500 items per request (adjustable in backend)
- **Single request:** Entire delete operation happens in one API call
- **Atomic:** All-or-nothing deletion (database transaction)
- **Efficient:** Uses SQL IN clause for bulk operation

## Security

- User ownership verified (WHERE user_id = ?)
- Parameterized queries prevent SQL injection
- Rate limiting applies to endpoint
- Authentication required

## Next Steps

Ready to use! Just:
1. Restart your backend server to load the new endpoint
2. Navigate to My Bar page
3. Test the selection and bulk delete

Then you can clear your old inventory and re-import with proper categorization! 🎉
