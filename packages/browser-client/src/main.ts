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

  // Single document content with all sections
  private documentContent = `# Visit Enc #: 139 Date: 09-22-2025 RE: Heart, William 02-14-1964

## Patient
Name: William Heart
Sex: Male
DOB: 02-14-1964

## Chief Complaint
Chest pain and shortness of breath

## HPI
Patient presents with complaints of chest pain and shortness of breath. Symptoms began 2 days ago and have been progressively worsening. Patient reports a history of similar episodes but denies any recent trauma or injury.

## Allergies and Intolerances
- PENICILLINS
- SULFONAMIDES

## Medications
- aspirin 81 mg tablet, delayed release
- lisinopril 10 mg tablet  
- Coumadin 5 mg tablet
- Lasix: 20 mg tablet

## Assessment
- Hypertension - well controlled on current regimen
- CHF - Congestive heart failure
- Atrial fibrillation

## Plan
- Continue lisinopril 10 mg daily
- Increase monitoring of blood pressure at home
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
    // Store the codes and diagnostics
    this.extractedCodes.set(update.uri, update.codes);
    this.diagnostics.set(update.uri, update.diagnostics);

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

  private updateMetadataPanel() {
    const currentUri = this.model.uri.toString();
    const codes = this.extractedCodes.get(currentUri) || [];
    const diagnostics = this.diagnostics.get(currentUri) || [];

    // Update codes list - now inline
    const codesList = document.getElementById('codes-list');
    if (codesList) {
      if (codes.length === 0) {
        codesList.innerHTML =
          '<div class="empty-state">No medical codes detected yet</div>';
      } else {
        codesList.innerHTML = codes
          .map(
            code => `
          <span class="code-item">
            <span class="code-term">${code.term}</span>
            <span class="code-id">${code.code}</span>
          </span>
        `
          )
          .join('');
      }
    }

    // Update diagnostics list
    const diagnosticsList = document.getElementById('diagnostics-list');
    if (diagnosticsList) {
      if (diagnostics.length === 0) {
        diagnosticsList.innerHTML =
          '<div class="empty-state">No issues detected</div>';
      } else {
        diagnosticsList.innerHTML = diagnostics
          .map(
            diag => `
          <div class="diagnostic-item ${diag.severity === 1 ? 'error' : 'warning'}">
            <div class="diagnostic-icon">${diag.severity === 1 ? '🚨' : '⚠️'}</div>
            <div class="diagnostic-content">
              <div class="diagnostic-message">${diag.message}</div>
              <div class="diagnostic-code">${diag.code || 'VALIDATION'}</div>
            </div>
          </div>
        `
          )
          .join('');
      }
    }

    // Update section summary
    this.updateSectionSummary();
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

    // Update headings list when sections change
    this.updateHeadingsList();
  }

  /**
   * Update the headings list in the metadata panel
   */
  private updateHeadingsList() {
    const content = this.model.getValue();
    const lines = content.split('\n');
    const headings: { level: number; text: string; line: number }[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) {
        const match = trimmed.match(/^(#+)\s*(.+)/);
        if (match) {
          const level = match[1].length;
          const text = match[2].trim();
          headings.push({ level, text, line: index + 1 });
        }
      }
    });

    const headingsList = document.getElementById('headings-list');
    if (headingsList) {
      if (headings.length === 0) {
        headingsList.innerHTML =
          '<div class="empty-state">No headings detected</div>';
      } else {
        headingsList.innerHTML = headings
          .map(
            heading => `
          <div class="heading-item" data-line="${heading.line}">
            <span class="heading-level">H${heading.level}</span>
            <span class="heading-text">${heading.text}</span>
          </div>
        `
          )
          .join('');

        // Add click handlers for heading navigation
        headingsList.querySelectorAll('.heading-item').forEach(item => {
          item.addEventListener('click', () => {
            const line = parseInt(item.getAttribute('data-line') || '1');
            this.editor.revealLineInCenter(line);
            this.editor.setPosition({ lineNumber: line, column: 1 });
            this.editor.focus();
          });
        });
      }
    }
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
