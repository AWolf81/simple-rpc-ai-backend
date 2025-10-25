#!/usr/bin/env node
/**
 * Approval Dialog Script
 *
 * Shows an approval dialog with customizable options
 * Returns JSON with approval decision and optional custom reason
 */

import readline from 'readline';

interface ApprovalResult {
  approved: boolean;
  choice: string;
  customReason?: string;
  rememberChoice: boolean;
}

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let title = 'Approval Required';
  let message = 'Do you approve this operation?';
  let optionsJson = '["Yes", "No"]';
  let allowCustom = false;

  // Parse positional args and flags
  let i = 0;
  while (i < args.length) {
    if (args[i] === '--allow-custom') {
      allowCustom = true;
      i++;
    } else if (i === 0) {
      title = args[i];
      i++;
    } else if (i === 1) {
      message = args[i];
      i++;
    } else if (i === 2) {
      optionsJson = args[i];
      i++;
    } else {
      i++;
    }
  }

  // Check for non-interactive mode
  const interactiveMode = process.env.USER_INTERACTION_MODE || 'interactive';
  if (interactiveMode !== 'interactive') {
    handleNonInteractiveMode(interactiveMode);
    return;
  }

  // Parse options
  let options: string[];
  try {
    options = JSON.parse(optionsJson);
    if (!Array.isArray(options) || options.length === 0) {
      throw new Error('Options must be a non-empty array');
    }
  } catch (error) {
    console.error('Invalid options format. Expected JSON array like ["Yes", "No"]');
    process.exit(1);
  }

  // Display dialog
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log(`║  ${title.padEnd(57)}║`);
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  console.log(message);
  console.log('\n─────────────────────────────────────────────────────────────\n');

  // Show options
  console.log('Options:');
  options.forEach((option, index) => {
    console.log(`  ${index + 1}. ${option}`);
  });

  if (allowCustom) {
    console.log(`  ${options.length + 1}. Other (provide custom reason)`);
  }

  console.log('\n─────────────────────────────────────────────────────────────\n');

  // Get user choice
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const choice = await new Promise<number>((resolve) => {
    const maxChoice = allowCustom ? options.length + 1 : options.length;
    rl.question(`Your choice [1-${maxChoice}]: `, (answer) => {
      const num = parseInt(answer, 10);
      if (isNaN(num) || num < 1 || num > maxChoice) {
        console.log('Invalid choice. Defaulting to No.');
        resolve(options.findIndex(o => o.toLowerCase().includes('no')) + 1 || 2);
      } else {
        resolve(num);
      }
    });
  });

  const result: ApprovalResult = {
    approved: false,
    choice: '',
    rememberChoice: false
  };

  // Handle "Other" option
  if (allowCustom && choice === options.length + 1) {
    const reason = await new Promise<string>((resolve) => {
      rl.question('Please provide a reason: ', resolve);
    });

    result.approved = false;
    result.choice = 'Other';
    result.customReason = reason;
    result.rememberChoice = false;

    rl.close();
    console.log('\n✓ Response recorded\n');
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  rl.close();

  // Process choice
  const selectedOption = options[choice - 1];
  result.choice = selectedOption;

  // Determine approval based on option text
  const isApproved =
    selectedOption.toLowerCase().includes('yes') ||
    selectedOption.toLowerCase().includes('approve') ||
    selectedOption.toLowerCase().includes('allow') ||
    selectedOption.toLowerCase().includes('proceed');

  result.approved = isApproved;

  // Check if "always ask" variant
  const alwaysAsk =
    selectedOption.toLowerCase().includes('always ask') ||
    selectedOption.toLowerCase().includes('but ask') ||
    selectedOption.toLowerCase().includes('keep asking');

  result.rememberChoice = isApproved && !alwaysAsk;

  console.log('\n✓ Response recorded\n');
  console.log(JSON.stringify(result, null, 2));
}

function handleNonInteractiveMode(mode: string) {
  const result: ApprovalResult = {
    approved: false,
    choice: 'auto',
    rememberChoice: false
  };

  switch (mode) {
    case 'auto-approve':
      result.approved = true;
      result.choice = 'auto-approved';
      break;
    case 'auto-deny':
      result.approved = false;
      result.choice = 'auto-denied';
      break;
    case 'default':
      result.approved = false;
      result.choice = 'default (no)';
      break;
    default:
      result.approved = false;
      result.choice = 'unknown mode (denied)';
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
