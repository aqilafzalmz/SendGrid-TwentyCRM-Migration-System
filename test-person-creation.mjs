import 'dotenv/config';
import fetch from 'node-fetch';

const { TWENTY_BASE_URL, TWENTY_API_TOKEN } = process.env;

async function testPersonCreation() {
  console.log('Testing person creation...');
  
  const testPerson = {
    name: {
      firstName: "Test",
      lastName: "Person"
    },
    emails: {
      primaryEmail: "test@example.com"
    }
  };
  
  console.log('Payload:', JSON.stringify(testPerson, null, 2));
  
  const url = new URL('/rest/people', TWENTY_BASE_URL).toString();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TWENTY_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(testPerson)
  });
  
  console.log('Response status:', response.status);
  const data = await response.text();
  console.log('Response:', data);
  
  if (response.ok) {
    const parsed = JSON.parse(data);
    console.log('\n✅ Person created successfully!');
    console.log('ID:', parsed.id || parsed.data?.createPerson?.id);
  } else {
    console.log('\n❌ Failed to create person');
  }
}

testPersonCreation();

