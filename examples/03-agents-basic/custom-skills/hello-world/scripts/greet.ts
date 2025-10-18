#!/usr/bin/env tsx

/**
 * Greet Script - Generate personalized greetings
 * Usage: tsx greet.ts <name> [--formal]
 */

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Error: Name required');
    console.error('Usage: tsx greet.ts <name> [--formal]');
    process.exit(1);
  }

  const name = args[0];
  const formal = args.includes('--formal');

  if (formal) {
    console.log(`Good day, ${name}. How may I assist you?`);
  } else {
    console.log(`Hello, ${name}!`);
  }

  process.exit(0);
}

main();
