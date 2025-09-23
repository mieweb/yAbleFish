# yAbelFish LSP Server

Core Language Server Protocol implementation for yAbel medical documentation format.

## Architecture

This is the universal LSP server that can run in multiple environments:
- Browser Web Worker (current implementation)
- Node.js process (for VS Code extension)
- Hosted web service

## Features

### ✅ Phase 1: Core LSP Foundation

- **yAbel Parser**: Custom parser for medical documentation format
  - Section detection (Patient, Chief Complaint, HPI, Allergies, Medications, Assessment, Plan)
  - Metadata extraction from document structure
  - Range tracking for precise code positioning

- **Medical Terminology Database**: 
  - **ICD-10 Codes**: Common conditions with proper diagnostic codes
  - **RxNorm Codes**: Medications with standardized pharmaceutical codes  
  - **Allergy Detection**: Known allergens with conflict checking
  - **Context Awareness**: Different completions based on current section

- **LSP Capabilities**:
  - **Completions**: Context-aware medical term suggestions
  - **Diagnostics**: Real-time validation and allergy conflict detection
  - **Hover**: Medical code information on hover
  - **Code Actions**: Normalize terms to standard codes (planned)
  - **Inlay Hints**: Show medical codes inline (planned)

## Current Implementation Status

✅ **Completed**:
- Core medical terminology database (15+ terms)
- yAbel document parser with section detection
- Completion provider with context awareness
- Diagnostics provider with allergy conflict detection
- Browser-compatible implementation

🚧 **In Progress**:
- Full LSP protocol implementation
- Node.js compatibility for VS Code extension
- Extended medical terminology database

## Medical Terminology Coverage

- **Cardiovascular**: Hypertension, CHF, Atrial Fibrillation
- **Symptoms**: Chest pain, Shortness of breath
- **Medications**: Aspirin, Lisinopril, Warfarin, Furosemide, Amoxicillin
- **Allergies**: Penicillin, Sulfonamides
- **Conflict Detection**: Penicillin family cross-reactions

## Usage

```typescript
import { MedicalTerminology, YAbelParser } from '@yabelfish/lsp-server';

const terminology = new MedicalTerminology();
const parser = new YAbelParser();

// Parse document
const document = parser.parse(medicalText);

// Find medical terms
const terms = terminology.findTermsInText(medicalText);

// Get completions
const completions = terminology.getCompletions('chest', 'chief-complaint');
```

## Future Enhancements

- SNOMED-CT integration
- CPT code support
- FHIR compatibility
- Extended allergy database
- Drug interaction checking