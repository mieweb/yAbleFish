/**
 * LSP Completion Provider
 *
 * Provides intelligent code completion for medical terms based on context.
 */

import {
  CompletionItem,
  CompletionItemKind,
  Position,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { MedicalTerminology } from '../medical/terminology';
import { YAbelParser, ParsedDocument } from '../parser/yabel-parser';

export class CompletionProvider {
  constructor(
    private terminology: MedicalTerminology,
    private parser: YAbelParser
  ) {}

  /**
   * Provide completion items
   */
  async provideCompletions(
    document: TextDocument,
    position: Position
  ): Promise<CompletionItem[]> {
    const text = document.getText();
    const offset = document.offsetAt(position);

    // Get the word being typed
    const wordRange = this.getWordRangeAtPosition(text, offset);
    const partialWord = text.substring(wordRange.start, wordRange.end);

    if (partialWord.length < 2) {
      return []; // Don't show completions for very short inputs
    }

    // Parse document to understand context
    const parsedDoc = this.parser.parse(text);
    const context = this.getContextAtPosition(parsedDoc, position);

    // Get medical term completions
    const termCompletions = this.terminology.getCompletions(
      partialWord,
      context
    );

    // Convert to LSP completion items
    const completionItems: CompletionItem[] = termCompletions.map(
      (completion, index) => {
        const term = completion.term;
        const primaryCode = term.codes[0];

        return {
          label: term.term,
          kind: this.getCompletionKind(primaryCode.type),
          detail: `${primaryCode.code} - ${primaryCode.type.toUpperCase()}`,
          documentation: {
            kind: 'markdown',
            value: this.buildDocumentation(term),
          },
          sortText: String(index).padStart(3, '0'), // Maintain relevance order
          filterText: term.term,
          insertText: term.term,
          data: {
            term: term.term,
            codes: term.codes,
          },
        };
      }
    );

    // Add snippet completions for common patterns
    const snippetCompletions = this.getSnippetCompletions(context, partialWord);

    return [...completionItems, ...snippetCompletions];
  }

  /**
   * Get word range at position
   */
  private getWordRangeAtPosition(
    text: string,
    offset: number
  ): { start: number; end: number } {
    let start = offset;
    let end = offset;

    // Find start of word
    while (start > 0 && /\w/.test(text[start - 1])) {
      start--;
    }

    // Find end of word
    while (end < text.length && /\w/.test(text[end])) {
      end++;
    }

    return { start, end };
  }

  /**
   * Get context at position (which section we're in)
   */
  private getContextAtPosition(
    document: ParsedDocument,
    position: Position
  ): string | undefined {
    // Find the section containing this position
    for (const section of document.sections) {
      if (this.isPositionInRange(position, section.range)) {
        return section.metadata?.sectionType;
      }
    }
    return undefined;
  }

  /**
   * Check if position is within range
   */
  private isPositionInRange(position: Position, range: any): boolean {
    if (position.line < range.start.line || position.line > range.end.line) {
      return false;
    }

    if (
      position.line === range.start.line &&
      position.character < range.start.character
    ) {
      return false;
    }

    if (
      position.line === range.end.line &&
      position.character > range.end.character
    ) {
      return false;
    }

    return true;
  }

  /**
   * Get completion kind based on code type
   */
  private getCompletionKind(codeType: string): CompletionItemKind {
    switch (codeType) {
      case 'icd10':
        return CompletionItemKind.Value;
      case 'rxnorm':
        return CompletionItemKind.Unit;
      case 'snomed':
        return CompletionItemKind.Keyword;
      case 'cpt':
        return CompletionItemKind.Function;
      default:
        return CompletionItemKind.Text;
    }
  }

  /**
   * Build documentation for medical term
   */
  private buildDocumentation(term: any): string {
    let doc = `**${term.term}**\n\n`;

    // Add codes
    doc += '**Codes:**\n';
    term.codes.forEach((code: any) => {
      doc += `- ${code.code} (${code.type.toUpperCase()}): ${code.description}\n`;
    });

    // Add aliases if present
    if (term.aliases && term.aliases.length > 0) {
      doc += '\n**Also known as:** ' + term.aliases.join(', ') + '\n';
    }

    return doc;
  }

  /**
   * Get snippet completions for common medical patterns
   */
  private getSnippetCompletions(
    context: string | undefined,
    partialWord: string
  ): CompletionItem[] {
    const snippets: CompletionItem[] = [];

    if (context === 'medications' && partialWord.length >= 2) {
      snippets.push({
        label: 'medication template',
        kind: CompletionItemKind.Snippet,
        detail: 'Standard medication format',
        insertText:
          '${1:medication name} ${2:dose} ${3:frequency}\n    status: ${4:active}\n    instructions: ${5:take with food}',
        documentation: 'Insert a structured medication entry',
      });
    }

    if (context === 'assessment-plan' && partialWord.length >= 2) {
      snippets.push({
        label: 'assessment template',
        kind: CompletionItemKind.Snippet,
        detail: 'Standard assessment format',
        insertText:
          '${1:condition} - ${2:assessment}\n   - ${3:plan item 1}\n   - ${4:plan item 2}',
        documentation: 'Insert a structured assessment and plan entry',
      });
    }

    return snippets;
  }
}
