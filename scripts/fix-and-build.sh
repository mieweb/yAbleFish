#!/bin/bash
set -e

echo "🔧 Fixing linting issues..."
npm run lint:fix

echo "✨ Formatting code..."
npm run format

echo "🏗️ Building all packages..."
npm run build

echo "✅ Code fixed and built successfully!"