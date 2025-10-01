/**
 * yAbelFish Browser Client - Main Application
 *
 * Enhanced version of the proof of concept with proper Phase 1 & 2 implementation.
 * Features Monaco Editor with tabbed interface for medical visit sections.
 */

import * as monaco from 'monaco-editor';

// Define section types for medical visit
type Section =
  | 'patient'
  | 'chief'
  | 'hpi'
  | 'allergies'
  | 'meds'
  | 'assessment'
  | 'plan';

interface ExtractedCode {
  term: string;
  code: string;
  range: monaco.Range;
}

interface MetadataUpdate {
  uri: string;
  codes: ExtractedCode[];
  diagnostics: any[];
  patient?: {
    uid?: string;
    name?: string;
    surname?: string;
    mrn?: string;
    dob?: string;
    gender?: string;
    email?: string;
    phone?: any[];
    address?: any;
    summary?: string;
  };
}

class YAbelFishEditor {
  private editor!: monaco.editor.IStandaloneCodeEditor;
  private model!: monaco.editor.ITextModel;
  private currentSection: Section = 'patient';
  private sectionRanges = new Map<Section, { start: number; end: number }>();
  private sectionTitles = new Map<Section, string>();
  private availableSections = new Set<Section>();
  private patientInfo = new Map<string, any>();

  // Single document content with all sections
  private documentContent = `# Visit Enc #: 142 Date: 09-23-2025 RE: Johnson, Robert 01-15-1975

## Patient
Name: Robert Johnson
Sex: Male
DOB: 01-15-1975
Phone: (555) 123-4567

## Chief Complaint
Follow-up for diabetes management

## HPI
Patient returns for routine diabetes follow-up. Reports good adherence to medication regimen. Blood sugars have been stable in the 120-140 range. No recent episodes of hypoglycemia.

## Allergies and Intolerances
- PENICILLINS
- SULFONAMIDES

## Medications
- metformin 1000 mg twice daily
- insulin glargine 20 units at bedtime  
- lisinopril 5 mg daily

## Assessment
- Type 2 diabetes mellitus - well controlled
- Hypertension - stable on current regimen

## Plan
- Continue current diabetes regimen
- HbA1c in 3 months
- Follow up in 3 months`;

  // Metadata storage
  private extractedCodes = new Map<string, ExtractedCode[]>();
  private diagnostics = new Map<string, any[]>();

  constructor() {
    this.initializeMonaco();
    this.registerYAbelLanguage();
    this.createModel();
    this.createEditor();
    this.initializeLSP();
    this.setupMetadataPanel();
    this.setupDocumentSwitcher();
    this.setupPreviewToggle();
    
    // Initial section calculation
    this.calculateSectionRanges();
    this.updateSectionTitle(this.currentSection);
  }

  private initializeMonaco() {
    // Set Monaco theme
    monaco.editor.setTheme('vs');
    
    // Configure Monaco editor options
    monaco.editor.EditorOptions.readOnly.defaultValue = false;
  }

  private registerYAbelLanguage() {
    // Register yAbel language
    monaco.languages.register({
      id: 'yabel',
      extensions: ['.yabel', '.yaml'],
      aliases: ['yAbel', 'yabel'],
      mimetypes: ['text/x-yabel', 'application/x-yabel']
    });

    // Basic tokenization for medical documents
    monaco.languages.setMonarchTokensProvider('yabel', {
      tokenizer: {
        root: [
          [/^##\s+.*$/, 'section-header'],
          [/^[A-Za-z][^:]*:/, 'field-name'],
          [/\b[A-Z]\d{2}(\.\d+)?\b/, 'icd-code'],
          [/\b\d{4,}\b/, 'rxnorm-code'],
          [/#.*$/, 'comment']
        ]
      }
    });

    // Define theme for medical terminology
    monaco.editor.defineTheme('yabel-theme', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'section-header', foreground: '0066cc', fontStyle: 'bold' },
        { token: 'field-name', foreground: '008000', fontStyle: 'bold' },
        { token: 'icd-code', foreground: '800080' },
        { token: 'rxnorm-code', foreground: 'ff6600' },
        { token: 'comment', foreground: '808080', fontStyle: 'italic' }
      ],
      colors: {}
    });
  }

  private createModel() {
    const uri = monaco.Uri.parse('yabel://visit/encounter-123');
    this.model = monaco.editor.createModel(this.documentContent, 'yabel', uri);

    // Calculate section ranges for scroll navigation
    this.calculateSectionRanges();
  }

  private createEditor() {
    const container = document.getElementById('editor');
    if (!container) {
      throw new Error('Editor container not found');
    }

    this.editor = monaco.editor.create(container, {
      model: this.model,
      fontSize: 14,
      lineNumbers: 'on',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      theme: 'yabel-dark',
      automaticLayout: true,
      suggest: {
        showKeywords: false,
        showSnippets: true,
        showFunctions: false,
        showVariables: false,
        showModules: false,
        showClasses: false,
      },
      // Enable LSP features
      quickSuggestions: {
        other: true,
        comments: false,
        strings: false,
      },
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: 'on',
      tabCompletion: 'on',
    });

    // Handle window resize
    window.addEventListener('resize', () => {
      this.editor.layout();
    });

    // Track document changes for the single model
    this.model.onDidChangeContent(() => {
      // TODO: Send document changes to real LSP server
      // Recalculate section ranges when content changes
      this.calculateSectionRanges();
      
      // Validate document and show errors
      this.validateDocumentAndShowErrors();
    });
    
    // Initial validation
    this.validateDocumentAndShowErrors();
  }



  private async initializeLSP() {
    try {
      // Import and start the new LSP client
      const { YAbelLSPClient } = await import('./lsp/client.js');
      
      const lspClient = new YAbelLSPClient();
      await lspClient.start();

      // Initialize LSP session
      await lspClient.sendRequest('initialize', {
        processId: null,
        clientInfo: { name: 'yAbelFish Browser Client', version: '0.1.0' },
        rootUri: null,
        capabilities: {
          textDocument: {
            synchronization: {
              didOpen: true,
              didChange: true,
              didClose: true
            }
          }
        }
      });

      // Send initialized notification
      lspClient.sendNotification('initialized', {});

      // Open the current document with LSP server
      const uri = this.model.uri.toString();
      lspClient.sendNotification('textDocument/didOpen', {
        textDocument: {
          uri: uri,
          languageId: 'yabel',
          version: 1,
          text: this.model.getValue()
        }
      });

      // Listen for content changes and notify LSP server
      this.model.onDidChangeContent(() => {
        lspClient.sendNotification('textDocument/didChange', {
          textDocument: {
            uri: uri,
            version: Date.now() // Simple versioning
          },
          contentChanges: [
            {
              text: this.model.getValue() // Send full text for simplicity
            }
          ]
        });
      });

      // Store LSP client reference for later use
      (this as any).lspClient = lspClient;

      // Listen for LSP diagnostics events
      window.addEventListener('yabelfish-diagnostics', (event: any) => {
        const { uri, diagnostics } = event.detail;
        if (uri === this.model.uri.toString()) {
          // Update our diagnostics storage with LSP diagnostics
          this.diagnostics.set(uri, diagnostics);
          this.updateMetadataPanel();
        }
      });

      console.log('✅ Real LSP client started successfully');
    } catch (error) {
      console.error('❌ Failed to initialize LSP:', error);
    }
  }

  // TODO: Replace with real LSP client communication methods

  private handleMetadataUpdate(update: MetadataUpdate) {
    // Store the codes, diagnostics, and patient info
    this.extractedCodes.set(update.uri, update.codes);
    this.diagnostics.set(update.uri, update.diagnostics);
    if (update.patient) {
      this.patientInfo.set(update.uri, update.patient);
    }

    // Update UI (always update since we have single model)
    const currentUri = this.model.uri.toString();
    if (update.uri === currentUri) {
      this.updateMetadataPanel();
    }
  }

  private handleDiagnostics(data: { uri: string; diagnostics: any[] }) {
    this.diagnostics.set(data.uri, data.diagnostics);

    // Update metadata panel (always update since we have single model)
    const currentUri = this.model.uri.toString();
    if (data.uri === currentUri) {
      this.updateMetadataPanel();
    }
  }

  private updateHeader(patient?: any) {
    // Extract visit information from document content
    const content = this.model.getValue();
    const visitInfo = this.extractVisitInfo(content);
    
    // Update patient info in header
    const patientInfoEl = document.querySelector('.patient-info');
    if (patientInfoEl && patient) {
      const patientName = patient.name && patient.surname 
        ? `${patient.name} ${patient.surname}` 
        : patient.name || 'Unknown Patient';
      const patientDob = patient.dob || 'Unknown DOB';
      
      patientInfoEl.innerHTML = `
        <span>👤 ${patientName}</span>
        <span>🎂 ${patientDob}</span>
      `;
    }
    
    // Update visit info in header
    const visitInfoEl = document.querySelector('.visit-info');
    if (visitInfoEl && visitInfo) {
      visitInfoEl.innerHTML = `
        <span>📋 ${visitInfo.encounter || 'No Enc'}</span>
        <span>📅 ${visitInfo.date || 'No Date'}</span>
      `;
    }
    
    // Update section title with patient and visit info
    const sectionTitleEl = document.querySelector('.section-title');
    if (sectionTitleEl && patient && visitInfo) {
      const patientName = patient.name && patient.surname 
        ? `${patient.name} ${patient.surname}` 
        : patient.name || 'Unknown Patient';
      sectionTitleEl.textContent = `Medical Documentation - ${patientName} (${visitInfo.encounter || 'Visit'})`;
    }
  }

  private extractVisitInfo(content: string) {
    // Extract visit information from the main heading
    const lines = content.split('\n');
    const firstLine = lines[0];
    
    // Look for visit header pattern: # Visit Enc #: 139 Date: 09-22-2025 RE: Heart, William 02-14-1964
    const visitMatch = firstLine.match(/^#\s*Visit\s+Enc\s*#?:\s*(\w+).*Date:\s*([\d-]+)/i);
    if (visitMatch) {
      return {
        encounter: `Enc #${visitMatch[1]}`,
        date: visitMatch[2]
      };
    }
    
    // Fallback: try to extract any encounter and date info
    const encMatch = firstLine.match(/Enc\s*#?:\s*(\w+)/i);
    const dateMatch = firstLine.match(/Date:\s*([\d-]+)/i) || firstLine.match(/([\d]{2}-[\d]{2}-[\d]{4})/);
    
    return {
      encounter: encMatch ? `Enc #${encMatch[1]}` : null,
      date: dateMatch ? dateMatch[1] : null
    };
  }

  private setupDocumentSwitcher() {
    const switchButton = document.getElementById('switch-document');
    if (switchButton) {
      const documents = [
        {
          name: "Robert Johnson",
          content: `# Visit Enc #: 142 Date: 09-23-2025 RE: Johnson, Robert 01-15-1975

## Patient
Name: Robert Johnson
Sex: Male
DOB: 01-15-1975
Phone: (555) 123-4567

## Chief Complaint
Follow-up for diabetes management

## HPI
Patient returns for routine diabetes follow-up. Reports good adherence to medication regimen. Blood sugars have been stable in the 120-140 range. No recent episodes of hypoglycemia.

## Allergies and Intolerances
- PENICILLINS
- SULFONAMIDES

## Medications
- metformin 1000 mg twice daily
- insulin glargine 20 units at bedtime  
- lisinopril 5 mg daily

## Assessment
- Type 2 diabetes mellitus - well controlled
- Hypertension - stable on current regimen

## Plan
- Continue current diabetes regimen
- HbA1c in 3 months
- Follow up in 3 months`
        },
        {
          name: "William Heart",
          content: `# Visit Enc #: 139 Date: 09-22-2025 RE: Heart, William 02-14-1964

## Patient
Name: William Heart
Sex: Male
DOB: 02-14-1964

## Chief Complaint
Chest pain and shortness of breath

## Assessment
- Hypertension - well controlled on current regimen
- CHF - Congestive heart failure
- Atrial fibrillation

## Plan
- Continue lisinopril 10 mg daily
- Follow up in 3 months`
        },
        {
          name: "Jane Doe",
          content: `# Visit Enc #: 98 Date: 09-20-2025 RE: Doe, Jane 03-10-1985

## Patient
Name: Jane Doe
Sex: Female
DOB: 03-10-1985

## Chief Complaint
Annual physical exam

## Assessment
- Healthy adult female
- Routine screening up to date

## Plan
- Continue routine care
- Next annual exam in 12 months`
        }
      ];

      let currentDocIndex = 0;

      switchButton.addEventListener('click', () => {
        currentDocIndex = (currentDocIndex + 1) % documents.length;
        const newDoc = documents[currentDocIndex];
        
        // Update the model content
        this.model.setValue(newDoc.content);
        
        // Update button text to show current patient
        switchButton.textContent = `📄 Current: ${newDoc.name}`;
      });

      // Set initial button text
      switchButton.textContent = `📄 Current: ${documents[0].name}`;
    }
  }

  private setupPreviewToggle() {
    const previewButton = document.getElementById('preview-toggle');
    const editorElement = document.getElementById('editor');
    const previewPane = document.getElementById('preview-pane');
    let isPreviewMode = false;

    if (previewButton && editorElement && previewPane) {
      previewButton.addEventListener('click', () => {
        isPreviewMode = !isPreviewMode;
        
        if (isPreviewMode) {
          // Switch to preview mode
          editorElement.style.display = 'none';
          previewPane.style.display = 'block';
          previewButton.textContent = '✏️ Edit';
          previewButton.style.background = '#d83b01';
          
          // Convert markdown to HTML and update preview
          this.updatePreview();
        } else {
          // Switch to editor mode
          editorElement.style.display = 'block';
          previewPane.style.display = 'none';
          previewButton.textContent = '👁️ Preview';
          previewButton.style.background = '#16825d';
        }
      });

      // Update preview when content changes
      this.model.onDidChangeContent(() => {
        if (isPreviewMode) {
          this.updatePreview();
        }
      });
    }
  }

  private updatePreview() {
    const previewContent = document.getElementById('preview-content');
    if (!previewContent) return;

    const markdownContent = this.model.getValue();
    const htmlContent = this.convertMarkdownToHtml(markdownContent);
    previewContent.innerHTML = htmlContent;
  }

  private convertMarkdownToHtml(markdown: string): string {
    let html = markdown;

    // Convert headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Convert bold and italic
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');

    // Convert inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Convert lists
    const lines = html.split('\n');
    let inList = false;
    let listType = '';
    const processedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isListItem = /^[\s]*[-*+]\s+/.test(line) || /^[\s]*\d+\.\s+/.test(line);
      const isOrderedList = /^[\s]*\d+\.\s+/.test(line);
      const currentListType = isOrderedList ? 'ol' : 'ul';

      if (isListItem) {
        if (!inList) {
          processedLines.push(`<${currentListType}>`);
          inList = true;
          listType = currentListType;
        } else if (listType !== currentListType) {
          processedLines.push(`</${listType}>`);
          processedLines.push(`<${currentListType}>`);
          listType = currentListType;
        }
        const itemText = line.replace(/^[\s]*[-*+]\s+/, '').replace(/^[\s]*\d+\.\s+/, '');
        processedLines.push(`<li>${itemText}</li>`);
      } else {
        if (inList) {
          processedLines.push(`</${listType}>`);
          inList = false;
          listType = '';
        }
        processedLines.push(line);
      }
    }

    if (inList) {
      processedLines.push(`</${listType}>`);
    }

    html = processedLines.join('\n');

    // Convert paragraphs (double newlines)
    html = html.replace(/\n\n+/g, '</p><p>');
    html = '<p>' + html + '</p>';

    // Clean up empty paragraphs and fix header paragraphs
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[1-6]>)/g, '$1');
    html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ul>|<ol>)/g, '$1');
    html = html.replace(/(<\/ul>|<\/ol>)<\/p>/g, '$1');

    // Highlight medical terms
    html = this.highlightMedicalTerms(html);

    return html;
  }

  private highlightMedicalTerms(html: string): string {
    const medicalTerms = [
      'diabetes', 'hypertension', 'CHF', 'atrial fibrillation',
      'chest pain', 'shortness of breath', 'metformin', 'insulin',
      'lisinopril', 'penicillin', 'sulfonamide', 'HbA1c',
      'congestive heart failure', 'hypoglycemia'
    ];

    medicalTerms.forEach(term => {
      const regex = new RegExp(`\\b(${term})\\b`, 'gi');
      html = html.replace(regex, '<span class="medical-term">$1</span>');
    });

    return html;
  }

  private validateDocumentAndShowErrors() {
    const content = this.model.getValue();
    const errors = this.detectParseErrors(content);
    
    // Clear existing markers
    monaco.editor.setModelMarkers(this.model, 'yabelfish', []);
    
    // Add new error markers
    if (errors.length > 0) {
      monaco.editor.setModelMarkers(this.model, 'yabelfish', errors.map(error => ({
        severity: error.severity,
        startLineNumber: error.range.startLineNumber,
        startColumn: error.range.startColumn,
        endLineNumber: error.range.endLineNumber,
        endColumn: error.range.endColumn,
        message: error.message,
        code: error.code || 'PARSE_ERROR'
      })));
    }
    
    // Update diagnostics storage for metadata panel
    const currentUri = this.model.uri.toString();
    this.diagnostics.set(currentUri, errors);
    this.updateMetadataPanel();
  }

  private detectParseErrors(content: string): any[] {
    const errors: any[] = [];
    const lines = content.split('\n');
    
    lines.forEach((line, lineIndex) => {
      const lineNumber = lineIndex + 1;
      
      // Check for invalid section headers
      if (line.trim().startsWith('#')) {
        const headerMatch = line.match(/^(#+)\s*(.*)$/);
        if (headerMatch) {
          const level = headerMatch[1].length;
          const title = headerMatch[2].trim();
          
          // Check for invalid header levels (more than 3 #)
          if (level > 3) {
            errors.push({
              severity: monaco.MarkerSeverity.Warning,
              range: new monaco.Range(lineNumber, 1, lineNumber, line.length + 1),
              message: `Header level ${level} is too deep. Maximum recommended level is 3.`,
              code: 'INVALID_HEADER_LEVEL'
            });
          }
          
          // Check for empty headers
          if (!title) {
            errors.push({
              severity: monaco.MarkerSeverity.Error,
              range: new monaco.Range(lineNumber, 1, lineNumber, line.length + 1),
              message: 'Empty header detected. Headers must have content.',
              code: 'EMPTY_HEADER'
            });
          }
          
          // Check for invalid medical section headers
          const validSections = ['patient', 'chief complaint', 'hpi', 'history of present illness', 
                               'allergies', 'allergies and intolerances', 'medications', 'assessment', 'plan'];
          if (level === 2 && title && !validSections.some(section => 
              title.toLowerCase().includes(section))) {
            errors.push({
              severity: monaco.MarkerSeverity.Info,
              range: new monaco.Range(lineNumber, level + 2, lineNumber, line.length + 1),
              message: `Non-standard section header: "${title}". Consider using standard medical sections.`,
              code: 'NON_STANDARD_SECTION'
            });
          }
        }
      }
      
      // Check for malformed medical codes
      this.validateMedicalCodesInLine(line, lineNumber, errors);
      
      // Check for malformed patient data
      this.validatePatientDataInLine(line, lineNumber, errors);
      
      // Check for invalid medication formats
      this.validateMedicationFormats(line, lineNumber, errors);
      
      // Check for date format issues
      this.validateDateFormats(line, lineNumber, errors);
    });
    
    // Check document structure
    this.validateDocumentStructure(content, errors);
    
    return errors;
  }

  private validateMedicalCodesInLine(line: string, lineNumber: number, errors: any[]) {
    // Check for invalid ICD-10 codes
    const icd10Pattern = /\b[A-Z]\d{2}(\.\d+)?\b/g;
    let match;
    while ((match = icd10Pattern.exec(line)) !== null) {
      const code = match[0];
      const startColumn = match.index + 1;
      const endColumn = startColumn + code.length;
      
      // Validate ICD-10 format more strictly
      if (!/^[A-Z]\d{2}(\.\d{1,2})?$/.test(code)) {
        errors.push({
          severity: monaco.MarkerSeverity.Error,
          range: new monaco.Range(lineNumber, startColumn, lineNumber, endColumn),
          message: `Invalid ICD-10 code format: "${code}". Expected format: A12 or A12.3`,
          code: 'INVALID_ICD10_FORMAT'
        });
      } else {
        // Check if it's a known code (simplified validation)
        const knownCodes = ['E11', 'E11.9', 'I10', 'I48.91', 'I50.9', 'R06.02', 'R06.00'];
        const baseCode = code.split('.')[0];
        if (!knownCodes.includes(baseCode) && !knownCodes.includes(code)) {
          errors.push({
            severity: monaco.MarkerSeverity.Info,
            range: new monaco.Range(lineNumber, startColumn, lineNumber, endColumn),
            message: `Unknown ICD-10 code: "${code}". Verify this is a valid medical code.`,
            code: 'UNKNOWN_ICD10_CODE'
          });
        }
      }
    }
    
    // Check for invalid RxNorm codes
    const rxnormPattern = /\b\d{4,8}\b/g;
    while ((match = rxnormPattern.exec(line)) !== null) {
      const code = match[0];
      const startColumn = match.index + 1;
      const endColumn = startColumn + code.length;
      
      // Basic validation for RxNorm codes (4-8 digits)
      if (code.length < 4 || code.length > 8) {
        errors.push({
          severity: monaco.MarkerSeverity.Warning,
          range: new monaco.Range(lineNumber, startColumn, lineNumber, endColumn),
          message: `Suspicious RxNorm code format: "${code}". RxNorm codes are typically 4-8 digits.`,
          code: 'SUSPICIOUS_RXNORM_FORMAT'
        });
      }
    }
  }

  private validatePatientDataInLine(line: string, lineNumber: number, errors: any[]) {
    // Check for invalid date formats in patient data
    if (line.toLowerCase().includes('dob:') || line.toLowerCase().includes('date of birth:')) {
      const datePattern = /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/g;
      const match = datePattern.exec(line);
      if (match) {
        const dateStr = match[1];
        const startColumn = match.index + 1;
        const endColumn = startColumn + dateStr.length;
        
        // Validate date format
        if (!/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
          errors.push({
            severity: monaco.MarkerSeverity.Warning,
            range: new monaco.Range(lineNumber, startColumn, lineNumber, endColumn),
            message: `Date format "${dateStr}" should follow MM-DD-YYYY format for consistency.`,
            code: 'INCONSISTENT_DATE_FORMAT'
          });
        }
      }
    }
    
    // Check for missing required patient fields
    if (line.toLowerCase().includes('name:') && line.split(':')[1].trim() === '') {
      errors.push({
        severity: monaco.MarkerSeverity.Warning,
        range: new monaco.Range(lineNumber, 1, lineNumber, line.length + 1),
        message: 'Patient name is required for proper medical documentation.',
        code: 'MISSING_PATIENT_NAME'
      });
    }
  }

  private validateMedicationFormats(line: string, lineNumber: number, errors: any[]) {
    // Check for medication dosage format issues
    if (line.trim().startsWith('-') && (line.toLowerCase().includes('mg') || line.toLowerCase().includes('units'))) {
      // Look for common medication format issues
      if (!line.match(/\d+\s*(mg|units|ml|g)\s+(daily|twice daily|three times daily|as needed|prn)/i)) {
        const dosageMatch = line.match(/(\d+\s*(?:mg|units|ml|g))/i);
        if (dosageMatch && !line.match(/daily|twice|three times|as needed|prn|bid|tid|qid|q\d+h/i)) {
          errors.push({
            severity: monaco.MarkerSeverity.Info,
            range: new monaco.Range(lineNumber, 1, lineNumber, line.length + 1),
            message: 'Medication entry may be missing frequency information (e.g., "daily", "twice daily").',
            code: 'INCOMPLETE_MEDICATION_INFO'
          });
        }
      }
    }
  }

  private validateDateFormats(line: string, lineNumber: number, errors: any[]) {
    // Check for various date formats and flag inconsistencies
    const datePatterns = [
      /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g,  // MM/DD/YYYY or MM-DD-YYYY
      /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g,    // YYYY-MM-DD
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/gi // Jan 1, 2023
    ];
    
    datePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const dateStr = match[0];
        const startColumn = match.index + 1;
        const endColumn = startColumn + dateStr.length;
        
        // Check for obviously invalid dates
        if (dateStr.includes('00-00') || dateStr.includes('/00/') || dateStr.includes('-00-')) {
          errors.push({
            severity: monaco.MarkerSeverity.Error,
            range: new monaco.Range(lineNumber, startColumn, lineNumber, endColumn),
            message: `Invalid date: "${dateStr}". Dates cannot contain zero months or days.`,
            code: 'INVALID_DATE'
          });
        }
      }
    });
  }

  private validateDocumentStructure(content: string, errors: any[]) {
    const lines = content.split('\n');
    let hasPatientSection = false;
    let hasAssessmentSection = false;
    
    lines.forEach((line, _index) => {
      if (line.toLowerCase().includes('## patient')) {
        hasPatientSection = true;
      }
      if (line.toLowerCase().includes('## assessment')) {
        hasAssessmentSection = true;
      }
    });
    
    // Check for missing critical sections
    if (!hasPatientSection) {
      errors.push({
        severity: monaco.MarkerSeverity.Warning,
        range: new monaco.Range(1, 1, 1, 1),
        message: 'Document is missing a Patient section (## Patient). This is recommended for medical documentation.',
        code: 'MISSING_PATIENT_SECTION'
      });
    }
    
    if (!hasAssessmentSection) {
      errors.push({
        severity: monaco.MarkerSeverity.Info,
        range: new monaco.Range(1, 1, 1, 1),
        message: 'Document may be missing an Assessment section (## Assessment). This is typically required for medical visits.',
        code: 'MISSING_ASSESSMENT_SECTION'
      });
    }
  }

  private extractCodesFromContent(content: string): ExtractedCode[] {
    const codes: ExtractedCode[] = [];
    const lines = content.split('\n');
    
    lines.forEach((line, lineIndex) => {
      const lineNumber = lineIndex + 1;
      
      // Extract medical terms that could be coded
      // Look for diabetes-related terms
      const diabetesTerms = [
        { term: 'Type 2 diabetes mellitus', code: 'E11.9', pattern: /type\s*2\s*diabetes\s*mellitus/i },
        { term: 'diabetes management', code: 'Z71.3', pattern: /diabetes\s*management/i },
        { term: 'diabetes', code: 'E11.9', pattern: /\bdiabetes\b/i },
        { term: 'hypoglycemia', code: 'E16.2', pattern: /hypoglycemia/i },
        { term: 'HbA1c', code: '83036', pattern: /\bhba1c\b/i }
      ];

      // Look for hypertension terms
      const hypertensionTerms = [
        { term: 'Hypertension', code: 'I10', pattern: /\bhypertension\b/i },
        { term: 'well controlled hypertension', code: 'I10', pattern: /well\s*controlled.*hypertension/i }
      ];

      // Look for heart-related terms
      const heartTerms = [
        { term: 'CHF', code: 'I50.9', pattern: /\bchf\b/i },
        { term: 'Congestive heart failure', code: 'I50.9', pattern: /congestive\s*heart\s*failure/i },
        { term: 'Atrial fibrillation', code: 'I48.91', pattern: /atrial\s*fibrillation/i },
        { term: 'chest pain', code: 'R06.02', pattern: /chest\s*pain/i },
        { term: 'shortness of breath', code: 'R06.00', pattern: /shortness\s*of\s*breath/i }
      ];

      // Look for medication terms (RxNorm codes)
      const medicationTerms = [
        { term: 'metformin', code: '6809', pattern: /\bmetformin\b/i },
        { term: 'insulin glargine', code: '274783', pattern: /insulin\s*glargine/i },
        { term: 'lisinopril', code: '29046', pattern: /\blisinopril\b/i }
      ];

      // Look for allergy terms
      const allergyTerms = [
        { term: 'PENICILLINS', code: 'N0000007624', pattern: /\bpenicillins?\b/i },
        { term: 'SULFONAMIDES', code: 'N0000007508', pattern: /\bsulfonamides?\b/i }
      ];

      const allTerms = [...diabetesTerms, ...hypertensionTerms, ...heartTerms, ...medicationTerms, ...allergyTerms];

      allTerms.forEach(termData => {
        const match = line.match(termData.pattern);
        if (match) {
          const startColumn = match.index! + 1;
          const endColumn = startColumn + match[0].length;
          
          codes.push({
            term: termData.term,
            code: termData.code,
            range: new monaco.Range(lineNumber, startColumn, lineNumber, endColumn)
          });
        }
      });
    });

    return codes;
  }

  private extractPatientFromContent(content: string): any {
    const lines = content.split('\n');
    const patient: any = {};

    // Extract from visit header - pattern: RE: Johnson, Robert 01-15-1975
    const firstLine = lines[0];
    const patientMatch = firstLine.match(/RE:\s*([^,]+),\s*([^\s]+)\s*([\d-]+)/i);
    if (patientMatch) {
      patient.surname = patientMatch[1].trim();
      patient.name = patientMatch[2].trim();
      patient.dob = patientMatch[3].trim();
    }

    // Extract from Patient section
    lines.forEach(line => {
      const trimmedLine = line.trim();
      
      // Extract Name
      const nameMatch = trimmedLine.match(/^Name:\s*(.+)$/i);
      if (nameMatch) {
        const fullName = nameMatch[1].trim();
        const nameParts = fullName.split(' ');
        if (nameParts.length >= 2) {
          patient.name = nameParts[0];
          patient.surname = nameParts.slice(1).join(' ');
        } else {
          patient.name = fullName;
        }
      }

      // Extract Sex/Gender
      const sexMatch = trimmedLine.match(/^Sex:\s*(.+)$/i);
      if (sexMatch) {
        patient.gender = sexMatch[1].trim();
      }

      // Extract DOB
      const dobMatch = trimmedLine.match(/^DOB:\s*(.+)$/i);
      if (dobMatch) {
        patient.dob = dobMatch[1].trim();
      }

      // Extract Phone
      const phoneMatch = trimmedLine.match(/^Phone:\s*(.+)$/i);
      if (phoneMatch) {
        patient.phone = [{ number: phoneMatch[1].trim() }];
      }
    });

    return patient;
  }

  private updateMetadataPanel() {
    const currentUri = this.model.uri.toString();
    const content = this.model.getValue();
    
    // Extract codes directly from content until LSP server is connected
    const codes = this.extractCodesFromContent(content);
    const diagnostics = this.diagnostics.get(currentUri) || [];
    const patient = this.extractPatientFromContent(content);

    // Store extracted data temporarily
    this.extractedCodes.set(currentUri, codes);
    this.patientInfo.set(currentUri, patient);

    // Update header with patient and visit information
    this.updateHeader(patient);

    // Update diagnostics panel
    this.updateDiagnosticsPanel(diagnostics);

    // Build hierarchical document structure
    const documentStructure = document.getElementById('document-structure');
    if (documentStructure) {
      const content = this.model.getValue();
      const structure = this.buildDocumentStructure(content, codes, diagnostics, patient);
      documentStructure.innerHTML = structure;

      // Add click handlers for navigation
      // Handle heading clicks
      documentStructure.querySelectorAll('.toc-heading').forEach(header => {
        header.addEventListener('click', (e) => {
          const lineStr = (e.currentTarget as HTMLElement).dataset.line;
          if (lineStr) {
            const line = parseInt(lineStr);
            
            // Get the line content to determine selection range
            const model = this.editor.getModel();
            if (model) {
              const lineContent = model.getLineContent(line);
              const headingMatch = lineContent.match(/^(#+)\s*(.+)$/);
              
              if (headingMatch) {
                const headingPrefix = headingMatch[1] + ' '; // "## " or "# " etc.
                const startColumn = headingPrefix.length + 1; // Start after "## "
                const endColumn = lineContent.length + 1; // End of line
                
                // Select the heading text (without the # markers)
                this.editor.setSelection({
                  startLineNumber: line,
                  startColumn: startColumn,
                  endLineNumber: line,
                  endColumn: endColumn
                });
              } else {
                // Fallback: select entire line if not a standard heading
                const fallbackModel = this.editor.getModel();
                const endCol = fallbackModel ? fallbackModel.getLineContent(line).length + 1 : 1;
                this.editor.setSelection({
                  startLineNumber: line,
                  startColumn: 1,
                  endLineNumber: line,
                  endColumn: endCol
                });
              }
            }
            
            this.editor.revealLineInCenter(line);
            this.editor.focus();
          }
        });
      });

      // Handle code item clicks
      documentStructure.querySelectorAll('.code-item').forEach(codeItem => {
        codeItem.addEventListener('click', (e) => {
          const lineStr = (e.currentTarget as HTMLElement).dataset.line;
          const columnStr = (e.currentTarget as HTMLElement).dataset.column;
          const endColumnStr = (e.currentTarget as HTMLElement).dataset.endColumn;
          if (lineStr && columnStr) {
            const line = parseInt(lineStr);
            const startColumn = parseInt(columnStr);
            const endColumn = endColumnStr ? parseInt(endColumnStr) : startColumn;
            
            // Set selection range to highlight the medical term
            this.editor.setSelection({
              startLineNumber: line,
              startColumn: startColumn,
              endLineNumber: line,
              endColumn: endColumn
            });
            this.editor.revealLineInCenter(line);
            this.editor.focus();
          }
        });
      });

      // Handle patient info clicks
      documentStructure.querySelectorAll('.patient-name, .patient-meta').forEach(patientElement => {
        patientElement.addEventListener('click', (e) => {
          // Find the patient section line (the heading that contains this patient info)
          const tocSection = (e.currentTarget as HTMLElement).closest('.toc-section');
          const tocHeading = tocSection?.querySelector('.toc-heading');
          const lineStr = tocHeading?.getAttribute('data-line');
          
          if (lineStr) {
            const line = parseInt(lineStr);
            
            // Navigate to the patient section and select the content
            const model = this.editor.getModel();
            if (model) {
              // Find patient data in the section (look for typical patient info patterns)
              let foundPatientData = false;
              const totalLines = model.getLineCount();
              
              for (let i = line + 1; i <= Math.min(line + 20, totalLines); i++) {
                const lineContent = model.getLineContent(i);
                // Look for patient info patterns like "Name:", "DOB:", etc.
                if (lineContent.match(/\b(name|dob|date of birth|mrn|gender|age)\b/i)) {
                  this.editor.setSelection({
                    startLineNumber: i,
                    startColumn: 1,
                    endLineNumber: i,
                    endColumn: lineContent.length + 1
                  });
                  this.editor.revealLineInCenter(i);
                  foundPatientData = true;
                  break;
                }
              }
              
              // Fallback: just go to the section heading
              if (!foundPatientData) {
                this.editor.setPosition({ lineNumber: line, column: 1 });
                this.editor.revealLineInCenter(line);
              }
            }
            
            this.editor.focus();
          }
        });
      });
    }

    // Update section summary
    this.updateSectionSummary();
  }

  private buildDocumentStructure(content: string, codes: ExtractedCode[], diagnostics: any[], patient: any): string {
    const lines = content.split('\n');
    const sections: Array<{
      level: number;
      title: string;
      line: number;
      codes: ExtractedCode[];
      diagnostics: any[];
      patient?: any;
    }> = [];

    // Parse headings first to build section boundaries
    const headings: Array<{ level: number; line: number; title: string }> = [];
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) {
        const match = trimmed.match(/^(#+)\s*(.+)/);
        if (match) {
          const level = match[1].length;
          const title = match[2].trim().replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] || c));
          headings.push({ level, line: index + 1, title });
        }
      }
    });

    // Build sections with proper code association - only direct children
    headings.forEach(heading => {
      // Find the next heading at the same level or higher (lower level number)
      const nextSameLevelIndex = headings.findIndex(h => h.line > heading.line && h.level <= heading.level);
      
      // Find the next heading at any deeper level (higher level number) 
      const nextDeeperLevelIndex = headings.findIndex(h => h.line > heading.line && h.level > heading.level);
      
      // Section ends at the next deeper heading OR next same/higher level heading
      let sectionEnd = lines.length;
      if (nextDeeperLevelIndex >= 0 && (nextSameLevelIndex < 0 || headings[nextDeeperLevelIndex].line < headings[nextSameLevelIndex].line)) {
        // There's a deeper level heading before any same-level heading
        sectionEnd = headings[nextDeeperLevelIndex].line - 1;
      } else if (nextSameLevelIndex >= 0) {
        // There's a same/higher level heading
        sectionEnd = headings[nextSameLevelIndex].line - 1;
      }
      
      // Find codes that belong directly to this section (not in subsections)
      const sectionCodes = codes.filter(code => {
        const codeLine = code.range.startLineNumber;
        return codeLine > heading.line && codeLine <= sectionEnd;
      });
      
      // Find diagnostics that belong directly to this section
      const sectionDiagnostics = diagnostics.filter(diag => {
        const diagLine = diag.range?.startLineNumber || 0;
        return diagLine > heading.line && diagLine <= sectionEnd;
      });

      // Check if this is a patient section
      const isPatientSection = heading.title.toLowerCase().includes('patient');
      
      sections.push({
        level: heading.level,
        title: heading.title,
        line: heading.line,
        codes: sectionCodes,
        diagnostics: sectionDiagnostics,
        patient: isPatientSection ? patient : undefined
      });
    });

    if (sections.length === 0) {
      return '<div class="empty-state">No document structure detected</div>';
    }

    return sections.map(section => {
      const badges = [];
      if (section.codes.length > 0) badges.push(`<span class="section-badge">${section.codes.length} codes</span>`);
      if (section.diagnostics.length > 0) badges.push(`<span class="section-badge" style="background: rgba(255,68,68,0.2); color: #ff4444;">${section.diagnostics.length} issues</span>`);
      if (section.patient) badges.push(`<span class="section-badge" style="background: rgba(0,200,100,0.2); color: #00c864;">patient</span>`);

      let sectionContent = '';
      
      // Add patient details if this is a patient section
      if (section.patient) {
        const patientName = `${section.patient.name || ''} ${section.patient.surname || ''}`.trim() || '';
        const nameDisplay = patientName || '[No Name]';
        const dobDisplay = section.patient.dob || '[No DOB]';
        const sexDisplay = section.patient.gender || '[No Sex]';

        sectionContent += `
          <div class="patient-details">
            <div class="patient-name">Name: ${nameDisplay}</div>
            <div class="patient-meta">DOB: ${dobDisplay} • Sex: ${sexDisplay}</div>
          </div>
        `;
      }

      // Add diagnostics for this section (keep these on the left)
      if (section.diagnostics.length > 0) {
        sectionContent += `
          <div class="diagnostics-in-section">
            ${section.diagnostics.map(diag => 
              `<div class="diagnostic-item-inline">${diag.message}</div>`
            ).join('')}
          </div>
        `;
      }

      return `
        <div class="toc-section level-${Math.min(section.level, 3)}">
          <div class="toc-heading" data-line="${section.line}">
            <span class="heading-level">H${section.level}</span>
            <span class="heading-title">${section.title}</span>
            <div class="section-badges">
              ${badges.join('')}
            </div>
          </div>
          ${sectionContent ? `<div class="section-content">${sectionContent}</div>` : ''}
          ${section.codes.length > 0 ? `
            <ul class="code-list">
              ${section.codes.map(code => 
                `<li class="code-item" 
                     data-line="${code.range.startLineNumber}" 
                     data-column="${code.range.startColumn}" 
                     data-end-column="${code.range.endColumn}">
                  <span class="code-term">${code.term}</span>
                  <span class="code-value">${code.code}</span>
                </li>`
              ).join('')}
            </ul>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  private updateDiagnosticsPanel(diagnostics: any[]) {
    const diagnosticsListElement = document.getElementById('diagnostics-list');
    if (!diagnosticsListElement) return;

    if (diagnostics.length === 0) {
      diagnosticsListElement.innerHTML = '<div class="empty-state">No issues detected ✅</div>';
      return;
    }

    const groupedDiagnostics = {
      errors: diagnostics.filter(d => d.severity === monaco.MarkerSeverity.Error),
      warnings: diagnostics.filter(d => d.severity === monaco.MarkerSeverity.Warning),
      info: diagnostics.filter(d => d.severity === monaco.MarkerSeverity.Info)
    };

    let html = '';
    
    if (groupedDiagnostics.errors.length > 0) {
      html += '<div class="diagnostic-group"><h4 class="diagnostic-group-title error">🚨 Errors (' + groupedDiagnostics.errors.length + ')</h4>';
      groupedDiagnostics.errors.forEach(diagnostic => {
        html += this.formatDiagnosticItem(diagnostic, 'error');
      });
      html += '</div>';
    }
    
    if (groupedDiagnostics.warnings.length > 0) {
      html += '<div class="diagnostic-group"><h4 class="diagnostic-group-title warning">⚠️ Warnings (' + groupedDiagnostics.warnings.length + ')</h4>';
      groupedDiagnostics.warnings.forEach(diagnostic => {
        html += this.formatDiagnosticItem(diagnostic, 'warning');
      });
      html += '</div>';
    }
    
    if (groupedDiagnostics.info.length > 0) {
      html += '<div class="diagnostic-group"><h4 class="diagnostic-group-title info">ℹ️ Info (' + groupedDiagnostics.info.length + ')</h4>';
      groupedDiagnostics.info.forEach(diagnostic => {
        html += this.formatDiagnosticItem(diagnostic, 'info');
      });
      html += '</div>';
    }

    diagnosticsListElement.innerHTML = html;
    
    // Add click handlers to navigate to errors
    diagnosticsListElement.querySelectorAll('.diagnostic-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const lineNumber = parseInt((e.currentTarget as HTMLElement).dataset.line || '1');
        const column = parseInt((e.currentTarget as HTMLElement).dataset.column || '1');
        
        this.editor.setPosition({ lineNumber, column });
        this.editor.revealLineInCenter(lineNumber);
        this.editor.focus();
      });
    });
  }

  private formatDiagnosticItem(diagnostic: any, severity: string): string {
    const line = diagnostic.range?.startLineNumber || 1;
    const column = diagnostic.range?.startColumn || 1;
    
    return `
      <div class="diagnostic-item ${severity}" data-line="${line}" data-column="${column}" 
           title="Click to navigate to line ${line}">
        <div class="diagnostic-header">
          <span class="diagnostic-line">Line ${line}:${column}</span>
          <span class="diagnostic-code">${diagnostic.code || 'UNKNOWN'}</span>
        </div>
        <div class="diagnostic-message">${diagnostic.message}</div>
      </div>
    `;
  }

  private updateSectionSummary() {
    const summaryElement = document.getElementById('section-summary');
    if (!summaryElement) return;

    const currentUri = this.model.uri.toString();
    const codes = this.extractedCodes.get(currentUri) || [];
    const diagnostics = this.diagnostics.get(currentUri) || [];

    const codesCount = codes.length;
    const warningsCount = diagnostics.filter(d => d.severity === monaco.MarkerSeverity.Warning).length;
    const errorsCount = diagnostics.filter(d => d.severity === monaco.MarkerSeverity.Error).length;

    summaryElement.innerHTML = `
      <div class="summary-item">
        <span class="summary-label">Medical Terms:</span>
        <span class="summary-value">${codesCount}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Warnings:</span>
        <span class="summary-value ${warningsCount > 0 ? 'warning' : ''}">${warningsCount}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Errors:</span>
        <span class="summary-value ${errorsCount > 0 ? 'error' : ''}">${errorsCount}</span>
      </div>
    `;
  }

  private setupMetadataPanel() {
    // Initialize metadata panel
    this.updateMetadataPanel();

    // Add metadata panel toggle functionality
    const toggleButton = document.getElementById('metadata-toggle');
    const metadataPanel = document.getElementById('metadata-panel');

    if (toggleButton && metadataPanel) {
      toggleButton.addEventListener('click', () => {
        metadataPanel.classList.toggle('collapsed');
        toggleButton.textContent = metadataPanel.classList.contains('collapsed')
          ? '◀'
          : '▶';
      });
    }
  }

  /**
   * Calculate line ranges for each section for scroll navigation
   */
  private calculateSectionRanges() {
    const content = this.model.getValue();
    const lines = content.split('\n');

    // Section mappings from heading text to section type
    const sectionMappings: Record<string, Section> = {
      patient: 'patient',
      'chief complaint': 'chief',
      hpi: 'hpi',
      'history of present illness': 'hpi',
      allergies: 'allergies',
      'allergies and intolerances': 'allergies',
      medications: 'meds',
      meds: 'meds',
      assessment: 'assessment',
      plan: 'plan',
    };

    // Reset all tracking data
    this.sectionRanges.clear();
    this.sectionTitles.clear();
    this.availableSections.clear();

    let currentSection: Section | null = null;
    let sectionStart = 0;

    lines.forEach((line, index) => {
      const trimmed = line.trim().toLowerCase();

      // Check if this line is a heading (starts with ##)
      if (trimmed.startsWith('##')) {
        // If we had a previous section, close it
        if (currentSection) {
          this.sectionRanges.set(currentSection, {
            start: sectionStart,
            end: index - 1,
          });
        }

        // Extract the actual heading text (preserve original case)
        const originalHeading = line.trim().replace(/^#+\s*/, '');
        const headingText = trimmed.replace(/^#+\s*/, '');
        
        // Find matching section
        currentSection = null;
        for (const [key, section] of Object.entries(sectionMappings)) {
          if (headingText.includes(key)) {
            currentSection = section;
            sectionStart = index;
            // Store the actual title from the document
            this.sectionTitles.set(section, originalHeading);
            this.availableSections.add(section);
            break;
          }
        }
      }
    });

    // Close the last section
    if (currentSection) {
      this.sectionRanges.set(currentSection, {
        start: sectionStart,
        end: lines.length - 1,
      });
    }

    // Update metadata panel when sections change
    this.updateMetadataPanel();
  }





  /**
   * Scroll editor to the specified section
   */
  private scrollToSection(section: Section) {
    const range = this.sectionRanges.get(section);
    if (!range) {
      console.warn(`No range found for section: ${section}`);
      return;
    }

    // Scroll to the section heading
    this.editor.revealLineInCenter(range.start + 1); // Monaco uses 1-based line numbers

    // Optionally set cursor to the beginning of the section content
    const position = { lineNumber: range.start + 2, column: 1 }; // Skip heading line
    this.editor.setPosition(position);
  }

  /**
   * Update the section title in the editor header
   */
  private updateSectionTitle(section: Section) {
    const sectionTitleElement = document.querySelector('.section-title');
    if (sectionTitleElement) {
      const sectionNames: Record<Section, string> = {
        patient: 'Patient Information',
        chief: 'Chief Complaint',
        hpi: 'History of Present Illness',
        allergies: 'Allergies & Intolerances',
        meds: 'Medications',
        assessment: 'Assessment',
        plan: 'Plan',
      };

      sectionTitleElement.textContent =
        sectionNames[section] || 'Medical Documentation';
    }
  }

  public dispose() {
    this.editor?.dispose();
    this.model?.dispose();
  }
}

// Initialize the application
let editor: YAbelFishEditor;

document.addEventListener('DOMContentLoaded', () => {
  try {
    editor = new YAbelFishEditor();
    console.log('yAbelFish Editor initialized successfully');
  } catch (error) {
    console.error('Failed to initialize yAbelFish Editor:', error);

    // Show error message to user
    const editorContainer = document.getElementById('editor');
    if (editorContainer) {
      editorContainer.innerHTML = `
        <div class="error-container">
          <div class="error-content">
            <h3>🚨 Failed to initialize editor</h3>
            <p>Please check the browser console for more details.</p>
            <p>Make sure you have a modern browser with Web Worker support.</p>
          </div>
        </div>
      `;
    }
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  editor?.dispose();
});

export { YAbelFishEditor };
