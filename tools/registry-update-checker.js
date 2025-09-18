/**
 * Public Registry Update Checker
 *
 * Verifies that @anolilab/ai-model-registry is in sync
 * with public sources (OpenAI, Anthropic, Google).
 *
 * No API tokens required.
 */

import fetch from "node-fetch";
import { load } from "cheerio";
import { getModelsByProvider } from "@anolilab/ai-model-registry";

// --- Timeout wrapper ---
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// --- Helpers ---
function isOpenAIModelName(text) {
  return /^(gpt|o\d|codex)/i.test(text.trim());
}

// --- Fetchers ---
async function fetchOpenAIModels() {
  const res = await fetchWithTimeout("https://openai.com/api/pricing/");
  const html = await res.text();
  const $ = load(html);

  const models = new Set();
  $("table tr td:first-child").each((_, el) => {
    const text = $(el).text().trim();
    if (text && isOpenAIModelName(text)) {
      models.add(text);
    }
  });
  return [...models];
}

async function fetchAnthropicModels() {
  const res = await fetchWithTimeout("https://docs.anthropic.com/claude/docs/models-overview");
  const html = await res.text();
  const $ = load(html);

  const models = new Set();
  $("table tr td:first-child").each((_, el) => {
    const text = $(el).text().trim();
    if (text.toLowerCase().startsWith("claude")) {
      models.add(text);
    }
  });
  return [...models];
}

async function fetchGoogleModels() {
  const res = await fetchWithTimeout("https://generativelanguage.googleapis.com/v1beta/models");
  const json = await res.json();
  return (json.models || [])
    .map(m => m.name.replace("models/", ""))
    .filter(name => name.startsWith("gemini-"));
}

// --- Compare ---
function compareModels(source, registryModels) {
  const missing = source.filter(m => !registryModels.includes(m));
  const extra = registryModels.filter(m => !source.includes(m));
  return { missing, extra };
}

// --- Main ---
async function checkForUpdates() {
  console.log("🔄 Public Registry Update Checker\n");

  try {
    const PUBLIC_PROVIDERS = ["OpenAI", "Anthropic", "Google"];
    const registryModels = {
      openai: getModelsByProvider("OpenAI").map(m => m.id || m.name),
      anthropic: getModelsByProvider("Anthropic").map(m => m.id || m.name),
      google: getModelsByProvider("Google").map(m => m.id || m.name),
    };

    // Show models currently in the registry
    console.log("📋 Models currently in the registry:");
    for (const provider of PUBLIC_PROVIDERS) {
      console.log(`\n${provider}:`);
      const models = registryModels[provider.toLowerCase()];
      if (models.length) {
        models.forEach(m => console.log(`  • ${m}`));
      } else {
        console.log("  ⚠️ No models found in registry");
      }
    }

    console.log("\n📡 Fetching latest models from public providers...");
    const [openaiLatest, anthropicLatest, googleLatest] = await Promise.all([
      fetchOpenAIModels(),
      fetchAnthropicModels(),
      fetchGoogleModels(),
    ]);

    const publicModels = {
      OpenAI: openaiLatest,
      Anthropic: anthropicLatest,
      Google: googleLatest,
    };

    console.log("\n=== Verification Report ===");
    for (const [provider, models] of Object.entries(publicModels)) {
      const { missing, extra } = compareModels(models, registryModels[provider.toLowerCase()]);
      console.log(`\n${provider}:`);
      if (missing.length) console.log("  🚨 Missing in registry:", missing);
      if (extra.length) console.log("  ⚠️ Extra in registry:", extra);
      if (!missing.length && !extra.length) console.log("  ✅ Up to date");
    }

    console.log("\n✅ Update check complete");
    return true;
  } catch (error) {
    console.error("❌ Failed to check for updates:", error.message);
    return false;
  }
}

// CLI usage
if (import.meta.url === new URL(process.argv[1], "file://").href) {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(`
Public Registry Update Checker

Usage:
  node registry-update-checker.js        # Check for updates
  node registry-update-checker.js --help # Show this help

Checks:
  • OpenAI (model IDs filtered)
  • Anthropic (claude-* only)
  • Google (gemini-* only)

Reports:
  • Registry models
  • Missing models
  • Extra models
`);
  } else {
    checkForUpdates().catch(console.error);
  }
}

// Export for module usage
export { checkForUpdates };
