/**
 * Medical Terminology Database
 * 
 * Comprehensive medical terminology with focus on ICD-10 codes
 * as specified in Phase 1 requirements.
 */

export interface MedicalCode {
  code: string;
  description: string;
  type: 'icd10' | 'rxnorm' | 'snomed' | 'cpt';
  category?: string;
  aliases?: string[];
}

export interface MedicalTerm {
  term: string;
  codes: MedicalCode[];
  aliases?: string[];
  commonMisspellings?: string[];
  contextHints?: string[];
}

export class MedicalTerminology {
  private terms: Map<string, MedicalTerm> = new Map();
  private codeIndex: Map<string, MedicalTerm> = new Map();
  private aliasIndex: Map<string, MedicalTerm> = new Map();

  constructor() {
    this.initializeTerminology();
  }

  /**
   * Initialize medical terminology database with ICD-10 focus
   */
  private initializeTerminology(): void {
    const icd10Terms: MedicalTerm[] = [
      // Common conditions from example
      {
        term: 'hypertension',
        codes: [
          { code: 'I10', description: 'Essential hypertension', type: 'icd10', category: 'cardiovascular' },
          { code: '38341003', description: 'Hypertensive disorder', type: 'snomed' }
        ],
        aliases: ['high blood pressure', 'htn'],
        contextHints: ['assessment', 'plan', 'medical history']
      },
      {
        term: 'congestive heart failure',
        codes: [
          { code: 'I50.9', description: 'Heart failure, unspecified', type: 'icd10', category: 'cardiovascular' },
          { code: 'I50.1', description: 'Left ventricular failure', type: 'icd10', category: 'cardiovascular' }
        ],
        aliases: ['chf', 'heart failure', 'cardiac failure'],
        contextHints: ['assessment', 'plan', 'medical history']
      },
      {
        term: 'atrial fibrillation',
        codes: [
          { code: 'I48.91', description: 'Unspecified atrial fibrillation', type: 'icd10', category: 'cardiovascular' },
          { code: 'I48.0', description: 'Paroxysmal atrial fibrillation', type: 'icd10', category: 'cardiovascular' }
        ],
        aliases: ['afib', 'a-fib', 'atrial fib'],
        contextHints: ['assessment', 'plan', 'medical history']
      },
      {
        term: 'chest pain',
        codes: [
          { code: 'R06.02', description: 'Shortness of breath', type: 'icd10', category: 'symptoms' },
          { code: 'R07.89', description: 'Other chest pain', type: 'icd10', category: 'symptoms' },
          { code: 'R07.9', description: 'Chest pain, unspecified', type: 'icd10', category: 'symptoms' }
        ],
        aliases: ['thoracic pain', 'chest discomfort'],
        contextHints: ['chief complaint', 'hpi', 'symptoms']
      },
      {
        term: 'shortness of breath',
        codes: [
          { code: 'R06.02', description: 'Shortness of breath', type: 'icd10', category: 'symptoms' },
          { code: 'R06.00', description: 'Dyspnea, unspecified', type: 'icd10', category: 'symptoms' }
        ],
        aliases: ['dyspnea', 'sob', 'breathlessness', 'difficulty breathing'],
        contextHints: ['chief complaint', 'hpi', 'symptoms']
      },
      // Knee injury from example
      {
        term: 'contusion of left knee',
        codes: [
          { code: 'S80.01XA', description: 'Contusion of left knee, initial encounter', type: 'icd10', category: 'injury' }
        ],
        aliases: ['knee bruise', 'knee contusion'],
        contextHints: ['assessment', 'diagnosis', 'injury']
      }
    ];

    // RxNorm medications
    const rxnormTerms: MedicalTerm[] = [
      {
        term: 'aspirin 81 mg',
        codes: [
          { code: '243670', description: 'aspirin 81 MG Enteric Coated Tablet', type: 'rxnorm', category: 'medication' }
        ],
        aliases: ['baby aspirin', 'low dose aspirin'],
        contextHints: ['medications', 'plan']
      },
      {
        term: 'lisinopril 10 mg',
        codes: [
          { code: '314076', description: 'lisinopril 10 MG Oral Tablet', type: 'rxnorm', category: 'medication' }
        ],
        aliases: ['lisinopril 10mg tablet'],
        contextHints: ['medications', 'plan']
      },
      {
        term: 'warfarin 5 mg',
        codes: [
          { code: '855332', description: 'warfarin sodium 5 MG Oral Tablet', type: 'rxnorm', category: 'medication' }
        ],
        aliases: ['coumadin 5 mg', 'warfarin sodium 5mg'],
        contextHints: ['medications', 'plan']
      },
      {
        term: 'furosemide 20 mg',
        codes: [
          { code: '310429', description: 'furosemide 20 MG Oral Tablet', type: 'rxnorm', category: 'medication' }
        ],
        aliases: ['lasix 20 mg', 'furosemide 20mg'],
        contextHints: ['medications', 'plan']
      }
    ];

    // Common allergies
    const allergyTerms: MedicalTerm[] = [
      {
        term: 'penicillin allergy',
        codes: [
          { code: 'Z88.0', description: 'Allergy status to penicillin', type: 'icd10', category: 'allergy' }
        ],
        aliases: ['penicillin', 'pcn allergy'],
        contextHints: ['allergies', 'contraindications']
      },
      {
        term: 'sulfonamide allergy',
        codes: [
          { code: 'Z88.2', description: 'Allergy status to sulfonamides', type: 'icd10', category: 'allergy' }
        ],
        aliases: ['sulfa allergy', 'sulfonamides'],
        contextHints: ['allergies', 'contraindications']
      }
    ];

    // Index all terms
    [...icd10Terms, ...rxnormTerms, ...allergyTerms].forEach(term => {
      this.indexTerm(term);
    });
  }

  /**
   * Index a medical term for fast lookup
   */
  private indexTerm(term: MedicalTerm): void {
    // Index by main term
    const normalizedTerm = this.normalizeTerm(term.term);
    this.terms.set(normalizedTerm, term);

    // Index by codes
    term.codes.forEach(code => {
      this.codeIndex.set(code.code, term);
    });

    // Index by aliases
    term.aliases?.forEach(alias => {
      const normalizedAlias = this.normalizeTerm(alias);
      this.aliasIndex.set(normalizedAlias, term);
    });
  }

  /**
   * Normalize term for comparison (lowercase, remove punctuation)
   */
  private normalizeTerm(term: string): string {
    return term.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Find medical terms in text
   */
  findTermsInText(text: string): Array<{
    term: MedicalTerm;
    match: string;
    start: number;
    end: number;
  }> {
    const matches: Array<{
      term: MedicalTerm;
      match: string;
      start: number;
      end: number;
    }> = [];

    const normalizedText = text.toLowerCase();

    // Check all indexed terms
    for (const [normalizedTerm, term] of this.terms.entries()) {
      const regex = new RegExp(`\\b${this.escapeRegex(normalizedTerm)}\\b`, 'gi');
      let match;
      while ((match = regex.exec(normalizedText)) !== null) {
        matches.push({
          term,
          match: text.substring(match.index, match.index + match[0].length),
          start: match.index,
          end: match.index + match[0].length
        });
      }
    }

    // Check aliases
    for (const [normalizedAlias, term] of this.aliasIndex.entries()) {
      const regex = new RegExp(`\\b${this.escapeRegex(normalizedAlias)}\\b`, 'gi');
      let match;
      while ((match = regex.exec(normalizedText)) !== null) {
        matches.push({
          term,
          match: text.substring(match.index, match.index + match[0].length),
          start: match.index,
          end: match.index + match[0].length
        });
      }
    }

    return matches.sort((a, b) => a.start - b.start);
  }

  /**
   * Get term by normalized name
   */
  getTerm(termName: string): MedicalTerm | undefined {
    const normalized = this.normalizeTerm(termName);
    return this.terms.get(normalized) || this.aliasIndex.get(normalized);
  }

  /**
   * Get term by code
   */
  getTermByCode(code: string): MedicalTerm | undefined {
    return this.codeIndex.get(code);
  }

  /**
   * Get completions for partial term
   */
  getCompletions(partial: string, context?: string): Array<{
    term: MedicalTerm;
    relevance: number;
  }> {
    const normalizedPartial = this.normalizeTerm(partial);
    const completions: Array<{ term: MedicalTerm; relevance: number }> = [];

    // Check main terms
    for (const [normalizedTerm, term] of this.terms.entries()) {
      if (normalizedTerm.includes(normalizedPartial)) {
        let relevance = this.calculateRelevance(normalizedTerm, normalizedPartial, context, term);
        completions.push({ term, relevance });
      }
    }

    // Check aliases
    for (const [normalizedAlias, term] of this.aliasIndex.entries()) {
      if (normalizedAlias.includes(normalizedPartial)) {
        let relevance = this.calculateRelevance(normalizedAlias, normalizedPartial, context, term);
        completions.push({ term, relevance });
      }
    }

    return completions
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 20); // Limit to top 20 results
  }

  /**
   * Calculate relevance score for completion
   */
  private calculateRelevance(
    termName: string, 
    partial: string, 
    context: string | undefined, 
    term: MedicalTerm
  ): number {
    let score = 0;

    // Exact prefix match scores higher
    if (termName.startsWith(partial)) {
      score += 10;
    }

    // Shorter terms score higher (more likely to be intended)
    score += Math.max(0, 10 - termName.length / 2);

    // Context matching
    if (context && term.contextHints?.includes(context)) {
      score += 5;
    }

    // ICD-10 codes get priority
    if (term.codes.some(code => code.type === 'icd10')) {
      score += 3;
    }

    return score;
  }

  /**
   * Validate a medical code
   */
  validateCode(code: string): { valid: boolean; term?: MedicalTerm; message?: string } {
    const term = this.getTermByCode(code);
    
    if (term) {
      return { valid: true, term };
    }

    // Check if it looks like a valid code format
    if (/^[A-Z]\d{2}(\.\d+)?$/.test(code)) {
      return { 
        valid: false, 
        message: `ICD-10 code ${code} not found in terminology database` 
      };
    }

    if (/^\d+$/.test(code)) {
      return { 
        valid: false, 
        message: `RxNorm code ${code} not found in terminology database` 
      };
    }

    return { 
      valid: false, 
      message: `Invalid code format: ${code}` 
    };
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}