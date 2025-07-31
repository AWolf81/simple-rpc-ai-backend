/**
 * Response Parser Service
 *
 * Handles fast XML and JSON parsing with streaming support.
 * XML as default for streaming capabilities, JSON for compatibility.
 */
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
export declare class ResponseParser {
    private xmlParser;
    private defaultFormat;
    constructor();
    /**
     * Parse response with format detection
     */
    parse(content: string, options?: ParserOptions): Promise<ParsedResponse>;
    /**
     * Create streaming XML parser
     */
    createStreamingXMLParser(onChunk: (chunk: any) => void): Transform;
    /**
     * Create streaming JSON parser
     */
    createStreamingJSONParser(onChunk: (chunk: any) => void): Transform;
    /**
     * Auto-detect response format
     */
    private detectFormat;
    /**
     * Parse XML content
     */
    private parseXML;
    /**
     * Parse JSON content
     */
    private parseJSON;
    /**
     * Extract complete XML elements from buffer
     */
    private extractCompleteXMLElements;
    /**
     * Extract complete JSON objects from buffer
     */
    private extractCompleteJSONObjects;
    /**
     * Generate system prompt with format specification
     */
    static generateFormatPrompt(format?: ResponseFormat): string;
}
export default ResponseParser;
//# sourceMappingURL=response-parser.d.ts.map