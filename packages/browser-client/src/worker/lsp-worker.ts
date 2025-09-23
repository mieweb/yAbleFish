/**
 * LSP Worker - Browser Implementation
 *
 * This worker hosts the LSP server in a browser environment.
 * It's based on the working proof of concept but enhanced with proper LSP integration.
 */

/// <reference lib="webworker" />

import { MedicalTerminology } from '../lsp/terminology';
import { YAbelParser } from '../lsp/parser';

let port: MessagePort;

// Initialize core components
const terminology = new MedicalTerminology();
const parser = new YAbelParser();

// Store document content and extracted data
const documents = new Map<string, string>();
const extractedCodes = new Map<
  string,
  Array<{ term: string; code: string; range: any }>
>();

// Initialize when receiving port from main thread
self.onmessage = (e: MessageEvent) => {
  if (e.data?.type === 'lsp-init' && e.ports?.length) {
    port = e.ports[0];
    startWorker(port);
  }
};

function startWorker(port: MessagePort) {
  console.log('yAbelFish LSP Worker started');

  // Listen for messages from main thread
  port.onmessage = (event: MessageEvent) => {
    handleMessage(event.data);
  };
}

function handleMessage(message: any) {
  switch (message.type) {
    case 'document-changed':
      handleDocumentChange(message.uri, message.text);
      break;
    case 'get-completions':
      handleCompletions(message.uri, message.position, message.text);
      break;
    case 'get-hover':
      handleHover(message.uri, message.position, message.text);
      break;
    case 'validate-document':
      handleValidation(message.uri, message.text);
      break;
  }
}

function handleDocumentChange(uri: string, text: string) {
  documents.set(uri, text);

  // Parse document
  const parsedDoc = parser.parse(text);

  // Extract medical terms
  const matches = terminology.findTermsInText(text);
  const codes = matches.map(match => ({
    term: match.term.term,
    code: match.term.codes[0]?.code || '',
    range: {
      start: { line: 0, character: match.start },
      end: { line: 0, character: match.end },
    },
  }));

  extractedCodes.set(uri, codes);

  // Check for allergy conflicts
  const diagnostics = validateDocument(uri, text, parsedDoc);

  // Send metadata update
  port.postMessage({
    type: 'metadata-update',
    data: {
      uri,
      codes,
      diagnostics,
    },
  });
}

function handleCompletions(uri: string, position: any, text: string) {
  // Get context from URI (section type)
  let context = 'general';
  if (uri.includes('#meds') || uri.includes('#medications')) {
    context = 'medications';
  } else if (uri.includes('#allergies')) {
    context = 'allergies';
  } else if (uri.includes('#assessment') || uri.includes('#plan')) {
    context = 'assessment-plan';
  }

  // Get current word being typed
  const lines = text.split('\\n');
  const currentLine = lines[position.line] || '';
  const beforeCursor = currentLine.substring(0, position.character);
  const wordMatch = beforeCursor.match(/\\b\\w+$/);
  const partialWord = wordMatch ? wordMatch[0] : '';

  if (partialWord.length < 2) {
    port.postMessage({
      type: 'completions',
      completions: [],
    });
    return;
  }

  // Get completions from terminology
  const termCompletions = terminology.getCompletions(partialWord, context);

  const completions = termCompletions.map(completion => ({
    label: completion.term.term,
    detail: `${completion.term.codes[0]?.code} (${completion.term.codes[0]?.type.toUpperCase()})`,
    insertText: completion.term.term,
    kind: getCompletionKind(completion.term.codes[0]?.type),
    data: {
      code: completion.term.codes[0]?.code,
      type: completion.term.codes[0]?.type,
    },
  }));

  port.postMessage({
    type: 'completions',
    completions,
  });
}

function handleHover(uri: string, position: any, text: string) {
  const matches = terminology.findTermsInText(text);

  // Calculate approximate offset from position
  const lines = text.split('\\n');
  let offset = 0;
  for (let i = 0; i < position.line && i < lines.length; i++) {
    offset += lines[i].length + 1; // +1 for newline
  }
  offset += position.character;

  // Find if cursor is over a medical term
  for (const match of matches) {
    if (offset >= match.start && offset <= match.end) {
      const term = match.term;
      const primaryCode = term.codes[0];

      port.postMessage({
        type: 'hover',
        data: {
          contents: {
            kind: 'markdown',
            value: [
              `**${term.term}**`,
              '',
              `**Code:** ${primaryCode?.code} (${primaryCode?.type.toUpperCase()})`,
              `**Description:** ${primaryCode?.description}`,
              '',
              term.aliases && term.aliases.length > 0
                ? `**Also known as:** ${term.aliases.join(', ')}`
                : '',
            ]
              .filter(Boolean)
              .join('\\n'),
          },
          range: {
            start: { line: position.line, character: match.start },
            end: { line: position.line, character: match.end },
          },
        },
      });
      return;
    }
  }

  port.postMessage({
    type: 'hover',
    data: null,
  });
}

function handleValidation(uri: string, text: string) {
  const parsedDoc = parser.parse(text);
  const diagnostics = validateDocument(uri, text, parsedDoc);

  port.postMessage({
    type: 'diagnostics',
    data: {
      uri,
      diagnostics,
    },
  });
}

function validateDocument(
  uri: string,
  text: string,
  parsedDoc: any
): Array<any> {
  const diagnostics: Array<any> = [];

  // Check for allergy conflicts
  const allergySection = YAbelParser.getSectionByType(parsedDoc, 'allergies');
  const medicationSection = YAbelParser.getSectionByType(
    parsedDoc,
    'medications'
  );

  if (allergySection && medicationSection) {
    const allergyTerms = terminology.findTermsInText(allergySection.content);
    const medicationTerms = terminology.findTermsInText(
      medicationSection.content
    );

    // Check for penicillin allergy conflicts
    const hasPenicillinAllergy = allergyTerms.some(match =>
      match.term.term.toLowerCase().includes('penicillin')
    );

    if (hasPenicillinAllergy) {
      medicationTerms.forEach(medMatch => {
        const medName = medMatch.term.term.toLowerCase();
        if (medName.includes('amoxicillin') || medName.includes('ampicillin')) {
          diagnostics.push({
            severity: 2, // Warning
            range: {
              start: { line: 0, character: medMatch.start },
              end: { line: 0, character: medMatch.end },
            },
            message: `Potential allergy conflict: Patient allergic to penicillin, prescribed ${medMatch.match}`,
            code: 'ALLERGY_CONFLICT',
            source: 'yAbelFish',
          });
        }
      });
    }
  }

  return diagnostics;
}

function getCompletionKind(codeType: string): number {
  switch (codeType) {
    case 'icd10':
      return 12; // Value
    case 'rxnorm':
      return 11; // Unit
    case 'snomed':
      return 14; // Keyword
    default:
      return 1; // Text
  }
}
