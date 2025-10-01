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

    try {
      // Parse the document
      const parsedDoc = this.parser.parse(text);

      // Check for parse errors and document structure issues
      const parseErrors = this.validateDocumentStructure(text, document);
      diagnostics.push(...parseErrors);

      // Check for allergy conflicts
      const allergyConflicts = this.checkAllergyConflicts(parsedDoc, document);
      diagnostics.push(...allergyConflicts);

      // Validate medical codes
      const codeValidation = this.validateMedicalCodes(text, document);
      diagnostics.push(...codeValidation);

      // Check for unknown medical terms
      const unknownTerms = this.checkUnknownMedicalTerms(text, document);
      diagnostics.push(...unknownTerms);

      // Validate patient data format
      const patientValidation = this.validatePatientData(text, document);
      diagnostics.push(...patientValidation);

      // Validate medication formats
      const medicationValidation = this.validateMedicationFormats(text, document);
      diagnostics.push(...medicationValidation);

      // Validate date formats
      const dateValidation = this.validateDateFormats(text, document);
      diagnostics.push(...dateValidation);

    } catch (error) {
      // If parsing completely fails, report a critical error
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        message: `Failed to parse document: ${error instanceof Error ? error.message : 'Unknown parsing error'}`,
        code: 'PARSE_FAILURE',
        source: 'yAbelFish'
      });
    }

    return diagnostics;
  }

  /**
   * Validate document structure and detect unparsable sections
   */
  private validateDocumentStructure(text: string, document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = text.split('\n');
    
    let hasPatientSection = false;
    let hasAssessmentSection = false;
    
    lines.forEach((line, lineIndex) => {
      const lineNumber = lineIndex;
      
      // Check for invalid section headers
      if (line.trim().startsWith('#')) {
        const headerMatch = line.match(/^(#+)\s*(.*)$/);
        if (headerMatch) {
          const level = headerMatch[1].length;
          const title = headerMatch[2].trim();
          
          // Check for invalid header levels (more than 3 #)
          if (level > 3) {
            diagnostics.push({
              severity: DiagnosticSeverity.Warning,
              range: {
                start: { line: lineNumber, character: 0 },
                end: { line: lineNumber, character: line.length }
              },
              message: `Header level ${level} is too deep. Maximum recommended level is 3 for medical documentation.`,
              code: 'INVALID_HEADER_LEVEL',
              source: 'yAbelFish'
            });
          }
          
          // Check for empty headers
          if (!title) {
            diagnostics.push({
              severity: DiagnosticSeverity.Error,
              range: {
                start: { line: lineNumber, character: 0 },
                end: { line: lineNumber, character: line.length }
              },
              message: 'Empty header detected. Headers must have descriptive content.',
              code: 'EMPTY_HEADER',
              source: 'yAbelFish'
            });
          }
          
          // Track standard medical sections
          const lowerTitle = title.toLowerCase();
          if (level === 2) {
            if (lowerTitle.includes('patient')) hasPatientSection = true;
            if (lowerTitle.includes('assessment')) hasAssessmentSection = true;
            
            // Check for non-standard section headers
            const validSections = [
              'patient', 'chief complaint', 'hpi', 'history of present illness',
              'allergies', 'allergies and intolerances', 'medications', 'meds',
              'assessment', 'plan', 'review of systems', 'ros', 'physical exam',
              'physical examination', 'vitals', 'vital signs', 'social history',
              'family history', 'past medical history', 'pmh'
            ];
            
            if (!validSections.some(section => lowerTitle.includes(section))) {
              diagnostics.push({
                severity: DiagnosticSeverity.Information,
                range: {
                  start: { line: lineNumber, character: level + 1 },
                  end: { line: lineNumber, character: line.length }
                },
                message: `Non-standard section header: "${title}". Consider using standard medical documentation sections.`,
                code: 'NON_STANDARD_SECTION',
                source: 'yAbelFish'
              });
            }
          }
        } else {
          // Malformed header
          diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: {
              start: { line: lineNumber, character: 0 },
              end: { line: lineNumber, character: line.length }
            },
            message: 'Malformed header syntax. Headers should follow markdown format: # Title',
            code: 'MALFORMED_HEADER',
            source: 'yAbelFish'
          });
        }
      }
      
      // Check for unparsable medical code formats
      this.validateMedicalCodesInLine(line, lineNumber, document, diagnostics);
    });
    
    // Check for missing critical sections
    if (!hasPatientSection) {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        message: 'Document is missing a Patient section (## Patient). This is required for complete medical documentation.',
        code: 'MISSING_PATIENT_SECTION',
        source: 'yAbelFish'
      });
    }
    
    if (!hasAssessmentSection) {
      diagnostics.push({
        severity: DiagnosticSeverity.Information,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        message: 'Document may be missing an Assessment section (## Assessment). This is typically required for medical visits.',
        code: 'MISSING_ASSESSMENT_SECTION',
        source: 'yAbelFish'
      });
    }
    
    return diagnostics;
  }

  /**
   * Validate medical codes within a specific line
   */
  private validateMedicalCodesInLine(line: string, lineNumber: number, document: TextDocument, diagnostics: Diagnostic[]) {
    // Check for invalid ICD-10 codes
    const icd10Pattern = /\b[A-Z]\d{2}(\.\d+)?\b/g;
    let match;
    while ((match = icd10Pattern.exec(line)) !== null) {
      const code = match[0];
      const startChar = match.index;
      const endChar = startChar + code.length;
      
      // Validate ICD-10 format more strictly
      if (!/^[A-Z]\d{2}(\.\d{1,2})?$/.test(code)) {
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: {
            start: { line: lineNumber, character: startChar },
            end: { line: lineNumber, character: endChar }
          },
          message: `Invalid ICD-10 code format: "${code}". Expected format: A12 or A12.34`,
          code: 'INVALID_ICD10_FORMAT',
          source: 'yAbelFish'
        });
      } else {
        // Check if it's a known code
        const validation = this.terminology.validateCode(code);
        if (!validation.valid) {
          diagnostics.push({
            severity: DiagnosticSeverity.Information,
            range: {
              start: { line: lineNumber, character: startChar },
              end: { line: lineNumber, character: endChar }
            },
            message: `Unknown ICD-10 code: "${code}". Please verify this is a valid medical diagnostic code.`,
            code: 'UNKNOWN_ICD10_CODE',
            source: 'yAbelFish'
          });
        }
      }
    }
    
    // Check for suspicious RxNorm codes
    const rxnormPattern = /\b\d{4,8}\b/g;
    while ((match = rxnormPattern.exec(line)) !== null) {
      const code = match[0];
      const startChar = match.index;
      const endChar = startChar + code.length;
      
      // Basic validation for RxNorm codes (4-8 digits)
      if (code.length < 4 || code.length > 8) {
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          range: {
            start: { line: lineNumber, character: startChar },
            end: { line: lineNumber, character: endChar }
          },
          message: `Suspicious RxNorm code format: "${code}". RxNorm codes should be 4-8 digits.`,
          code: 'SUSPICIOUS_RXNORM_FORMAT',
          source: 'yAbelFish'
        });
      }
    }
  }

  /**
   * Validate patient data format
   */
  private validatePatientData(text: string, _document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = text.split('\n');
    
    lines.forEach((line, lineIndex) => {
      // Check for missing required patient fields
      if (line.toLowerCase().includes('name:') && line.split(':')[1].trim() === '') {
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          range: {
            start: { line: lineIndex, character: 0 },
            end: { line: lineIndex, character: line.length }
          },
          message: 'Patient name is required for proper medical documentation.',
          code: 'MISSING_PATIENT_NAME',
          source: 'yAbelFish'
        });
      }
      
      // Check for invalid date formats in patient data
      if (line.toLowerCase().includes('dob:') || line.toLowerCase().includes('date of birth:')) {
        const datePattern = /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/g;
        const match = datePattern.exec(line);
        if (match) {
          const dateStr = match[1];
          const startChar = match.index;
          const endChar = startChar + dateStr.length;
          
          // Validate date format consistency
          if (!/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
            diagnostics.push({
              severity: DiagnosticSeverity.Information,
              range: {
                start: { line: lineIndex, character: startChar },
                end: { line: lineIndex, character: endChar }
              },
              message: `Date format "${dateStr}" should follow MM-DD-YYYY format for consistency.`,
              code: 'INCONSISTENT_DATE_FORMAT',
              source: 'yAbelFish'
            });
          }
          
          // Check for obviously invalid dates
          if (dateStr.includes('00-00') || dateStr.includes('/00/') || dateStr.includes('-00-')) {
            diagnostics.push({
              severity: DiagnosticSeverity.Error,
              range: {
                start: { line: lineIndex, character: startChar },
                end: { line: lineIndex, character: endChar }
              },
              message: `Invalid date: "${dateStr}". Dates cannot contain zero months or days.`,
              code: 'INVALID_DATE',
              source: 'yAbelFish'
            });
          }
        }
      }
    });
    
    return diagnostics;
  }

  /**
   * Validate medication format
   */
  private validateMedicationFormats(text: string, _document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = text.split('\n');
    
    lines.forEach((line, lineIndex) => {
      // Check for medication dosage format issues
      if (line.trim().startsWith('-') && (line.toLowerCase().includes('mg') || line.toLowerCase().includes('units'))) {
        // Look for incomplete medication information
        const dosageMatch = line.match(/(\d+\s*(?:mg|units|ml|g))/i);
        if (dosageMatch && !line.match(/daily|twice|three times|as needed|prn|bid|tid|qid|q\d+h/i)) {
          diagnostics.push({
            severity: DiagnosticSeverity.Information,
            range: {
              start: { line: lineIndex, character: 0 },
              end: { line: lineIndex, character: line.length }
            },
            message: 'Medication entry may be missing frequency information (e.g., "daily", "twice daily", "as needed").',
            code: 'INCOMPLETE_MEDICATION_INFO',
            source: 'yAbelFish'
          });
        }
      }
    });
    
    return diagnostics;
  }

  /**
   * Validate date formats throughout document
   */
  private validateDateFormats(text: string, _document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = text.split('\n');
    
    const datePatterns = [
      { regex: /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g, name: 'MM/DD/YYYY or MM-DD-YYYY' },
      { regex: /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g, name: 'YYYY-MM-DD' },
      { regex: /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/gi, name: 'Month Day, Year' }
    ];
    
    lines.forEach((line, lineIndex) => {
      datePatterns.forEach(pattern => {
        let match;
        while ((match = pattern.regex.exec(line)) !== null) {
          const dateStr = match[0];
          const startChar = match.index;
          const endChar = startChar + dateStr.length;
          
          // Check for obviously invalid dates
          if (dateStr.includes('00-00') || dateStr.includes('/00/') || dateStr.includes('-00-')) {
            diagnostics.push({
              severity: DiagnosticSeverity.Error,
              range: {
                start: { line: lineIndex, character: startChar },
                end: { line: lineIndex, character: endChar }
              },
              message: `Invalid date: "${dateStr}". Dates cannot contain zero months or days.`,
              code: 'INVALID_DATE',
              source: 'yAbelFish'
            });
          }
        }
      });
    });
    
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
        .filter((match: any) =>
          match.term.codes.some((code: any) => code.category === 'allergy')
        )
        .map((match: any) => match.term.term.toLowerCase())
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

      medicationTerms.forEach((medMatch: any) => {
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
   * Validate medical codes in text (enhanced version)
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
        const position = document.positionAt(match.index);
        const range: Range = {
          start: position,
          end: document.positionAt(match.index + code.length),
        };
        
        // Enhanced validation with format checking
        if (pattern.type === 'ICD-10') {
          // Strict ICD-10 format validation
          if (!/^[A-Z]\d{2}(\.\d{1,2})?$/.test(code)) {
            diagnostics.push({
              severity: DiagnosticSeverity.Error,
              range,
              message: `Invalid ICD-10 code format: "${code}". Expected format: A12 or A12.34`,
              code: 'INVALID_ICD10_FORMAT',
              source: 'yAbelFish',
            });
            continue;
          }
        }
        
        const validation = this.terminology.validateCode(code);
        if (!validation.valid) {
          diagnostics.push({
            severity: DiagnosticSeverity.Information,
            range,
            message:
              validation.message || `Unknown ${pattern.type} code: ${code}. Please verify this is a valid medical code.`,
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
    _document: TextDocument
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
