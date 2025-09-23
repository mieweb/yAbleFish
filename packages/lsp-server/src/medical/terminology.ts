/**
 * Medical Terminology Database - LSP Server Integration
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
export { MedicalCode, MedicalTerm, MedicalTerminology };

// Export the singleton instance for use in LSP server
export { medicalTerminology };
