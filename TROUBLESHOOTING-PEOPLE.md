# Troubleshooting: People Not Showing

## The Issue
- API logs show: ✅ "Person created" for all 14 people
- Twenty CRM UI shows: "All People · 5" (only original 5 people)
- New people are NOT visible in the UI

## Possible Reasons

### 1. **UI Cache Issue**
The Twenty CRM UI might be cached. Try:
- **Hard refresh**: Press `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
- **Clear browser cache**: Settings → Clear browsing data
- **Log out and log back in**

### 2. **Filter Applied**
Check if there's a filter hiding the new people:
- Click on "Filter" button
- Make sure all filters are cleared
- Try sorting by "Creation date" (newest first)

### 3. **People Actually Created but UI Not Updated**
The API says people were created. To verify:
1. Try clicking on "Company: Confirmation Selangor 4"
2. Look for a "People" section in the company details
3. The people might be linked there

### 4. **Different View or Page**
- Check if you're on page 1 of the People list
- Try pagination arrows
- Look for "Load More" button

## What to Check Right Now

1. **Hard Refresh**: Press `Ctrl+Shift+R` to force reload
2. **Check Filters**: Click "Filter" button and clear all
3. **Sort by Date**: Click "Sort" → "Creation date" → "Newest first"
4. **Look at Company**: Click on "Confirmation Selangor 4" and check "People" section
5. **Check Total**: Does it say "All People · 5" or "All People · 19" now?

## Immediate Next Steps

1. **Refresh the page** (`Ctrl+Shift+R`)
2. **Tell me what you see** - Does the count change?
3. If still only 5 people, I'll check the API more directly

