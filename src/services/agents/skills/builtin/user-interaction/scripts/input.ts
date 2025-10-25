#!/usr/bin/env node
/**
 * Input Dialog Script
 *
 * Prompt user for text input
 */

import readline from 'readline';

interface InputResult {
  value: string;
  provided: boolean;
}

async function main() {
  const args = process.argv.slice(2);

  let prompt = 'Enter value:';
  let defaultValue = '';
  let multiline = false;

  // Parse arguments
  let i = 0;
  while (i < args.length) {
    if (args[i] === '--default' && i + 1 < args.length) {
      defaultValue = args[i + 1];
      i += 2;
    } else if (args[i] === '--multiline') {
      multiline = true;
      i++;
    } else if (i === 0) {
      prompt = args[i];
      i++;
    } else {
      i++;
    }
  }

  // Check for non-interactive mode
  const interactiveMode = process.env.USER_INTERACTION_MODE || 'interactive';
  if (interactiveMode !== 'interactive') {
    handleNonInteractiveMode(defaultValue);
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  if (multiline) {
    console.log(`${prompt}`);
    console.log('(Press Ctrl+D when done, or enter an empty line)\n');

    const lines: string[] = [];

    rl.on('line', (line) => {
      if (line.trim() === '' && lines.length > 0) {
        rl.close();
      } else {
        lines.push(line);
      }
    });

    await new Promise<void>((resolve) => {
      rl.on('close', resolve);
    });

    const value = lines.join('\n').trim() || defaultValue;
    const result: InputResult = {
      value,
      provided: value.length > 0
    };

    console.log(JSON.stringify(result, null, 2));
  } else {
    const defaultHint = defaultValue ? ` [${defaultValue}]` : '';
    const answer = await new Promise<string>((resolve) => {
      rl.question(`> ${prompt}${defaultHint} `, resolve);
    });

    rl.close();

    const value = answer.trim() || defaultValue;
    const result: InputResult = {
      value,
      provided: value.length > 0
    };

    console.log(JSON.stringify(result, null, 2));
  }
}

function handleNonInteractiveMode(defaultValue: string) {
  const result: InputResult = {
    value: defaultValue,
    provided: defaultValue.length > 0
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
