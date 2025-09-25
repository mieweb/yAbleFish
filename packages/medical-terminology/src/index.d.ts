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
export declare class MedicalTerminology {
    private terms;
    private codeIndex;
    private aliasIndex;
    constructor();
    /**
     * Initialize medical terminology database with ICD-10 focus
     */
    private initializeTerminology;
    private addTerm;
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
    }>;
    /**
     * Get term by main term name
     */
    getTerm(term: string): MedicalTerm | undefined;
    /**
     * Get term by medical code
     */
    getTermByCode(code: string): MedicalTerm | undefined;
    /**
     * Search for terms by partial text with fuzzy matching
     */
    searchTerms(query: string, limit?: number, context?: string): Array<{
        term: MedicalTerm;
        score: number;
    }>;
    /**
     * Get completions for partial term (alias for searchTerms for backward compatibility)
     */
    getCompletions(query: string, context?: string, limit?: number): Array<{
        term: MedicalTerm;
        relevance: number;
    }>;
    private calculateScore;
    /**
     * Validate a medical code
     */
    validateCode(code: string): {
        valid: boolean;
        term?: MedicalTerm;
        message?: string;
    };
    /**
     * Escape regex special characters
     */
    private escapeRegex;
}
export declare const medicalTerminology: MedicalTerminology;
export default MedicalTerminology;
//# sourceMappingURL=index.d.ts.map