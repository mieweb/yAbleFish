#!/bin/bash
set -e

echo "🔍 Running format check..."
npm run format:check

echo "✨ Running linting..."
npm run lint

echo "🔧 Running type check..."
npm run type-check

echo "🏗️ Building all packages..."
npm run build

echo "✅ All checks passed!"