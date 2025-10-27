import 'dotenv/config';
import fetch from 'node-fetch';

const { TWENTY_BASE_URL, TWENTY_API_TOKEN } = process.env;

const payload = {
  name: {
    firstName: "John",
    lastName: "Doe"
  },
  emails: {
    primaryEmail: "john.doe.test@example.com"
  }
};

console.log('\n🔍 Creating person with payload:', JSON.stringify(payload, null, 2));

const r = await fetch(new URL('/rest/people', TWENTY_BASE_URL), {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${TWENTY_API_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
});

const responseText = await r.text();
console.log('\n🔍 Response status:', r.status);
console.log('\n🔍 Response body:', responseText);

const response = JSON.parse(responseText);
const extractedId = response?.data?.createPerson?.id || response?.id;
console.log('\n✅ Extracted ID:', extractedId);

