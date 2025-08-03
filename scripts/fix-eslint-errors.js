#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Fix unescaped entities in JSX files
function fixUnescapedEntities(content) {
  // Replace apostrophes
  content = content.replace(/([^\\])'/g, "$1&apos;");
  
  // Replace quotes - but be careful not to replace those in attributes
  content = content.replace(/([^=\\])"([^>]*?)"/g, '$1&quot;$2&quot;');
  
  return content;
}

// Remove unused imports
function removeUnusedImports(content) {
  // This is a simple approach - might need refinement
  const lines = content.split('\n');
  const importRegex = /^import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/;
  
  const usedIdentifiers = new Set();
  const importLines = [];
  
  // First pass: collect all imports and scan for usage
  lines.forEach((line, index) => {
    const match = line.match(importRegex);
    if (match) {
      importLines.push({ line, index, imports: match[1] || match[2] });
    } else {
      // Check for identifier usage (simple approach)
      const words = line.match(/\b\w+\b/g) || [];
      words.forEach(word => usedIdentifiers.add(word));
    }
  });
  
  // Filter out unused imports
  importLines.forEach(({ line, index, imports }) => {
    const importNames = imports.split(',').map(i => i.trim());
    const allUsed = importNames.every(name => {
      const cleanName = name.split(' as ')[0].trim();
      return usedIdentifiers.has(cleanName);
    });
    
    if (!allUsed) {
      lines[index] = '// ' + line + ' // TODO: Check if really unused';
    }
  });
  
  return lines.join('\n');
}

// Fix React hook dependencies
function addHookDependencies(content) {
  // This is complex and should be done manually for accuracy
  // Just add TODO comments for now
  return content.replace(
    /React Hook \w+ has missing dependencies:/g,
    '// TODO: Fix React Hook dependencies - $&'
  );
}

// Main function
async function fixFiles() {
  const files = glob.sync('**/*.{tsx,ts,jsx,js}', {
    ignore: ['node_modules/**', '.next/**', 'build/**', 'dist/**']
  });
  
  console.log(`Found ${files.length} files to process`);
  
  let fixedCount = 0;
  
  for (const file of files) {
    try {
      let content = fs.readFileSync(file, 'utf8');
      const originalContent = content;
      
      // Apply fixes based on file type
      if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
        content = fixUnescapedEntities(content);
      }
      
      // Apply to all files
      content = removeUnusedImports(content);
      
      if (content !== originalContent) {
        fs.writeFileSync(file, content);
        fixedCount++;
        console.log(`Fixed: ${file}`);
      }
    } catch (error) {
      console.error(`Error processing ${file}:`, error.message);
    }
  }
  
  console.log(`\nFixed ${fixedCount} files`);
}

// Run the fixer
fixFiles().catch(console.error);