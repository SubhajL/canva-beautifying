// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Add TransformStream polyfill for Node.js
if (typeof TransformStream === 'undefined') {
  global.TransformStream = class TransformStream {
    constructor() {
      this.readable = {
        getReader: () => ({
          read: async () => ({ done: true, value: undefined }),
          releaseLock: () => {},
        }),
      }
      this.writable = {
        getWriter: () => ({
          write: async () => {},
          close: async () => {},
          releaseLock: () => {},
        }),
      }
    }
  }
}

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.OPENAI_API_KEY = 'test-openai-key'
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
process.env.GOOGLE_API_KEY = 'test-google-key'
// Comment out to test fallback availability
// process.env.REPLICATE_API_TOKEN = 'test-replicate-key'
process.env.R2_ENDPOINT = 'https://test-r2.com'
process.env.R2_ACCESS_KEY_ID = 'test-access-key'
process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key'
process.env.R2_BUCKET_NAME = 'test-bucket'
process.env.R2_PUBLIC_URL = 'https://test-public-r2.com'
process.env.STRIPE_SECRET_KEY = 'sk_test_123'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123'

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

// Mock fetch
global.fetch = jest.fn()

// Mock Request and Response for Next.js
global.Request = class Request {
  constructor(url, init = {}) {
    this._url = url
    this.method = init.method || 'GET'
    this.headers = new Map(Object.entries(init.headers || {}))
    this.body = init.body
    
    // Add getter for url
    Object.defineProperty(this, 'url', {
      get: () => this._url,
      enumerable: true
    })
  }
  
  async json() {
    return JSON.parse(this.body)
  }
  
  async text() {
    return this.body
  }
  
  async formData() {
    return this.body
  }
}

global.Response = class Response {
  constructor(body, init = {}) {
    this.body = body
    this.status = init.status || 200
    this.statusText = init.statusText || 'OK'
    this.headers = new Map(Object.entries(init.headers || {}))
  }
  
  async json() {
    return typeof this.body === 'string' ? JSON.parse(this.body) : this.body
  }
  
  async text() {
    return typeof this.body === 'string' ? this.body : JSON.stringify(this.body)
  }
  
  static json(body, init = {}) {
    return new Response(JSON.stringify(body), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {})
      }
    })
  }
}

// Mock NextResponse
global.NextResponse = global.Response

// Add TextDecoder and TextEncoder for jsdom environment
const { TextDecoder, TextEncoder } = require('util')
global.TextDecoder = TextDecoder
global.TextEncoder = TextEncoder

// Mock WebSocket for Socket.io tests
const WebSocket = require('ws')
global.WebSocket = WebSocket

// Mock next/router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      replace: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn(),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
    }
  },
}))

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      refresh: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      prefetch: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock canvas for PDF and image generation
jest.mock('canvas', () => ({
  createCanvas: jest.fn(() => ({
    getContext: jest.fn(() => ({
      drawImage: jest.fn(),
      fillRect: jest.fn(),
      strokeRect: jest.fn(),
      fillText: jest.fn(),
      measureText: jest.fn(() => ({ width: 100 })),
      save: jest.fn(),
      restore: jest.fn(),
      scale: jest.fn(),
      rotate: jest.fn(),
      translate: jest.fn(),
      transform: jest.fn(),
      beginPath: jest.fn(),
      closePath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      bezierCurveTo: jest.fn(),
      quadraticCurveTo: jest.fn(),
      arc: jest.fn(),
      arcTo: jest.fn(),
      rect: jest.fn(),
      fill: jest.fn(),
      stroke: jest.fn(),
      clip: jest.fn(),
      clearRect: jest.fn(),
      putImageData: jest.fn(),
      getImageData: jest.fn(() => ({ data: new Uint8ClampedArray(4) })),
      createImageData: jest.fn(),
      setTransform: jest.fn(),
      resetTransform: jest.fn(),
      canvas: {
        toBuffer: jest.fn((callback) => callback(null, Buffer.from('fake-image-data'))),
        toDataURL: jest.fn(() => 'data:image/png;base64,fake-data'),
      }
    })),
    width: 800,
    height: 600,
    toBuffer: jest.fn((callback) => callback(null, Buffer.from('fake-image-data'))),
    toDataURL: jest.fn(() => 'data:image/png;base64,fake-data'),
  })),
  loadImage: jest.fn(() => Promise.resolve({ width: 100, height: 100 })),
  Image: class {
    constructor() {
      this.onload = null;
      this.onerror = null;
      this.src = '';
    }
    set src(value) {
      this._src = value;
      // Simulate async image loading
      setTimeout(() => {
        if (this.onload) this.onload();
      }, 0);
    }
    get src() {
      return this._src;
    }
  }
}))

// Mock sharp for image processing
jest.mock('sharp', () => {
  return jest.fn(() => ({
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    toBuffer: jest.fn(() => Promise.resolve(Buffer.from('mock-image-data'))),
    toFile: jest.fn(() => Promise.resolve()),
    metadata: jest.fn(() => Promise.resolve({ width: 100, height: 100, format: 'png' })),
    composite: jest.fn().mockReturnThis(),
    blur: jest.fn().mockReturnThis(),
    sharpen: jest.fn().mockReturnThis(),
    negate: jest.fn().mockReturnThis(),
    normalise: jest.fn().mockReturnThis(),
    normalize: jest.fn().mockReturnThis(),
    greyscale: jest.fn().mockReturnThis(),
    grayscale: jest.fn().mockReturnThis(),
    rotate: jest.fn().mockReturnThis(),
    flip: jest.fn().mockReturnThis(),
    flop: jest.fn().mockReturnThis(),
    extract: jest.fn().mockReturnThis(),
    trim: jest.fn().mockReturnThis(),
    extend: jest.fn().mockReturnThis(),
    flatten: jest.fn().mockReturnThis(),
    gamma: jest.fn().mockReturnThis(),
    tint: jest.fn().mockReturnThis(),
    toFormat: jest.fn().mockReturnThis(),
  }))
})

// Mock Replicate
jest.mock('replicate', () => {
  return jest.fn(() => ({
    run: jest.fn(() => Promise.resolve(['https://fake-image-url.com/image.png'])),
    predictions: {
      create: jest.fn(() => Promise.resolve({ id: 'fake-prediction-id' })),
      get: jest.fn(() => Promise.resolve({ 
        status: 'succeeded', 
        output: ['https://fake-image-url.com/image.png'] 
      })),
    }
  }))
})

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn(() => ({
    chat: {
      completions: {
        create: jest.fn(() => Promise.resolve({
          choices: [{ message: { content: 'Test response' } }]
        }))
      }
    },
    images: {
      generate: jest.fn(() => Promise.resolve({
        data: [{ url: 'https://fake-openai-image.com/image.png' }]
      }))
    }
  }))
})

// Mock Google Generative AI
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn(() => ({
    getGenerativeModel: jest.fn(() => ({
      generateContent: jest.fn(() => Promise.resolve({
        response: {
          text: () => 'Test response from Gemini'
        }
      }))
    }))
  }))
}))

// Mock Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn(() => ({
    messages: {
      create: jest.fn(() => Promise.resolve({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Test response from Claude' }]
      }))
    }
  }))
})

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      signUp: jest.fn(() => Promise.resolve({ data: { user: { id: 'test-user' } }, error: null })),
      signInWithPassword: jest.fn(() => Promise.resolve({ data: { user: { id: 'test-user' } }, error: null })),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(() => Promise.resolve({ data: {}, error: null })),
      limit: jest.fn().mockReturnThis(),
    })),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(() => Promise.resolve({ data: { path: 'test-path' }, error: null })),
        download: jest.fn(() => Promise.resolve({ data: Buffer.from('test'), error: null })),
        remove: jest.fn(() => Promise.resolve({ data: [], error: null })),
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://test-url.com' } })),
      }))
    }
  }))
}))

// Mock pdf-lib
jest.mock('pdf-lib', () => ({
  PDFDocument: {
    create: jest.fn(() => Promise.resolve({
      addPage: jest.fn(() => ({
        getSize: jest.fn(() => ({ width: 595, height: 842 })),
        drawImage: jest.fn(),
        drawText: jest.fn(),
      })),
      embedPng: jest.fn(() => Promise.resolve({})),
      embedJpg: jest.fn(() => Promise.resolve({})),
      save: jest.fn(() => Promise.resolve(new Uint8Array([1, 2, 3]))),
    })),
    load: jest.fn(() => Promise.resolve({
      getPages: jest.fn(() => []),
      save: jest.fn(() => Promise.resolve(new Uint8Array([1, 2, 3]))),
    }))
  },
  rgb: jest.fn(() => ({})),
  degrees: jest.fn((deg) => deg)
}))

// Mock html2canvas
jest.mock('html2canvas', () => {
  return jest.fn(() => Promise.resolve({
    toDataURL: jest.fn(() => 'data:image/png;base64,fake-data'),
    toBlob: jest.fn((callback) => callback(new Blob(['fake-data']))),
  }))
})

// Mock jspdf
jest.mock('jspdf', () => {
  return jest.fn(() => ({
    addImage: jest.fn(),
    save: jest.fn(),
    addPage: jest.fn(),
    setFontSize: jest.fn(),
    text: jest.fn(),
    internal: {
      pageSize: {
        getWidth: jest.fn(() => 210),
        getHeight: jest.fn(() => 297),
      }
    }
  }))
})

// Mock AWS S3 Client
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({
    send: jest.fn(() => Promise.resolve({
      $metadata: { httpStatusCode: 200 }
    }))
  })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  HeadObjectCommand: jest.fn(),
  ListObjectsV2Command: jest.fn()
}))

// Mock AWS S3 Request Presigner
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(() => Promise.resolve('https://signed-url.com'))
}))

// Mock archiver
jest.mock('archiver', () => {
  return jest.fn(() => {
    const eventHandlers = {}
    const mockArchive = {
      pipe: jest.fn(),
      append: jest.fn(),
      finalize: jest.fn(() => {
        // Trigger the 'end' event when finalize is called
        setTimeout(() => {
          if (eventHandlers['end']) {
            eventHandlers['end']()
          }
        }, 0)
        return Promise.resolve()
      }),
      on: jest.fn((event, handler) => {
        eventHandlers[event] = handler
      }),
    }
    return mockArchive
  })
})

// Mock jszip
jest.mock('jszip', () => {
  return jest.fn(() => ({
    file: jest.fn(),
    generateAsync: jest.fn(() => Promise.resolve(Buffer.from('mock-zip-data'))),
    loadAsync: jest.fn(() => Promise.resolve({
      files: {},
      file: jest.fn(),
    }))
  }))
})

// Mock file-saver
jest.mock('file-saver', () => ({
  saveAs: jest.fn()
}))

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  configureScope: jest.fn(),
  setUser: jest.fn(),
  setContext: jest.fn(),
  setExtra: jest.fn(),
  setTag: jest.fn(),
  addBreadcrumb: jest.fn(),
  withScope: jest.fn((callback) => callback({ setTag: jest.fn(), setExtra: jest.fn() })),
}))