#!/usr/bin/env node
/**
 * Approval Dialog Script
 *
 * Shows an approval dialog with customizable options - outputs XML for UI rendering
 */

interface ApprovalArgs {
  title: string;
  message: string;
  options: string[];
  allowCustom?: boolean;
  enableAIInterpretation?: boolean;
  aiContext?: string;
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseArgs(args: string[]): ApprovalArgs {
  const result: ApprovalArgs = {
    title: 'Approval Required',
    message: 'Do you approve this operation?',
    options: ['Yes', 'No'],
    allowCustom: false,
    enableAIInterpretation: false
  };

  // Parse positional args and flags
  let i = 0;
  while (i < args.length) {
    if (args[i] === '--allow-custom') {
      result.allowCustom = true;
      i++;
    } else if (args[i] === '--enable-ai-interpretation') {
      result.enableAIInterpretation = true;
      i++;
    } else if (args[i] === '--ai-context' && i + 1 < args.length) {
      result.aiContext = args[i + 1];
      i += 2;
    } else if (i === 0) {
      result.title = args[i];
      i++;
    } else if (i === 1) {
      result.message = args[i];
      i++;
    } else if (i === 2) {
      // Parse options JSON
      try {
        const parsed = JSON.parse(args[i]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          result.options = parsed;
        }
      } catch (error) {
        console.error('Invalid options format. Expected JSON array like ["Yes", "No", "Cancel"]');
        process.exit(1);
      }
      i++;
    } else {
      i++;
    }
  }

  return result;
}

function outputInteractionXML(args: ApprovalArgs) {
  let xml = `<interaction type="approval">\n`;

  xml += `  <title>${escapeXML(args.title)}</title>\n`;
  xml += `  <message>${escapeXML(args.message)}</message>\n`;

  xml += `  <options>\n`;
  for (const option of args.options) {
    xml += `    <option>${escapeXML(option)}</option>\n`;
  }
  xml += `  </options>\n`;

  if (args.enableAIInterpretation) {
    xml += `  <enable-ai-interpretation>true</enable-ai-interpretation>\n`;
  }

  if (args.aiContext) {
    xml += `  <ai-context>${escapeXML(args.aiContext)}</ai-context>\n`;
  }

  xml += `</interaction>`;

  console.log(xml);
}

function handleNonInteractiveMode(mode: string, options: string[]) {
  const value = mode === 'auto-approve' ? options[0] :
                mode === 'auto-deny' ? (options[1] || 'No') :
                options[0];

  console.log(`<interaction-response>\n  <value>${escapeXML(value)}</value>\n</interaction-response>`);
  process.exit(0);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Check for non-interactive mode
  const interactiveMode = process.env.USER_INTERACTION_MODE || 'xml';

  if (interactiveMode === 'auto-approve' || interactiveMode === 'auto-deny' || interactiveMode === 'default') {
    handleNonInteractiveMode(interactiveMode, args.options);
    return;
  }

  // Output XML interaction marker
  outputInteractionXML(args);

  // Exit with special code indicating UI interaction needed
  process.exit(42);
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
