/**
 * Medical Terminology Database - Browser Client Integration
 * 
 * This file now imports from the shared medical terminology package
 * to maintain DRY principles and single source of truth.
 */

import { 
  MedicalCode, 
  MedicalTerm, 
  MedicalTerminology, 
  medicalTerminology 
} from '@yabelfish/medical-terminology';

// Re-export for backward compatibility
export type { MedicalCode, MedicalTerm };
export { MedicalTerminology };

// Export the singleton instance for use in browser client
export { medicalTerminology };
