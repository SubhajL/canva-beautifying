#!/usr/bin/env tsx

import { ExportService } from '../lib/export/export-service'
import { PngExporter } from '../lib/export/exporters/png-exporter'
import { JpgExporter } from '../lib/export/exporters/jpg-exporter'
import { PdfExporter } from '../lib/export/exporters/pdf-exporter'
import { CanvaExporter } from '../lib/export/exporters/canva-exporter'
import { config } from 'dotenv'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Load environment variables
config({ path: '.env.local' })

// Create output directory
const OUTPUT_DIR = join(process.cwd(), 'test-output', 'exports')
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true })
}

// Mock R2 upload for testing
const mockUploadToR2 = async (buffer: Buffer, key: string): Promise<string> => {
  const fileName = key.split('/').pop() || 'export.bin'
  const outputPath = join(OUTPUT_DIR, fileName)
  writeFileSync(outputPath, buffer)
  console.log(`   📁 Saved to: ${outputPath}`)
  return `file://${outputPath}`
}

// Monkey-patch the upload function for testing
import * as r2Module from '../lib/r2/client'
(r2Module as any).uploadToR2 = mockUploadToR2

async function testExportService() {
  console.log('📦 Testing Export Service...\n')
  console.log(`📁 Output directory: ${OUTPUT_DIR}\n`)

  const exportService = new ExportService()
  
  // Test data
  const testImageUrl = 'https://picsum.photos/1920/1080' // Random test image
  const testDocument = {
    documentId: 'test-doc-123',
    userId: 'test-user-456',
    enhancedUrl: testImageUrl,
    metadata: {
      title: 'Test Document',
      enhancedAt: new Date().toISOString(),
      enhancements: {
        typography: { headings: ['Title 1', 'Title 2'] },
        decorativeElements: [
          {
            type: 'circle',
            position: { x: 100, y: 100 },
            size: { width: 50, height: 50 },
            style: { fill: '#FF0000', opacity: 0.5 }
          }
        ]
      }
    }
  }

  // Test 1: PNG Export
  console.log('1. Testing PNG Export...')
  try {
    const pngResult = await exportService.exportDocument({
      ...testDocument,
      options: {
        format: 'png',
        scale: 1.5,
        backgroundColor: '#F0F0F0'
      }
    })
    
    if (pngResult.success) {
      console.log('✅ PNG export successful')
      console.log(`   - File size: ${(pngResult.fileSize! / 1024).toFixed(2)} KB`)
      console.log(`   - Dimensions: ${pngResult.dimensions?.width}x${pngResult.dimensions?.height}`)
      console.log(`   - Processing time: ${pngResult.processingTime}ms`)
      
      // Open the file
      if (pngResult.exportUrl?.startsWith('file://')) {
        await openFile(pngResult.exportUrl.replace('file://', ''))
      }
    } else {
      console.error('❌ PNG export failed:', pngResult.error)
    }
  } catch (error) {
    console.error('❌ PNG export error:', error)
  }

  // Test 2: JPG Export
  console.log('\n2. Testing JPG Export...')
  try {
    const jpgResult = await exportService.exportDocument({
      ...testDocument,
      options: {
        format: 'jpg',
        quality: 85,
        scale: 0.75,
        backgroundColor: '#FFFFFF'
      }
    })
    
    if (jpgResult.success) {
      console.log('✅ JPG export successful')
      console.log(`   - File size: ${(jpgResult.fileSize! / 1024).toFixed(2)} KB`)
      console.log(`   - Quality: 85%`)
      console.log(`   - Processing time: ${jpgResult.processingTime}ms`)
      
      if (jpgResult.exportUrl?.startsWith('file://')) {
        await openFile(jpgResult.exportUrl.replace('file://', ''))
      }
    } else {
      console.error('❌ JPG export failed:', jpgResult.error)
    }
  } catch (error) {
    console.error('❌ JPG export error:', error)
  }

  // Test 3: PDF Export
  console.log('\n3. Testing PDF Export...')
  try {
    const pdfResult = await exportService.exportDocument({
      ...testDocument,
      options: {
        format: 'pdf',
        preserveVectors: true,
        includeMetadata: true
      }
    })
    
    if (pdfResult.success) {
      console.log('✅ PDF export successful')
      console.log(`   - File size: ${(pdfResult.fileSize! / 1024).toFixed(2)} KB`)
      console.log(`   - Processing time: ${pdfResult.processingTime}ms`)
      
      if (pdfResult.exportUrl?.startsWith('file://')) {
        await openFile(pdfResult.exportUrl.replace('file://', ''))
      }
    } else {
      console.error('❌ PDF export failed:', pdfResult.error)
    }
  } catch (error) {
    console.error('❌ PDF export error:', error)
  }

  // Test 4: Canva Export
  console.log('\n4. Testing Canva Export...')
  try {
    const canvaResult = await exportService.exportDocument({
      ...testDocument,
      options: {
        format: 'canva'
      }
    })
    
    if (canvaResult.success) {
      console.log('✅ Canva export successful')
      console.log(`   - File size: ${(canvaResult.fileSize! / 1024).toFixed(2)} KB`)
      console.log(`   - Format: JSON`)
      console.log(`   - Processing time: ${canvaResult.processingTime}ms`)
      
      // Read and display JSON structure
      if (canvaResult.exportUrl?.startsWith('file://')) {
        const jsonPath = canvaResult.exportUrl.replace('file://', '')
        const { readFileSync } = await import('fs')
        const jsonContent = JSON.parse(readFileSync(jsonPath, 'utf-8'))
        console.log('   - Structure:', JSON.stringify(jsonContent, null, 2).substring(0, 500) + '...')
      }
    } else {
      console.error('❌ Canva export failed:', canvaResult.error)
    }
  } catch (error) {
    console.error('❌ Canva export error:', error)
  }

  // Test 5: Batch Export
  console.log('\n5. Testing Batch Export...')
  try {
    // Simulate multiple documents
    const batchDocumentIds = ['doc-1', 'doc-2', 'doc-3']
    
    console.log(`   Exporting ${batchDocumentIds.length} documents...`)
    const batchUrl = await exportService.exportBatch(
      'test-user-456',
      {
        documentIds: batchDocumentIds,
        format: 'png',
        quality: 90,
        scale: 1,
        zipFileName: 'batch-export-test.zip'
      },
      (documentId, progress) => {
        console.log(`   - ${documentId}: ${progress.status} (${progress.progress}%)`)
      }
    )
    
    console.log('✅ Batch export successful')
    console.log(`   - Archive URL: ${batchUrl}`)
  } catch (error) {
    console.error('❌ Batch export error:', error)
  }

  // Test 6: Export Progress Tracking
  console.log('\n6. Testing Progress Tracking...')
  const progressTracker = (exportService as any).progressTracker
  const allProgress = progressTracker.getAllProgress()
  console.log(`   Active exports: ${allProgress.length}`)
  allProgress.forEach((progress: any) => {
    console.log(`   - Document ${progress.documentId}: ${progress.status} (${progress.progress}%)`)
  })

  // Test 7: Export Validation
  console.log('\n7. Testing Export Validation...')
  const validationTests = [
    { format: 'png', scale: 5, expected: false, reason: 'Scale too high' },
    { format: 'jpg', quality: 150, expected: false, reason: 'Quality out of range' },
    { format: 'png', backgroundColor: 'invalid', expected: false, reason: 'Invalid color format' },
    { format: 'pdf', preserveVectors: true, expected: true, reason: 'Valid PDF options' }
  ]

  for (const test of validationTests) {
    try {
      const result = await exportService.exportDocument({
        ...testDocument,
        options: test as any
      })
      
      const isValid = result.success
      console.log(`   ${test.reason}: ${isValid === test.expected ? '✅ Pass' : '❌ Fail'}`)
    } catch (error) {
      console.log(`   ${test.reason}: ❌ Error`)
    }
  }

  console.log('\n✨ Export service tests complete!')
  console.log(`\n📁 All test files saved to: ${OUTPUT_DIR}`)
}

async function openFile(path: string) {
  try {
    if (process.platform === 'darwin') {
      await execAsync(`open "${path}"`)
    } else if (process.platform === 'win32') {
      await execAsync(`start "${path}"`)
    } else {
      await execAsync(`xdg-open "${path}"`)
    }
  } catch (error) {
    console.log(`   (Could not automatically open file: ${path})`)
  }
}

// Run tests
testExportService().catch(console.error)