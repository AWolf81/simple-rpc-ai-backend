/**
 * Interactive Approval Dialog Component
 *
 * Provides arrow key navigation for approval choices
 * Used by the approval system for user confirmation
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

export interface ApprovalDialogProps {
  title: string;
  message: string;
  options?: string[];
  onSelect: (choice: string, index: number) => void;
  onCancel?: () => void;
  allowCustom?: boolean;
}

const DEFAULT_OPTIONS = ['Yes', 'Yes (always ask)', 'No', 'Other'];

export function ApprovalDialog({
  title,
  message,
  options = DEFAULT_OPTIONS,
  onSelect,
  onCancel,
  allowCustom = true
}: ApprovalDialogProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showingCustomInput, setShowingCustomInput] = useState(false);
  const [customReason, setCustomReason] = useState('');

  useInput((input, key) => {
    // Handle custom reason input mode
    if (showingCustomInput) {
      if (key.return) {
        onSelect(`Other: ${customReason}`, options.length);
      } else if (key.escape) {
        setShowingCustomInput(false);
        setCustomReason('');
      } else if (key.backspace || key.delete) {
        setCustomReason(prev => prev.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta) {
        setCustomReason(prev => prev + input);
      }
      return;
    }

    // Normal navigation mode
    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => Math.min(options.length - 1, prev + 1));
    } else if (key.return) {
      const selectedOption = options[selectedIndex];

      // Check if "Other" option and custom input is allowed
      if (allowCustom && selectedOption.toLowerCase().includes('other')) {
        setShowingCustomInput(true);
      } else {
        onSelect(selectedOption, selectedIndex);
      }
    } else if (key.escape && onCancel) {
      onCancel();
    }
  });

  if (showingCustomInput) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1} borderStyle="round" borderColor="yellow">
        <Box marginBottom={1}>
          <Text bold color="yellow">📝 Provide Reason</Text>
        </Box>
        <Box marginBottom={1}>
          <Text dimColor>Why are you declining this operation?</Text>
        </Box>
        <Box>
          <Text color="cyan">&gt; </Text>
          <Text>{customReason}</Text>
          <Text color="cyan">_</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press Enter to submit, Esc to cancel</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} borderStyle="double" borderColor="yellow">
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="yellow">⚠️  {title}</Text>
      </Box>

      {/* Message */}
      <Box marginBottom={1} flexDirection="column">
        {message.split('\n').map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>{'─'.repeat(60)}</Text>
      </Box>

      {/* Options */}
      <Box flexDirection="column" marginBottom={1}>
        <Box marginBottom={1}>
          <Text bold>Options:</Text>
        </Box>
        {options.map((option, index) => {
          const isSelected = index === selectedIndex;
          return (
            <Box key={index} marginLeft={1}>
              <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
                {isSelected ? '▶ ' : '  '}
                {index + 1}. {option}
              </Text>
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>{'─'.repeat(60)}</Text>
      </Box>

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>
          Use <Text color="cyan">↑↓</Text> to select, <Text color="cyan">Enter</Text> to confirm
          {onCancel && <>, <Text color="cyan">Esc</Text> to cancel</>}
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Simple confirmation dialog (Yes/No)
 */
export interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onDecline: () => void;
  defaultChoice?: 'yes' | 'no';
}

export function ConfirmDialog({
  message,
  onConfirm,
  onDecline,
  defaultChoice = 'no'
}: ConfirmDialogProps) {
  const [selectedIndex, setSelectedIndex] = useState(defaultChoice === 'yes' ? 0 : 1);

  useInput((input, key) => {
    if (key.upArrow || key.leftArrow) {
      setSelectedIndex(0);
    } else if (key.downArrow || key.rightArrow) {
      setSelectedIndex(1);
    } else if (key.return) {
      if (selectedIndex === 0) {
        onConfirm();
      } else {
        onDecline();
      }
    } else if (input === 'y' || input === 'Y') {
      onConfirm();
    } else if (input === 'n' || input === 'N') {
      onDecline();
    }
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} borderStyle="round" borderColor="cyan">
      <Box marginBottom={1}>
        <Text>? {message}</Text>
      </Box>
      <Box>
        <Box marginRight={2}>
          <Text color={selectedIndex === 0 ? 'green' : undefined} bold={selectedIndex === 0}>
            {selectedIndex === 0 ? '▶ ' : '  '}Yes
          </Text>
        </Box>
        <Box>
          <Text color={selectedIndex === 1 ? 'red' : undefined} bold={selectedIndex === 1}>
            {selectedIndex === 1 ? '▶ ' : '  '}No
          </Text>
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          Use <Text color="cyan">↑↓</Text> or <Text color="cyan">y/n</Text>, <Text color="cyan">Enter</Text> to confirm
        </Text>
      </Box>
    </Box>
  );
}
