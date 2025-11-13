# Active Tasks

Last updated: 2025-11-12 (Session 7)

## High Priority - Bug Fixes
- [ ] **Investigate refresh logout issue** - User logs out on every page refresh
  - Check Zustand persistence configuration
  - Verify token validation logic
  - Test localStorage auth state restoration
- [ ] **Test Edit Modal** - Verify updated fields save correctly to database
- [ ] **Refactor AddBottleModal** - Update to match database schema like EditBottleModal
  - Change Spirit → name or Liquor Type
  - Change Brand → part of name
  - Add fields: Stock Number, Distillery Location, ABV (%), etc.
- [ ] **Verify table display** - Check if imported bottles show correct data in My Bar table

## Critical (User Requested Improvements) - COMPLETED ✅
- ✅ **Refine modal UX/UI** - 2025-11-08
  - ✅ Fixed modal scrolling bug
  - ✅ Improved form layouts with better spacing
  - ✅ Added animations (fade-in, slide-up)
  - ✅ Full mobile responsiveness (<640px)
- ✅ **Improve form validation** - 2025-11-08
  - ✅ Real-time validation on all fields
  - ✅ Inline error messages with icons
  - ✅ Specific, actionable error text
  - ✅ Field-level validation logic
- ✅ **Add loading states** - 2025-11-08
  - ✅ Spinner component created
  - ✅ Loading spinners in all modals
  - ✅ Disabled states during async operations
  - ✅ Success animations on completion
- [ ] **CSV import preview** - Show data preview before importing (Optional)
  - Display first 5 rows of CSV
  - Column mapping validation
  - Duplicate detection
  - Error rows highlighting
- [ ] **Test modals with real data** - Verify functionality with backend

## High Priority
- [ ] Test all modal improvements with real backend data
- [ ] Test mobile responsive behavior on actual devices
- [ ] Test accessibility with screen readers
- [ ] Implement recipe detail overlay/modal
- [ ] Edit and optimize logo image for TopNav/Login integration
- [ ] Test CSV import with sample data files
- [ ] Add Anthropic API key to backend .env for AI testing

## Medium Priority
- [ ] Build recipe creation modal
- [ ] Add error boundary components
- [ ] Test on main development PC
- [ ] Implement advanced inventory filtering
- [ ] Add bulk operations for inventory

## Low Priority / Future
- [ ] Tooltip hints for complex fields (Info icons)
- [ ] Field autocomplete/suggestions (Spirit types, locations)
- [ ] 4-step CSV upload flow (enhanced UX)
- [ ] Empty state illustrations
- [ ] Dark mode toggle
- [ ] Mobile PWA setup
- [ ] Performance optimization

## Bug Fixes
- [ ] None currently identified

## Recently Completed

### Session 7 - 2025-11-12 (CSV Import & Edit Modal Fixes)
- ✅ Fix API response structure mismatch (nested data extraction)
- ✅ Implement validateBottleData function with flexible field matching
- ✅ Add findField() helper for multiple column name variations
- ✅ Add safeString() and safeNumber() type conversion helpers
- ✅ Fix CSV import to accept 42 bottles successfully
- ✅ Completely refactor EditBottleModal to match database schema
- ✅ Organize modal fields into logical sections
- ✅ Update validation for new field names
- ✅ Fix handleSubmit to use correct database fields
- ✅ Add debug logging to store and page components
- ✅ Kill zombie node processes on ports 3000 and 3001

### Session 4 - 2025-11-08 (Modal System Polish)
- ✅ Fix modal scrolling bug (min-height: 0 on content)
- ✅ Add mobile responsive styles to all modals
- ✅ Create Spinner component (sm/md/lg, primary/white)
- ✅ Create SuccessCheckmark component (animated)
- ✅ Add loading spinners to all async operations
- ✅ Add success animations on save (1.5s auto-dismiss)
- ✅ Implement real-time form validation (all fields)
- ✅ Add ARIA labels for accessibility (role, aria-*)
- ✅ Implement focus management (auto-focus, trapping)
- ✅ Add keyboard shortcuts (ESC, Tab, Enter)
- ✅ Add unsaved changes confirmation
- ✅ Add modal animations (fade-in, slide-up)
- ✅ Update Button and Input with forwardRef
- ✅ Improve error display with icons

### Session 3 - 2025-11-07 (Modal System)
- ✅ Create CSV upload modal component (bottles and recipes)
- ✅ Build add bottle form modal (12 fields)
- ✅ Build edit bottle form modal
- ✅ Build delete confirmation modal
- ✅ Add toast notification system (ToastProvider + useToast)
- ✅ Wire up all modals to My Bar page actions
- ✅ Wire up CSV modal to Recipes page
- ✅ Integrate toast notifications for all user actions
- ✅ Commit and push modal system to GitHub (13 files created)

### Session 2 - 2025-11-07 (Icon Refactor & Bug Fixes)
- ✅ Replace all emoji icons with Lucide React icons
- ✅ Fix array initialization bugs in all pages
- ✅ Fix CORS configuration in backend
- ✅ Install lucide-react package
- ✅ Test full authentication flow
- ✅ Downgrade Node.js to v20 LTS
- ✅ Install backend dependencies

### Session 1 - 2025-11-07 (Foundation)
- ✅ Create all 7 MVP pages
- ✅ Build TopNav component
- ✅ Set up Zustand store
- ✅ Configure API client with Axios
- ✅ Create core UI components (Button, Card, Input)
- ✅ Implement design system
- ✅ Initialize Next.js project
- ✅ Create GitHub repository

---
