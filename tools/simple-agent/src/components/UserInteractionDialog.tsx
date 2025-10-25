/**
 * User Interaction Dialog Component
 *
 * Provides interactive dialogs for the user-interaction skill:
 * - Select: Arrow key navigation for choosing from options
 * - Input: Free-form text input with AI interpretation
 * - Confirm: Yes/No confirmation with optional AI interpretation
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

export type InteractionType = 'select' | 'input' | 'confirm' | 'approval';

export interface UserInteractionDialogProps {
  type: InteractionType;
  title: string;
  message: string;
  options?: string[];
  defaultValue?: string;
  multiSelect?: boolean;
  onSubmit: (response: string | string[]) => void;
  onCancel?: () => void;
  /** Enable AI interpretation of free-form responses */
  enableAIInterpretation?: boolean;
  /** Additional context for AI interpretation */
  aiContext?: string;
}

/**
 * Select Dialog - Choose from options with arrow keys
 */
export function SelectDialog({
  title,
  message,
  options = [],
  multiSelect = false,
  onSubmit,
  onCancel
}: Omit<UserInteractionDialogProps, 'type'>) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => Math.min(options.length - 1, prev + 1));
    } else if (key.return) {
      if (multiSelect) {
        const selected = Array.from(selectedItems).map(i => options[i]);
        onSubmit(selected);
      } else {
        onSubmit(options[selectedIndex]);
      }
    } else if (input === ' ' && multiSelect) {
      // Toggle selection in multi-select mode
      setSelectedItems(prev => {
        const next = new Set(prev);
        if (next.has(selectedIndex)) {
          next.delete(selectedIndex);
        } else {
          next.add(selectedIndex);
        }
        return next;
      });
    } else if (key.escape && onCancel) {
      onCancel();
    }
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} borderStyle="round" borderColor="cyan">
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">📋 {title}</Text>
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
        {options.map((option, index) => {
          const isSelected = index === selectedIndex;
          const isChecked = selectedItems.has(index);
          return (
            <Box key={index} marginLeft={1}>
              <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
                {multiSelect ? (isChecked ? '☑ ' : '☐ ') : (isSelected ? '▶ ' : '  ')}
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
          Use <Text color="cyan">↑↓</Text> to select
          {multiSelect && <>, <Text color="cyan">Space</Text> to toggle</>}
          , <Text color="cyan">Enter</Text> to confirm
          {onCancel && <>, <Text color="cyan">Esc</Text> to cancel</>}
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Input Dialog - Free-form text input with optional AI interpretation
 */
export function InputDialog({
  title,
  message,
  defaultValue = '',
  onSubmit,
  onCancel,
  enableAIInterpretation = false,
  aiContext
}: Omit<UserInteractionDialogProps, 'type' | 'options'>) {
  const [inputText, setInputText] = useState(defaultValue);
  const [mode, setMode] = useState<'input' | 'confirm'>('input');

  useInput((input, key) => {
    if (mode === 'confirm') {
      if (key.return) {
        onSubmit(inputText);
      } else if (key.escape) {
        setMode('input');
      }
      return;
    }

    // Input mode
    if (key.return) {
      if (enableAIInterpretation && inputText.trim()) {
        // Show confirmation before AI interpretation
        setMode('confirm');
      } else {
        onSubmit(inputText);
      }
    } else if (key.escape && onCancel) {
      onCancel();
    } else if (key.backspace || key.delete) {
      setInputText(prev => prev.slice(0, -1));
    } else if (input && !key.ctrl && !key.meta) {
      setInputText(prev => prev + input);
    }
  });

  if (mode === 'confirm') {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1} borderStyle="round" borderColor="yellow">
        <Box marginBottom={1}>
          <Text bold color="yellow">🤖 AI Interpretation</Text>
        </Box>
        <Box marginBottom={1}>
          <Text>Your response: <Text color="cyan">{inputText}</Text></Text>
        </Box>
        <Box marginBottom={1}>
          <Text dimColor>
            The AI will interpret your response. Examples:
            {'\n'}- "yes" or "no" → Direct answer
            {'\n'}- "do it but add X first" → Modified instruction
            {'\n'}- "not now" → Decline with context
          </Text>
        </Box>
        {aiContext && (
          <Box marginBottom={1}>
            <Text dimColor>Context: {aiContext}</Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text dimColor>
            Press <Text color="cyan">Enter</Text> to proceed, <Text color="cyan">Esc</Text> to edit
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} borderStyle="round" borderColor="green">
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="green">✏️  {title}</Text>
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

      {/* Input Field */}
      <Box marginBottom={1}>
        <Text color="green">&gt; </Text>
        <Text>{inputText}</Text>
        <Text color="green">_</Text>
      </Box>

      {enableAIInterpretation && (
        <Box marginBottom={1}>
          <Text dimColor>
            💡 AI will interpret your response - you can say things like:
            {'\n'}   "yes", "no", "do it", "don't do it", "yes but add X first"
          </Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>{'─'.repeat(60)}</Text>
      </Box>

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>
          Type your response, <Text color="cyan">Enter</Text> to submit
          {onCancel && <>, <Text color="cyan">Esc</Text> to cancel</>}
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Confirm Dialog - Yes/No with optional AI interpretation for custom responses
 */
export function ConfirmDialog({
  title,
  message,
  onSubmit,
  onCancel,
  enableAIInterpretation = false,
  aiContext
}: Omit<UserInteractionDialogProps, 'type' | 'options'>) {
  const [selectedIndex, setSelectedIndex] = useState(1); // Default to "No"
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState('');

  useInput((input, key) => {
    if (customMode) {
      // Custom text input mode
      if (key.return) {
        onSubmit(customText);
      } else if (key.escape) {
        setCustomMode(false);
        setCustomText('');
      } else if (key.backspace || key.delete) {
        setCustomText(prev => prev.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta) {
        setCustomText(prev => prev + input);
      }
      return;
    }

    // Selection mode
    if (key.upArrow || key.leftArrow) {
      setSelectedIndex(0);
    } else if (key.downArrow || key.rightArrow) {
      setSelectedIndex(1);
    } else if (key.return) {
      if (selectedIndex === 0) {
        onSubmit('yes');
      } else {
        onSubmit('no');
      }
    } else if (input === 'y' || input === 'Y') {
      onSubmit('yes');
    } else if (input === 'n' || input === 'N') {
      onSubmit('no');
    } else if (input === 'c' || input === 'C') {
      if (enableAIInterpretation) {
        setCustomMode(true);
      }
    } else if (key.escape && onCancel) {
      onCancel();
    }
  });

  if (customMode) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1} borderStyle="round" borderColor="yellow">
        <Box marginBottom={1}>
          <Text bold color="yellow">🤖 Custom Response</Text>
        </Box>
        <Box marginBottom={1}>
          <Text>{message}</Text>
        </Box>
        <Box marginBottom={1}>
          <Text dimColor>
            Enter your custom response (AI will interpret):
          </Text>
        </Box>
        <Box marginBottom={1}>
          <Text color="yellow">&gt; </Text>
          <Text>{customText}</Text>
          <Text color="yellow">_</Text>
        </Box>
        {aiContext && (
          <Box marginBottom={1}>
            <Text dimColor>Context: {aiContext}</Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text dimColor>
            Press <Text color="cyan">Enter</Text> to submit, <Text color="cyan">Esc</Text> to go back
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} borderStyle="round" borderColor="cyan">
      {/* Header */}
      {title && (
        <Box marginBottom={1}>
          <Text bold color="cyan">❓ {title}</Text>
        </Box>
      )}

      {/* Message */}
      <Box marginBottom={1}>
        <Text>{message}</Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>{'─'.repeat(60)}</Text>
      </Box>

      {/* Options */}
      <Box marginBottom={1}>
        <Box marginRight={3}>
          <Text color={selectedIndex === 0 ? 'green' : undefined} bold={selectedIndex === 0}>
            {selectedIndex === 0 ? '▶ ' : '  '}Yes (y)
          </Text>
        </Box>
        <Box marginRight={3}>
          <Text color={selectedIndex === 1 ? 'red' : undefined} bold={selectedIndex === 1}>
            {selectedIndex === 1 ? '▶ ' : '  '}No (n)
          </Text>
        </Box>
        {enableAIInterpretation && (
          <Box>
            <Text dimColor>Custom (c)</Text>
          </Box>
        )}
      </Box>

      {enableAIInterpretation && (
        <Box marginBottom={1}>
          <Text dimColor>
            💡 Press 'c' for custom response with AI interpretation
          </Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>{'─'.repeat(60)}</Text>
      </Box>

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>
          Use <Text color="cyan">↑↓</Text> or <Text color="cyan">y/n</Text>
          {enableAIInterpretation && <>, <Text color="cyan">c</Text> for custom</>}
          , <Text color="cyan">Enter</Text> to confirm
          {onCancel && <>, <Text color="cyan">Esc</Text> to cancel</>}
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Main User Interaction Dialog - Routes to appropriate sub-component
 */
export function UserInteractionDialog(props: UserInteractionDialogProps) {
  const { type } = props;

  switch (type) {
    case 'select':
    case 'approval':
      return <SelectDialog {...props} />;
    case 'input':
      return <InputDialog {...props} />;
    case 'confirm':
      return <ConfirmDialog {...props} />;
    default:
      return (
        <Box>
          <Text color="red">Unknown interaction type: {type}</Text>
        </Box>
      );
  }
}
