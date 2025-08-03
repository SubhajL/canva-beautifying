#!/bin/bash
echo "Starting build process..."
npm run build 2>&1 | tee build-output.log
BUILD_EXIT_CODE=$?

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo "Build succeeded!"
    echo "Checking .next directory..."
    ls -la .next/
else
    echo "Build failed with exit code: $BUILD_EXIT_CODE"
    echo "Last 50 lines of build output:"
    tail -50 build-output.log
fi