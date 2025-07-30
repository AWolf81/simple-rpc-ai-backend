/**
 * Response Parser Service
 * 
 * Handles fast XML and JSON parsing with streaming support.
 * XML as default for streaming capabilities, JSON for compatibility.
 */

import { XMLParser } from 'fast-xml-parser';
import { Transform } from 'stream';

export type ResponseFormat = 'xml' | 'json';

export interface ParsedResponse {
  format: ResponseFormat;
  data: any;
  raw: string;
  metadata: {
    parseTime: number;
    isStreaming: boolean;
    chunkCount?: number;
  };
}

export interface ParserOptions {
  format?: ResponseFormat;
  streaming?: boolean;
  xmlOptions?: {
    ignoreAttributes: boolean;
    parseTagValue: boolean;
    trimValues: boolean;
    parseTrueNumberOnly: boolean;
  };
  jsonOptions?: {
    reviver?: (key: string, value: any) => any;
  };
}

export class ResponseParser {
  private xmlParser: XMLParser;
  private defaultFormat: ResponseFormat = 'xml';

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: true,
      trimValues: true,
      parseAttributeValue: true,
      attributeNamePrefix: '@_',
      textNodeName: '#text'
    });
  }

  /**
   * Parse response with format detection
   */
  async parse(content: string, options: ParserOptions = {}): Promise<ParsedResponse> {
    const startTime = Date.now();
    const format = options.format || this.detectFormat(content);
    
    let data: any;
    try {
      if (format === 'xml') {
        data = this.parseXML(content, options.xmlOptions);
      } else {
        data = this.parseJSON(content, options.jsonOptions);
      }
    } catch (error: any) {
      throw new Error(`Failed to parse ${format.toUpperCase()}: ${error.message}`);
    }

    return {
      format,
      data,
      raw: content,
      metadata: {
        parseTime: Date.now() - startTime,
        isStreaming: options.streaming || false
      }
    };
  }

  /**
   * Create streaming XML parser
   */
  createStreamingXMLParser(onChunk: (chunk: any) => void): Transform {
    let buffer = '';
    let chunkCount = 0;
    const parser = this;
    
    return new Transform({
      objectMode: true,
      transform(chunk: Buffer, encoding: string, callback: Function) {
        buffer += chunk.toString();
        chunkCount++;
        
        // Try to parse complete XML elements from buffer
        const xmlChunks = parser.extractCompleteXMLElements(buffer);
        
        for (const xmlChunk of xmlChunks.complete) {
          try {
            const parsed = parser.xmlParser.parse(xmlChunk);
            onChunk({
              data: parsed,
              chunk: chunkCount,
              timestamp: Date.now()
            });
          } catch (error) {
            // Incomplete XML, keep in buffer
          }
        }
        
        buffer = xmlChunks.remaining;
        callback();
      },
      
      flush(callback: Function) {
        // Parse any remaining buffer content
        if (buffer.trim()) {
          try {
            const parsed = parser.xmlParser.parse(buffer);
            onChunk({
              data: parsed,
              chunk: chunkCount,
              timestamp: Date.now(),
              final: true
            });
          } catch (error: any) {
            console.error(`Final XML parse failed: ${error.message}`);
          }
        }
        callback();
      }
    });
  }

  /**
   * Create streaming JSON parser
   */
  createStreamingJSONParser(onChunk: (chunk: any) => void): Transform {
    let buffer = '';
    let chunkCount = 0;
    const parser = this;
    
    return new Transform({
      objectMode: true,
      transform(chunk: Buffer, encoding: string, callback: Function) {
        buffer += chunk.toString();
        chunkCount++;
        
        // Try to parse complete JSON objects from buffer
        const jsonChunks = parser.extractCompleteJSONObjects(buffer);
        
        for (const jsonChunk of jsonChunks.complete) {
          try {
            const parsed = JSON.parse(jsonChunk);
            onChunk({
              data: parsed,
              chunk: chunkCount,
              timestamp: Date.now()
            });
          } catch (error) {
            // Incomplete JSON, keep in buffer
          }
        }
        
        buffer = jsonChunks.remaining;
        callback();
      },
      
      flush(callback: Function) {
        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer);
            onChunk({
              data: parsed,
              chunk: chunkCount,
              timestamp: Date.now(),
              final: true
            });
          } catch (error: any) {
            this.emit('error', new Error(`Final JSON parse failed: ${error.message}`));
          }
        }
        callback();
      }
    });
  }

  /**
   * Auto-detect response format
   */
  private detectFormat(content: string): ResponseFormat {
    const trimmed = content.trim();
    
    if (trimmed.startsWith('<') && trimmed.includes('>')) {
      return 'xml';
    }
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return 'json';
    }
    
    // Default to XML for streaming advantages
    return this.defaultFormat;
  }

  /**
   * Parse XML content
   */
  private parseXML(content: string, options?: ParserOptions['xmlOptions']): any {
    if (options) {
      const customParser = new XMLParser(options);
      return customParser.parse(content);
    }
    return this.xmlParser.parse(content);
  }

  /**
   * Parse JSON content
   */
  private parseJSON(content: string, options?: ParserOptions['jsonOptions']): any {
    return JSON.parse(content, options?.reviver);
  }

  /**
   * Extract complete XML elements from buffer
   */
  private extractCompleteXMLElements(buffer: string): { complete: string[], remaining: string } {
    const complete: string[] = [];
    let remaining = buffer;
    
    // Simple XML element extraction (could be enhanced)
    const elementRegex = /<(\w+)[^>]*>.*?<\/\1>/gs;
    let match;
    
    while ((match = elementRegex.exec(buffer)) !== null) {
      complete.push(match[0]);
      remaining = remaining.replace(match[0], '');
    }
    
    return { complete, remaining };
  }

  /**
   * Extract complete JSON objects from buffer
   */
  private extractCompleteJSONObjects(buffer: string): { complete: string[], remaining: string } {
    const complete: string[] = [];
    let remaining = buffer;
    let braceCount = 0;
    let inString = false;
    let escaped = false;
    let start = -1;
    
    for (let i = 0; i < buffer.length; i++) {
      const char = buffer[i];
      
      if (escaped) {
        escaped = false;
        continue;
      }
      
      if (char === '\\') {
        escaped = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === '{') {
          if (braceCount === 0) {
            start = i;
          }
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0 && start !== -1) {
            const jsonStr = buffer.substring(start, i + 1);
            complete.push(jsonStr);
            remaining = remaining.replace(jsonStr, '');
            start = -1;
          }
        }
      }
    }
    
    return { complete, remaining };
  }

  /**
   * Generate system prompt with format specification
   */
  static generateFormatPrompt(format: ResponseFormat = 'xml'): string {
    if (format === 'xml') {
      return `
Your response MUST be valid XML format. Structure your response like this:
<response>
  <summary>Brief summary</summary>
  <analysis>
    <point>Analysis point 1</point>
    <point>Analysis point 2</point>
  </analysis>
  <recommendations>
    <item>Recommendation 1</item>
    <item>Recommendation 2</item>
  </recommendations>
</response>

Use meaningful XML tags that describe the content. Keep the structure consistent and well-formed.`.trim();
    } else {
      return `
Your response MUST be valid JSON format. Structure your response like this:
{
  "summary": "Brief summary",
  "analysis": [
    "Analysis point 1",
    "Analysis point 2"
  ],
  "recommendations": [
    "Recommendation 1", 
    "Recommendation 2"
  ]
}

Use meaningful JSON properties that describe the content. Ensure valid JSON syntax.`.trim();
    }
  }
}

export default ResponseParser;