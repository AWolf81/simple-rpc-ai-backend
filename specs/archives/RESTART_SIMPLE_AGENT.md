# How to Use the Conversation History Fix in simple-agent

## ✅ Fix is Complete!

The conversation history bug has been fixed in the backend. To use it in simple-agent:

## Step 1: Kill Old Server

The old server (running before the fix) has been killed. ✅

## Step 2: Restart simple-agent

Now just restart simple-agent normally:

```bash
cd tools/simple-agent
node dist/cli.js
```

Or if you prefer the npm script:

```bash
cd tools/simple-agent
pnpm start
```

## That's It!

The conversation history fix will work automatically. You can now:

1. Have multi-turn conversations
2. Execute skills with conversation context
3. Use "Execute the greet script with name Charlie" and it will work!

## What Was Fixed

- Added conversation history support to AIService
- Fixed agent adapter to properly pass conversation history
- All AI providers now support conversation history (Anthropic, OpenAI, Google, OpenRouter)

No more "Invalid prompt: The messages must be a ModelMessage[]" error! 🎉

## Verification

When you run simple-agent and execute the greet script, you should see:
```
You: Execute the greet script with name "Charlie"

Agent: [executes greet script successfully]
Hello, Charlie! [or similar output]
```

Instead of the OpenRouter error.
