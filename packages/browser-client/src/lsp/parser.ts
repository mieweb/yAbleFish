/**
 * yAbel Parser - Browser Version
 *
 * Simplified version for browser client
 */

export interface ParsedSection {
  type: 'heading' | 'text' | 'structured';
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
  metadata: Record<string, any>;
}

export class YAbelParser {
  private lines: string[] = [];
  private currentLine = 0;

  parse(content: string): ParsedDocument {
    this.lines = content.split('\n');
    this.currentLine = 0;

    const sections: ParsedSection[] = [];
    const metadata: Record<string, any> = {};

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

  private parseSection(): ParsedSection | null {
    const startLine = this.currentLine;
    const line = this.lines[this.currentLine]?.trim();

    if (!line) {
      return null;
    }

    // Check for headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();
      const startChar = this.lines[this.currentLine].indexOf('#');

      this.currentLine++;

      const contentLines: string[] = [];
      while (this.currentLine < this.lines.length) {
        const nextLine = this.lines[this.currentLine];
        if (nextLine.trim().match(/^#{1,6}\s+/)) {
          break;
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

    // Regular text
    const contentLines = [line];
    this.currentLine++;

    while (this.currentLine < this.lines.length) {
      const nextLine = this.lines[this.currentLine];
      if (nextLine.trim().match(/^#{1,6}\s+/)) {
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

  private extractMetadata(title: string, content: string): Record<string, any> {
    const metadata: Record<string, any> = {};

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
    } else if (titleLower.includes('hpi') || titleLower.includes('history')) {
      metadata.sectionType = 'hpi';
    } else if (
      titleLower.includes('assessment') ||
      titleLower.includes('plan')
    ) {
      metadata.sectionType = 'assessment-plan';
    } else if (titleLower.includes('patient')) {
      metadata.sectionType = 'patient-info';
    }

    return metadata;
  }

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
}
