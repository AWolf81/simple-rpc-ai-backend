#!/usr/bin/env node
/**
 * Selection Dialog Script
 *
 * Multiple choice selection menu
 */

import readline from 'readline';

interface SelectResult {
  selected: string[];
  indices: number[];
}

async function main() {
  const args = process.argv.slice(2);

  let prompt = 'Select an option:';
  let choicesJson = '[]';
  let multi = false;

  // Parse arguments
  let i = 0;
  while (i < args.length) {
    if (args[i] === '--multi') {
      multi = true;
      i++;
    } else if (i === 0) {
      prompt = args[i];
      i++;
    } else if (i === 1) {
      choicesJson = args[i];
      i++;
    } else {
      i++;
    }
  }

  // Parse choices
  let choices: string[];
  try {
    choices = JSON.parse(choicesJson);
    if (!Array.isArray(choices) || choices.length === 0) {
      throw new Error('Choices must be a non-empty array');
    }
  } catch (error) {
    console.error('Invalid choices format. Expected JSON array like ["Option 1", "Option 2"]');
    process.exit(1);
  }

  // Check for non-interactive mode
  const interactiveMode = process.env.USER_INTERACTION_MODE || 'interactive';
  if (interactiveMode !== 'interactive') {
    handleNonInteractiveMode(choices);
    return;
  }

  // Display menu
  console.log(`\n? ${prompt}\n`);
  choices.forEach((choice, index) => {
    console.log(`  ${index + 1}. ${choice}`);
  });
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  if (multi) {
    // Multiple selection
    const answer = await new Promise<string>((resolve) => {
      rl.question('Select options (comma-separated, e.g., 1,3,4): ', resolve);
    });

    rl.close();

    const selections = answer
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n >= 1 && n <= choices.length);

    if (selections.length === 0) {
      console.error('No valid selections made');
      process.exit(1);
    }

    const result: SelectResult = {
      selected: selections.map(i => choices[i - 1]),
      indices: selections.map(i => i - 1)
    };

    console.log(JSON.stringify(result, null, 2));
  } else {
    // Single selection
    const answer = await new Promise<string>((resolve) => {
      rl.question(`Your choice [1-${choices.length}]: `, resolve);
    });

    rl.close();

    const selection = parseInt(answer.trim(), 10);

    if (isNaN(selection) || selection < 1 || selection > choices.length) {
      console.error('Invalid selection');
      process.exit(1);
    }

    const result: SelectResult = {
      selected: [choices[selection - 1]],
      indices: [selection - 1]
    };

    console.log(JSON.stringify(result, null, 2));
  }
}

function handleNonInteractiveMode(choices: string[]) {
  // Default to first choice in non-interactive mode
  const result: SelectResult = {
    selected: [choices[0]],
    indices: [0]
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
