/**
 * Main App Component - Reactive Terminal UI
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import ChatHistory from './ChatHistory.js';
import { createTypedAIClient } from 'simple-rpc-ai-backend/client';
import { httpLink } from '@trpc/client';
import superjson from 'superjson';
import { isSlashCommand, parseSlashCommand, executePlugin } from '../core/plugin-manager.js';
import { FileProxy } from '../core/file-proxy.js';
import { getHistoryManager } from '../core/history-manager.js';
import { getLogHistory, subscribeToLogs, clearLogHistory } from '../../../../dist/utils/logger.js';

// @TODO can we use types from simple-rpc-ai-backend?
type Message = {
  role: 'user' | 'assistant' | 'system' | 'error';
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  toolCalls?: Array<{
    name: string;
    arguments: any;
    result: any;
  }>;
}

type Skill = {
  name: string;
  description: string;
  capabilities: string[];
  sourceType: string;
};

interface AppProps {
  serverUrl: string;
  model: string;
  provider?: string;
  // server exposes an optional stop() method used on exit; keep it optional to match usage
  server?: { stop?: () => Promise<void> } | null;
  // File proxy options (only for remote servers)
  enableFileProxy?: boolean;
  workspaceDir?: string;
  verbose?: boolean;
}

export default function App({ serverUrl, model, provider, server, enableFileProxy, workspaceDir, verbose }: AppProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [toolProgress, setToolProgress] = useState<string[]>([]);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [debugMode, setDebugMode] = useState(false);
  const [debugLines, setDebugLines] = useState<string[]>(() => getLogHistory());
  const { stdout } = useStdout();
  const { exit } = useApp();
  const toolProgressRef = useRef<string[]>([]);

  // Conversation tracking for interactions
  const [pendingConversation, setPendingConversation] = useState<{
    conversationId: string;
    interaction: any;
  } | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    toolProgressRef.current = toolProgress;
  }, [toolProgress]);

  // Create tRPC client with superjson transformer (must match server)
  const trpcUrl = serverUrl.includes('trpc') ? serverUrl : `${serverUrl}/trpc`;
  const client = createTypedAIClient({
    links: [
      httpLink({
        url: trpcUrl,
        transformer: superjson // Transformer goes in the link
      })
    ]
  }) as any; // Use 'as any' since agents router is dynamically created
  const historyManager = getHistoryManager();

  const appendDebugLine = useCallback((line: string) => {
    setDebugLines(prev => {
      const next = [...prev, line];
      return next.length > 200 ? next.slice(-200) : next;
    });

    if (isLoading && line.includes('[progress]')) {
      const message = line.split('[progress]')[1]?.trim();
      if (message) {
        setToolProgress(prev => {
          const last = prev[prev.length - 1];
          if (last === message) {
            return prev;
          }
          return [...prev, message];
        });
      }
    }
  }, [isLoading, setToolProgress]);

  const clearLogFile = useCallback(() => {
    clearLogHistory();
    setDebugLines([]);
  }, []);

  // Load persistent history on mount
  useEffect(() => {
    const persistedHistory = historyManager.getAll();
    setHistory(persistedHistory);
  }, []);

  useEffect(() => {
    if (enableFileProxy) {
      setDebugLines([]);
      return;
    }

    setDebugLines(getLogHistory());
    const unsubscribe = subscribeToLogs(appendDebugLine);
    return () => unsubscribe();
  }, [enableFileProxy, appendDebugLine]);

  // Initialize file proxy for remote servers
  useEffect(() => {
    let fileProxy: FileProxy | null = null;

    const initFileProxy = async () => {
      if (enableFileProxy && workspaceDir) {
        try {
          fileProxy = new FileProxy({
            client,
            workspaceDir,
            verbose: verbose || false
          });

          await fileProxy.initialize();

          if (verbose) {
            const info = fileProxy.getWorkspaceInfo();
            setMessages(prev => [...prev, {
              role: 'system',
              content: `📁 File proxy enabled for remote server\n   Workspace: ${info.path}\n   ID: ${info.id}`
            }]);
          }
        } catch (error) {
          console.error('Failed to initialize file proxy:', error);
        }
      }
    };

    initFileProxy();

    // Cleanup on unmount
    return () => {
      if (fileProxy) {
        fileProxy.cleanup();
      }
    };
  }, [enableFileProxy, workspaceDir, verbose]);


  // Fetch available skills on mount (with retry for server startup)
  useEffect(() => {
    const loadSkills = async () => {
      const maxAttempts = 3;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const response = await client.agents.skills.list.query();
          const skills = response?.skills || [];

          if (skills && skills.length > 0) {
            setAvailableSkills(skills);
            setMessages([{
              role: 'system',
              content: `✅ Loaded ${skills.length} skill(s): ${skills.map(s => s.name).join(', ')}`
            }]);
            return; // Success!
          }

          // Empty skills array - server might still be initializing
          if (attempt < maxAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          } else {
            setMessages([{
              role: 'system',
              content: `⚠️ No skills loaded after ${maxAttempts} attempts`
            }]);
          }
        } catch (error) {
          // Log detailed error info for debugging
          console.error('Skills loading error:', error);
          if (error instanceof Error) {
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
          }
          console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));

          if (attempt < maxAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          } else {
            const message = error instanceof Error ? error.message : 'Unknown error';
            const fullError = error instanceof Error ?
              `${message}\n\nStack: ${error.stack?.split('\n').slice(0, 3).join('\n')}` :
              JSON.stringify(error);

            setMessages([{
              role: 'system',
              content: `⚠️ Skills system error: ${fullError}`
            }]);
          }
        }
      }
    };
    loadSkills();
  }, []);

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      handleExit();
    }

    // Handle up/down arrow keys for history navigation
    if (key.upArrow && history.length > 0) {
      const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setInput(history[newIndex]);
    }

    if (key.downArrow && historyIndex !== -1) {
      const newIndex = historyIndex + 1;
      if (newIndex >= history.length) {
        setHistoryIndex(-1);
        setInput('');
      } else {
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
    }
  });

  const handleExit = () => {
    // Clear log file and exit Ink
    // Note: Server cleanup is handled by CLI after waitUntilExit()
    clearLogFile();
    exit();
  };

  const handleSubmit = async (value: string) => {
    if (!value.trim()) return;

    const userMessage = value.trim();
    setInput('');
    const priorConversation = messages
      .filter(message => message.role === 'user' || message.role === 'assistant')
      .map(message => ({
        role: message.role,
        content: message.content
      }));

    // Add to command history (in-memory and persistent)
    historyManager.add(userMessage);
    setHistory(prev => [...prev, userMessage]);
    setHistoryIndex(-1);

    // Add user message to history
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setToolProgress([]);
    toolProgressRef.current = [];

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

      if (command === 'resume') {
        setMessages(prev => [...prev, {
          role: 'system',
          content: '💡 /resume - Full session resumption coming soon!\n\nCurrently available:\n- Up/Down arrows: Navigate recent prompts (last 50)\n- History persists across CLI restarts\n\nPlanned features:\n- Resume full conversation context\n- Session management and switching\n- Export/import sessions'
        }]);
        return;
      }

      if (command === 'debug') {
        if (enableFileProxy) {
          setMessages(prev => [...prev, {
            role: 'system',
            content: '⚠️ Debug view is only available when running against a local server.'
          }]);
          return;
        }

        const enable = !debugMode;

        setDebugMode(enable);
        setMessages(prev => [...prev, {
          role: 'system',
          content: enable ? '🛠️ Debug panel enabled' : '🛠️ Debug panel disabled'
        }]);

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
        const message = error instanceof Error ? error.message : 'Unknown error';
        setMessages(prev => [...prev, {
          role: 'error',
          content: message
        }]);
        setIsLoading(false);
        return;
      }
    }

    // Regular agent prompt
    setIsLoading(true);
    setStreamingText('');

    try {
      // Build system prompt with available skills
      let systemPrompt = 'You are a helpful AI assistant with a skills system.\n\n';

      if (availableSkills.length > 0) {
        systemPrompt += '## Your Available Skills\n\n';
        systemPrompt += 'IMPORTANT: When the user asks "what skills do you have" or "list available skills", you must ONLY list these specific skills loaded in your system:\n\n';
        systemPrompt += availableSkills.map(skill => {
          const capabilities = Array.isArray(skill.capabilities) && skill.capabilities.length > 0
            ? skill.capabilities.join(', ')
            : 'none listed';
          return `- **${skill.name}**: ${skill.description}\n  Capabilities: ${capabilities}\n  Source: ${skill.sourceType}`;
        }).join('\n\n');
        systemPrompt += '\n\n**DO NOT** list generic AI capabilities. ONLY list the skills shown above.\n\n';

        // Add file operation permissions
        systemPrompt += '## File Operation Guidelines\n\n';
        systemPrompt += '**READ Operations** - Execute immediately without asking:\n';
        systemPrompt += '- List files/directories\n';
        systemPrompt += '- Read file contents\n';
        systemPrompt += '- Search for files\n';
        systemPrompt += '- Check if paths exist\n';
        systemPrompt += '- Get file information\n\n';
        systemPrompt += '**WRITE Operations** - Always ask for permission first:\n';
        systemPrompt += '- Create, update, or delete files\n';
        systemPrompt += '- Rename files or directories\n';
        systemPrompt += '- Copy or move files\n\n';
        systemPrompt += 'When the user asks to read, list, search, or check files, just do it directly. Only ask permission for write operations.\n\n';

        // Add skill usage instructions
        systemPrompt += '## Skill Execution\n\n';
        systemPrompt += 'You have access to executable skill scripts! When users request skill-related actions, you can execute them directly using available tools.\n\n';
        systemPrompt += 'When a user asks to execute a skill script (e.g., "Execute the greet script with name Charlie"), use the corresponding tool.\n';
        systemPrompt += 'Tool names follow the pattern: skillId_scriptName (e.g., hello-world_greet for hello-world skill\'s greet script).\n';
        systemPrompt += 'When you need to run a tool, state that you will invoke the specific tool identifier (e.g., "Executing hello-world_greet now") and call it without offering numeric options.\n';
        systemPrompt += 'When offering choices, avoid numbered menus—always reference the exact tool identifier (e.g., "Use hello-world_greet now").\n\n';
        systemPrompt += 'Available commands: `/list`, `/skills`, `/help`';

        systemPrompt += '\n\n### Tool Selection Rules\n';
        systemPrompt += '- Only call `hello_world_greet` when the user explicitly requests a greeting.\n';
        systemPrompt += '- When the user mentions a file (e.g., "Validate tsconfig.json"), first locate the file using `file_handling_search_files` to obtain the absolute path, then pass that path to the appropriate validation or read tool (such as `hello_world_validate-json`).\n';
        systemPrompt += '- Prefer using the most relevant skill/tool for the task instead of repeating previous tool calls.\n';
      } else {
        systemPrompt += 'Note: No skills are currently loaded in the system.';
      }

      // Use tRPC to execute agent
      // Skills are auto-loaded from SkillManager, so we don't need to pass them explicitly
      const result = await client.agents.execute.mutate({
        prompt: userMessage,
        systemPrompt: systemPrompt,
        provider: provider,
        model: model,
        messages: priorConversation,
        conversationId: conversationId || undefined  // Pass conversation ID if exists
        // Note: skills are auto-loaded from SkillManager on the server
      });

      // Check for interaction requirement
      if ((result as any).type === 'interaction_required') {
        logger.info(`🔔 Interaction required - showing dialog`);

        // Store conversation ID
        setConversationId((result as any).conversationId);

        // Add interaction message to UI
        setMessages(prev => [...prev, {
          role: 'interaction',
          content: '',
          interaction: (result as any).interaction
        } as any]);

        // Store pending conversation
        setPendingConversation({
          conversationId: (result as any).conversationId,
          interaction: (result as any).interaction
        });

        setIsLoading(false);
        return;
      }

      // Normal completion - update conversation ID
      if ((result as any).conversationId) {
        setConversationId((result as any).conversationId);
      }

      const progressFromResult = Array.isArray(result.progressMessages) && result.progressMessages.length > 0
        ? result.progressMessages
        : toolProgressRef.current;

      if (progressFromResult.length > 0) {
        setToolProgress(progressFromResult);
        toolProgressRef.current = progressFromResult;
      }

      setMessages(prev => {
        const next = [...prev];
        if (progressFromResult.length > 0) {
          const summary = ['🛠️ Progress:']
            .concat(progressFromResult.map((msg, idx) => `${idx + 1}. ${msg}`))
            .join('\n');
          next.push({
            role: 'system',
            content: summary
          });
        }
        next.push({
          role: 'assistant',
          content: result.content || result.message || '',  // Try content first, then message
          usage: result.usage,
          toolCalls: result.toolCalls // Pass through tool execution details
        });
        return next;
      });
    } catch (error) {
      // Extract detailed error message from JSON-RPC error
      let errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Define type for JSON-RPC error structure
      type JsonRpcError = {
        data?: string;
        error?: {
          message: string;
        };
      };

      // Cast error to JsonRpcError type
      const err = error as JsonRpcError;

      // If it's a JSON-RPC error with data field, show that instead
      if (err && typeof err === 'object' && typeof err.data === 'string') {
        errorMessage = err.data;
      } else if (err && typeof err === 'object' && err.error && typeof err.error === 'object' && typeof err.error.message === 'string') {
        errorMessage = err.error.message;
      }

      // Make API key errors more user-friendly
      if (typeof errorMessage === 'string' && errorMessage.includes('API_KEY') && errorMessage.includes('required')) {
        const provider = errorMessage.match(/(OPENROUTER|ANTHROPIC|OPENAI|GOOGLE)/i)?.[1] || 'API';
        errorMessage = `❌ Missing API Key\n\nThe ${provider} provider requires an API key.\n\nTo fix this:\n1. Get an API key from ${provider.toLowerCase()}.com\n2. Add it to your .env file:\n   ${provider}_API_KEY=your-key-here\n3. Restart simple-agent\n\nOr use a different provider with --provider flag.`;
      }

      const progressSoFar = toolProgressRef.current;
      setMessages(prev => {
        const next = [...prev];
        if (progressSoFar.length > 0) {
          const summary = ['🛠️ Progress:']
            .concat(progressSoFar.map((msg, idx) => `${idx + 1}. ${msg}`))
            .join('\n');
          next.push({
            role: 'system',
            content: summary
          });
        }
        next.push({
          role: 'error',
          content: errorMessage
        });
        return next;
      });
    }

    setIsLoading(false);
  };

  const handleInteractionResponse = async (response: string | string[]) => {
    if (!pendingConversation) {
      logger.error('No pending conversation for interaction response');
      return;
    }

    setIsLoading(true);

    // Remove interaction message, add user response
    setMessages(prev => {
      const withoutInteraction = prev.filter(m => m.role !== 'interaction');
      const responseText = Array.isArray(response) ? response.join(', ') : response;
      return [...withoutInteraction, {
        role: 'user',
        content: responseText
      }];
    });

    try {
      // Resume agent with user response
      const result = await client.agents.resume.mutate({
        conversationId: pendingConversation.conversationId,
        response
      });

      // Check if another interaction is required
      if ((result as any).type === 'interaction_required') {
        logger.info(`🔔 Another interaction required`);

        setMessages(prev => [...prev, {
          role: 'interaction',
          content: '',
          interaction: (result as any).interaction
        } as any]);

        setPendingConversation({
          conversationId: (result as any).conversationId,
          interaction: (result as any).interaction
        });

        setIsLoading(false);
        return;
      }

      // Normal completion
      setPendingConversation(null);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.content || '',
        usage: result.usage,
        toolCalls: result.toolCalls
      }]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setMessages(prev => [...prev, {
        role: 'error',
        content: `Resume failed: ${errorMessage}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInteractionCancel = () => {
    // Remove interaction message
    setMessages(prev => prev.filter(m => m.role !== 'interaction'));
    setPendingConversation(null);
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
        {availableSkills.length > 0 && (
          <>
            <Text dimColor> • </Text>
            <Text color="green">{availableSkills.length} skills</Text>
          </>
        )}
        <Text dimColor> • </Text>
        <Text dimColor>Type /exit to quit, /help for commands</Text>
      </Box>

      {/* Chat History */}
      <Box flexDirection="column" marginY={1}>
        <ChatHistory
          messages={messages}
          onInteractionResponse={handleInteractionResponse}
          onInteractionCancel={handleInteractionCancel}
        />
      </Box>

      {/* Debug panel */}
      {debugMode && (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="yellow"
          paddingX={1}
          paddingY={1}
          marginBottom={1}
          width={Math.max(40, Math.min((stdout?.columns ?? 80) - 4, 120))}
        >
          <Text color="yellow">Debug Log (server.log)</Text>
          {debugLines.length === 0 ? (
            <Text dimColor>No log entries yet…</Text>
          ) : (
            debugLines.slice(-20).map((line, index) => (
              <Text key={`${index}-${line}`} dimColor wrap="wrap">
                {line}
              </Text>
            ))
          )}
        </Box>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <Box flexDirection="column">
          <Box>
            <Text color="yellow">
              <Spinner type="dots" />
            </Text>
            <Text> Agent in progress...</Text>
          </Box>
          {toolProgress.length > 0 && (
            <Box flexDirection="column" marginLeft={2}>
              {toolProgress.slice(-3).map((msg, idx) => (
                <Text key={`${idx}-${msg}`} color="cyan">
                  • {msg}
                </Text>
              ))}
            </Box>
          )}
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
