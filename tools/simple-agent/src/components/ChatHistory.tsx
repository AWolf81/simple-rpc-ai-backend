/**
 * Chat History Component - Displays conversation messages
 */

import React from 'react';
import { Box, Text } from 'ink';
import stripAnsi from 'strip-ansi';

export default function ChatHistory({ messages }) {
  if (messages.length === 0) {
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
        <MessageItem key={index} message={message} />
      ))}
    </Box>
  );
}

function MessageItem({ message }) {
  const { role, content, usage } = message;

  // User message
  if (role === 'user') {
    return (
      <Box marginY={1}>
        <Box marginRight={1}>
          <Text bold color="green">You:</Text>
        </Box>
        <Box flexDirection="column">
          <Text>{content}</Text>
        </Box>
      </Box>
    );
  }

  // Assistant message
  if (role === 'assistant') {
    return (
      <Box marginY={1} flexDirection="column">
        <Box>
          <Box marginRight={1}>
            <Text bold color="cyan">Agent:</Text>
          </Box>
        </Box>
        <Box flexDirection="column" paddingLeft={2}>
          <Text>{content}</Text>
          {usage && (
            <Box marginTop={1}>
              <Text dimColor>
                (Tokens: {usage.totalTokens} • Prompt: {usage.promptTokens} • Completion: {usage.completionTokens})
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
        <Text color="yellow">ℹ️  {content}</Text>
      </Box>
    );
  }

  // Error message
  if (role === 'error') {
    return (
      <Box marginY={1}>
        <Text color="red">❌ Error: {content}</Text>
      </Box>
    );
  }

  return null;
}
