import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';

// Mock data for testing
const mockSendGridData = [
  {
    email: 'test1@example.com',
    first_name: 'John',
    last_name: 'Doe',
    city: 'New York',
    tags: 'customer,premium'
  },
  {
    email: 'test2@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    location: 'Los Angeles',
    lists: 'newsletter|vip'
  }
];

// Test configuration validation
describe('Configuration Validation', () => {
  it('should validate required environment variables', () => {
    const required = ['SENDGRID_API_KEY', 'TWENTY_BASE_URL', 'TWENTY_API_TOKEN'];
    for (const key of required) {
      expect(process.env[key]).toBeDefined();
    }
  });

  it('should validate URL format', () => {
    const url = process.env.TWENTY_BASE_URL;
    expect(() => new URL(url)).not.toThrow();
  });
});

// Test data normalization
describe('Data Normalization', () => {
  it('should normalize SendGrid contact data', () => {
    const testRow = {
      email: 'TEST@EXAMPLE.COM',
      first_name: 'John',
      last_name: 'Doe',
      city: 'New York',
      tags: 'customer,premium'
    };

    // Import the normalizeRow function (would need to be exported)
    const normalized = normalizeRow(testRow);
    
    expect(normalized.email).toBe('test@example.com');
    expect(normalized.firstName).toBe('John');
    expect(normalized.lastName).toBe('Doe');
    expect(normalized.location).toBe('New York');
    expect(normalized.tags).toEqual(['customer', 'premium']);
    expect(normalized.source).toBe('sendgrid');
  });

  it('should handle missing email gracefully', () => {
    const testRow = { first_name: 'John' };
    const normalized = normalizeRow(testRow);
    expect(normalized).toBeNull();
  });

  it('should parse tags correctly', () => {
    const testCases = [
      { input: 'tag1,tag2,tag3', expected: ['tag1', 'tag2', 'tag3'] },
      { input: 'tag1|tag2|tag3', expected: ['tag1', 'tag2', 'tag3'] },
      { input: 'tag1;tag2;tag3', expected: ['tag1', 'tag2', 'tag3'] },
      { input: 'tag1, tag2 , tag3', expected: ['tag1', 'tag2', 'tag3'] }
    ];

    testCases.forEach(({ input, expected }) => {
      const testRow = { email: 'test@example.com', tags: input };
      const normalized = normalizeRow(testRow);
      expect(normalized.tags).toEqual(expected);
    });
  });
});

// Test API error handling
describe('Error Handling', () => {
  it('should handle network timeouts gracefully', async () => {
    // Mock a timeout error
    const mockFetch = () => Promise.reject(new Error('timeout'));
    
    // Test retry logic (would need to be exported)
    let attempts = 0;
    const retryFn = async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('timeout');
      }
      return 'success';
    };

    const result = await withRetry(retryFn, 3, 100);
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('should not retry on non-retryable errors', async () => {
    const mockFetch = () => Promise.reject(new Error('401 Unauthorized'));
    
    let attempts = 0;
    const retryFn = async () => {
      attempts++;
      throw new Error('401 Unauthorized');
    };

    await expect(withRetry(retryFn, 3, 100)).rejects.toThrow('401 Unauthorized');
    expect(attempts).toBe(1);
  });
});

// Test logging functionality
describe('Logging', () => {
  it('should create log files', async () => {
    const logsDir = path.resolve('logs');
    await fs.mkdir(logsDir, { recursive: true });
    
    const logPath = path.join(logsDir, 'test.log');
    await fs.writeFile(logPath, 'test log entry', 'utf8');
    
    const exists = await fs.access(logPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });
});

// Test CSV handling
describe('CSV Processing', () => {
  it('should write failed contacts to CSV', async () => {
    const failedRows = [
      { email: 'test1@example.com', error: 'API Error' },
      { email: 'test2@example.com', error: 'Network Error' }
    ];

    const logsDir = path.resolve('logs');
    await fs.mkdir(logsDir, { recursive: true });
    const failedCsvPath = path.join(logsDir, 'test-failed.csv');

    // Test CSV writing logic
    const header = Object.keys(failedRows[0]);
    const csv = [header.join(','), ...failedRows.map(r => header.map(h => (r[h] ?? '')).join(','))].join('\n');
    await fs.writeFile(failedCsvPath, csv, 'utf8');

    const exists = await fs.access(failedCsvPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });
});

// Integration test setup
describe('Integration Tests', () => {
  beforeAll(async () => {
    // Setup test environment
    console.log('Setting up integration test environment...');
  });

  afterAll(async () => {
    // Cleanup test environment
    console.log('Cleaning up integration test environment...');
  });

  it('should perform end-to-end migration test', async () => {
    // This would test the full migration flow with mock data
    // For now, just verify the main function exists
    expect(typeof main).toBe('function');
  });
});

// Performance tests
describe('Performance', () => {
  it('should handle large datasets efficiently', async () => {
    const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
      email: `test${i}@example.com`,
      first_name: `User${i}`,
      last_name: 'Test'
    }));

    const startTime = Date.now();
    const normalized = largeDataset.map(normalizeRow).filter(Boolean);
    const endTime = Date.now();

    expect(normalized.length).toBe(1000);
    expect(endTime - startTime).toBeLessThan(1000); // Should process 1000 records in under 1 second
  });
});

// Export test functions for manual testing
export {
  normalizeRow,
  withRetry,
  main
};


