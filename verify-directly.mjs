import 'dotenv/config';
import fetch from 'node-fetch';

const { TWENTY_BASE_URL, TWENTY_API_TOKEN } = process.env;

async function checkPeopleCount() {
  console.log('Checking how many people are in Twenty CRM...\n');
  
  try {
    const url = new URL('/rest/people', TWENTY_BASE_URL).toString();
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TWENTY_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    const data = await response.text();
    
    if (response.ok) {
      const parsed = JSON.parse(data);
      console.log('Data type:', Array.isArray(parsed) ? 'Array' : typeof parsed);
      
      if (Array.isArray(parsed)) {
        console.log(`\n✅ Total people in Twenty CRM: ${parsed.length}`);
        console.log('\nFirst 5 people:');
        parsed.slice(0, 5).forEach((person, i) => {
          console.log(`${i + 1}. ${person.name?.firstName || 'N/A'} ${person.name?.lastName || 'N/A'} - ${person.emails?.primaryEmail || 'N/A'}`);
        });
      } else {
        console.log('Response structure:', JSON.stringify(parsed, null, 2));
      }
    } else {
      console.log('Error:', data);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkPeopleCount();

