/**
 * yAbel Format Parser
 * 
 * Parses yAbel format which is inspired by Markdown and YAML but forgiving.
 * Extracts structured information from medical documentation.
 */

export interface ParsedSection {
  type: 'heading' | 'text' | 'medication' | 'allergy' | 'condition' | 'structured';
  level?: number;
  title?: string;
  content: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  metadata?: Record<string, any>;
}

export interface ParsedDocument {
  sections: ParsedSection[];
  metadata: {
    patientInfo?: Record<string, string>;
    visitInfo?: Record<string, string>;
    extractedCodes?: Array<{ term: string; code: string; type: string }>;
  };
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

    while (this.currentLine < this.lines.length) {
      const section = this.parseSection();
      if (section) {
        sections.push(section);
      } else {
        this.currentLine++;
      }
    }

    return { sections, metadata };
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
          end: { line: endLine, character: endChar }
        },
        metadata: this.extractMetadata(title, content)
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
        end: { line: this.currentLine - 1, character: this.lines[this.currentLine - 1]?.length || 0 }
      }
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
        end: { line: endLine, character: this.lines[endLine]?.length || 0 }
      },
      metadata: { structuredData }
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
    } else if (titleLower.includes('chief') || titleLower.includes('complaint')) {
      metadata.sectionType = 'chief-complaint';
    } else if (titleLower.includes('hpi') || titleLower.includes('history') || titleLower.includes('illness')) {
      metadata.sectionType = 'hpi';
    } else if (titleLower.includes('assessment') || titleLower.includes('plan')) {
      metadata.sectionType = 'assessment-plan';
    } else if (titleLower.includes('patient')) {
      metadata.sectionType = 'patient-info';
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
  static getSectionByType(document: ParsedDocument, sectionType: string): ParsedSection | null {
    return document.sections.find(section => 
      section.metadata?.sectionType === sectionType
    ) || null;
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
  static getTextAtPosition(content: string, line: number, character: number): string {
    const lines = content.split('\n');
    if (line >= lines.length) return '';
    
    const targetLine = lines[line];
    if (character >= targetLine.length) return '';
    
    return targetLine;
  }
}