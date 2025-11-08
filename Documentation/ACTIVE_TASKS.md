# Active Tasks

Last updated: 2025-11-07 (Session 3)

## Critical (User Requested Improvements)
- [ ] **Refine modal UX/UI** - User feedback: "needs a lot of critique and extra work"
  - Review all modal designs for usability issues
  - Improve form layouts and field organization
  - Better visual hierarchy in modals
  - Improve mobile responsiveness of modals
- [ ] **Improve form validation** - Add client-side validation before submission
  - Required field indicators (*)
  - Real-time validation feedback
  - Better error messages (specific, actionable)
  - Prevent invalid data submission
- [ ] **CSV import preview** - Show data preview before importing
  - Display first 5 rows of CSV
  - Column mapping validation
  - Duplicate detection
  - Error rows highlighting
- [ ] **Add loading states** - Show progress during async operations
  - Modal loading spinners
  - Disabled states during saves
  - Progress indicators for CSV import
- [ ] **Test modals with real data** - Verify functionality with backend

## High Priority
- [ ] Implement recipe detail overlay/modal
- [ ] Edit and optimize logo image for TopNav/Login integration
- [ ] Test CSV import with sample data files
- [ ] Add Anthropic API key to backend .env for AI testing
- [ ] Add loading spinners for all async operations
- [ ] Mobile responsive testing and fixes

## Medium Priority
- [ ] Build recipe creation modal
- [ ] Add error boundary components
- [ ] Test on main development PC
- [ ] Implement advanced inventory filtering
- [ ] Add bulk operations for inventory

## Low Priority / Future
- [ ] 4-step CSV upload flow (enhanced UX)
- [ ] Empty state illustrations
- [ ] Dark mode toggle
- [ ] Mobile PWA setup
- [ ] Keyboard shortcuts
- [ ] Accessibility audit
- [ ] Performance optimization

## Bug Fixes
- [ ] None currently identified

## Recently Completed

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
