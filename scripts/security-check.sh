#!/bin/bash

# Security check script for local development
# Run this before committing code

echo "🔒 Running Security Checks..."
echo "=============================="

# Check for exposed secrets
echo "1. Checking for exposed secrets..."
npx gitleaks detect --source . --verbose

# Check dependencies for vulnerabilities
echo -e "\n2. Checking npm dependencies..."
npm audit --production

# Check for common security issues in code
echo -e "\n3. Running ESLint security rules..."
npx eslint . --ext .js,.jsx,.ts,.tsx --config .eslintrc.security.json

# Check TypeScript for type safety
echo -e "\n4. Running TypeScript checks..."
npm run typecheck

# Check for hardcoded secrets
echo -e "\n5. Checking for hardcoded secrets..."
grep -r -E "(api_key|apikey|secret|password|pwd|token|key)" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist \
  . | grep -v -E "(process\.env|import|export|interface|type|const.*=.*process\.env)" || true

# Check environment variables
echo -e "\n6. Checking environment variables..."
if [ -f .env.local ]; then
  echo "⚠️  Warning: .env.local file exists. Make sure it's in .gitignore"
fi

# Check for console.log statements
echo -e "\n7. Checking for console.log statements..."
grep -r "console.log" \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.next \
  . | grep -v "// eslint-disable-line" || echo "✅ No console.log statements found"

# Check file permissions
echo -e "\n8. Checking file permissions..."
find . -type f -name "*.sh" -not -path "./node_modules/*" -exec ls -la {} \;

# Summary
echo -e "\n=============================="
echo "Security check complete!"
echo "Please review any warnings above before committing."