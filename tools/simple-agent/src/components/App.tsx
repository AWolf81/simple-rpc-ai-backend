/**
 * Main App Component - Reactive Terminal UI
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import ChatHistory from './ChatHistory.js';
import { RPCClient } from 'simple-rpc-ai-backend/client';
import { isSlashCommand, parseSlashCommand, executePlugin } from '../core/plugin-manager.js';

export default function App({ serverUrl, model, provider, server }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const { exit } = useApp();

  const client = new RPCClient(serverUrl);

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      handleExit();
    }
  });

  const handleExit = async () => {
    if (server) {
      await server.stop();
    }
    exit();
  };

  const handleSubmit = async (value) => {
    if (!value.trim()) return;

    const userMessage = value.trim();
    setInput('');

    // Add user message to history
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    // Check for slash commands
    if (isSlashCommand(userMessage)) {
      const { command, args } = parseSlashCommand(userMessage);

      // Built-in commands
      if (command === 'exit' || command === 'quit') {
        await handleExit();
        return;
      }

      if (command === 'clear') {
        setMessages([]);
        return;
      }

      if (command === 'model') {
        if (args[0]) {
          setMessages(prev => [...prev, {
            role: 'system',
            content: `Model changed to: ${args[0]}`
          }]);
        }
        return;
      }

      // Try to execute plugin command
      try {
        setIsLoading(true);
        const result = await executePlugin(command, args, {
          client,
          model,
          provider,
          messages
        });

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: result
        }]);
        setIsLoading(false);
        return;
      } catch (error) {
        setMessages(prev => [...prev, {
          role: 'error',
          content: error.message
        }]);
        setIsLoading(false);
        return;
      }
    }

    // Regular agent prompt
    setIsLoading(true);
    setStreamingText('');

    try {
      // For now, use non-streaming (TODO: implement streaming with tRPC subscriptions)
      const result = await client.request('agents.execute', {
        prompt: userMessage,
        model: model,
        sdk: 'claude-code'
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.content,
        usage: result.usage
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'error',
        content: error.message
      }]);
    }

    setIsLoading(false);
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box borderStyle="round" borderColor="cyan" paddingX={2}>
        <Text bold color="cyan">
          🤖 Simple Agent CLI
        </Text>
        <Text dimColor> ({model})</Text>
        <Text dimColor> • </Text>
        <Text dimColor>Type /exit to quit, /help for commands</Text>
      </Box>

      {/* Chat History */}
      <Box flexDirection="column" marginY={1}>
        <ChatHistory messages={messages} />
      </Box>

      {/* Loading indicator */}
      {isLoading && (
        <Box>
          <Text color="yellow">
            <Spinner type="dots" />
          </Text>
          <Text> Agent is thinking...</Text>
          {streamingText && (
            <Box marginTop={1}>
              <Text>{streamingText}</Text>
            </Box>
          )}
        </Box>
      )}

      {/* Input box */}
      <Box borderStyle="round" borderColor="gray" paddingX={1}>
        <Text bold color="green">You: </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="Enter your message..."
        />
      </Box>

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>
          Press Ctrl+C or type /exit to quit
        </Text>
      </Box>
    </Box>
  );
}
