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
  private worker: Worker | null = null;
  private port: MessagePort | null = null;
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
    this.createModel();
    this.createEditor();
    this.initializeLSP();
    this.setupMetadataPanel();
    this.setupDocumentSwitcher();
    
    // Initial section calculation
    this.calculateSectionRanges();
    this.updateSectionTitle(this.currentSection);
  }

  private initializeMonaco() {
    // Register yAbel language
    monaco.languages.register({ id: 'yabel' });

    // Configure Monaco theme (VS Code dark)
    monaco.editor.defineTheme('yabel-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: '569cd6' },
        { token: 'string', foreground: 'ce9178' },
        { token: 'number', foreground: 'b5cea8' },
        { token: 'comment', foreground: '6a9955' },
      ],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#cccccc',
        'editor.lineHighlightBackground': '#2d2d30',
        'editor.selectionBackground': '#264f78',
        'editorCursor.foreground': '#ffffff',
        'editor.inactiveSelectionBackground': '#3a3d41',
      },
    });

    monaco.editor.setTheme('yabel-dark');
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
      this.sendDocumentChange(this.model.uri.toString(), this.model.getValue());
      // Recalculate section ranges when content changes
      this.calculateSectionRanges();
    });
  }



  private async initializeLSP() {
    try {
      // Create worker
      this.worker = new Worker(
        new URL('./worker/lsp-worker.ts', import.meta.url),
        { type: 'module' }
      );

      // Create message channel
      const channel = new MessageChannel();
      this.port = channel.port1;

      // Listen for metadata updates from worker
      this.port.onmessage = event => {
        this.handleWorkerMessage(event.data);
      };

      // Send port to worker
      this.worker.postMessage({ type: 'lsp-init' }, [channel.port2]);

      // Send initial document content
      this.sendDocumentChange(this.model.uri.toString(), this.model.getValue());

      console.log('LSP worker started successfully');
    } catch (error) {
      console.error('Failed to initialize LSP:', error);
    }
  }

  private handleWorkerMessage(data: any) {
    switch (data.type) {
      case 'metadata-update':
        this.handleMetadataUpdate(data.data as MetadataUpdate);
        break;
      case 'completions':
        // Handle completions if needed
        break;
      case 'hover':
        // Handle hover if needed
        break;
      case 'diagnostics':
        this.handleDiagnostics(data.data);
        break;
    }
  }

  private sendDocumentChange(uri: string, text: string) {
    if (this.port) {
      this.port.postMessage({
        type: 'document-changed',
        uri,
        text,
      });
    }
  }

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

## Assessment
- Type 2 diabetes mellitus - well controlled
- Hypertension - stable on current regimen

## Plan
- Continue current diabetes regimen
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

  private updateMetadataPanel() {
    const currentUri = this.model.uri.toString();
    const codes = this.extractedCodes.get(currentUri) || [];
    const diagnostics = this.diagnostics.get(currentUri) || [];
    const patient = this.patientInfo.get(currentUri);

    // Update header with patient and visit information
    this.updateHeader(patient);

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

    // Function to find which section a line belongs to
    const findSectionForLine = (lineNumber: number) => {
      let bestHeading = null;
      for (let i = headings.length - 1; i >= 0; i--) {
        if (headings[i].line <= lineNumber) {
          bestHeading = headings[i];
          break;
        }
      }
      return bestHeading;
    };

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
                     data-column="${((code.range as any).start?.character || 0) + 1}" 
                     data-end-column="${((code.range as any).end?.character || 0) + 1}">
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

  private updateSectionSummary() {
    const summaryElement = document.getElementById('section-summary');
    if (!summaryElement) return;

    const currentUri = this.model.uri.toString();
    const codes = this.extractedCodes.get(currentUri) || [];
    const diagnostics = this.diagnostics.get(currentUri) || [];

    const codesCount = codes.length;
    const warningsCount = diagnostics.filter(d => d.severity === 2).length;
    const errorsCount = diagnostics.filter(d => d.severity === 1).length;

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
    this.worker?.terminate();

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
