/**
 * Medical Terminology Database
 *
 * Comprehensive medical terminology with focus on ICD-10 codes
 * as specified in Phase 1 requirements.
 * 
 * This is the single source of truth for all medical terminology
 * used across the yAbleFish LSP server and browser client.
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
          {
            code: 'I10',
            description: 'Essential hypertension',
            type: 'icd10',
            category: 'cardiovascular',
          },
          {
            code: '38341003',
            description: 'Hypertensive disorder',
            type: 'snomed',
            category: 'cardiovascular',
          },
        ],
        aliases: ['high blood pressure', 'htn'],
        contextHints: ['assessment', 'plan'],
      },
      {
        term: 'congestive heart failure',
        codes: [
          {
            code: 'I50.9',
            description: 'Heart failure, unspecified',
            type: 'icd10',
            category: 'cardiovascular',
          },
        ],
        aliases: ['chf', 'heart failure'],
        contextHints: ['assessment', 'plan'],
      },
      {
        term: 'atrial fibrillation',
        codes: [
          {
            code: 'I48.91',
            description: 'Unspecified atrial fibrillation',
            type: 'icd10',
            category: 'cardiovascular',
          },
          {
            code: 'I48.0',
            description: 'Paroxysmal atrial fibrillation',
            type: 'icd10',
            category: 'cardiovascular',
          },
        ],
        aliases: ['afib', 'a-fib', 'atrial fib'],
        contextHints: ['assessment', 'plan', 'medical history'],
      },
      {
        term: 'chest pain',
        codes: [
          {
            code: 'R06.02',
            description: 'Shortness of breath',
            type: 'icd10',
            category: 'symptoms',
          },
          {
            code: 'R07.89',
            description: 'Other chest pain',
            type: 'icd10',
            category: 'symptoms',
          },
          {
            code: 'R07.9',
            description: 'Chest pain, unspecified',
            type: 'icd10',
            category: 'symptoms',
          },
        ],
        aliases: ['thoracic pain', 'chest discomfort'],
        contextHints: ['chief complaint', 'hpi', 'symptoms'],
      },
      {
        term: 'diabetes mellitus',
        codes: [
          {
            code: 'E11.9',
            description: 'Type 2 diabetes mellitus without complications',
            type: 'icd10',
            category: 'endocrine',
          },
          {
            code: 'E10.9',
            description: 'Type 1 diabetes mellitus without complications',
            type: 'icd10',
            category: 'endocrine',
          },
        ],
        aliases: ['diabetes', 'dm', 'type 2 diabetes', 'type 1 diabetes', 't2dm', 't1dm', 'diabetic'],
        contextHints: ['hpi', 'cc', 'assessment', 'plan', 'pmh'],
      },
      {
        term: 'shortness of breath',
        codes: [
          {
            code: 'R06.02',
            description: 'Shortness of breath',
            type: 'icd10',
            category: 'symptoms',
          },
        ],
        aliases: ['dyspnea', 'sob', 'difficulty breathing'],
        contextHints: ['chief complaint', 'hpi', 'symptoms'],
      },
    ];

    // RxNorm medication codes
    const rxnormTerms: MedicalTerm[] = [
      {
        term: 'lisinopril 10 mg',
        codes: [
          {
            code: '314076',
            description: 'lisinopril 10 MG Oral Tablet',
            type: 'rxnorm',
            category: 'medication',
          },
        ],
        aliases: ['lisinopril 10mg', 'lisinopril 10mg tablet'],
        contextHints: ['medications', 'plan'],
      },
      {
        term: 'lisinopril 5 mg',
        codes: [
          {
            code: '314077',
            description: 'lisinopril 5 MG Oral Tablet',
            type: 'rxnorm',
            category: 'medication',
          },
        ],
        aliases: ['lisinopril 5mg tablet', 'lisinopril 5 mg daily'],
        contextHints: ['medications', 'plan'],
      },
      {
        term: 'metformin',
        codes: [
          {
            code: '6809',
            description: 'Metformin',
            type: 'rxnorm',
            category: 'medication',
          },
        ],
        aliases: ['metformin 1000 mg', 'metformin twice daily', 'metformin 1000 mg twice daily'],
        contextHints: ['medications', 'diabetes'],
      },
      {
        term: 'insulin glargine',
        codes: [
          {
            code: '274783',
            description: 'insulin glargine',
            type: 'rxnorm',
            category: 'medication',
          },
        ],
        aliases: ['insulin glargine 20 units', 'glargine insulin', 'long-acting insulin'],
        contextHints: ['medications', 'diabetes', 'insulin'],
      },
      {
        term: 'warfarin 5 mg',
        codes: [
          {
            code: '855332',
            description: 'warfarin sodium 5 MG Oral Tablet',
            type: 'rxnorm',
            category: 'medication',
          },
        ],
        aliases: ['coumadin 5 mg', 'warfarin sodium 5mg'],
        contextHints: ['medications', 'plan'],
      },
      {
        term: 'furosemide 20 mg',
        codes: [
          {
            code: '310429',
            description: 'furosemide 20 MG Oral Tablet',
            type: 'rxnorm',
            category: 'medication',
          },
        ],
        aliases: ['lasix 20 mg', 'furosemide 20mg'],
        contextHints: ['medications', 'plan'],
      },
    ];

    // Common allergies
    const allergyTerms: MedicalTerm[] = [
      {
        term: 'penicillin allergy',
        codes: [
          {
            code: 'Z88.0',
            description: 'Allergy status to penicillin',
            type: 'icd10',
            category: 'allergy',
          },
        ],
        aliases: ['penicillin', 'pcn allergy'],
        contextHints: ['allergies', 'contraindications'],
      },
      {
        term: 'sulfonamide allergy',
        codes: [
          {
            code: 'Z88.2',
            description: 'Allergy status to sulfonamides',
            type: 'icd10',
            category: 'allergy',
          },
        ],
        aliases: ['sulfa allergy', 'sulfonamides'],
        contextHints: ['allergies', 'contraindications'],
      },
    ];

    // Index all terms
    [...icd10Terms, ...rxnormTerms, ...allergyTerms].forEach(term => {
      this.addTerm(term);
    });
  }

  private addTerm(term: MedicalTerm): void {
    // Index by main term
    this.terms.set(term.term.toLowerCase(), term);

    // Index by codes
    term.codes.forEach(code => {
      this.codeIndex.set(code.code, term);
    });

    // Index by aliases
    if (term.aliases) {
      term.aliases.forEach(alias => {
        this.aliasIndex.set(alias.toLowerCase(), term);
      });
    }
  }

  /**
   * Find all medical terms in text using greedy matching to avoid duplicates
   */
  findTermsInText(text: string): Array<{
    term: MedicalTerm;
    match: string;
    start: number;
    end: number;
    startIndex: number;
    endIndex: number;
  }> {
    const results: Array<{
      term: MedicalTerm;
      match: string;
      start: number;
      end: number;
      startIndex: number;
      endIndex: number;
    }> = [];

    // Collect all potential matches with their positions
    const allMatches: Array<{
      term: MedicalTerm;
      match: string;
      start: number;
      end: number;
    }> = [];

    // Search for all terms and aliases
    const searchTerms = new Map<string, MedicalTerm>();
    
    // Add main terms
    this.terms.forEach((term, key) => {
      searchTerms.set(key, term);
    });
    
    // Add aliases
    this.aliasIndex.forEach((term, alias) => {
      searchTerms.set(alias, term);
    });

    searchTerms.forEach((term, searchTerm) => {
      const regex = new RegExp(`\\b${this.escapeRegex(searchTerm)}\\b`, 'gi');
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        allMatches.push({
          term,
          match: match[0],
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    });

    // Sort by start position, then by length (longer matches first for same position)
    allMatches.sort((a, b) => {
      if (a.start !== b.start) {
        return a.start - b.start;
      }
      return b.match.length - a.match.length;
    });

    // Greedy matching: keep only non-overlapping matches, preferring longer ones
    const greedyMatches: Array<{
      term: MedicalTerm;
      match: string;
      start: number;
      end: number;
    }> = [];

    for (const candidate of allMatches) {
      // Check if this candidate overlaps with any already selected match
      // Also check for contextual conflicts (e.g., "CHF - Congestive heart failure")
      const hasConflict = greedyMatches.some(existing => {
        // Direct overlap
        if (candidate.start < existing.end && candidate.end > existing.start) {
          return true;
        }
        
        // Contextual conflict: check if candidate is an alias of existing term or vice versa
        // and they're close together (within 10 characters with only punctuation/whitespace)
        const distance = Math.abs(candidate.start - existing.end);
        const betweenText = text.substring(
          Math.min(existing.end, candidate.start),
          Math.max(existing.end, candidate.start)
        );
        const isCloseWithPunctuation = distance <= 10 && /^[\s\-–—,;:.]*$/.test(betweenText);
        
        if (isCloseWithPunctuation) {
          // Check if one is an alias of the other
          const candidateAliases = candidate.term.aliases || [];
          const existingAliases = existing.term.aliases || [];
          
          // Check if candidate term/aliases match existing term/aliases
          if (candidateAliases.includes(existing.term.term.toLowerCase()) ||
              existingAliases.includes(candidate.term.term.toLowerCase()) ||
              candidate.term.term.toLowerCase() === existing.term.term.toLowerCase()) {
            return true;
          }
        }
        
        return false;
      });

      if (!hasConflict) {
        greedyMatches.push({
          term: candidate.term,
          match: candidate.match,
          start: candidate.start,
          end: candidate.end,
        });
      }
    }

    // Convert to final format
    greedyMatches.forEach(match => {
      results.push({
        term: match.term,
        match: match.match,
        start: match.start,       // For LSP server compatibility
        end: match.end,           // For LSP server compatibility
        startIndex: match.start,  // For browser client compatibility
        endIndex: match.end,      // For browser client compatibility
      });
    });

    return results;
  }

  /**
   * Get term by main term name
   */
  getTerm(term: string): MedicalTerm | undefined {
    return this.terms.get(term.toLowerCase()) || this.aliasIndex.get(term.toLowerCase());
  }

  /**
   * Get term by medical code
   */
  getTermByCode(code: string): MedicalTerm | undefined {
    return this.codeIndex.get(code);
  }

  /**
   * Search for terms by partial text with fuzzy matching
   */
  searchTerms(
    query: string,
    limit: number = 10,
    context?: string
  ): Array<{ term: MedicalTerm; score: number }> {
    const results: Array<{ term: MedicalTerm; score: number }> = [];
    const queryLower = query.toLowerCase();

    // Search main terms and aliases
    const allTerms = new Set<MedicalTerm>();
    
    this.terms.forEach(term => allTerms.add(term));
    this.aliasIndex.forEach(term => allTerms.add(term));

    allTerms.forEach(term => {
      // Check main term
      let score = this.calculateScore(term.term, queryLower, context, term);
      if (score > 0) {
        results.push({ term, score });
        return;
      }

      // Check aliases
      if (term.aliases) {
        for (const alias of term.aliases) {
          score = this.calculateScore(alias, queryLower, context, term);
          if (score > 0) {
            results.push({ term, score });
            break;
          }
        }
      }
    });

    // Sort by score (highest first) and limit results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get completions for partial term (alias for searchTerms for backward compatibility)
   */
  getCompletions(
    query: string,
    context?: string,
    limit: number = 10
  ): Array<{ term: MedicalTerm; relevance: number }> {
    const results = this.searchTerms(query, limit, context);
    return results.map(result => ({
      term: result.term,
      relevance: result.score
    }));
  }

  private calculateScore(
    termName: string,
    partial: string,
    context: string | undefined,
    term: MedicalTerm
  ): number {
    const termLower = termName.toLowerCase();
    let score = 0;

    // Exact match scores highest
    if (termLower === partial) {
      score += 20;
    }
    // Contains match
    else if (termLower.includes(partial)) {
      score += 15;
    }
    // No match
    else {
      return 0;
    }

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
  validateCode(code: string): {
    valid: boolean;
    term?: MedicalTerm;
    message?: string;
  } {
    const term = this.getTermByCode(code);

    if (term) {
      return { valid: true, term };
    }

    // Check if it looks like a valid code format
    if (/^[A-Z]\d{2}(\.\d+)?$/.test(code)) {
      return {
        valid: false,
        message: `ICD-10 code ${code} not found in terminology database`,
      };
    }

    if (/^\d+$/.test(code)) {
      return {
        valid: false,
        message: `RxNorm code ${code} not found in terminology database`,
      };
    }

    return {
      valid: false,
      message: `Invalid code format: ${code}`,
    };
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// Export a singleton instance for convenience
export const medicalTerminology = new MedicalTerminology();

// Export the class for custom instantiation if needed
export default MedicalTerminology;