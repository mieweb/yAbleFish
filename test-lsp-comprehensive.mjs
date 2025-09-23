#!/usr/bin/env node

/**
 * Comprehensive LSP Test Runner
 * 
 * Tests the actual LSP server by communicating with it using the
 * Language Server Protocol, just like a real editor would.
 * 
 * This is the DRY approach - no code duplication, tests the real implementation.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

class LSPClient {
  constructor() {
    this.messageId = 0;
    this.pendingRequests = new Map();
    this.serverProcess = null;
    this.buffer = '';
  }

  async startServer() {
    console.log('🚀 Starting LSP server...');
    
    // Start the LSP server process with stdio mode
    this.serverProcess = spawn('node', [
      'packages/lsp-server/dist/server.js',
      '--stdio'
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    // Handle server output
    this.serverProcess.stdout.on('data', (data) => {
      this.handleServerMessage(data);
    });

    this.serverProcess.stderr.on('data', (data) => {
      console.error('LSP Server Error:', data.toString());
    });

    this.serverProcess.on('close', (code) => {
      console.log(`LSP server exited with code ${code}`);
    });

    // Initialize the server
    await this.initialize();
    console.log('✅ LSP server initialized');
  }

  handleServerMessage(data) {
    this.buffer += data.toString();
    
    // Process complete messages
    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;
      
      const header = this.buffer.substring(0, headerEnd);
      const contentLengthMatch = header.match(/Content-Length: (\d+)/);
      
      if (!contentLengthMatch) {
        console.error('Invalid LSP message header');
        break;
      }
      
      const contentLength = parseInt(contentLengthMatch[1]);
      const messageStart = headerEnd + 4;
      const messageEnd = messageStart + contentLength;
      
      if (this.buffer.length < messageEnd) break;
      
      const messageContent = this.buffer.substring(messageStart, messageEnd);
      this.buffer = this.buffer.substring(messageEnd);
      
      try {
        const message = JSON.parse(messageContent);
        this.processMessage(message);
      } catch (error) {
        console.error('Failed to parse LSP message:', error);
      }
    }
  }

  processMessage(message) {
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);
      
      if (message.error) {
        reject(new Error(message.error.message));
      } else {
        resolve(message.result);
      }
    } else if (message.method) {
      // Handle notifications/requests from server
      console.log('Server notification:', message.method);
    }
  }

  sendRequest(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      const message = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      this.pendingRequests.set(id, { resolve, reject });
      this.sendMessage(message);
      
      // Add timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request ${method} timed out`));
        }
      }, 10000);
    });
  }

  sendNotification(method, params) {
    const message = {
      jsonrpc: '2.0',
      method,
      params
    };
    this.sendMessage(message);
  }

  sendMessage(message) {
    const content = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;
    this.serverProcess.stdin.write(header + content);
  }

  async initialize() {
    const result = await this.sendRequest('initialize', {
      processId: process.pid,
      clientInfo: {
        name: 'LSP Test Client',
        version: '1.0.0'
      },
      capabilities: {
        textDocument: {
          synchronization: {
            dynamicRegistration: false,
            willSave: false,
            willSaveWaitUntil: false,
            didSave: false
          },
          completion: {
            dynamicRegistration: false,
            completionItem: {
              snippetSupport: false
            }
          },
          hover: {
            dynamicRegistration: false
          }
        }
      },
      workspaceFolders: null
    });

    this.sendNotification('initialized', {});
    return result;
  }

  async openDocument(uri, content) {
    this.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri,
        languageId: 'yabel',
        version: 1,
        text: content
      }
    });
  }

  async getCompletion(uri, line, character) {
    return await this.sendRequest('textDocument/completion', {
      textDocument: { uri },
      position: { line, character }
    });
  }

  async getHover(uri, line, character) {
    return await this.sendRequest('textDocument/hover', {
      textDocument: { uri },
      position: { line, character }
    });
  }

  async getDiagnostics(uri) {
    // Diagnostics are usually sent as notifications, but we can trigger them
    // by sending a change notification
    this.sendNotification('textDocument/didChange', {
      textDocument: { uri, version: 2 },
      contentChanges: []
    });
    
    // In a real test, you'd wait for the diagnostics notification
    // For now, we'll return a placeholder
    return [];
  }

  async shutdown() {
    console.log('🛑 Shutting down LSP server...');
    await this.sendRequest('shutdown', null);
    this.sendNotification('exit', null);
    
    if (this.serverProcess) {
      this.serverProcess.kill();
    }
  }
}

// Test framework functions
function assertEquals(actual, expected, message = '') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}. ${message}`);
  }
}

function assertNotNull(value, message = '') {
  if (value === null || value === undefined) {
    throw new Error(`Expected non-null value. ${message}`);
  }
}

function assertGreaterThan(actual, expected, message = '') {
  if (actual <= expected) {
    throw new Error(`Expected ${actual} to be greater than ${expected}. ${message}`);
  }
}

// Find test files
function findTestFiles() {
  const testDir = path.join(process.cwd(), 'test-documents');
  if (!fs.existsSync(testDir)) {
    throw new Error(`Test directory not found: ${testDir}`);
  }
  
  const files = fs.readdirSync(testDir);
  const yablFiles = files.filter(f => f.endsWith('.yabl'));
  
  return yablFiles.map(f => ({
    name: path.basename(f, '.yabl'),
    yablPath: path.join(testDir, f),
    yamlPath: path.join(testDir, f.replace('.yabl', '.yaml')),
    uri: `file://${path.join(testDir, f)}`
  }));
}

// Load baseline or create if missing
function loadOrCreateBaseline(yamlPath, actualResult) {
  if (fs.existsSync(yamlPath)) {
    const yamlContent = fs.readFileSync(yamlPath, 'utf8');
    return { baseline: yaml.load(yamlContent), isNew: false };
  } else {
    const baselineData = {
      ...actualResult,
      generated_at: new Date().toISOString(),
      note: "Generated baseline from real LSP - review and adjust as needed"
    };
    
    fs.writeFileSync(yamlPath, yaml.dump(baselineData, { indent: 2 }));
    console.log(`   📝 Created new baseline: ${path.basename(yamlPath)}`);
    return { baseline: baselineData, isNew: true };
  }
}

// Test a single document with the real LSP
async function testDocument(client, testFile) {
  console.log(`📄 Testing: ${testFile.name}.yabl`);
  
  // Load document content
  const content = fs.readFileSync(testFile.yablPath, 'utf8');
  console.log(`   Document loaded: ${content.length} characters`);
  
  // Open document in LSP
  await client.openDocument(testFile.uri, content);
  console.log(`   📖 Document opened in LSP`);
  
  // Test completion at various positions
  const lines = content.split('\n');
  const completionTests = [];
  
  // Test completion after headings
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('#')) {
      try {
        const completion = await client.getCompletion(testFile.uri, i + 1, 0);
        if (completion && completion.items && completion.items.length > 0) {
          completionTests.push({
            line: i + 1,
            completions: completion.items.length
          });
        }
      } catch (error) {
        console.log(`   ⚠️  Completion test failed at line ${i + 1}: ${error.message}`);
      }
    }
  }
  
  // Test hover on medical terms
  const hoverTests = [];
  const medicalTerms = ['hypertension', 'diabetes', 'aspirin', 'lisinopril'];
  
  for (const term of medicalTerms) {
    const termIndex = content.toLowerCase().indexOf(term.toLowerCase());
    if (termIndex >= 0) {
      // Convert character position to line/character
      const beforeTerm = content.substring(0, termIndex);
      const line = beforeTerm.split('\n').length - 1;
      const character = beforeTerm.split('\n').pop().length;
      
      try {
        const hover = await client.getHover(testFile.uri, line, character);
        if (hover && hover.contents) {
          hoverTests.push({
            term,
            line,
            character,
            hasHover: true
          });
        }
      } catch (error) {
        console.log(`   ⚠️  Hover test failed for ${term}: ${error.message}`);
      }
    }
  }
  
  const result = {
    document_info: {
      length: content.length,
      lines: lines.length,
      completion_tests: completionTests.length,
      hover_tests: hoverTests.length
    },
    completion_results: completionTests,
    hover_results: hoverTests
  };
  
  // Compare with baseline
  const { baseline, isNew } = loadOrCreateBaseline(testFile.yamlPath, result);
  
  if (isNew) {
    return { passed: true, isBaseline: true, message: 'New baseline created' };
  }
  
  // Compare results
  let passed = true;
  let failures = [];
  
  try {
    if (result.document_info.length !== baseline.document_info.length) {
      failures.push(`Document length: expected ${baseline.document_info.length}, got ${result.document_info.length}`);
      passed = false;
    }
    
    if (result.completion_results.length !== baseline.completion_results.length) {
      failures.push(`Completion tests: expected ${baseline.completion_results.length}, got ${result.completion_results.length}`);
      passed = false;
    }
    
    if (result.hover_results.length !== baseline.hover_results.length) {
      failures.push(`Hover tests: expected ${baseline.hover_results.length}, got ${result.hover_results.length}`);
      passed = false;
    }
    
  } catch (error) {
    failures.push(`Comparison error: ${error.message}`);
    passed = false;
  }
  
  return {
    passed,
    isBaseline: false,
    message: passed ? 'All LSP tests passed' : failures.join('; '),
    failures
  };
}

// Main test execution
async function main() {
  console.log('🧪 Real LSP Client Test Runner\n');
  
  let client;
  
  try {
    // Check if LSP server is built
    const serverPath = 'packages/lsp-server/dist/server.js';
    if (!fs.existsSync(serverPath)) {
      console.log('📦 Building LSP server...');
      const { spawn } = await import('child_process');
      await new Promise((resolve, reject) => {
        const build = spawn('npm', ['run', 'build'], { 
          stdio: 'inherit',
          cwd: 'packages/lsp-server'
        });
        build.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Build failed with code ${code}`));
        });
      });
    }
    
    // Find test files
    console.log('🔍 Scanning for test files...');
    const testFiles = findTestFiles();
    console.log(`   Found ${testFiles.length} .yabl test files`);
    
    if (testFiles.length === 0) {
      console.log('⚠️  No .yabl files found in test-documents/ directory');
      process.exit(1);
    }
    
    // Start LSP client
    client = new LSPClient();
    await client.startServer();
    
    // Run tests
    console.log('⚡ Running real LSP tests...\n');
    
    let passedTests = 0;
    let totalTests = testFiles.length;
    let baselinesCreated = 0;
    
    for (const testFile of testFiles) {
      const result = await testDocument(client, testFile);
      
      if (result.isBaseline) {
        baselinesCreated++;
        console.log(`   ✨ ${result.message}`);
      } else if (result.passed) {
        passedTests++;
        console.log(`   ✅ ${result.message}`);
      } else {
        console.log(`   ❌ ${result.message}`);
        if (result.failures) {
          result.failures.forEach(failure => console.log(`      - ${failure}`));
        }
      }
      console.log('');
    }
    
    // Summary
    console.log(`📊 LSP Test Results: ${passedTests}/${totalTests} passed`);
    if (baselinesCreated > 0) {
      console.log(`📝 Baselines created: ${baselinesCreated}`);
    }
    
    if (passedTests === totalTests) {
      console.log('🎉 All LSP tests passed! Server is working correctly.');
      process.exit(0);
    } else {
      console.log('⚠️  Some LSP tests failed. Check the server implementation.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 LSP test failed:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      await client.shutdown();
    }
  }
}

// Handle cleanup
process.on('SIGINT', async () => {
  console.log('\n🛑 Test interrupted');
  process.exit(1);
});

main().catch(console.error);