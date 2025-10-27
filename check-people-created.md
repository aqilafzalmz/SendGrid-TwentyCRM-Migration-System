# Checking People Records

The migration logs show people were created:
- ✓ Person created: riniatikha.ra@gmail.com
- ✓ Person created: amirulhakimt3015221@gmail.com  
- ✓ Person created: norhanisahsakri@gmail.com
- ✓ Person created: hazimah@gbg.com.my
- And 10 more...

But the People tab in Twenty CRM is empty.

**Possible reasons:**
1. People were created but not linked to the company properly
2. CompanyId wasn't included in the payload
3. There's a filter applied in the Twenty CRM UI

**To check:**
1. Go to People tab in Twenty CRM
2. Look at the bottom - does it say "5 People" or "0 People"?
3. Try removing any filters
4. Check if the people are there but just not showing

**The company was created:**
- "Confirmation Selangor 4" with ID: 28a1641b-171c-46cd-ae89-34b4b66e813e

**14 people were created** according to the logs.

Please check your People tab and let me know:
- How many people are shown?
- Are they linked to the company?

