# Comprehensive Migration Plan

## Understanding the Requirements

You want to migrate SendGrid data to Twenty CRM in a structured way:

### Current SendGrid Structure
- **List**: "AI TEACH Malaysia (Yayasan Amir)"
- **Contacts in that list**: 32 people

### Desired Twenty CRM Structure

#### Companies Tab:
- **1 Company**: "AI TEACH Malaysia (Yayasan Amir)" (from the list name)
  - Fields to populate:
    - Name: List name
    - Domain: Extract from contacts' emails if available
    - Address: From contacts' locations (if consistent)
    - Employees: Count of contacts (32 in this case)

#### People Tab:
- **32 People**: Individual contacts from that list
  - Fields to populate:
    - Name: firstName + lastName
    - Email: EMAIL field
    - Company: Link to "AI TEACH Malaysia (Yayasan Amir)" company
    - City: CITY field
    - Phone: PHONE_NUMBER field
    - LinkedIn: LinkedIn field (if available)

## Field Mapping Strategy

### SendGrid → Companies (from List)

| Twenty CRM Company Field | SendGrid Source | Logic |
|-------------------------|-----------------|-------|
| Name | List name | "AI TEACH Malaysia (Yayasan Amir)" |
| Domain | Contact emails | Extract most common domain from contacts |
| Address | Contact cities | Use most common city/location |
| Employees | Contact count | Count of contacts in the list |

### SendGrid → People (from Contacts)

| Twenty CRM People Field | SendGrid Field | Example |
|------------------------|----------------|---------|
| Name (firstName) | FIRST_NAME | "John" |
| Name (lastName) | LAST_NAME | "Doe" |
| Email (primaryEmail) | EMAIL | "john@example.com" |
| Company | List name | "AI TEACH Malaysia (Yayasan Amir)" (linked) |
| City | CITY | "Kuala Lumpur" |
| Phone (primaryPhoneNumber) | PHONE_NUMBER | "+60123456789" |
| LinkedIn | LinkedIn | "linkedin.com/in/johndoe" |

## Implementation Plan

### Step 1: Create a Company from the List
```javascript
// For each SendGrid list:
const company = {
  name: listName,  // "AI TEACH Malaysia (Yayasan Amir)"
  domainName: mostCommonDomain,  // From contact emails
  address: mostCommonCity  // From contact locations
};
await createCompany(company);
```

### Step 2: Create People Linked to the Company
```javascript
// For each contact in the list:
const person = {
  name: {
    firstName: contact.firstName,
    lastName: contact.lastName
  },
  emails: {
    primaryEmail: contact.email
  },
  companyId: company.id,  // Link to the company
  city: contact.city,
  phones: {
    primaryPhoneNumber: contact.phone
  }
};
await createPerson(person);
```

## Migration Flow

```
For each SendGrid List:
  1. Create Company record in Twenty CRM
     - Use list name as company name
     - Extract common domain from contacts
     - Use common city for address
  
  2. For each contact in the list:
     - Create Person record
     - Link to the company (companyId)
     - Populate personal fields
  
  3. Log progress and results
```

## What I Need to Build

1. **Get SendGrid List Info**: Function to retrieve list details
2. **Create Company First**: When migrating a list, create the company first
3. **Link People to Company**: Include companyId when creating people
4. **Batch Processing**: Handle multiple lists efficiently
5. **Progress Tracking**: Track both companies and people being created

## Next Steps

Would you like me to implement this comprehensive migration strategy?

This will:
- ✅ Create companies from SendGrid list names
- ✅ Create people from contacts in those lists
- ✅ Link people to their respective companies
- ✅ Populate all available fields correctly
- ✅ Handle multiple lists at once

