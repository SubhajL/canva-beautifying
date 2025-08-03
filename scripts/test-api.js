const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';
const API_TOKEN = process.env.API_TOKEN || 'test-token';

// Test file path - create a simple test PDF if it doesn't exist
const TEST_FILE_PATH = path.join(__dirname, 'test-document.pdf');

// Simple API client
class TestClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.token}`,
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('API Error:', data);
      }
      
      return { status: response.status, data };
    } catch (error) {
      console.error('Request failed:', error);
      throw error;
    }
  }

  async enhance(filePath, settings = {}) {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    
    if (Object.keys(settings).length > 0) {
      form.append('settings', JSON.stringify(settings));
    }

    return this.request('/enhance', {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });
  }

  async getStatus(enhancementId) {
    return this.request(`/enhance/${enhancementId}`);
  }

  async getHistory(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/enhance${queryString ? `?${queryString}` : ''}`);
  }

  async cancel(enhancementId) {
    return this.request(`/enhance/${enhancementId}`, {
      method: 'DELETE',
    });
  }
}

// Test functions
async function runTests() {
  console.log('🧪 BeautifyAI API Test Suite\n');
  
  const client = new TestClient(API_BASE_URL, API_TOKEN);
  let enhancementId = null;

  // Test 1: Create Enhancement
  console.log('1️⃣ Testing POST /enhance');
  try {
    // Check if test file exists
    if (!fs.existsSync(TEST_FILE_PATH)) {
      console.log('   ⚠️  Test file not found. Please create test-document.pdf');
      return;
    }

    const result = await client.enhance(TEST_FILE_PATH, {
      enhancementSettings: {
        style: 'modern',
        targetAudience: 'professionals',
        enhancementLevel: 'moderate',
      },
      priority: 'normal',
    });

    if (result.status === 201 || result.status === 200) {
      console.log('   ✅ Enhancement created successfully');
      console.log(`   📄 Enhancement ID: ${result.data.data.id}`);
      console.log(`   📊 Queue position: ${result.data.data.queuePosition}`);
      enhancementId = result.data.data.id;
    } else {
      console.log(`   ❌ Failed with status ${result.status}`);
    }
  } catch (error) {
    console.log('   ❌ Test failed:', error.message);
  }

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Get Status
  if (enhancementId) {
    console.log('\n2️⃣ Testing GET /enhance/{id}');
    try {
      const result = await client.getStatus(enhancementId);
      
      if (result.status === 200) {
        console.log('   ✅ Status retrieved successfully');
        console.log(`   📊 Status: ${result.data.data.status}`);
        console.log(`   📈 Progress: ${result.data.data.progress}%`);
      } else {
        console.log(`   ❌ Failed with status ${result.status}`);
      }
    } catch (error) {
      console.log('   ❌ Test failed:', error.message);
    }
  }

  // Test 3: Get History
  console.log('\n3️⃣ Testing GET /enhance (history)');
  try {
    const result = await client.getHistory({
      page: 1,
      pageSize: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    
    if (result.status === 200) {
      console.log('   ✅ History retrieved successfully');
      console.log(`   📚 Total items: ${result.data.data.pagination.totalItems}`);
      console.log(`   📄 Items on page: ${result.data.data.items.length}`);
    } else {
      console.log(`   ❌ Failed with status ${result.status}`);
    }
  } catch (error) {
    console.log('   ❌ Test failed:', error.message);
  }

  // Test 4: Cancel Enhancement
  if (enhancementId) {
    console.log('\n4️⃣ Testing DELETE /enhance/{id}');
    try {
      const result = await client.cancel(enhancementId);
      
      if (result.status === 200) {
        console.log('   ✅ Enhancement cancelled successfully');
        console.log(`   🛑 Job removed: ${result.data.data.jobRemoved}`);
      } else {
        console.log(`   ❌ Failed with status ${result.status}`);
      }
    } catch (error) {
      console.log('   ❌ Test failed:', error.message);
    }
  }

  // Test 5: Rate Limiting
  console.log('\n5️⃣ Testing Rate Limiting');
  console.log('   ⏳ Sending rapid requests...');
  
  let rateLimitHit = false;
  for (let i = 0; i < 5; i++) {
    try {
      const result = await client.getHistory();
      if (result.status === 429) {
        rateLimitHit = true;
        console.log(`   ✅ Rate limit enforced after ${i + 1} requests`);
        console.log(`   ⏰ Retry after: ${result.data.error.details.retryAfter}s`);
        break;
      }
    } catch (error) {
      // Ignore errors for this test
    }
  }
  
  if (!rateLimitHit) {
    console.log('   ℹ️  Rate limit not hit (might be disabled in dev)');
  }

  console.log('\n✨ API tests completed!\n');
}

// Run tests
runTests().catch(console.error);

// Instructions for creating a test PDF
console.log(`
📝 To run these tests, you need:

1. A valid API token (set API_TOKEN environment variable)
2. A test PDF file at: ${TEST_FILE_PATH}

You can create a simple test PDF using:
- macOS: Print any document to PDF
- Linux: Use LibreOffice or similar
- Or download a sample PDF from the internet

Example:
  API_TOKEN=your-token-here node scripts/test-api.js
`);