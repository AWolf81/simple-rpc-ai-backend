# Archived Root Notes

This directory consolidates the historical Markdown notes that previously lived in the repository root. Each file captures context for a feature, fix, or workflow and remains available here for reference.

## Agent Architecture & Skills
- [AGENTS_FEATURE_SUMMARY.md](AGENTS_FEATURE_SUMMARY.md): outlines the unified agent abstraction spanning Claude Code and OpenAI Agents SDKs.
- [AGENT_SKILLS_IMPLEMENTATION.md](AGENT_SKILLS_IMPLEMENTATION.md): details the initial skills system rollout and supporting components.
- [AGENT_SYSTEM_SUMMARY.md](AGENT_SYSTEM_SUMMARY.md): summarizes the broader agent orchestration, sandboxing, and CLI upgrades.
- [STREAMING_FEATURE.md](STREAMING_FEATURE.md): describes the real-time streaming pipeline for AI responses and agent runs.
- [TOOL_CALLING_INTEGRATION_PLAN.md](TOOL_CALLING_INTEGRATION_PLAN.md): captures the plan for exposing tool calling within the skills system.
- [TOOL_OUTPUT_UI_IMPLEMENTATION.md](TOOL_OUTPUT_UI_IMPLEMENTATION.md): explains the UI flow for presenting raw tool output alongside AI responses.

## Infrastructure & Developer Experience
- [SANDBOX_ARCHITECTURE.md](SANDBOX_ARCHITECTURE.md): documents the pluggable sandbox providers and deployment targets.
- [CONFIGURATION_SYSTEM_SUMMARY.md](CONFIGURATION_SYSTEM_SUMMARY.md): covers the hierarchical configuration discovery model for `simple-agent`.
- [DX_IMPROVEMENTS.md](DX_IMPROVEMENTS.md): lists build, tooling, and discoverability improvements for contributors.

## Provider Guidance
- [CLAUDE.md](CLAUDE.md): usage guidance tailored for Anthropic Claude interactions with this codebase.
- [GEMINI.md](GEMINI.md): tips for Google Gemini-oriented development.
- [QWEN.md](QWEN.md): repository overview for Qwen-based workflows.

## Fixes & Operational Notes
- [CONVERSATION_HISTORY_FIX.md](CONVERSATION_HISTORY_FIX.md): outlines the fix for OpenRouter conversation history errors in skills.
- [DUPLICATE_TOOL_RESULTS_FIX.md](DUPLICATE_TOOL_RESULTS_FIX.md): explains the Anthropic duplicate tool result resolution.
- [EXIT_COMMAND_FIX.md](EXIT_COMMAND_FIX.md): ensures `/exit` and `/quit` cleanly shut down the CLI session.
- [FINAL_FIXES_SUMMARY.md](FINAL_FIXES_SUMMARY.md): aggregates the final set of fixes shipped together.
- [RESTART_SIMPLE_AGENT.md](RESTART_SIMPLE_AGENT.md): walk-through for adopting the conversation history fix in `simple-agent`.
- [SERVER_CLEANUP_FIX.md](SERVER_CLEANUP_FIX.md): details automatic cleanup for orphaned development servers.
- [TRPC_ROUTE_MATCHING_FIX.md](TRPC_ROUTE_MATCHING_FIX.md): covers improved routing diagnostics when loading skills.
- [VERBOSE_MODE_IMPROVEMENTS.md](VERBOSE_MODE_IMPROVEMENTS.md): highlights usability tweaks for verbose CLI output.

## Debugging & Testing Guides
- [DEBUG_MESSAGES_EXPLAINED.md](DEBUG_MESSAGES_EXPLAINED.md): decodes common debug-level log messages and warnings.
- [ERROR_MESSAGE_TEST_SUMMARY.md](ERROR_MESSAGE_TEST_SUMMARY.md): summarizes the QA coverage for CLI error messaging.
- [TOOL_OUTPUT_TESTING_GUIDE.md](TOOL_OUTPUT_TESTING_GUIDE.md): testing strategy for keeping skill output faithful to underlying scripts.
