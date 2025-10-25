/**
 * Chat History Component - Displays conversation messages
 */

import React from 'react';
import { Box, Text } from 'ink';
import stripAnsi from 'strip-ansi';

import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import { UserInteractionDialog, InteractionType } from './UserInteractionDialog.js';

// Configure marked to use terminal renderer
marked.setOptions({
  renderer: new TerminalRenderer()
});

// Helper to render markdown to terminal format
function renderMarkdown(text: string): string {
  try {
    return marked(text);
  } catch (error) {
    // Fallback to plain text if markdown rendering fails
    return text;
  }
}

type Role = 'user' | 'assistant' | 'system' | 'error' | 'interaction';

type Usage = {
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
};

type ToolCall = {
  name: string;
  arguments: any;
  result: any;
};

type InteractionData = {
  type: InteractionType;
  title: string;
  message: string;
  options?: string[];
  defaultValue?: string;
  multiSelect?: boolean;
  enableAIInterpretation?: boolean;
  aiContext?: string;
};

export type Message = {
  role: Role;
  content: string;
  usage?: Usage;
  toolCalls?: ToolCall[];
  interaction?: InteractionData;
};

interface ChatHistoryProps {
  messages: Message[];
  onInteractionResponse?: (response: string | string[]) => void;
  onInteractionCancel?: () => void;
}

export default function ChatHistory({ messages, onInteractionResponse, onInteractionCancel }: ChatHistoryProps) {
  if (!messages || messages.length === 0) {
    return (
      <Box>
        <Text dimColor>
          💡 Start chatting with the agent or use slash commands like /help
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {messages.map((message, index) => (
        <MessageItem
          key={index}
          message={message}
          onInteractionResponse={onInteractionResponse}
          onInteractionCancel={onInteractionCancel}
        />
      ))}
    </Box>
  );
}

interface MessageItemProps {
  message: Message;
  onInteractionResponse?: (response: string | string[]) => void;
  onInteractionCancel?: () => void;
}

function MessageItem({ message, onInteractionResponse, onInteractionCancel }: MessageItemProps) {
  const { role, content, usage, interaction } = message;
  const rawContent = content || '';

  // Render markdown for assistant messages, strip ANSI for others
  const renderedContent = role === 'assistant'
    ? renderMarkdown(rawContent)
    : stripAnsi(rawContent);

  // User message
  if (role === 'user') {
    return (
      <Box marginY={1} flexDirection="column">
        <Box>
          <Box marginRight={1}>
            <Text bold color="green">You:</Text>
          </Box>
        </Box>
        <Box paddingLeft={2}>
          <Text>{renderedContent}</Text>
        </Box>
      </Box>
    );
  }

  // Assistant message - with markdown rendering
  if (role === 'assistant') {
    return (
      <Box marginY={1} flexDirection="column">
        <Box>
          <Box marginRight={1}>
            <Text bold color="cyan">Agent:</Text>
          </Box>
        </Box>
        <Box flexDirection="column" paddingLeft={2}>
          {/* Tool Executions */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              {message.toolCalls.map((toolCall, idx) => (
                <ToolExecutionBlock key={idx} toolCall={toolCall} />
              ))}
            </Box>
          )}

          {/* AI Response */}
          <Text>{renderedContent}</Text>

          {usage && (
            <Box marginTop={1}>
              <Text dimColor>
                (Tokens: {usage.totalTokens ?? '-'} • Prompt: {usage.promptTokens ?? '-'} • Completion: {usage.completionTokens ?? '-'})
              </Text>
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  // System message
  if (role === 'system') {
    return (
      <Box marginY={1}>
        <Text color="yellow">ℹ️  {renderedContent}</Text>
      </Box>
    );
  }

  // Error message
  if (role === 'error') {
    return (
      <Box marginY={1}>
        <Text color="red">❌ Error: {renderedContent}</Text>
      </Box>
    );
  }

  // Interactive message - renders interactive dialog
  if (role === 'interaction' && interaction) {
    return (
      <Box marginY={1}>
        <UserInteractionDialog
          {...interaction}
          onSubmit={(response) => {
            if (onInteractionResponse) {
              onInteractionResponse(response);
            }
          }}
          onCancel={onInteractionCancel}
        />
      </Box>
    );
  }

  return null;
}

/**
 * Tool Execution Block - Shows raw tool output
 */
function ToolExecutionBlock({ toolCall }: { toolCall: ToolCall }) {
  const { name, arguments: args, result } = toolCall;

  // Format the tool result
  let output = '';
  let exitCode: number | undefined;
  let duration: number | undefined;

  if (result && typeof result === 'object') {
    // Extract structured result (from skill execution)
    exitCode = result.exitCode;
    duration = result.duration;
    output = result.stdout || result.error || JSON.stringify(result, null, 2);
  } else {
    output = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  }

  // Limit output to 4 lines max with ellipsis
  const lines = output.split('\n');
  // Filter out trailing empty line from split (if output ends with \n)
  const nonEmptyLines = lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines;
  const displayOutput = nonEmptyLines.length > 4
    ? nonEmptyLines.slice(0, 4).join('\n') + '\n... (' + (nonEmptyLines.length - 4) + ' more lines)'
    : output;

  const isSuccess = exitCode === undefined || exitCode === 0;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isSuccess ? "gray" : "red"}
      paddingX={1}
      marginBottom={1}
    >
      {/* Tool Header */}
      <Box>
        <Text bold color="magenta">🔧 Tool:</Text>
        <Text color="magenta"> {name}</Text>
        {exitCode !== undefined && (
          <Text dimColor> (exit: {exitCode})</Text>
        )}
        {duration !== undefined && (
          <Text dimColor> ({duration}ms)</Text>
        )}
      </Box>

      {/* Tool Arguments (if any) */}
      {args && Object.keys(args).length > 0 && (
        <Box marginTop={0}>
          <Text dimColor>Args: {JSON.stringify(args)}</Text>
        </Box>
      )}

      {/* Tool Output */}
      <Box flexDirection="column" marginTop={0}>
        <Text dimColor>Output:</Text>
        <Box paddingLeft={1}>
          <Text color={isSuccess ? "white" : "red"}>{displayOutput.trim()}</Text>
        </Box>
      </Box>
    </Box>
  );
}
