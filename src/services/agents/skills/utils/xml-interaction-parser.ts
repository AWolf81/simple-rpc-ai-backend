/**
 * XML Interaction Parser
 *
 * Parses XML interaction markers from tool output using fast-xml-parser.
 * Supports streaming and partial XML parsing.
 */

import { XMLParser, XMLBuilder } from 'fast-xml-parser';

export interface InteractionData {
  type: 'confirm' | 'select' | 'input' | 'approval';
  title?: string;
  message: string;
  options?: string[];
  defaultValue?: string;
  multiSelect?: boolean;
  enableAIInterpretation?: boolean;
  aiContext?: string;
}

// XML Parser configuration
const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: true,
  trimValues: true
};

const parser = new XMLParser(parserOptions);

// XML Builder configuration
const builderOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  indentBy: '  ',
  suppressEmptyNode: true
};

const builder = new XMLBuilder(builderOptions);

/**
 * Detect if string contains interaction XML
 */
export function containsInteraction(text: string): boolean {
  return /<interaction[\s>]/i.test(text);
}

/**
 * Detect if interaction XML is complete
 */
export function isInteractionComplete(text: string): boolean {
  return /<interaction[\s>]/i.test(text) && /<\/interaction>/i.test(text);
}

/**
 * Extract interaction XML from text (even with surrounding content)
 */
export function extractInteractionXML(text: string): string | null {
  const match = text.match(/<interaction[^>]*>[\s\S]*?<\/interaction>/i);
  return match ? match[0] : null;
}

/**
 * Parse interaction XML into InteractionData
 */
export function parseInteractionXML(xml: string): InteractionData | null {
  try {
    const parsed = parser.parse(xml);

    if (!parsed.interaction) {
      console.error('No interaction root element found');
      return null;
    }

    const interactionNode = parsed.interaction;

    // Extract type from attribute
    const type = interactionNode['@_type'] as InteractionData['type'];
    if (!type) {
      console.error('No type attribute found in interaction XML');
      return null;
    }

    // Extract message (required)
    const message = interactionNode.message;
    if (!message) {
      console.error('No message found in interaction XML');
      return null;
    }

    // Build interaction data
    const interaction: InteractionData = {
      type,
      message: typeof message === 'string' ? message : message['#text'] || ''
    };

    // Extract optional fields
    if (interactionNode.title) {
      interaction.title = typeof interactionNode.title === 'string'
        ? interactionNode.title
        : interactionNode.title['#text'];
    }

    if (interactionNode['default-value']) {
      interaction.defaultValue = typeof interactionNode['default-value'] === 'string'
        ? interactionNode['default-value']
        : interactionNode['default-value']['#text'];
    }

    if (interactionNode['ai-context']) {
      interaction.aiContext = typeof interactionNode['ai-context'] === 'string'
        ? interactionNode['ai-context']
        : interactionNode['ai-context']['#text'];
    }

    // Extract boolean fields
    if (interactionNode['enable-ai-interpretation'] !== undefined) {
      const value = interactionNode['enable-ai-interpretation'];
      interaction.enableAIInterpretation = typeof value === 'boolean'
        ? value
        : String(value).toLowerCase() === 'true';
    }

    if (interactionNode['multi-select'] !== undefined) {
      const value = interactionNode['multi-select'];
      interaction.multiSelect = typeof value === 'boolean'
        ? value
        : String(value).toLowerCase() === 'true';
    }

    // Extract options array
    if (interactionNode.options) {
      const optionsNode = interactionNode.options;

      if (optionsNode.option) {
        // Normalize to array
        const optionList = Array.isArray(optionsNode.option)
          ? optionsNode.option
          : [optionsNode.option];

        interaction.options = optionList.map((opt: any) =>
          typeof opt === 'string' ? opt : (opt['#text'] || '')
        );
      }
    }

    return interaction;
  } catch (error) {
    console.error('Error parsing interaction XML:', error);
    return null;
  }
}

/**
 * Streaming XML Parser for interaction detection
 */
export class InteractionStreamParser {
  private buffer = '';
  private inInteraction = false;

  /**
   * Process a chunk of text and extract interaction if complete
   */
  process(chunk: string): InteractionData | null {
    this.buffer += chunk;

    // Start of interaction
    if (!this.inInteraction && containsInteraction(this.buffer)) {
      this.inInteraction = true;
    }

    // Check if complete
    if (this.inInteraction && isInteractionComplete(this.buffer)) {
      const xml = extractInteractionXML(this.buffer);
      if (xml) {
        const interaction = parseInteractionXML(xml);
        this.reset();
        return interaction;
      }
    }

    return null;
  }

  /**
   * Check if currently parsing an interaction
   */
  isActive(): boolean {
    return this.inInteraction;
  }

  /**
   * Get current buffer content
   */
  getBuffer(): string {
    return this.buffer;
  }

  /**
   * Reset parser state
   */
  reset() {
    this.buffer = '';
    this.inInteraction = false;
  }
}

/**
 * Generate interaction XML
 */
export function generateInteractionXML(interaction: InteractionData): string {
  const obj: any = {
    interaction: {
      '@_type': interaction.type,
      message: interaction.message
    }
  };

  if (interaction.title) {
    obj.interaction.title = interaction.title;
  }

  if (interaction.options && interaction.options.length > 0) {
    obj.interaction.options = {
      option: interaction.options
    };
  }

  if (interaction.defaultValue) {
    obj.interaction['default-value'] = interaction.defaultValue;
  }

  if (interaction.multiSelect !== undefined) {
    obj.interaction['multi-select'] = interaction.multiSelect;
  }

  if (interaction.enableAIInterpretation !== undefined) {
    obj.interaction['enable-ai-interpretation'] = interaction.enableAIInterpretation;
  }

  if (interaction.aiContext) {
    obj.interaction['ai-context'] = interaction.aiContext;
  }

  return builder.build(obj);
}

/**
 * Generate interaction response XML
 */
export function generateInteractionResponseXML(response: string | string[]): string {
  if (Array.isArray(response)) {
    return builder.build({
      'interaction-response': {
        values: {
          value: response
        }
      }
    });
  } else {
    return builder.build({
      'interaction-response': {
        value: response
      }
    });
  }
}

/**
 * Parse interaction response XML
 */
export function parseInteractionResponseXML(xml: string): string | string[] | null {
  try {
    const parsed = parser.parse(xml);

    if (!parsed['interaction-response']) {
      return null;
    }

    const response = parsed['interaction-response'];

    // Single value
    if (response.value) {
      return typeof response.value === 'string' ? response.value : response.value['#text'];
    }

    // Multiple values
    if (response.values && response.values.value) {
      const values = Array.isArray(response.values.value)
        ? response.values.value
        : [response.values.value];

      return values.map((v: any) => typeof v === 'string' ? v : v['#text']);
    }

    return null;
  } catch (error) {
    console.error('Error parsing interaction response XML:', error);
    return null;
  }
}
