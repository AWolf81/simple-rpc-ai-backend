#!/usr/bin/env node
/**
 * Confirmation Dialog Script
 *
 * Simple yes/no confirmation - outputs XML for UI rendering
 */

interface ConfirmArgs {
  message: string;
  title?: string;
  default?: string;
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

function parseArgs(args: string[]): ConfirmArgs {
  const result: ConfirmArgs = {
    message: 'Continue?',
    default: 'no',
    enableAIInterpretation: false
  };

  let i = 0;
  while (i < args.length) {
    if (args[i] === '--title' && i + 1 < args.length) {
      result.title = args[i + 1];
      i += 2;
    } else if (args[i] === '--default' && i + 1 < args.length) {
      result.default = args[i + 1].toLowerCase();
      i += 2;
    } else if (args[i] === '--enable-ai-interpretation') {
      result.enableAIInterpretation = true;
      i++;
    } else if (args[i] === '--ai-context' && i + 1 < args.length) {
      result.aiContext = args[i + 1];
      i++;
    } else if (i === 0) {
      result.message = args[i];
      i++;
    } else {
      i++;
    }
  }

  return result;
}

function outputInteractionXML(args: ConfirmArgs) {
  let xml = `<interaction type="confirm">\n`;

  if (args.title) {
    xml += `  <title>${escapeXML(args.title)}</title>\n`;
  }

  xml += `  <message>${escapeXML(args.message)}</message>\n`;

  if (args.enableAIInterpretation) {
    xml += `  <enable-ai-interpretation>true</enable-ai-interpretation>\n`;
  }

  if (args.aiContext) {
    xml += `  <ai-context>${escapeXML(args.aiContext)}</ai-context>\n`;
  }

  xml += `</interaction>`;

  console.log(xml);
}

function handleNonInteractiveMode(mode: string, defaultChoice: string) {
  const answer = mode === 'auto-approve' ? 'yes' :
                 mode === 'auto-deny' ? 'no' :
                 defaultChoice;

  console.log(`<interaction-response>\n  <value>${answer}</value>\n</interaction-response>`);
  process.exit(0);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Check for non-interactive mode
  const interactiveMode = process.env.USER_INTERACTION_MODE || 'xml';

  if (interactiveMode === 'auto-approve' || interactiveMode === 'auto-deny' || interactiveMode === 'default') {
    handleNonInteractiveMode(interactiveMode, args.default || 'no');
    return;
  }

  // Output XML interaction marker
  outputInteractionXML(args);

  // Exit successfully - XML presence indicates interaction needed
  process.exit(0);
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
