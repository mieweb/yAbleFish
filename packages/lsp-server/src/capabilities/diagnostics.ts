/**
 * LSP Diagnostics Provider
 *
 * Provides real-time validation and diagnostics for medical documentation.
 */

import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { MedicalTerminology } from '../medical/terminology';
import { YAbelParser, ParsedDocument } from '../parser/yabel-parser';

export class DiagnosticsProvider {
  constructor(
    private terminology: MedicalTerminology,
    private parser: YAbelParser
  ) {}

  /**
   * Validate document and return diagnostics
   */
  async validateDocument(document: TextDocument): Promise<Diagnostic[]> {
    const text = document.getText();
    const diagnostics: Diagnostic[] = [];

    // Parse the document
    const parsedDoc = this.parser.parse(text);

    // Check for allergy conflicts
    const allergyConflicts = this.checkAllergyConflicts(parsedDoc, document);
    diagnostics.push(...allergyConflicts);

    // Validate medical codes
    const codeValidation = this.validateMedicalCodes(text, document);
    diagnostics.push(...codeValidation);

    // Check for unknown medical terms
    const unknownTerms = this.checkUnknownMedicalTerms(text, document);
    diagnostics.push(...unknownTerms);

    return diagnostics;
  }

  /**
   * Check for allergy conflicts in medications
   */
  private checkAllergyConflicts(
    parsedDoc: ParsedDocument,
    document: TextDocument
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Get allergies section
    const allergiesSection = YAbelParser.getSectionByType(
      parsedDoc,
      'allergies'
    );
    if (!allergiesSection) return diagnostics;

    // Extract known allergies
    const allergyTerms = this.terminology.findTermsInText(
      allergiesSection.content
    );
    const patientAllergies = new Set(
      allergyTerms
        .filter(match =>
          match.term.codes.some(code => code.category === 'allergy')
        )
        .map(match => match.term.term.toLowerCase())
    );

    // Check medications section for conflicts
    const medicationsSection = YAbelParser.getSectionByType(
      parsedDoc,
      'medications'
    );
    if (medicationsSection && patientAllergies.size > 0) {
      const medicationTerms = this.terminology.findTermsInText(
        medicationsSection.content
      );

      medicationTerms.forEach(medMatch => {
        // Check for penicillin allergy vs penicillin-based medications
        if (
          patientAllergies.has('penicillin allergy') ||
          patientAllergies.has('penicillin')
        ) {
          const medName = medMatch.term.term.toLowerCase();
          if (
            medName.includes('amoxicillin') ||
            medName.includes('ampicillin') ||
            medName.includes('penicillin')
          ) {
            const range = this.createRange(
              document,
              medicationsSection.range.start.line + 1,
              medMatch.start,
              medMatch.end
            );

            diagnostics.push({
              severity: DiagnosticSeverity.Warning,
              range,
              message: `Potential allergy conflict: Patient has penicillin allergy, prescribed ${medMatch.match}`,
              code: 'ALLERGY_CONFLICT',
              source: 'yAbelFish',
            });
          }
        }

        // Check for sulfa allergy conflicts
        if (
          patientAllergies.has('sulfonamide allergy') ||
          patientAllergies.has('sulfa allergy')
        ) {
          const medName = medMatch.term.term.toLowerCase();
          if (
            medName.includes('sulfamethoxazole') ||
            medName.includes('sulfa')
          ) {
            const range = this.createRange(
              document,
              medicationsSection.range.start.line + 1,
              medMatch.start,
              medMatch.end
            );

            diagnostics.push({
              severity: DiagnosticSeverity.Warning,
              range,
              message: `Potential allergy conflict: Patient has sulfa allergy, prescribed ${medMatch.match}`,
              code: 'ALLERGY_CONFLICT',
              source: 'yAbelFish',
            });
          }
        }
      });
    }

    return diagnostics;
  }

  /**
   * Validate medical codes in text
   */
  private validateMedicalCodes(
    text: string,
    document: TextDocument
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Look for code patterns like ICD-10 (A12.3), RxNorm (123456)
    const codePatterns = [
      { regex: /\b[A-Z]\d{2}(\.\d+)?\b/g, type: 'ICD-10' },
      { regex: /\b\d{5,8}\b/g, type: 'RxNorm' },
    ];

    codePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        const code = match[0];
        const validation = this.terminology.validateCode(code);

        if (!validation.valid) {
          const position = document.positionAt(match.index);
          const range: Range = {
            start: position,
            end: document.positionAt(match.index + code.length),
          };

          diagnostics.push({
            severity: DiagnosticSeverity.Information,
            range,
            message:
              validation.message || `Unknown ${pattern.type} code: ${code}`,
            code: 'UNKNOWN_CODE',
            source: 'yAbelFish',
          });
        }
      }
    });

    return diagnostics;
  }

  /**
   * Check for potentially misspelled or unknown medical terms
   */
  private checkUnknownMedicalTerms(
    text: string,
    document: TextDocument
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Look for medical-sounding terms that aren't in our terminology
    const lines = text.split('\n');

    lines.forEach((line, lineIndex) => {
      // Skip headings and structured data
      if (line.trim().startsWith('#') || line.includes(':')) {
        return;
      }

      // Look for potential medical terms (capitalized words, medication patterns)
      const medicalPatterns = [
        /\b[A-Z][a-z]+(?:in|ol|ide|ine|ate)\b/g, // Common medication suffixes
        /\b\d+\s?mg\b/gi, // Dosage patterns without medication names
      ];

      medicalPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(line)) !== null) {
          const term = match[0];
          const foundTerm = this.terminology.getTerm(term);

          if (!foundTerm && term.length > 3) {
            const range: Range = {
              start: { line: lineIndex, character: match.index },
              end: { line: lineIndex, character: match.index + term.length },
            };

            diagnostics.push({
              severity: DiagnosticSeverity.Hint,
              range,
              message: `Possible medical term not in terminology database: "${term}". Consider adding standard code.`,
              code: 'UNKNOWN_MEDICAL_TERM',
              source: 'yAbelFish',
            });
          }
        }
      });
    });

    return diagnostics;
  }

  /**
   * Create a range object for diagnostics
   */
  private createRange(
    document: TextDocument,
    line: number,
    start: number,
    end: number
  ): Range {
    const startPos = document.positionAt(start);
    const endPos = document.positionAt(end);

    return {
      start: startPos,
      end: endPos,
    };
  }
}
