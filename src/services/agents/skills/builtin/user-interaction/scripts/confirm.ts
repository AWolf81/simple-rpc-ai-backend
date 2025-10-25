#!/usr/bin/env node
/**
 * Confirmation Dialog Script
 *
 * Simple yes/no confirmation
 */

import readline from 'readline';

interface ConfirmResult {
  confirmed: boolean;
  answer: string;
}

async function main() {
  const args = process.argv.slice(2);

  let message = 'Continue?';
  let defaultChoice = 'no';

  // Parse arguments
  let i = 0;
  while (i < args.length) {
    if (args[i] === '--default' && i + 1 < args.length) {
      defaultChoice = args[i + 1].toLowerCase();
      i += 2;
    } else if (i === 0) {
      message = args[i];
      i++;
    } else {
      i++;
    }
  }

  // Check for non-interactive mode
  const interactiveMode = process.env.USER_INTERACTION_MODE || 'interactive';
  if (interactiveMode !== 'interactive') {
    handleNonInteractiveMode(interactiveMode, defaultChoice);
    return;
  }

  // Show prompt
  const defaultHint = defaultChoice === 'yes' ? '(Y/n)' : '(y/N)';
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question(`? ${message} ${defaultHint} `, (input) => {
      resolve(input.trim().toLowerCase() || defaultChoice);
    });
  });

  rl.close();

  const confirmed = answer === 'y' || answer === 'yes';

  const result: ConfirmResult = {
    confirmed,
    answer: confirmed ? 'yes' : 'no'
  };

  console.log(JSON.stringify(result, null, 2));
}

function handleNonInteractiveMode(mode: string, defaultChoice: string) {
  const result: ConfirmResult = {
    confirmed: false,
    answer: 'no'
  };

  switch (mode) {
    case 'auto-approve':
      result.confirmed = true;
      result.answer = 'yes';
      break;
    case 'auto-deny':
      result.confirmed = false;
      result.answer = 'no';
      break;
    case 'default':
      result.confirmed = defaultChoice === 'yes';
      result.answer = defaultChoice;
      break;
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
