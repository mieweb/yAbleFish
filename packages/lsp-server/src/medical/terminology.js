"use strict";
/**
 * Medical Terminology Database - LSP Server Integration
 *
 * This file now imports from the shared medical terminology package
 * to maintain DRY principles and single source of truth.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.medicalTerminology = exports.MedicalTerminology = exports.MedicalTerm = exports.MedicalCode = void 0;
var medical_terminology_1 = require("@yabelfish/medical-terminology");
Object.defineProperty(exports, "MedicalCode", { enumerable: true, get: function () { return medical_terminology_1.MedicalCode; } });
Object.defineProperty(exports, "MedicalTerm", { enumerable: true, get: function () { return medical_terminology_1.MedicalTerm; } });
Object.defineProperty(exports, "MedicalTerminology", { enumerable: true, get: function () { return medical_terminology_1.MedicalTerminology; } });
Object.defineProperty(exports, "medicalTerminology", { enumerable: true, get: function () { return medical_terminology_1.medicalTerminology; } });
