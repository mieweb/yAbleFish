/**
 * Medical Terminology Database - Browser Version
 * 
 * Simplified version for browser client without Node.js dependencies
 */

export interface MedicalCode {
  code: string;
  description: string;
  type: 'icd10' | 'rxnorm' | 'snomed' | 'cpt';
  category?: string;
}

export interface MedicalTerm {
  term: string;
  codes: MedicalCode[];
  aliases?: string[];
  contextHints?: string[];
}

export class MedicalTerminology {
  private terms: Map<string, MedicalTerm> = new Map();
  private codeIndex: Map<string, MedicalTerm> = new Map();
  private aliasIndex: Map<string, MedicalTerm> = new Map();

  constructor() {
    this.initializeTerminology();
  }

  private initializeTerminology(): void {
    const medicalTerms: MedicalTerm[] = [
      // ICD-10 Conditions
      {
        term: 'hypertension',
        codes: [
          { code: 'I10', description: 'Essential hypertension', type: 'icd10', category: 'cardiovascular' }
        ],
        aliases: ['high blood pressure', 'htn'],
        contextHints: ['assessment', 'plan']
      },
      {
        term: 'congestive heart failure',
        codes: [
          { code: 'I50.9', description: 'Heart failure, unspecified', type: 'icd10', category: 'cardiovascular' }
        ],
        aliases: ['chf', 'heart failure'],
        contextHints: ['assessment', 'plan']
      },
      {
        term: 'atrial fibrillation',
        codes: [
          { code: 'I48.91', description: 'Unspecified atrial fibrillation', type: 'icd10', category: 'cardiovascular' }
        ],
        aliases: ['afib', 'a-fib'],
        contextHints: ['assessment', 'plan']
      },
      {
        term: 'chest pain',
        codes: [
          { code: 'R07.9', description: 'Chest pain, unspecified', type: 'icd10', category: 'symptoms' }
        ],
        aliases: ['thoracic pain'],
        contextHints: ['chief', 'hpi']
      },
      {
        term: 'shortness of breath',
        codes: [
          { code: 'R06.02', description: 'Shortness of breath', type: 'icd10', category: 'symptoms' }
        ],
        aliases: ['dyspnea', 'sob', 'breathlessness'],
        contextHints: ['chief', 'hpi']
      },
      // Medications (RxNorm)
      {
        term: 'aspirin 81 mg',
        codes: [
          { code: '243670', description: 'aspirin 81 MG Enteric Coated Tablet', type: 'rxnorm', category: 'medication' }
        ],
        aliases: ['baby aspirin', 'low dose aspirin'],
        contextHints: ['meds', 'plan']
      },
      {
        term: 'lisinopril 10 mg',
        codes: [
          { code: '314076', description: 'lisinopril 10 MG Oral Tablet', type: 'rxnorm', category: 'medication' }
        ],
        contextHints: ['meds', 'plan']
      },
      {
        term: 'warfarin 5 mg',
        codes: [
          { code: '855332', description: 'warfarin sodium 5 MG Oral Tablet', type: 'rxnorm', category: 'medication' }
        ],
        aliases: ['coumadin 5 mg'],
        contextHints: ['meds', 'plan']
      },
      {
        term: 'furosemide 20 mg',
        codes: [
          { code: '310429', description: 'furosemide 20 MG Oral Tablet', type: 'rxnorm', category: 'medication' }
        ],
        aliases: ['lasix 20 mg'],
        contextHints: ['meds', 'plan']
      },
      // Allergies
      {
        term: 'penicillin',
        codes: [
          { code: 'Z88.0', description: 'Allergy status to penicillin', type: 'icd10', category: 'allergy' }
        ],
        aliases: ['pcn'],
        contextHints: ['allergies']
      },
      {
        term: 'sulfonamides',
        codes: [
          { code: 'Z88.2', description: 'Allergy status to sulfonamides', type: 'icd10', category: 'allergy' }
        ],
        aliases: ['sulfa'],
        contextHints: ['allergies']
      },
      // Additional common medications that might conflict
      {
        term: 'amoxicillin',
        codes: [
          { code: '308191', description: 'amoxicillin 500 MG Oral Capsule', type: 'rxnorm', category: 'medication' }
        ],
        contextHints: ['meds', 'plan']
      }
    ];

    // Index all terms
    medicalTerms.forEach(term => this.indexTerm(term));
  }

  private indexTerm(term: MedicalTerm): void {
    const normalizedTerm = this.normalizeTerm(term.term);
    this.terms.set(normalizedTerm, term);

    term.codes.forEach(code => {
      this.codeIndex.set(code.code, term);
    });

    term.aliases?.forEach(alias => {
      const normalizedAlias = this.normalizeTerm(alias);
      this.aliasIndex.set(normalizedAlias, term);
    });
  }

  private normalizeTerm(term: string): string {
    return term.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

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

  getTerm(termName: string): MedicalTerm | undefined {
    const normalized = this.normalizeTerm(termName);
    return this.terms.get(normalized) || this.aliasIndex.get(normalized);
  }

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
      .slice(0, 20);
  }

  private calculateRelevance(termName: string, partial: string, context: string | undefined, term: MedicalTerm): number {
    let score = 0;

    if (termName.startsWith(partial)) {
      score += 10;
    }

    score += Math.max(0, 10 - termName.length / 2);

    if (context && term.contextHints?.includes(context)) {
      score += 5;
    }

    if (term.codes.some(code => code.type === 'icd10')) {
      score += 3;
    }

    return score;
  }

  validateCode(code: string): { valid: boolean; term?: MedicalTerm; message?: string } {
    const term = this.codeIndex.get(code);
    
    if (term) {
      return { valid: true, term };
    }

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

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}