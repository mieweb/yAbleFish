/**
 * LSP Server Worker - Enhanced Diagnostics Bridge
 */

/// <reference lib="webworker" />

// Simplified worker implementation - no external dependencies
class SimpleMedicalTerminology {
  validateCode(code: string): { valid: boolean; description?: string } {
    // Basic ICD-10 format validation
    if (/^[A-Z]\d{2}(\.\d{1,2})?$/.test(code)) {
      // For now, assume format validation is sufficient
      return { valid: true, description: `Medical code ${code}` };
    }
    return { valid: false };
  }
}

class SimpleYAbelParser {
  parse(text: string): any {
    return { success: true, errors: [] };
  }
  
  validate(text: string): any[] {
    const errors = [];
    // Basic validation - could be expanded
    if (text.includes('syntax error')) {
      errors.push({ message: 'Syntax error detected', line: 0 });
    }
    return errors;
  }
}

let port: MessagePort;
let terminology: SimpleMedicalTerminology;
let parser: SimpleYAbelParser;
let documents: Map<string, { uri: string; text: string; version: number }> = new Map();

self.onmessage = (event: MessageEvent) => {
  if (event.data?.type === 'init' && event.data?.port) {
    port = event.data.port;
    setupLSPServer();
  }
};

function setupLSPServer() {
  if (!port) return;

  // Initialize components
  terminology = new SimpleMedicalTerminology();
  parser = new SimpleYAbelParser();

  port.onmessage = async (event: MessageEvent) => {
    const request = event.data;
    
    try {
      let response;
      
      switch (request.method) {
        case 'initialize':
          response = {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              capabilities: {
                textDocumentSync: 1, // Full document sync
                completionProvider: { 
                  resolveProvider: true,
                  triggerCharacters: [' ', '.', '-']
                },
                hoverProvider: true
              }
            }
          };
          break;
          
        case 'textDocument/didOpen':
          await handleDidOpen(request.params);
          response = null; // No response for notifications
          break;
          
        case 'textDocument/didChange':
          await handleDidChange(request.params);
          response = null; // No response for notifications
          break;
          
        case 'textDocument/completion':
          const completions = await handleCompletion(request.params);
          response = {
            jsonrpc: '2.0',
            id: request.id,
            result: completions
          };
          break;
          
        default:
          response = {
            jsonrpc: '2.0', 
            id: request.id,
            result: null
          };
      }
      
      if (response) {
        port.postMessage(response);
      }
    } catch (error) {
      console.error('LSP Worker error:', error);
      const errorResponse = {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
      port.postMessage(errorResponse);
    }
  };

  port.start();
}

async function handleDidOpen(params: any) {
  const { textDocument } = params;
  documents.set(textDocument.uri, {
    uri: textDocument.uri,
    text: textDocument.text,
    version: textDocument.version
  });
  
  await validateDocument(textDocument.uri, textDocument.text);
}

async function handleDidChange(params: any) {
  const { textDocument, contentChanges } = params;
  
  if (contentChanges.length > 0) {
    const change = contentChanges[0];
    documents.set(textDocument.uri, {
      uri: textDocument.uri,
      text: change.text,
      version: textDocument.version
    });
    
    await validateDocument(textDocument.uri, change.text);
  }
}

async function validateDocument(uri: string, text: string) {
  try {
    // Create comprehensive diagnostics using enhanced validation
    const diagnostics = createEnhancedDiagnostics(text);
    
    // Send diagnostics notification to client
    const notification = {
      jsonrpc: '2.0',
      method: 'textDocument/publishDiagnostics',
      params: {
        uri: uri,
        diagnostics: diagnostics
      }
    };
    
    port.postMessage(notification);
  } catch (error) {
    console.error('Validation error:', error);
  }
}

function createEnhancedDiagnostics(text: string): any[] {
  const diagnostics: any[] = [];
  const lines = text.split('\\n');
  
  lines.forEach((line, lineIndex) => {
    // Check for invalid section headers
    if (line.trim().startsWith('#')) {
      const headerMatch = line.match(/^(#+)\\s*(.*)$/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const title = headerMatch[2].trim();
        
        // Check for invalid header levels
        if (level > 3) {
          diagnostics.push({
            severity: 2, // Warning
            range: {
              start: { line: lineIndex, character: 0 },
              end: { line: lineIndex, character: line.length }
            },
            message: `Header level ${level} is too deep. Maximum recommended level is 3.`,
            code: 'INVALID_HEADER_LEVEL',
            source: 'yAbelFish LSP'
          });
        }
        
        // Check for empty headers
        if (!title) {
          diagnostics.push({
            severity: 1, // Error
            range: {
              start: { line: lineIndex, character: 0 },
              end: { line: lineIndex, character: line.length }
            },
            message: 'Empty header detected. Headers must have content.',
            code: 'EMPTY_HEADER',
            source: 'yAbelFish LSP'
          });
        }
      }
    }
    
    // Check for invalid medical codes
    validateMedicalCodesInLine(line, lineIndex, diagnostics);
  });
  
  return diagnostics;
}

function validateMedicalCodesInLine(line: string, lineIndex: number, diagnostics: any[]) {
  // Check for invalid ICD-10 codes
  const icd10Pattern = /\\b[A-Z]\\d{2}(\\.\\d+)?\\b/g;
  let match;
  while ((match = icd10Pattern.exec(line)) !== null) {
    const code = match[0];
    const startChar = match.index;
    const endChar = startChar + code.length;
    
    // Validate ICD-10 format
    if (!/^[A-Z]\\d{2}(\\.\\d{1,2})?$/.test(code)) {
      diagnostics.push({
        severity: 1, // Error
        range: {
          start: { line: lineIndex, character: startChar },
          end: { line: lineIndex, character: endChar }
        },
        message: `Invalid ICD-10 code format: \"${code}\". Expected format: A12 or A12.34`,
        code: 'INVALID_ICD10_FORMAT',
        source: 'yAbelFish LSP'
      });
    } else {
      // Check if it's a known code
      const validation = terminology.validateCode(code);
      if (!validation.valid) {
        diagnostics.push({
          severity: 3, // Information
          range: {
            start: { line: lineIndex, character: startChar },
            end: { line: lineIndex, character: endChar }
          },
          message: `Unknown ICD-10 code: \"${code}\". Please verify this is a valid medical code.`,
          code: 'UNKNOWN_ICD10_CODE',
          source: 'yAbelFish LSP'
        });
      }
    }
  }
}

async function handleCompletion(params: any) {
  // Simple completion implementation
  return { items: [] };
}
