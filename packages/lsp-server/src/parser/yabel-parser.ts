import { patientParser, type MedicalPatient } from './ycard-patient-parser';

/**
 * yAbel Format Parser
 *
 * Parses yAbel format which is inspired by Markdown and YAML but forgiving.
 * Extracts structured information from medical documentation with yCard patient parsing.
 */

export interface ParsedSection {
  type:
    | 'heading'
    | 'text'
    | 'medication'
    | 'allergy'
    | 'condition'
    | 'structured';
  level?: number;
  title?: string;
  content: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  metadata?: Record<string, any>;
}

export interface HierarchicalSection {
  section: ParsedSection;
  children: HierarchicalSection[];
  parent?: HierarchicalSection;
  depth: number;
}

export interface DocumentStructure {
  // Linear representation - flat list of all sections in order
  linear: ParsedSection[];
  
  // Hierarchical representation - nested tree structure
  hierarchical: HierarchicalSection[];
  
  // Quick access maps
  sectionsByType: Map<string, ParsedSection[]>;
  sectionsByLevel: Map<number, ParsedSection[]>;
  
  // Navigation helpers
  getNextSibling(section: ParsedSection): ParsedSection | null;
  getPreviousSibling(section: ParsedSection): ParsedSection | null;
  getParent(section: ParsedSection): ParsedSection | null;
  getChildren(section: ParsedSection): ParsedSection[];
  getAncestors(section: ParsedSection): ParsedSection[];
  getDescendants(section: ParsedSection): ParsedSection[];
}

export interface ParsedDocument {
  // Dual structure representation
  structure: DocumentStructure;
  
  // Legacy flat sections array for backward compatibility
  sections: ParsedSection[];
  
  metadata: {
    patientInfo?: Record<string, string>;
    visitInfo?: Record<string, string>;
    extractedCodes?: Array<{ term: string; code: string; type: string }>;
    patient?: MedicalPatient; // yCard structured patient data
    patientErrors?: string[]; // yCard parsing errors
  };
}

class DocumentStructureImpl implements DocumentStructure {
  linear: ParsedSection[];
  hierarchical: HierarchicalSection[];
  sectionsByType: Map<string, ParsedSection[]>;
  sectionsByLevel: Map<number, ParsedSection[]>;
  private sectionMap: Map<ParsedSection, HierarchicalSection>;

  constructor(sections: ParsedSection[]) {
    this.linear = sections;
    this.sectionsByType = new Map();
    this.sectionsByLevel = new Map();
    this.sectionMap = new Map();
    
    // Build hierarchical structure
    this.hierarchical = this.buildHierarchy(sections);
    
    // Build quick access maps
    this.buildMaps();
  }

  private buildHierarchy(sections: ParsedSection[]): HierarchicalSection[] {
    const root: HierarchicalSection[] = [];
    const stack: HierarchicalSection[] = [];

    for (const section of sections) {
      if (section.type !== 'heading') {
        continue; // Only process headings for hierarchy
      }

      const level = section.level || 1;
      const hierarchicalSection: HierarchicalSection = {
        section,
        children: [],
        depth: level
      };

      this.sectionMap.set(section, hierarchicalSection);

      // Find the correct parent
      while (stack.length > 0 && stack[stack.length - 1].depth >= level) {
        stack.pop();
      }

      if (stack.length === 0) {
        // Top-level section
        root.push(hierarchicalSection);
      } else {
        // Child section
        const parent = stack[stack.length - 1];
        hierarchicalSection.parent = parent;
        parent.children.push(hierarchicalSection);
      }

      stack.push(hierarchicalSection);
    }

    return root;
  }

  private buildMaps(): void {
    for (const section of this.linear) {
      // Group by type
      if (!this.sectionsByType.has(section.type)) {
        this.sectionsByType.set(section.type, []);
      }
      this.sectionsByType.get(section.type)!.push(section);

      // Group by level
      if (section.level) {
        if (!this.sectionsByLevel.has(section.level)) {
          this.sectionsByLevel.set(section.level, []);
        }
        this.sectionsByLevel.get(section.level)!.push(section);
      }
    }
  }

  getNextSibling(section: ParsedSection): ParsedSection | null {
    const hierarchical = this.sectionMap.get(section);
    if (!hierarchical?.parent) return null;

    const siblings = hierarchical.parent.children;
    const index = siblings.indexOf(hierarchical);
    return index < siblings.length - 1 ? siblings[index + 1].section : null;
  }

  getPreviousSibling(section: ParsedSection): ParsedSection | null {
    const hierarchical = this.sectionMap.get(section);
    if (!hierarchical?.parent) return null;

    const siblings = hierarchical.parent.children;
    const index = siblings.indexOf(hierarchical);
    return index > 0 ? siblings[index - 1].section : null;
  }

  getParent(section: ParsedSection): ParsedSection | null {
    const hierarchical = this.sectionMap.get(section);
    return hierarchical?.parent?.section || null;
  }

  getChildren(section: ParsedSection): ParsedSection[] {
    const hierarchical = this.sectionMap.get(section);
    return hierarchical?.children.map(child => child.section) || [];
  }

  getAncestors(section: ParsedSection): ParsedSection[] {
    const ancestors: ParsedSection[] = [];
    let current = this.getParent(section);
    while (current) {
      ancestors.unshift(current);
      current = this.getParent(current);
    }
    return ancestors;
  }

  getDescendants(section: ParsedSection): ParsedSection[] {
    const descendants: ParsedSection[] = [];
    const hierarchical = this.sectionMap.get(section);
    
    if (hierarchical) {
      const collectDescendants = (node: HierarchicalSection) => {
        for (const child of node.children) {
          descendants.push(child.section);
          collectDescendants(child);
        }
      };
      collectDescendants(hierarchical);
    }
    
    return descendants;
  }
}

export class YAbelParser {
  private lines: string[] = [];
  private currentLine = 0;

  /**
   * Parse yAbel document content
   */
  parse(content: string): ParsedDocument {
    this.lines = content.split('\n');
    this.currentLine = 0;

    const sections: ParsedSection[] = [];
    const metadata: ParsedDocument['metadata'] = {};

    // Parse patient section with yCard if present
    const patientResult = patientParser.parsePatientSection(content);
    if (patientResult.success) {
      metadata.patient = patientResult.data;
      
      // Also extract traditional patient info for backwards compatibility
      metadata.patientInfo = {
        uid: patientResult.data.uid,
        name: `${patientResult.data.name || ''} ${patientResult.data.surname || ''}`.trim(),
        mrn: patientResult.data.mrn || '',
        dob: patientResult.data.dob || '',
        gender: patientResult.data.gender || '',
      };
    } else {
      metadata.patientErrors = patientResult.errors;
    }

    while (this.currentLine < this.lines.length) {
      const section = this.parseSection();
      if (section) {
        sections.push(section);
      } else {
        this.currentLine++;
      }
    }

    // Create dual structure representation
    const structure = new DocumentStructureImpl(sections);

    return { 
      structure,
      sections, // Legacy compatibility
      metadata 
    };
  }

  /**
   * Parse a single section starting from current line
   */
  private parseSection(): ParsedSection | null {
    const startLine = this.currentLine;
    const line = this.lines[this.currentLine]?.trim();

    if (!line) {
      return null;
    }

    // Check for headings (## Header or # Header)
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();
      const startChar = this.lines[this.currentLine].indexOf('#');

      this.currentLine++;

      // Collect content until next heading or end
      const contentLines: string[] = [];
      while (this.currentLine < this.lines.length) {
        const nextLine = this.lines[this.currentLine];
        if (nextLine.trim().match(/^#{1,6}\s+/)) {
          break; // Next heading found
        }
        contentLines.push(nextLine);
        this.currentLine++;
      }

      const content = contentLines.join('\n').trim();
      const endLine = this.currentLine - 1;
      const endChar = this.lines[endLine]?.length || 0;

      return {
        type: 'heading',
        level,
        title,
        content,
        range: {
          start: { line: startLine, character: startChar },
          end: { line: endLine, character: endChar },
        },
        metadata: this.extractMetadata(title, content),
      };
    }

    // Check for structured data (YAML-like)
    if (line.includes(':') && !line.startsWith('//') && !line.startsWith('#')) {
      return this.parseStructuredSection(startLine);
    }

    // Regular text content
    const contentLines = [line];
    this.currentLine++;

    // Collect consecutive non-heading lines
    while (this.currentLine < this.lines.length) {
      const nextLine = this.lines[this.currentLine];
      if (nextLine.trim().match(/^#{1,6}\s+/) || nextLine.includes(':')) {
        break;
      }
      contentLines.push(nextLine);
      this.currentLine++;
    }

    const content = contentLines.join('\n').trim();
    if (!content) return null;

    return {
      type: 'text',
      content,
      range: {
        start: { line: startLine, character: 0 },
        end: {
          line: this.currentLine - 1,
          character: this.lines[this.currentLine - 1]?.length || 0,
        },
      },
    };
  }

  /**
   * Parse structured/YAML-like section
   */
  private parseStructuredSection(startLine: number): ParsedSection {
    const contentLines: string[] = [];
    const structuredData: Record<string, any> = {};

    while (this.currentLine < this.lines.length) {
      const line = this.lines[this.currentLine];
      const trimmed = line.trim();

      // Stop at next heading
      if (trimmed.match(/^#{1,6}\s+/)) {
        break;
      }

      contentLines.push(line);

      // Parse key-value pairs
      const kvMatch = trimmed.match(/^([^:]+):\s*(.*)$/);
      if (kvMatch) {
        const key = kvMatch[1].trim();
        const value = kvMatch[2].trim();
        structuredData[key] = value;
      }

      this.currentLine++;
    }

    const content = contentLines.join('\n').trim();
    const endLine = this.currentLine - 1;

    return {
      type: 'structured',
      content,
      range: {
        start: { line: startLine, character: 0 },
        end: { line: endLine, character: this.lines[endLine]?.length || 0 },
      },
      metadata: { structuredData },
    };
  }

  /**
   * Extract metadata from section title and content
   */
  private extractMetadata(title: string, content: string): Record<string, any> {
    const metadata: Record<string, any> = {};

    // Classify section type based on title
    const titleLower = title.toLowerCase();

    if (titleLower.includes('medication') || titleLower.includes('med')) {
      metadata.sectionType = 'medications';
    } else if (titleLower.includes('allerg')) {
      metadata.sectionType = 'allergies';
    } else if (
      titleLower.includes('chief') ||
      titleLower.includes('complaint')
    ) {
      metadata.sectionType = 'chief-complaint';
    } else if (
      titleLower.includes('hpi') ||
      titleLower.includes('history') ||
      titleLower.includes('illness')
    ) {
      metadata.sectionType = 'hpi';
    } else if (
      titleLower.includes('assessment') ||
      titleLower.includes('plan')
    ) {
      metadata.sectionType = 'assessment-plan';
    } else if (titleLower.includes('patient')) {
      metadata.sectionType = 'patient-info';
      
      // Try to parse patient section content with yCard
      const patientResult = patientParser.parsePatientSection(content);
      if (patientResult.success) {
        metadata.patientData = patientResult.data;
        metadata.patientSummary = patientParser.generatePatientSummary(patientResult.data);
      } else {
        metadata.patientErrors = patientResult.errors;
      }
    }

    // Extract visit information if present
    const visitMatch = content.match(/Visit\s+Enc\s*#:\s*(\d+)/i);
    const dateMatch = content.match(/Date:\s*([\d-]+)/i);

    if (visitMatch) {
      metadata.visitNumber = visitMatch[1];
    }
    if (dateMatch) {
      metadata.visitDate = dateMatch[1];
    }

    return metadata;
  }

  /**
   * Get section by type
   */
  static getSectionByType(
    document: ParsedDocument,
    sectionType: string
  ): ParsedSection | null {
    return (
      document.sections.find(
        section => section.metadata?.sectionType === sectionType
      ) || null
    );
  }

  /**
   * Get all headings
   */
  static getHeadings(document: ParsedDocument): ParsedSection[] {
    return document.sections.filter(section => section.type === 'heading');
  }

  /**
   * Extract text range
   */
  static getTextAtPosition(
    content: string,
    line: number,
    character: number
  ): string {
    const lines = content.split('\n');
    if (line >= lines.length) return '';

    const targetLine = lines[line];
    if (character >= targetLine.length) return '';

    return targetLine;
  }

  /**
   * Get linear representation of document structure
   */
  static getLinearStructure(document: ParsedDocument): ParsedSection[] {
    return document.structure.linear;
  }

  /**
   * Get hierarchical representation of document structure
   */
  static getHierarchicalStructure(document: ParsedDocument): HierarchicalSection[] {
    return document.structure.hierarchical;
  }

  /**
   * Navigate to next section in linear order
   */
  static getNextSection(document: ParsedDocument, currentSection: ParsedSection): ParsedSection | null {
    const linear = document.structure.linear;
    const index = linear.indexOf(currentSection);
    return index >= 0 && index < linear.length - 1 ? linear[index + 1] : null;
  }

  /**
   * Navigate to previous section in linear order
   */
  static getPreviousSection(document: ParsedDocument, currentSection: ParsedSection): ParsedSection | null {
    const linear = document.structure.linear;
    const index = linear.indexOf(currentSection);
    return index > 0 ? linear[index - 1] : null;
  }

  /**
   * Get sections by type using indexed lookup
   */
  static getSectionsByType(document: ParsedDocument, type: string): ParsedSection[] {
    return document.structure.sectionsByType.get(type) || [];
  }

  /**
   * Get sections by heading level using indexed lookup
   */
  static getSectionsByLevel(document: ParsedDocument, level: number): ParsedSection[] {
    return document.structure.sectionsByLevel.get(level) || [];
  }

  /**
   * Get document outline as flat list with indentation info
   */
  static getDocumentOutline(document: ParsedDocument): Array<{ section: ParsedSection; depth: number; path: string[] }> {
    const outline: Array<{ section: ParsedSection; depth: number; path: string[] }> = [];
    
    const traverseHierarchy = (nodes: HierarchicalSection[], path: string[] = []) => {
      for (const node of nodes) {
        const currentPath = [...path, node.section.title || 'Untitled'];
        outline.push({
          section: node.section,
          depth: node.depth,
          path: currentPath
        });
        traverseHierarchy(node.children, currentPath);
      }
    };

    traverseHierarchy(document.structure.hierarchical);
    return outline;
  }
}
