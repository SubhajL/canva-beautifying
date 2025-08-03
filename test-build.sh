#!/bin/bash
cd /Users/subhajlimanond/dev/canva-beautifying
echo "Running ESLint..."
npm run lint
echo ""
echo "Running TypeScript check..."
npx tsc --noEmit