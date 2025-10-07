---
title: Methods
parent: Server API
grand_parent: Documentation
nav_order: 5
---

> _Generated from `trpc-methods.json`. Run `pnpm trpc:build` then `pnpm docs:methods` to refresh._

# Namespace `ai`

## ai.generateText

<p>Executes guarded text generation with system prompt protection, token metering, and BYOK handling for authenticated and public callers.</p>

<table>
<tr><td><strong>Type</strong><br/>mutation</td><td><strong>Auth required</strong><br/>Yes</td><td><strong>Source</strong><br/><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/codex%2Frestructure-readme-and-docs-folder/src/trpc/routers/ai/methods/generation.ts#L58">src/trpc/routers/ai/methods/generation.ts:58</a></td></tr>
<tr><td colspan="3"><strong>Input</strong><br/><div class="schema"><p><code>ZodObject</code> • <span class="schema-js-type">object</span></p><div class="schema-fields"><p>Fields:</p><ul><li><code>content</code><div><div class="schema"><p><code>ZodString</code> • <span class="schema-js-type">string</span></p></div></div></li><li><code>systemPrompt</code><div><div class="schema"><p><code>ZodString</code> • <span class="schema-js-type">string</span></p></div></div></li><li><code>provider</code><div><div class="schema"><p><code>ZodOptional</code> • <span class="schema-flag">optional</span></p><div class="schema-inner"><p>Inner:</p><div class="schema"><p><code>ZodEnum</code> • <span class="schema-js-type">enum</span></p></div></div></div></div></li><li><code>apiKey</code><div><div class="schema"><p><code>ZodOptional</code> • <span class="schema-flag">optional</span></p><div class="schema-inner"><p>Inner:</p><div class="schema"><p><code>ZodString</code> • <span class="schema-js-type">string</span></p></div></div></div></div></li><li><code>metadata</code><div><div class="schema"><p><code>ZodOptional</code> • <span class="schema-flag">optional</span></p><div class="schema-inner"><p>Inner:</p><div class="schema"><p><code>ZodObject</code> • <span class="schema-js-type">object</span></p><div class="schema-fields"><p>Fields:</p><ul><li><code>name</code><div><div class="schema"><p><code>ZodOptional</code> • <span class="schema-flag">optional</span></p><div class="schema-inner"><p>Inner:</p><div class="schema"><p><code>ZodString</code> • <span class="schema-js-type">string</span></p></div></div></div></div></li><li><code>type</code><div><div class="schema"><p><code>ZodOptional</code> • <span class="schema-flag">optional</span></p><div class="schema-inner"><p>Inner:</p><div class="schema"><p><code>ZodString</code> • <span class="schema-js-type">string</span></p></div></div></div></div></li></ul></div></div></div></div></div></li><li><code>options</code><div><div class="schema"><p><code>ZodOptional</code> • <span class="schema-flag">optional</span></p><div class="schema-inner"><p>Inner:</p><div class="schema"><p><code>ZodObject</code> • <span class="schema-js-type">object</span></p><div class="schema-fields"><p>Fields:</p><ul><li><code>model</code><div><div class="schema"><p><code>ZodOptional</code> • <span class="schema-flag">optional</span></p><div class="schema-inner"><p>Inner:</p><div class="schema"><p><code>ZodString</code> • <span class="schema-js-type">string</span></p></div></div></div></div></li><li><code>maxTokens</code><div><div class="schema"><p><code>ZodOptional</code> • <span class="schema-flag">optional</span></p><div class="schema-inner"><p>Inner:</p><div class="schema"><p><code>default</code> • <span class="schema-flag">default</span></p><div class="schema-inner"><p>Inner:</p><div class="schema"><p><code>ZodNumber</code> • <span class="schema-js-type">number</span></p></div></div></div></div></div></div></li><li><code>temperature</code><div><div class="schema"><p><code>ZodOptional</code> • <span class="schema-flag">optional</span></p><div class="schema-inner"><p>Inner:</p><div class="schema"><p><code>ZodNumber</code> • <span class="schema-js-type">number</span></p></div></div></div></div></li></ul></div></div></div></div></div></li></ul></div></div></td></tr>
<tr><td colspan="3"><strong>Output</strong><br/><div class="schema"><p><code>ZodObject</code> • <span class="schema-js-type">object</span></p><div class="schema-fields"><p>Fields:</p><ul><li><code>success</code><div><div class="schema"><p><code>ZodBoolean</code> • <span class="schema-js-type">boolean</span></p></div></div></li><li><code>data</code><div><div class="schema"><p><code>ZodAny</code> • <span class="schema-js-type">any</span></p></div></div></li><li><code>tokenUsage</code><div><div class="schema"><p><code>ZodOptional</code> • <span class="schema-flag">optional</span></p><div class="schema-inner"><p>Inner:</p><div class="schema"><p><code>ZodObject</code> • <span class="schema-js-type">object</span></p><div class="schema-fields"><p>Fields:</p><ul><li><code>tokensUsed</code><div><div class="schema"><p><code>ZodNumber</code> • <span class="schema-js-type">number</span></p></div></div></li><li><code>tokensCharged</code><div><div class="schema"><p><code>ZodNumber</code> • <span class="schema-js-type">number</span></p></div></div></li><li><code>platformFee</code><div><div class="schema"><p><code>ZodNullable</code> • <span class="schema-flag">nullable</span></p><div class="schema-inner"><p>Inner:</p><div class="schema"><p><code>ZodNumber</code> • <span class="schema-js-type">number</span></p></div></div></div></div></li><li><code>remainingBalance</code><div><div class="schema"><p><code>ZodNullable</code> • <span class="schema-flag">nullable</span></p><div class="schema-inner"><p>Inner:</p><div class="schema"><p><code>ZodNumber</code> • <span class="schema-js-type">number</span></p></div></div></div></div></li></ul></div></div></div></div></div></li><li><code>usageInfo</code><div><div class="schema"><p><code>ZodOptional</code> • <span class="schema-flag">optional</span></p><div class="schema-inner"><p>Inner:</p><div class="schema"><p><code>ZodObject</code> • <span class="schema-js-type">object</span></p><div class="schema-fields"><p>Fields:</p><ul><li><code>tokensUsed</code><div><div class="schema"><p><code>ZodNumber</code> • <span class="schema-js-type">number</span></p></div></div></li><li><code>estimatedCostUsd</code><div><div class="schema"><p><code>ZodNumber</code> • <span class="schema-js-type">number</span></p></div></div></li></ul></div></div></div></div></div></li></ul></div></div></td></tr>
</table>
<details class="method-examples" markdown="1"><summary>Examples</summary>
{% highlight ts %}
const { data } = await client.ai.generateText.mutate({
content: 'Compose a friendly onboarding email for new engineers.',
systemPrompt: 'You are a helpful onboarding assistant.',
});
console.log(data.success, data.data?.usage?.totalTokens);
{% endhighlight %}
</details>

## ai.getRegistryHealth

<p>Reports availability and summary metrics for the registry integration, falling back to error details when checks fail.</p>

<table>
<tr><td><strong>Type</strong><br/>query</td><td><strong>Auth required</strong><br/>No</td><td><strong>Source</strong><br/><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/codex%2Frestructure-readme-and-docs-folder/src/trpc/routers/ai/methods/providers.ts#L107">src/trpc/routers/ai/methods/providers.ts:107</a></td></tr>
<tr><td colspan="3"><strong>Input</strong><br/><div class="schema"><p><code>ZodVoid</code> • <span class="schema-js-type">void</span></p></div></td></tr>
<tr><td colspan="3"><strong>Output</strong><br/><em>Not documented</em></td></tr>
</table>

## ai.listAllowedModels

<p>Provides production-ready model identifiers for a single provider or a map of providers to models.</p>

<table>
<tr><td><strong>Type</strong><br/>query</td><td><strong>Auth required</strong><br/>No</td><td><strong>Source</strong><br/><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/codex%2Frestructure-readme-and-docs-folder/src/trpc/routers/ai/methods/providers.ts#L70">src/trpc/routers/ai/methods/providers.ts:70</a></td></tr>
<tr><td colspan="3"><strong>Input</strong><br/><div class="schema"><p><code>ZodOptional</code> • <span class="schema-flag">optional</span></p><div class="schema-inner"><p>Inner:</p><div class="schema"><p><code>ZodObject</code> • <span class="schema-js-type">object</span></p><div class="schema-fields"><p>Fields:</p><ul><li><code>provider</code><div><div class="schema"><p><code>ZodOptional</code> • <span class="schema-flag">optional</span></p><div class="schema-inner"><p>Inner:</p><div class="schema"><p><code>ZodEnum</code> • <span class="schema-js-type">enum</span></p></div></div></div></div></li></ul></div></div></div></div></td></tr>
<tr><td colspan="3"><strong>Output</strong><br/><em>Not documented</em></td></tr>
</table>

## ai.listProviders

<p>Returns the providers currently registered in the model registry along with metadata about the registry source.</p>

<table>
<tr><td><strong>Type</strong><br/>query</td><td><strong>Auth required</strong><br/>No</td><td><strong>Source</strong><br/><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/codex%2Frestructure-readme-and-docs-folder/src/trpc/routers/ai/methods/providers.ts#L22">src/trpc/routers/ai/methods/providers.ts:22</a></td></tr>
<tr><td colspan="3"><strong>Input</strong><br/><div class="schema"><p><code>ZodVoid</code> • <span class="schema-js-type">void</span></p></div></td></tr>
<tr><td colspan="3"><strong>Output</strong><br/><em>Not documented</em></td></tr>
</table>

## ai.listProvidersBYOK

<p>Filters the provider catalog to only those eligible for user-supplied API keys.</p>

<table>
<tr><td><strong>Type</strong><br/>query</td><td><strong>Auth required</strong><br/>No</td><td><strong>Source</strong><br/><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/codex%2Frestructure-readme-and-docs-folder/src/trpc/routers/ai/methods/providers.ts#L46">src/trpc/routers/ai/methods/providers.ts:46</a></td></tr>
<tr><td colspan="3"><strong>Input</strong><br/><div class="schema"><p><code>ZodVoid</code> • <span class="schema-js-type">void</span></p></div></td></tr>
<tr><td colspan="3"><strong>Output</strong><br/><em>Not documented</em></td></tr>
</table>

## ai.validateProvider

<p>Performs lightweight API key validation for supported providers to catch obvious misconfigurations.</p>

<table>
<tr><td><strong>Type</strong><br/>mutation</td><td><strong>Auth required</strong><br/>No</td><td><strong>Source</strong><br/><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/codex%2Frestructure-readme-and-docs-folder/src/trpc/routers/ai/methods/providers.ts#L148">src/trpc/routers/ai/methods/providers.ts:148</a></td></tr>
<tr><td colspan="3"><strong>Input</strong><br/><div class="schema"><p><code>ZodObject</code> • <span class="schema-js-type">object</span></p><div class="schema-fields"><p>Fields:</p><ul><li><code>provider</code><div><div class="schema"><p><code>ZodEnum</code> • <span class="schema-js-type">enum</span></p></div></div></li><li><code>apiKey</code><div><div class="schema"><p><code>ZodString</code> • <span class="schema-js-type">string</span></p></div></div></li></ul></div></div></td></tr>
<tr><td colspan="3"><strong>Output</strong><br/><em>Not documented</em></td></tr>
</table>

# Namespace `mcp`

## mcp.apiDocumentationPrompt

<p>Generate comprehensive API documentation from code</p>

<table>
<tr><td><strong>Type</strong><br/>query</td><td><strong>Auth required</strong><br/>No</td><td><strong>Source</strong><br/><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/codex%2Frestructure-readme-and-docs-folder/src/trpc/routers/mcp/methods/prompt.ts#L89">src/trpc/routers/mcp/methods/prompt.ts:89</a></td></tr>
<tr><td colspan="3"><strong>Input</strong><br/><div class="schema"><p><code>ZodObject</code> • <span class="schema-js-type">object</span></p><div class="schema-fields"><p>Fields:</p><ul><li><code>code</code><div><div class="schema"><p><code>ZodString</code> • <span class="schema-js-type">string</span></p><p>API code to document</p></div></div></li><li><code>format</code><div><div class="schema"><p><code>default</code> • <span class="schema-flag">default</span></p><p>Output format</p><div class="schema-inner"><p>Inner:</p><div class="schema"><p><code>ZodEnum</code> • <span class="schema-js-type">enum</span></p></div></div></div></div></li></ul></div></div></td></tr>
<tr><td colspan="3"><strong>Output</strong><br/><em>Not documented</em></td></tr>
</table>

## mcp.codeReviewPrompt

<p>Comprehensive code review with security, performance, and maintainability analysis</p>

<table>
<tr><td><strong>Type</strong><br/>query</td><td><strong>Auth required</strong><br/>No</td><td><strong>Source</strong><br/><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/codex%2Frestructure-readme-and-docs-folder/src/trpc/routers/mcp/methods/prompt.ts#L19">src/trpc/routers/mcp/methods/prompt.ts:19</a></td></tr>
<tr><td colspan="3"><strong>Input</strong><br/><div class="schema"><p><code>ZodObject</code> • <span class="schema-js-type">object</span></p><div class="schema-fields"><p>Fields:</p><ul><li><code>code</code><div><div class="schema"><p><code>ZodString</code> • <span class="schema-js-type">string</span></p><p>Code to review</p></div></div></li><li><code>language</code><div><div class="schema"><p><code>ZodString</code> • <span class="schema-js-type">string</span></p><p>Programming language</p></div></div></li><li><code>focusArea</code><div><div class="schema"><p><code>ZodOptional</code> • <span class="schema-flag">optional</span></p><p>Focus area</p><div class="schema-inner"><p>Inner:</p><div class="schema"><p><code>ZodString</code> • <span class="schema-js-type">string</span></p></div></div></div></div></li></ul></div></div></td></tr>
<tr><td colspan="3"><strong>Output</strong><br/><em>Not documented</em></td></tr>
</table>

## mcp.currentSystemTime

<p>Get the current system time</p>

<table>
<tr><td><strong>Type</strong><br/>query</td><td><strong>Auth required</strong><br/>No</td><td><strong>Source</strong><br/><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/codex%2Frestructure-readme-and-docs-folder/src/trpc/routers/mcp/methods/utility.ts#L50">src/trpc/routers/mcp/methods/utility.ts:50</a></td></tr>
<tr><td colspan="3"><strong>Input</strong><br/><div class="schema"><p><code>ZodObject</code> • <span class="schema-js-type">object</span></p><div class="schema-fields"><p>Fields:</p><ul><li><code>format</code><div><div class="schema"><p><code>default</code> • <span class="schema-flag">default</span></p><p>Time format</p><div class="schema-inner"><p>Inner:</p><div class="schema"><p><code>ZodEnum</code> • <span class="schema-js-type">enum</span></p></div></div></div></div></li></ul></div></div></td></tr>
<tr><td colspan="3"><strong>Output</strong><br/><em>Not documented</em></td></tr>
</table>

## mcp.echo

<p>Echo back a message</p>

<table>
<tr><td><strong>Type</strong><br/>query</td><td><strong>Auth required</strong><br/>No</td><td><strong>Source</strong><br/><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/codex%2Frestructure-readme-and-docs-folder/src/trpc/routers/mcp/methods/utility.ts#L36">src/trpc/routers/mcp/methods/utility.ts:36</a></td></tr>
<tr><td colspan="3"><strong>Input</strong><br/><div class="schema"><p><code>ZodObject</code> • <span class="schema-js-type">object</span></p><div class="schema-fields"><p>Fields:</p><ul><li><code>message</code><div><div class="schema"><p><code>ZodString</code> • <span class="schema-js-type">string</span></p><p>Message to echo back</p></div></div></li></ul></div></div></td></tr>
<tr><td colspan="3"><strong>Output</strong><br/><em>Not documented</em></td></tr>
</table>

## mcp.explainConceptPrompt

<p>Explain technical concepts clearly at different skill levels</p>

<table>
<tr><td><strong>Type</strong><br/>query</td><td><strong>Auth required</strong><br/>No</td><td><strong>Source</strong><br/><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/codex%2Frestructure-readme-and-docs-folder/src/trpc/routers/mcp/methods/prompt.ts#L152">src/trpc/routers/mcp/methods/prompt.ts:152</a></td></tr>
<tr><td colspan="3"><strong>Input</strong><br/><div class="schema"><p><code>ZodObject</code> • <span class="schema-js-type">object</span></p><div class="schema-fields"><p>Fields:</p><ul><li><code>concept</code><div><div class="schema"><p><code>ZodString</code> • <span class="schema-js-type">string</span></p><p>Concept to explain</p></div></div></li><li><code>level</code><div><div class="schema"><p><code>ZodEnum</code> • <span class="schema-js-type">enum</span></p><p>Skill level</p></div></div></li><li><code>includeExamples</code><div><div class="schema"><p><code>default</code> • <span class="schema-flag">default</span></p><p>Include examples</p><div class="schema-inner"><p>Inner:</p><div class="schema"><p><code>ZodEnum</code> • <span class="schema-js-type">enum</span></p></div></div></div></div></li></ul></div></div></td></tr>
<tr><td colspan="3"><strong>Output</strong><br/><em>Not documented</em></td></tr>
</table>

## mcp.getResources

<p>List available MCP resources with metadata</p>

<table>
<tr><td><strong>Type</strong><br/>query</td><td><strong>Auth required</strong><br/>No</td><td><strong>Source</strong><br/><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/codex%2Frestructure-readme-and-docs-folder/src/trpc/routers/mcp/methods/resource.ts#L12">src/trpc/routers/mcp/methods/resource.ts:12</a></td></tr>
<tr><td colspan="3"><strong>Input</strong><br/><div class="schema"><p><code>ZodObject</code> • <span class="schema-js-type">object</span></p><div class="schema-fields"><p>Fields:</p><ul><li><code>category</code><div><div class="schema"><p><code>ZodOptional</code> • <span class="schema-flag">optional</span></p><p>Filter resources by category</p><div class="schema-inner"><p>Inner:</p><div class="schema"><p><code>ZodString</code> • <span class="schema-js-type">string</span></p></div></div></div></div></li><li><code>search</code><div><div class="schema"><p><code>ZodOptional</code> • <span class="schema-flag">optional</span></p><p>Search resources by name or description</p><div class="schema-inner"><p>Inner:</p><div class="schema"><p><code>ZodString</code> • <span class="schema-js-type">string</span></p></div></div></div></div></li></ul></div></div></td></tr>
<tr><td colspan="3"><strong>Output</strong><br/><div class="schema"><p><code>ZodObject</code> • <span class="schema-js-type">object</span></p><div class="schema-fields"><p>Fields:</p><ul><li><code>resources</code><div><div class="schema"><p><code>ZodArray</code> • <span class="schema-js-type">array</span></p><div class="schema-items"><p>Items:</p><div class="schema"><p><code>String</code></p></div></div></div></div></li><li><code>total</code><div><div class="schema"><p><code>ZodNumber</code> • <span class="schema-js-type">number</span></p></div></div></li></ul></div></div></td></tr>
</table>

## mcp.greeting

<p>Generate a friendly greeting in the specified language</p>

<table>
<tr><td><strong>Type</strong><br/>query</td><td><strong>Auth required</strong><br/>No</td><td><strong>Source</strong><br/><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/codex%2Frestructure-readme-and-docs-folder/src/trpc/routers/mcp/methods/utility.ts#L15">src/trpc/routers/mcp/methods/utility.ts:15</a></td></tr>
<tr><td colspan="3"><strong>Input</strong><br/><div class="schema"><p><code>ZodObject</code> • <span class="schema-js-type">object</span></p><div class="schema-fields"><p>Fields:</p><ul><li><code>name</code><div><div class="schema"><p><code>ZodString</code> • <span class="schema-js-type">string</span></p><p>Name to greet</p></div></div></li><li><code>language</code><div><div class="schema"><p><code>default</code> • <span class="schema-flag">default</span></p><p>Language for the greeting</p><div class="schema-inner"><p>Inner:</p><div class="schema"><p><code>ZodEnum</code> • <span class="schema-js-type">enum</span></p></div></div></div></div></li></ul></div></div></td></tr>
<tr><td colspan="3"><strong>Output</strong><br/><em>Not documented</em></td></tr>
</table>

## mcp.incidentResponsePrompt

<p>Guide incident response procedures and provide action steps</p>

<table>
<tr><td><strong>Type</strong><br/>query</td><td><strong>Auth required</strong><br/>No</td><td><strong>Source</strong><br/><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/codex%2Frestructure-readme-and-docs-folder/src/trpc/routers/mcp/methods/prompt.ts#L235">src/trpc/routers/mcp/methods/prompt.ts:235</a></td></tr>
<tr><td colspan="3"><strong>Input</strong><br/><div class="schema"><p><code>ZodObject</code> • <span class="schema-js-type">object</span></p><div class="schema-fields"><p>Fields:</p><ul><li><code>description</code><div><div class="schema"><p><code>ZodString</code> • <span class="schema-js-type">string</span></p><p>Incident description</p></div></div></li><li><code>severity</code><div><div class="schema"><p><code>ZodEnum</code> • <span class="schema-js-type">enum</span></p><p>Severity level</p></div></div></li><li><code>status</code><div><div class="schema"><p><code>ZodOptional</code> • <span class="schema-flag">optional</span></p><p>Current status</p><div class="schema-inner"><p>Inner:</p><div class="schema"><p><code>ZodString</code> • <span class="schema-js-type">string</span></p></div></div></div></div></li></ul></div></div></td></tr>
<tr><td colspan="3"><strong>Output</strong><br/><em>Not documented</em></td></tr>
</table>

## mcp.readResource

<p>Read the content of a specific MCP resource</p>

<table>
<tr><td><strong>Type</strong><br/>query</td><td><strong>Auth required</strong><br/>No</td><td><strong>Source</strong><br/><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/codex%2Frestructure-readme-and-docs-folder/src/trpc/routers/mcp/methods/resource.ts#L114">src/trpc/routers/mcp/methods/resource.ts:114</a></td></tr>
<tr><td colspan="3"><strong>Input</strong><br/><div class="schema"><p><code>ZodObject</code> • <span class="schema-js-type">object</span></p><div class="schema-fields"><p>Fields:</p><ul><li><code>uri</code><div><div class="schema"><p><code>ZodString</code> • <span class="schema-js-type">string</span></p><p>URI of the resource to read</p></div></div></li></ul></div></div></td></tr>
<tr><td colspan="3"><strong>Output</strong><br/><div class="schema"><p><code>ZodObject</code> • <span class="schema-js-type">object</span></p><div class="schema-fields"><p>Fields:</p><ul><li><code>content</code><div><div class="schema"><p><code>ZodAny</code> • <span class="schema-js-type">any</span></p></div></div></li><li><code>mimeType</code><div><div class="schema"><p><code>ZodString</code> • <span class="schema-js-type">string</span></p></div></div></li><li><code>uri</code><div><div class="schema"><p><code>ZodString</code> • <span class="schema-js-type">string</span></p></div></div></li></ul></div></div></td></tr>
</table>
