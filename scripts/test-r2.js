// Test R2 connection
// Run with: node scripts/test-r2.js

const { S3Client, PutObjectCommand, ListBucketsCommand } = require("@aws-sdk/client-s3");

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function testR2Connection() {
  console.log("Testing R2 connection...\n");

  // Check if credentials are set
  if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_ACCESS_KEY_ID) {
    console.error("❌ Missing R2 credentials in .env.local");
    console.log("\nPlease add these to your .env.local file:");
    console.log("CLOUDFLARE_ACCOUNT_ID=your_account_id");
    console.log("CLOUDFLARE_ACCESS_KEY_ID=your_access_key");
    console.log("CLOUDFLARE_SECRET_ACCESS_KEY=your_secret_key");
    return;
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
      secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
    },
  });

  try {
    // Test 1: List buckets
    console.log("1. Testing bucket access...");
    const listCommand = new ListBucketsCommand({});
    const buckets = await client.send(listCommand);
    console.log("✅ Connected to R2!");
    console.log(`   Found ${buckets.Buckets?.length || 0} buckets`);

    // Test 2: Upload a test file
    console.log("\n2. Testing file upload...");
    const testContent = "Hello from BeautifyAI test!";
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME || "beautifyai-storage",
      Key: "test/connection-test.txt",
      Body: testContent,
      ContentType: "text/plain",
    });
    
    await client.send(uploadCommand);
    console.log("✅ Successfully uploaded test file!");
    console.log("   Key: test/connection-test.txt");

    console.log("\n🎉 R2 setup is working correctly!");
    
  } catch (error) {
    console.error("❌ R2 connection failed:", error.message);
    console.log("\nTroubleshooting:");
    console.log("1. Check your credentials in .env.local");
    console.log("2. Ensure the bucket 'beautifyai-storage' exists");
    console.log("3. Verify API token has R2 read/write permissions");
  }
}

testR2Connection();