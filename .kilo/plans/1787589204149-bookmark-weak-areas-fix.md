# Plan: Fix Bookmark Toggle UX & Weak Areas Resolution

## Problem Analysis

### Issue 1: Bookmark Remove Option
- **Current state**: `toggleBookmark()` function (lines 4661-4679) already toggles add/remove correctly
- **UI**: Bookmark button at line 4019-4021 calls `toggleBookmark(q.id)` 
- **Likely issue**: Users may not realize it's a toggle, or visual feedback is unclear
- **Solution**: Add tooltip/label clarity and ensure visual state is obvious

### Issue 2: No Facility to Resolve Weak Areas
- **Current state**: `weakPoints` Set tracks questions answered incorrectly (added at line 4611 in `evaluatePracticeAnswer`)
- **Revision tab** (line 4766-4783): Renders weak questions using `buildMCQCard` with `mode='revision'`
- **Problem**: In 'revision' mode, option buttons are disabled after evaluation (line 4049: `pointer-events-none opacity-80`)
- **No way to**: Re-attempt a weak question and remove it from weakPoints on correct answer
- **Solution**: Allow re-answering in revision mode, and remove from weakPoints when answered correctly

## Implementation Plan

### Task 1: Improve Bookmark Toggle UX
1. Update bookmark button tooltip to show "Remove Bookmark" when already bookmarked
2. Add clearer visual indication (filled icon already exists, ensure color contrast)

### Task 2: Enable Weak Areas Resolution
1. Modify `buildMCQCard` to allow re-answering when `mode === 'revision'` and question is in `weakPoints`
2. Add a "Try Again" / "Resolve" action for weak area questions
3. When user answers correctly in revision mode, remove from `weakPoints` and save state
4. Update the revision container to reflect the change (re-render or in-place update)

### Task 3: Add "Mark as Resolved" Option (Alternative)
- Add a button to manually mark a weak area as resolved without re-answering
- This gives users flexibility to clear items they've studied externally

## Key Code Locations
- `toggleBookmark()` - lines 4661-4679
- `buildMCQCard()` - lines 3924+
- `evaluatePracticeAnswer()` - lines 4591-4636
- `renderRevisionMCQs()` - lines 4766-4783
- `toggleWeakPoint()` - lines 4645-4654 (already allows manual toggle)

## Validation Steps
1. Test bookmark toggle: click to add, click again to remove
2. Test weak areas: answer wrong → appears in Revision → re-answer correctly → disappears from Revision
3. Verify localStorage persistence for both features