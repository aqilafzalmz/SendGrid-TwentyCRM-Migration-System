# Twenty CRM Setup Guide

## Problem: Field Metadata Errors

If you're seeing errors like:
```
Field metadata for field "source" is missing in object metadata person
```

This means Twenty CRM hasn't been configured with the custom fields the migration system is trying to use.

## Solution

The migration system has been updated to send **only the `name` field** by default, which should work with any Twenty CRM instance out of the box.

### Option 1: Use Minimal Mode (Recommended for Quick Start)

The system now works with default Twenty CRM installations without any configuration. It will only create contacts with names.

**To use this mode:** Just run the migration - it works automatically!

```bash
npm start
```

### Option 2: Configure Custom Fields in Twenty CRM

If you want to store additional information (firstName, lastName, email, company, source, etc.), you need to configure these fields in Twenty CRM.

#### Steps to Configure Custom Fields:

1. **Log into your Twenty CRM instance**

2. **Navigate to Settings:**
   - Click the Settings icon (gear) in the top right
   - Go to **Objects** section

3. **Select the Object to Configure:**
   - Choose **Person** (for contact migration)
   - Or **Company** (for organization migration)

4. **Add Custom Fields:**
   - Click **"Fields"** tab
   - Click **"Add Field"**
   
5. **Configure These Recommended Fields:**
   
   | Field Name | Type | Description |
   |------------|------|-------------|
   | `firstName` | Text | First name |
   | `lastName` | Text | Last name |
   | `email` | Text | Email address |
   | `company` | Text | Company name |
   | `phone` | Text | Phone number |
   | `linkedin` | URL | LinkedIn profile |
   | `location` | Text | City/location |
   | `source` | Text | Data source (e.g., "sendgrid") |
   | `comment` | Text | Additional notes |
   | `tags` | Tags | Contact tags/categories |

6. **Save Settings**

7. **Update Migration Code** (if needed):
   After configuring custom fields, you can modify `index.mjs` to send additional data:

```javascript
const toPayload = (current = null) => {
  const payload = {};
  
  // Basic name
  const fullName = [data.firstName, data.lastName, data.company].filter(Boolean).join(' ').trim() || data.email;
  payload.name = fullName;
  
  // If you've configured these fields, uncomment:
  // if (data.firstName) payload.firstName = data.firstName;
  // if (data.lastName) payload.lastName = data.lastName;
  // if (data.email) payload.email = data.email;
  // if (data.company) payload.company = data.company;
  // if (data.phone) payload.phone = data.phone;
  // if (data.linkedin) payload.linkedin = data.linkedin;
  // if (data.location) payload.location = data.location;
  // if (data.source) payload.source = data.source;
  
  return payload;
};
```

### Option 3: Use Twenty CRM's API to Check Available Fields

You can query the Twenty CRM API to see what fields are available:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-twenty-instance.com/graphql \
     -d '{"query": "{ __schema { types { name fields { name type { name } } } } }"}'
```

Or check the object metadata:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-twenty-instance.com/rest/people/metadata
```

## Current Minimal Configuration

The migration system is currently configured to send only:

- **`name`** - A full name combining firstName, lastName, and/or company (or email if no name available)

This minimal payload ensures compatibility with all Twenty CRM installations without requiring custom field configuration.

## Benefits of Each Approach

### Minimal Mode (Current)
- ✅ Works immediately, no setup required
- ✅ Compatible with all Twenty CRM instances
- ✅ Quick and simple
- ❌ Only stores name information
- ❌ Limited data import

### Custom Fields Mode
- ✅ Full data import with all contact details
- ✅ Better data organization
- ✅ More complete contact records
- ❌ Requires Twenty CRM configuration
- ❌ Takes time to set up

## Testing Your Configuration

After configuring custom fields (if applicable):

```bash
npm run test:api
```

This will test creating a contact and verify all fields are accepted.

## Troubleshooting

### Error: "Field metadata for field X is missing"
- Either remove that field from the migration code
- Or configure that field in Twenty CRM Settings

### Error: "Cannot create contact"
- Check your Twenty CRM API token has write permissions
- Verify you're using the correct endpoint (`/rest/people` or `/rest/companies`)

### Contacts created but missing data
- Check which fields you've configured in Twenty CRM
- Verify the migration code is sending those fields
- Check logs for field rejection warnings

## Next Steps

1. **Start with minimal mode** - Run the migration now
2. **Verify contacts are created** - Check your Twenty CRM instance
3. **Configure custom fields** (optional) - If you want more data
4. **Re-run migration** - To populate the additional fields

