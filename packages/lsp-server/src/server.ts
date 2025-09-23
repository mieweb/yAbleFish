/**
 * yAbelFish LSP Server
 * 
 * Main Language Server Protocol implementation for yAbel medical documentation format.
 * This is the universal LSP server that can run in multiple environments:
 * - Browser Web Worker
 * - Node.js process
 * - VS Code extension host
 */

import {
  createConnection,
  TextDocuments,
  Diagnostic,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
  ServerCapabilities
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { MedicalTerminology } from './medical/terminology';
import { YAbelParser } from './parser/yabel-parser';
import { CompletionProvider } from './capabilities/completion';
import { DiagnosticsProvider } from './capabilities/diagnostics';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Initialize core components
const terminology = new MedicalTerminology();
const parser = new YAbelParser();
const completionProvider = new CompletionProvider(terminology, parser);
const diagnosticsProvider = new DiagnosticsProvider(terminology, parser);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );
  hasDiagnosticRelatedInformationCapability = !!(
    capabilities.textDocument &&
    capabilities.textDocument.publishDiagnostics &&
    capabilities.textDocument.publishDiagnostics.relatedInformation
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion.
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: [' ', '.', '-']
      },
      // Support hover information
      hoverProvider: true,
      // Support code actions
      codeActionProvider: true,
      // Support inlay hints
      inlayHintProvider: true
    }
  };

  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true
      }
    };
  }

  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(_event => {
      connection.console.log('Workspace folder change event received.');
    });
  }
});

// Cache the settings of all open documents
const documentSettings: Map<string, any> = new Map();

connection.onDidChangeConfiguration(change => {
  if (hasConfigurationCapability) {
    // Reset all cached document settings
    documentSettings.clear();
  }

  // Revalidate all open text documents
  documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<any> {
  if (!hasConfigurationCapability) {
    return Promise.resolve({
      enableDiagnostics: true,
      enableCompletions: true,
      enableHover: true
    });
  }
  let result = documentSettings.get(resource);
  if (!result) {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: 'yabelfish'
    });
    documentSettings.set(resource, result);
  }
  return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
  documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
  validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  // Get document settings
  const settings = await getDocumentSettings(textDocument.uri);
  
  if (!settings.enableDiagnostics) {
    return;
  }

  // Get diagnostics from our diagnostics provider
  const diagnostics = await diagnosticsProvider.validateDocument(textDocument);

  // Send the computed diagnostics to the client.
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// This handler provides the initial list of the completion items.
connection.onCompletion(
  async (_textDocumentPosition: TextDocumentPositionParams): Promise<CompletionItem[]> => {
    const document = documents.get(_textDocumentPosition.textDocument.uri);
    if (!document) {
      return [];
    }

    const settings = await getDocumentSettings(_textDocumentPosition.textDocument.uri);
    if (!settings.enableCompletions) {
      return [];
    }

    return completionProvider.provideCompletions(document, _textDocumentPosition.position);
  }
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  // Add additional information if needed
  return item;
});

// Handle hover requests
connection.onHover(async (params: TextDocumentPositionParams) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  const settings = await getDocumentSettings(params.textDocument.uri);
  if (!settings.enableHover) {
    return null;
  }

  const text = document.getText();
  const offset = document.offsetAt(params.position);
  
  // Find medical terms at this position
  const matches = terminology.findTermsInText(text);
  
  for (const match of matches) {
    if (offset >= match.start && offset <= match.end) {
      const term = match.term;
      const primaryCode = term.codes[0];
      
      return {
        contents: {
          kind: 'markdown',
          value: [
            `**${term.term}**`,
            '',
            `**Primary Code:** ${primaryCode.code} (${primaryCode.type.toUpperCase()})`,
            `**Description:** ${primaryCode.description}`,
            '',
            term.aliases && term.aliases.length > 0 
              ? `**Also known as:** ${term.aliases.join(', ')}`
              : ''
          ].filter(Boolean).join('\n')
        },
        range: {
          start: document.positionAt(match.start),
          end: document.positionAt(match.end)
        }
      };
    }
  }

  return null;
});

// Handle code actions (e.g., "Add ICD-10 code")
connection.onCodeAction(async (params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  // This would provide actions like "Normalize to ICD-10 code"
  // Implementation depends on specific requirements
  return [];
});

// Handle inlay hints (show codes inline)
connection.onInlayHint(async (params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  const text = document.getText();
  const matches = terminology.findTermsInText(text);
  
  return matches.map(match => {
    const primaryCode = match.term.codes[0];
    return {
      position: document.positionAt(match.end),
      label: ` ${primaryCode.code}`,
      kind: 1, // Type inlay hint
      tooltip: `${primaryCode.type.toUpperCase()}: ${primaryCode.description}`
    };
  });
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

// Export for use in other environments (web worker, etc.)
export {
  connection,
  documents,
  terminology,
  parser,
  completionProvider,
  diagnosticsProvider
};