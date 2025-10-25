#!/usr/bin/env node
/**
 * Selection Dialog Script
 *
 * Multiple choice selection menu - outputs XML for UI rendering
 */

interface SelectArgs {
  message: string;
  title?: string;
  options: string[];
  multiSelect?: boolean;
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseArgs(args: string[]): SelectArgs {
  const result: SelectArgs = {
    message: 'Select an option:',
    options: [],
    multiSelect: false
  };

  let i = 0;
  while (i < args.length) {
    if (args[i] === '--title' && i + 1 < args.length) {
      result.title = args[i + 1];
      i += 2;
    } else if (args[i] === '--multi' || args[i] === '--multi-select') {
      result.multiSelect = true;
      i++;
    } else if (i === 0) {
      result.message = args[i];
      i++;
    } else if (i === 1) {
      // Parse options JSON
      try {
        const parsed = JSON.parse(args[i]);
        if (Array.isArray(parsed)) {
          result.options = parsed;
        }
      } catch (error) {
        console.error('Invalid options format. Expected JSON array like ["Option 1", "Option 2"]');
        process.exit(1);
      }
      i++;
    } else {
      i++;
    }
  }

  if (result.options.length === 0) {
    console.error('No options provided');
    process.exit(1);
  }

  return result;
}

function outputInteractionXML(args: SelectArgs) {
  let xml = `<interaction type="select">\n`;

  if (args.title) {
    xml += `  <title>${escapeXML(args.title)}</title>\n`;
  }

  xml += `  <message>${escapeXML(args.message)}</message>\n`;

  xml += `  <options>\n`;
  for (const option of args.options) {
    xml += `    <option>${escapeXML(option)}</option>\n`;
  }
  xml += `  </options>\n`;

  if (args.multiSelect) {
    xml += `  <multi-select>true</multi-select>\n`;
  }

  xml += `</interaction>`;

  console.log(xml);
}

function handleNonInteractiveMode(options: string[], multiSelect: boolean) {
  // Default to first choice in non-interactive mode
  if (multiSelect) {
    console.log(`<interaction-response>\n  <values>\n    <value>${escapeXML(options[0])}</value>\n  </values>\n</interaction-response>`);
  } else {
    console.log(`<interaction-response>\n  <value>${escapeXML(options[0])}</value>\n</interaction-response>`);
  }
  process.exit(0);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Check for non-interactive mode
  const interactiveMode = process.env.USER_INTERACTION_MODE || 'xml';

  if (interactiveMode === 'auto-approve' || interactiveMode === 'auto-deny' || interactiveMode === 'default') {
    handleNonInteractiveMode(args.options, args.multiSelect || false);
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
