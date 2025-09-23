import { z } from 'zod';
import * as yaml from 'js-yaml';

// Directly import yCard schemas to avoid build issues
const AddressSchema = z
  .object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postal_code: z
      .union([z.string(), z.number()])
      .transform(val => String(val))
      .optional(),
    country: z.string().optional(),
  })
  .optional();

const PhoneSchema = z.union([
  z.string(),
  z.object({
    type: z.string(),
    number: z.string(),
  }),
]);

// Medical-specific extensions to yCard Person schema
export const MedicalPatientSchema = z
  .object({
    // Core identifiers (required for medical records)
    uid: z.string(),
    mrn: z.string().optional(), // Medical Record Number

    // Standard yCard person fields with medical aliases
    name: z.string().optional(),
    firstName: z.string().optional(), // Medical alias
    surname: z.string().optional(),
    lastName: z.string().optional(), // Medical alias

    // Medical-specific personal information
    dob: z
      .union([z.string(), z.date()])
      .transform(val =>
        val instanceof Date ? val.toISOString().split('T')[0] : val
      )
      .optional(), // Date of Birth (ISO format)
    dateOfBirth: z
      .union([z.string(), z.date()])
      .transform(val =>
        val instanceof Date ? val.toISOString().split('T')[0] : val
      )
      .optional(), // Alternative format
    age: z.number().optional(),
    gender: z.enum(['M', 'F', 'O', 'U']).optional(), // Male, Female, Other, Unknown
    sex: z.enum(['M', 'F', 'O', 'U']).optional(), // Biological sex

    // Contact information (from yCard)
    email: z.union([z.string(), z.array(z.string())]).optional(),
    phone: z.union([z.array(PhoneSchema), PhoneSchema]).optional(),
    address: AddressSchema,

    // Medical-specific fields
    emergencyContact: z
      .object({
        name: z.string(),
        relationship: z.string().optional(),
        phone: z.string(),
        email: z.string().optional(),
      })
      .optional(),

    insurance: z
      .object({
        primary: z
          .object({
            provider: z.string(),
            memberId: z.string(),
            groupId: z.string().optional(),
          })
          .optional(),
        secondary: z
          .object({
            provider: z.string(),
            memberId: z.string(),
            groupId: z.string().optional(),
          })
          .optional(),
      })
      .optional(),

    // Medical history references
    allergies: z.array(z.string()).optional(),
    medications: z.array(z.string()).optional(),
    conditions: z.array(z.string()).optional(),

    // Administrative
    primaryPhysician: z.string().optional(),
    lastVisit: z
      .union([z.string(), z.date()])
      .transform(val =>
        val instanceof Date ? val.toISOString().split('T')[0] : val
      )
      .optional(), // ISO date
    nextAppointment: z
      .union([z.string(), z.date()])
      .transform(val =>
        val instanceof Date ? val.toISOString().split('T')[0] : val
      )
      .optional(), // ISO date
  })
  .transform(patient => ({
    ...patient,
    // Resolve medical aliases to canonical fields
    name: patient.name || patient.firstName,
    surname: patient.surname || patient.lastName,
    dob: patient.dob || patient.dateOfBirth,
  }));

// Patient document schema
export const PatientDocumentSchema = z.object({
  patient: MedicalPatientSchema,
  sections: z.record(z.any()).optional(), // Flexible sections for medical notes
});

export type MedicalPatient = z.infer<typeof MedicalPatientSchema>;
export type PatientDocument = z.infer<typeof PatientDocumentSchema>;

/**
 * Simple YAML parser for patient data (without js-yaml dependency)
 */
export class PatientParser {
  private schema: z.ZodSchema;

  constructor(schema: z.ZodSchema = PatientDocumentSchema) {
    this.schema = schema;
  }

  /**
   * Parse patient YAML content from document
   * Extracts patient section and validates against medical schema
   */
  parsePatientSection(
    content: string
  ):
    | { success: true; data: MedicalPatient }
    | { success: false; errors: string[] } {
    try {
      // Extract patient section from yAbel document (support both "Patient:" and "## Patient" formats)
      const patientMatch =
        content.match(/^(?:##\s+)?Patient:\s*\n((?:\s{2}.*\n?)*)/m) ||
        content.match(/^##\s+Patient\s*\n((?:(?:\s{2}|\t).*\n?)*)/m);
      if (!patientMatch) {
        return {
          success: false,
          errors: ['No Patient section found in document'],
        };
      }

      const patientYaml = patientMatch[1];
      const patientData = yaml.load(patientYaml) as any;

      // Validate with medical patient schema
      const result = MedicalPatientSchema.safeParse(patientData);

      if (result.success) {
        return { success: true, data: result.data };
      } else {
        const errors = result.error.errors.map(err => {
          const path = err.path.join('.');
          return `${path ? `${path}: ` : ''}${err.message}`;
        });
        return { success: false, errors };
      }
    } catch (error) {
      return {
        success: false,
        errors: [
          `Parsing error: ${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    }
  }

  /**
   * Generate patient summary for display
   */
  generatePatientSummary(patient: MedicalPatient): string {
    const parts: string[] = [];

    // Name
    if (patient.name || patient.surname) {
      parts.push(`${patient.name || ''} ${patient.surname || ''}`.trim());
    }

    // Demographics
    const demographics: string[] = [];
    if (patient.dob) demographics.push(`DOB: ${patient.dob}`);
    if (patient.age) demographics.push(`Age: ${patient.age}`);
    if (patient.gender) demographics.push(`Gender: ${patient.gender}`);
    if (patient.mrn) demographics.push(`MRN: ${patient.mrn}`);

    if (demographics.length > 0) {
      parts.push(`(${demographics.join(', ')})`);
    }

    return parts.join(' ');
  }

  /**
   * Validate patient data and return issues
   */
  validatePatient(patient: MedicalPatient): string[] {
    const issues: string[] = [];

    // Required fields check
    if (!patient.uid) issues.push('Patient UID is required');
    if (!patient.name && !patient.surname)
      issues.push('Patient name is required');

    // Format validation
    if (patient.dob && !/^\d{4}-\d{2}-\d{2}$/.test(patient.dob)) {
      issues.push('Date of birth should be in YYYY-MM-DD format');
    }

    if (
      patient.email &&
      typeof patient.email === 'string' &&
      !patient.email.includes('@')
    ) {
      issues.push('Email format appears invalid');
    }

    return issues;
  }
}

export const patientParser = new PatientParser();
