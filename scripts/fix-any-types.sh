#!/bin/bash

# Script to help identify and fix 'any' types in the codebase

echo "Finding all files with 'any' types..."

# Find all TypeScript files with 'any' types
files_with_any=$(grep -r ":\s*any" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v "node_modules" | grep -v ".next" | cut -d: -f1 | sort -u)

# Count total any types
total_any=$(grep -r ":\s*any" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v "node_modules" | grep -v ".next" | wc -l)

echo "Total 'any' types found: $total_any"
echo ""
echo "Files with most 'any' types:"

# Count any types per file and sort
for file in $files_with_any; do
  count=$(grep -c ":\s*any" "$file" 2>/dev/null || echo 0)
  if [ "$count" -gt 0 ]; then
    echo "$count: $file"
  fi
done | sort -nr | head -20

echo ""
echo "Common patterns of 'any' usage:"
grep -r ":\s*any" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v "node_modules" | grep -v ".next" | sed 's/.*:\s*//' | sort | uniq -c | sort -nr | head -10