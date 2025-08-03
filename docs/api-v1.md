# BeautifyAI API v1 Documentation

## Overview

The BeautifyAI API provides programmatic access to document enhancement capabilities. All API endpoints require authentication and are rate-limited based on your subscription tier.

## Base URL

```
https://api.beautifyai.com/api/v1
```

## Authentication

All API requests must include a Bearer token in the Authorization header:

```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

You can obtain an access token by:
1. Using your Supabase authentication token from the web app
2. Creating an API key from your dashboard (coming soon)

## Rate Limits

Rate limits are applied per IP address and per user based on subscription tier:

- **Anonymous**: 100 requests per hour
- **Free tier**: 10 enhancements per hour
- **Basic tier**: 50 enhancements per hour  
- **Pro tier**: 200 enhancements per hour
- **Premium tier**: 1000 enhancements per hour

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when the rate limit resets
- `Retry-After`: Seconds to wait before retrying (on 429 responses)

## Response Format

All responses follow a consistent format:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2025-01-18T12:00:00Z",
    "version": "v1",
    "requestId": "req_1234567890_abcdef"
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... }
  },
  "meta": { ... }
}
```

## Endpoints

### Create Enhancement

Start a new document enhancement job.

**POST** `/enhance`

#### Request

**Headers:**
- `Content-Type: multipart/form-data`
- `Authorization: Bearer YOUR_TOKEN`

**Form Data:**
- `file` (required): The document file to enhance
  - Supported formats: PDF, PNG, JPG, WEBP, PPT, PPTX
  - Maximum size: 50MB
- `settings` (optional): JSON string with enhancement settings

**Settings Object:**
```json
{
  "documentType": "worksheet|presentation|marketing|infographic|other",
  "enhancementSettings": {
    "colorPalette": "vibrant|pastel|monochrome|professional|auto",
    "style": "modern|playful|elegant|minimalist|auto",
    "targetAudience": "children|teenagers|adults|professionals|general",
    "preserveContent": true,
    "enhancementLevel": "subtle|moderate|dramatic"
  },
  "priority": "low|normal|high",
  "webhookUrl": "https://your-domain.com/webhook",
  "metadata": {
    "customField": "value"
  }
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "enh_abc123",
    "documentId": "doc_xyz789",
    "status": "pending",
    "progress": 0,
    "queuePosition": 5,
    "estimatedWaitTime": 120,
    "createdAt": "2025-01-18T12:00:00Z",
    "links": {
      "status": "/api/v1/enhance/enh_abc123",
      "cancel": "/api/v1/enhance/enh_abc123"
    }
  }
}
```

### Get Enhancement Status

Check the status of an enhancement job.

**GET** `/enhance/{id}`

#### Response

```json
{
  "success": true,
  "data": {
    "id": "enh_abc123",
    "documentId": "doc_xyz789",
    "document": {
      "name": "worksheet.pdf",
      "type": "application/pdf",
      "size": 1234567,
      "originalUrl": "https://..."
    },
    "status": "completed",
    "progress": 100,
    "currentStage": "export",
    "createdAt": "2025-01-18T12:00:00Z",
    "updatedAt": "2025-01-18T12:05:00Z",
    "completedAt": "2025-01-18T12:05:00Z",
    "result": {
      "enhancedFileUrl": "https://...",
      "thumbnailUrl": "https://...",
      "improvements": {
        "before": 65,
        "after": 92
      },
      "enhancementsApplied": [
        "Improved color contrast",
        "Added visual hierarchy",
        "Enhanced typography"
      ],
      "processingTime": 45000,
      "reportUrl": "https://..."
    },
    "links": {
      "download": "https://...",
      "report": "https://..."
    }
  }
}
```

### Get Enhancement History

List all your enhancement jobs.

**GET** `/enhance`

#### Query Parameters

- `page` (default: 1): Page number
- `pageSize` (default: 20, max: 100): Items per page
- `status`: Filter by status (pending|processing|completed|failed|cancelled)
- `sortBy` (default: createdAt): Sort field (createdAt|updatedAt|status)
- `sortOrder` (default: desc): Sort order (asc|desc)
- `startDate`: ISO 8601 date string
- `endDate`: ISO 8601 date string

#### Response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "enh_abc123",
        "documentId": "doc_xyz789",
        "documentName": "worksheet.pdf",
        "status": "completed",
        "progress": 100,
        "createdAt": "2025-01-18T12:00:00Z",
        "updatedAt": "2025-01-18T12:05:00Z",
        "completedAt": "2025-01-18T12:05:00Z",
        "enhancedUrl": "https://...",
        "thumbnailUrl": "https://...",
        "improvements": {
          "before": 65,
          "after": 92
        },
        "links": {
          "status": "/api/v1/enhance/enh_abc123"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 45,
      "totalPages": 3
    }
  }
}
```

### Cancel Enhancement

Cancel a pending or processing enhancement job.

**DELETE** `/enhance/{id}`

#### Response

```json
{
  "success": true,
  "data": {
    "id": "enh_abc123",
    "status": "cancelled",
    "message": "Enhancement cancelled successfully",
    "jobRemoved": true
  }
}
```

## Webhooks

If you provide a `webhookUrl` when creating an enhancement, we'll send POST requests to your endpoint with status updates.

### Webhook Events

1. **enhancement.started**: Job has started processing
2. **enhancement.progress**: Progress update during processing
3. **enhancement.completed**: Job completed successfully
4. **enhancement.failed**: Job failed with error

### Webhook Payload

```json
{
  "event": "enhancement.completed",
  "timestamp": "2025-01-18T12:05:00Z",
  "data": {
    "enhancementId": "enh_abc123",
    "status": "completed",
    "progress": 100,
    "result": {
      "enhancedFileUrl": "https://...",
      "improvements": {
        "before": 65,
        "after": 92
      }
    }
  }
}
```

### Webhook Security

Webhooks include an HMAC-SHA256 signature in the `X-BeautifyAI-Signature` header if you configure a webhook secret.

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| UNAUTHORIZED | 401 | Missing or invalid authentication |
| INVALID_TOKEN | 401 | Invalid or expired token |
| INSUFFICIENT_PERMISSIONS | 403 | User lacks required permissions |
| INVALID_REQUEST | 400 | Invalid request data |
| INVALID_FILE_TYPE | 400 | Unsupported file format |
| FILE_TOO_LARGE | 400 | File exceeds size limit |
| NOT_FOUND | 404 | Resource not found |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| QUOTA_EXCEEDED | 429 | Monthly quota exceeded |
| ENHANCEMENT_FAILED | 500 | Processing failed |
| INTERNAL_ERROR | 500 | Server error |

## Code Examples

### Node.js

```javascript
const FormData = require('form-data');
const fs = require('fs');

async function enhanceDocument(filePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('settings', JSON.stringify({
    enhancementSettings: {
      style: 'modern',
      targetAudience: 'professionals'
    }
  }));

  const response = await fetch('https://api.beautifyai.com/api/v1/enhance', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN',
      ...form.getHeaders()
    },
    body: form
  });

  return response.json();
}
```

### Python

```python
import requests

def enhance_document(file_path):
    with open(file_path, 'rb') as f:
        files = {'file': f}
        data = {
            'settings': json.dumps({
                'enhancementSettings': {
                    'style': 'modern',
                    'targetAudience': 'professionals'
                }
            })
        }
        
        response = requests.post(
            'https://api.beautifyai.com/api/v1/enhance',
            headers={'Authorization': 'Bearer YOUR_TOKEN'},
            files=files,
            data=data
        )
    
    return response.json()
```

### cURL

```bash
curl -X POST https://api.beautifyai.com/api/v1/enhance \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@document.pdf" \
  -F 'settings={"enhancementSettings":{"style":"modern"}}'
```