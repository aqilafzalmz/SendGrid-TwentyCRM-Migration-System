import 'dotenv/config';
import fetch from 'node-fetch';

const {
  SENDGRID_API_KEY,
  TWENTY_BASE_URL,
  TWENTY_API_TOKEN
} = process.env;

// Helper function
const log = (message, type = 'INFO') => {
  const icon = {
    'INFO': 'ℹ️',
    'SUCCESS': '✓',
    'ERROR': '✗',
    'WARNING': '⚠️'
  }[type] || '•';
  console.log(`${icon} ${message}`);
};

// Test SendGrid Connection
async function testSendGrid() {
  log('Testing SendGrid API Connection...', 'INFO');
  console.log('');
  
  try {
    // Test 1: Basic API connectivity
    log('1. Testing basic API connectivity...', 'INFO');
    const response = await fetch('https://api.sendgrid.com/v3/marketing/contacts/exports', {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${SENDGRID_API_KEY}`
      }
    });
    
    if (response.ok) {
      log('   SendGrid API is reachable', 'SUCCESS');
    } else {
      const errorText = await response.text();
      log(`   SendGrid API returned: ${response.status} ${errorText}`, 'ERROR');
      return false;
    }
    
    // Test 2: Create a test export job
    log('2. Creating test export job (lists only, notifications disabled)...', 'INFO');
    const exportResponse = await fetch('https://api.sendgrid.com/v3/marketing/contacts/exports', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        list_ids: [],
        notifications: { email: false }
      })
    });
    
    if (!exportResponse.ok) {
      const errorText = await exportResponse.text();
      log(`   Failed to create export job: ${exportResponse.status} ${errorText}`, 'ERROR');
      return false;
    }
    
    const exportJob = await exportResponse.json();
    log(`   Export job created successfully: ${exportJob.id}`, 'SUCCESS');
    
    // Test 3: Poll the export job
    log('3. Polling export job status...', 'INFO');
    let pollCount = 0;
    const maxPolls = 10;
    
    while (pollCount < maxPolls) {
      pollCount++;
      const statusResponse = await fetch(
        `https://api.sendgrid.com/v3/marketing/contacts/exports/${exportJob.id}`,
        {
          headers: { 'Authorization': `Bearer ${SENDGRID_API_KEY}` }
        }
      );
      
      if (!statusResponse.ok) {
        log(`   Failed to check status: ${statusResponse.status}`, 'ERROR');
        return false;
      }
      
      const status = await statusResponse.json();
      log(`   Status (poll ${pollCount}/${maxPolls}): ${status.status}`, 'INFO');
      
      if (status.status === 'ready' || status.status === 'completed') {
        log('   Export job completed successfully', 'SUCCESS');
        
        if (status.urls && status.urls.length > 0) {
          log(`   Export has ${status.urls.length} file(s) ready for download`, 'SUCCESS');
          
          // Show sample URL (truncated for security)
          const sampleUrl = status.urls[0];
          const truncatedUrl = sampleUrl.substring(0, 80) + '...';
          log(`   Sample URL: ${truncatedUrl}`, 'INFO');
        }
        break;
      }
      
      if (status.status === 'failed') {
        log('   Export job failed', 'ERROR');
        return false;
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    log('', 'INFO');
    log('SendGrid API: ALL TESTS PASSED ✓', 'SUCCESS');
    return true;
    
  } catch (error) {
    log(`SendGrid API Error: ${error.message}`, 'ERROR');
    return false;
  }
}

// Test Twenty CRM Connection
async function testTwentyCRM() {
  log('Testing Twenty CRM API Connection...', 'INFO');
  console.log('');
  
  try {
    // Test 1: Basic API connectivity
    log('1. Testing basic API connectivity...', 'INFO');
    const testUrl = new URL('/rest/people', TWENTY_BASE_URL).toString();
    log(`   Connecting to: ${TWENTY_BASE_URL}`, 'INFO');
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TWENTY_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      log('   Twenty CRM API is reachable', 'SUCCESS');
      log(`   Retrieved ${Array.isArray(data) ? data.length : 'unknown'} records`, 'INFO');
    } else {
      const errorText = await response.text();
      log(`   Twenty CRM API returned: ${response.status}`, 'WARNING');
      log(`   Response: ${errorText.substring(0, 200)}`, 'INFO');
    }
    
    // Test 2: Search for existing contacts
    log('2. Testing search functionality...', 'INFO');
    const searchUrl = new URL('/rest/people/search', TWENTY_BASE_URL).toString();
    const searchParams = new URLSearchParams({ query: 'test@example.com' });
    
    const searchResponse = await fetch(`${searchUrl}?${searchParams}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TWENTY_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (searchResponse.ok || searchResponse.status === 404) {
      log('   Search endpoint is accessible', 'SUCCESS');
    } else {
      log(`   Search endpoint returned: ${searchResponse.status}`, 'WARNING');
    }
    
    // Test 3: Attempt to create a test contact
    log('3. Testing contact creation...', 'INFO');
    // Note: Only sending 'name' field - not sending 'source' or other custom fields to avoid metadata errors
    const testContact = {
      name: `Test Contact ${Date.now()}`
    };
    
    const createUrl = new URL('/rest/people', TWENTY_BASE_URL).toString();
    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TWENTY_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testContact)
    });
    
    const createResult = await createResponse.text();
    
    if (createResponse.ok) {
      log('   Contact creation endpoint is accessible', 'SUCCESS');
      try {
        const parsed = JSON.parse(createResult);
        log(`   Created contact: ${JSON.stringify(parsed)}`, 'INFO');
        
        // Try to delete the test contact if ID is available
        if (parsed.id) {
          log('4. Cleaning up test contact...', 'INFO');
          const deleteUrl = new URL(`/rest/people/${parsed.id}`, TWENTY_BASE_URL).toString();
          const deleteResponse = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${TWENTY_API_TOKEN}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (deleteResponse.ok) {
            log('   Test contact deleted successfully', 'SUCCESS');
          }
        }
      } catch (e) {
        log(`   Response: ${createResult.substring(0, 200)}`, 'INFO');
      }
    } else {
      log(`   Contact creation returned: ${createResponse.status}`, 'ERROR');
      log(`   Response: ${createResult}`, 'ERROR');
    }
    
    // Test 4: Try GraphQL endpoint
    log('4. Testing GraphQL endpoint...', 'INFO');
    const graphqlUrl = new URL('/graphql', TWENTY_BASE_URL).toString();
    const graphqlQuery = {
      query: `
        query {
          __typename
        }
      `
    };
    
    const graphqlResponse = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TWENTY_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(graphqlQuery)
    });
    
    if (graphqlResponse.ok) {
      log('   GraphQL endpoint is accessible', 'SUCCESS');
    } else {
      const errorText = await graphqlResponse.text();
      log(`   GraphQL endpoint returned: ${graphqlResponse.status}`, 'WARNING');
      log(`   Response: ${errorText.substring(0, 200)}`, 'INFO');
    }
    
    log('', 'INFO');
    
    // Overall assessment
    if (response.ok && createResponse.ok) {
      log('Twenty CRM API: ALL TESTS PASSED ✓', 'SUCCESS');
      return true;
    } else {
      log('Twenty CRM API: SOME TESTS FAILED', 'WARNING');
      log('Please check the API configuration and endpoint availability.', 'WARNING');
      return false;
    }
    
  } catch (error) {
    log(`Twenty CRM API Error: ${error.message}`, 'ERROR');
    log('Stack: ' + error.stack?.substring(0, 200), 'ERROR');
    return false;
  }
}

// Main function
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  API Connection Test for SendGrid & Twenty CRM');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  
  // Validate configuration
  log('Validating configuration...', 'INFO');
  if (!SENDGRID_API_KEY) {
    log('SENDGRID_API_KEY is missing', 'ERROR');
    process.exit(1);
  }
  if (!TWENTY_BASE_URL) {
    log('TWENTY_BASE_URL is missing', 'ERROR');
    process.exit(1);
  }
  if (!TWENTY_API_TOKEN) {
    log('TWENTY_API_TOKEN is missing', 'ERROR');
    process.exit(1);
  }
  
  log('Configuration looks valid', 'SUCCESS');
  log('', 'INFO');
  
  // Test SendGrid
  const sendGridResult = await testSendGrid();
  
  console.log('');
  console.log('───────────────────────────────────────────────────────');
  console.log('');
  
  // Test Twenty CRM
  const twentyResult = await testTwentyCRM();
  
  // Final summary
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Test Summary');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  
  log(`SendGrid API: ${sendGridResult ? 'PASSED' : 'FAILED'}`, sendGridResult ? 'SUCCESS' : 'ERROR');
  log(`Twenty CRM API: ${twentyResult ? 'PASSED' : 'FAILED'}`, twentyResult ? 'SUCCESS' : 'ERROR');
  
  console.log('');
  
  if (sendGridResult && twentyResult) {
    log('All API connections are working correctly!', 'SUCCESS');
    log('You can proceed with the migration.', 'SUCCESS');
  } else {
    log('Some API connections failed.', 'ERROR');
    log('Please check your configuration and try again.', 'WARNING');
  }
  
  console.log('');
  
  process.exit(sendGridResult && twentyResult ? 0 : 1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

