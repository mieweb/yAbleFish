# LSP Integration Testing

This directory contains comprehensive tests for the yAbelFish Language Server Protocol implementation.

## Overview

The LSP integration tests validate the real LSP server by communicating with it using the Language Server Protocol, just like a real editor would. This ensures we test the actual implementation, not mocked versions.

## Files

- **`test-lsp-comprehensive.mjs`** - Main test runner that spins up the real LSP server
- **`samples/`** - Test documents in yAbel format (`.yabl` files) with corresponding baseline files (`.yaml`)
- **`README.md`** - This documentation file

## Test Documents

### Current Sample Documents

- **`basic-visit.yabl`** - Standard medical visit with patient info, allergies, medications
- **`complex-case.yabl`** - Multi-condition case with various medical terms
- **`minimal-patient.yabl`** - Simple patient data extraction test

Each `.yabl` file has a corresponding `.yaml` baseline file that captures the expected LSP server responses for regression testing.

### Baseline Management
- **Auto-generated** - Baseline files are created automatically from real LSP server responses
- **Version controlled** - Both `.yabl` and `.yaml` files are committed to the repository
- **Self-updating** - Baselines can be regenerated when LSP behavior intentionally changes
- **No manual maintenance** - No need to manually write expected structures

## Running Tests

From the project root:

```bash
# Run all tests (workspace + LSP integration)
npm test

# Run only LSP integration tests
npm run test:lsp

# Or run directly
node test-environments/lsp-integration/test-lsp-comprehensive.mjs
```

The test runner will:
1. 🚀 Start the actual LSP server process
2. 📖 Open each sample document in the LSP
3. 🧪 Test hover, completion, and diagnostic features
4. 📊 Compare results against baselines
5. ✅ Report pass/fail status

## Test Process

### Real LSP Communication
- Spawns `node packages/lsp-server/dist/server.js --stdio`
- Communicates via JSON-RPC over stdio (like VS Code)
- Tests actual server responses, not mocked implementations

### Baseline Management
- First run creates `.yaml` baselines from actual LSP responses
- Subsequent runs compare current behavior against baselines
- Update baselines when LSP behavior intentionally changes

### What Gets Tested
- **Document processing** - Text parsing and structure recognition
- **Medical terminology** - Hover responses on medical terms
- **Completion** - Context-aware completions after headings
- **Diagnostics** - Real-time validation and error detection

## Adding New Tests

1. **Add `.yabl` file** - Create new medical document in `samples/`
2. **Run tests** - System automatically detects and processes new files
3. **Review baseline** - Check generated `.yaml` file for accuracy
4. **Commit both files** - Include both `.yabl` and `.yaml` in version control

## DRY Principle

This testing approach follows the DRY (Don't Repeat Yourself) principle by:
- ✅ Testing the real LSP server implementation
- ✅ No duplicate code or mock implementations
- ✅ Single source of truth for LSP behavior
- ✅ True end-to-end validation

## Integration with Development

These tests should be run:
- 🔄 **Before commits** - Ensure changes don't break LSP functionality
- 🚀 **In CI/CD** - Automated testing in GitHub Actions
- 🛠️ **During development** - Quick validation of LSP changes
- 📦 **Before releases** - Comprehensive regression testing

## Future Enhancements

- **Performance benchmarking** - Response time measurement
- **Stress testing** - Large document handling
- **Multi-client testing** - Concurrent LSP connections
- **Edge case validation** - Malformed document handling