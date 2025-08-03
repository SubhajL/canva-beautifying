#!/usr/bin/env ts-node

/**
 * Systematic warning fixer script
 * This script helps fix ESLint warnings in a structured manner
 */

import * as fs from 'fs'
import * as path from 'path'

// Type replacements mapping
const typeReplacements = new Map<string, string>([
  // Common any patterns
  ['Record<string, any>', 'Record<string, unknown>'],
  ['any[]', 'unknown[]'],
  ['(data: any)', '(data: unknown)'],
  ['(error: any)', '(error: Error | unknown)'],
  ['(event: any)', '(event: Event)'],
  ['(req: any, res: any)', '(req: Request, res: Response)'],
  ['Promise<any>', 'Promise<unknown>'],
  ['metadata: any', 'metadata: Record<string, unknown>'],
  ['style: any', 'style: React.CSSProperties'],
  ['Function', '(...args: unknown[]) => unknown'],
])

// Unused import fixes
const unusedImportPatterns = [
  { pattern: /import\s*{\s*([^}]+)\s*}\s*from\s*['"]([^'"]+)['"]/, type: 'named' },
  { pattern: /import\s+(\w+)\s+from\s*['"]([^'"]+)['"]/, type: 'default' },
]

// Function to process a file
function processFile(filePath: string): void {
  console.log(`Processing: ${filePath}`)
  
  try {
    let content = fs.readFileSync(filePath, 'utf-8')
    let modified = false
    
    // Replace any types
    for (const [pattern, replacement] of typeReplacements) {
      const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      const newContent = content.replace(regex, replacement)
      if (newContent !== content) {
        content = newContent
        modified = true
        console.log(`  Replaced: ${pattern} -> ${replacement}`)
      }
    }
    
    // Fix common any patterns with context
    content = content.replace(/:\s*any\b/g, (match, offset) => {
      const lineStart = content.lastIndexOf('\n', offset) + 1
      const lineEnd = content.indexOf('\n', offset)
      const line = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd)
      
      // Detect context and suggest appropriate type
      if (line.includes('event') || line.includes('Event')) {
        modified = true
        return ': Event'
      } else if (line.includes('error') || line.includes('Error')) {
        modified = true
        return ': Error | unknown'
      } else if (line.includes('data') || line.includes('response')) {
        modified = true
        return ': unknown'
      } else if (line.includes('style')) {
        modified = true
        return ': React.CSSProperties'
      } else if (line.includes('metadata')) {
        modified = true
        return ': Record<string, unknown>'
      }
      
      return match // Keep original if no pattern matches
    })
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf-8')
      console.log(`  ✅ File updated`)
    } else {
      console.log(`  ℹ️  No changes needed`)
    }
  } catch (error) {
    console.error(`  ❌ Error processing file: ${error}`)
  }
}

// Main execution
function main() {
  const targetFiles = [
    './app/(app)/admin/beta-analytics/page.tsx',
    './app/(app)/admin/beta-feedback/page.tsx',
    './app/api/admin/beta/messages/[messageId]/route.ts',
    './lib/enhancement/algorithms/asset-generation.ts',
    './lib/enhancement/pipeline/stages/enhancement-planning.ts',
  ]
  
  console.log('Starting systematic warning fixes...\n')
  
  for (const file of targetFiles) {
    if (fs.existsSync(file)) {
      processFile(file)
    } else {
      console.log(`❌ File not found: ${file}`)
    }
    console.log('')
  }
  
  console.log('Processing complete!')
}

// Run if executed directly
if (require.main === module) {
  main()
}