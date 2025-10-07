#!/usr/bin/env node

/**
 * Generate docs/server-api/methods.md from trpc-methods.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

function resolveMethodsFile() {
  const distPath = path.resolve(process.cwd(), 'dist/trpc-methods.json');
  if (existsSync(distPath)) {
    return distPath;
  }
  const rootPath = path.resolve(process.cwd(), 'trpc-methods.json');
  if (existsSync(rootPath)) {
    return rootPath;
  }
  throw new Error(
    `Could not locate trpc-methods.json (checked dist/trpc-methods.json and trpc-methods.json). Run "pnpm trpc:build" before generating docs.`
  );
}

let cachedGitInfo = null;

function getGitInfo() {
  if (cachedGitInfo !== null) {
    return cachedGitInfo;
  }

  try {
    const gitDir = path.resolve(process.cwd(), '.git');

    const configPath = path.join(gitDir, 'config');
    const headPath = path.join(gitDir, 'HEAD');

    if (!existsSync(configPath) || !existsSync(headPath)) {
      cachedGitInfo = null;
      return null;
    }

    const configContent = readFileSync(configPath, 'utf8');
    const headContent = readFileSync(headPath, 'utf8').trim();

    const remoteMatch = configContent.match(/\[remote "origin"\][\s\S]*?url\s*=\s*(.+)/);
    if (!remoteMatch) {
      cachedGitInfo = null;
      return null;
    }

    const remote = remoteMatch[1].trim();

    let branch = null;
    let commit = null;

    if (headContent.startsWith('ref:')) {
      const ref = headContent.replace('ref:', '').trim();
      if (ref.startsWith('refs/heads/')) {
        branch = ref.slice('refs/heads/'.length);
      } else {
        branch = ref.split('/').pop() || ref;
      }
      const refPath = path.join(gitDir, ref);
      if (existsSync(refPath)) {
        commit = readFileSync(refPath, 'utf8').trim();
      }
    } else {
      commit = headContent;
    }

    let repoPath = null;
    if (remote.startsWith('git@')) {
      // git@github.com:owner/repo.git
      const match = remote.match(/:(.*?)(\.git)?$/);
      if (match) {
        repoPath = match[1];
      }
    } else if (remote.startsWith('https://')) {
      const match = remote.match(/github\.com[:/](.*?)(\.git)?$/);
      if (match) {
        repoPath = match[1];
      }
    }

    if (!repoPath) {
      cachedGitInfo = null;
      return null;
    }

    const ref = branch && branch !== 'HEAD' ? branch : (commit || 'HEAD');
    const encodedRef = encodeURIComponent(ref);
    cachedGitInfo = {
      repoPath,
      ref,
      baseUrl: `https://github.com/${repoPath}/blob/${encodedRef}`
    };
    return cachedGitInfo;
  } catch (error) {
    cachedGitInfo = null;
    return null;
  }
}

function escapeHtml(value) {
  if (value == null) {
    return '';
  }
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDescription(text) {
  if (!text) {
    return '<p><em>Not documented.</em></p>';
  }

  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return '<p><em>Not documented.</em></p>';
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map(par => `<p>${escapeHtml(par.trim())}</p>`);

  return paragraphs.join('');
}

function sanitizeExample(example) {
  if (!example) {
    return null;
  }

  const normalized = example.trim();
  const fenced = normalized.match(/^```([\w-]+)?\n([\s\S]*?)\n?```$/);
  if (fenced) {
    const [, lang = '', code] = fenced;
    return {
      code: dedent(code.replace(/\r\n/g, '\n')),
      language: lang || null
    };
  }

  return {
    code: dedent(normalized.replace(/\r\n/g, '\n')),
    language: null
  };
}

function dedent(text) {
  const lines = text.split('\n');
  let minIndent = Infinity;

  for (const line of lines) {
    const match = line.match(/^(\s*)\S/);
    if (match) {
      minIndent = Math.min(minIndent, match[1].length);
    }
  }

  if (!isFinite(minIndent) || minIndent === 0) {
    return lines.join('\n');
  }

  return lines
    .map(line => (line.length >= minIndent ? line.slice(minIndent) : line.trimEnd()))
    .join('\n');
}

function createSourceLink(sourceFile, lineNumber) {
  if (!sourceFile) {
    return null;
  }

  const gitInfo = getGitInfo();
  const location = lineNumber ? `${sourceFile}:${lineNumber}` : sourceFile;

  if (!gitInfo) {
    return `<code>${escapeHtml(location)}</code>`;
  }

  const relativePath = sourceFile.replace(/\\/g, '/');
  const link = `${gitInfo.baseUrl}/${relativePath}${lineNumber ? `#L${lineNumber}` : ''}`;
  return `<a href="${escapeHtml(link)}">${escapeHtml(location)}</a>`;
}

function formatConstraints(schema) {
  const constraints = [];

  if (schema.minLength !== undefined) constraints.push(`min length ${schema.minLength}`);
  if (schema.maxLength !== undefined) constraints.push(`max length ${schema.maxLength}`);
  if (schema.minimum !== undefined) constraints.push(`min ${schema.minimum}`);
  if (schema.maximum !== undefined) constraints.push(`max ${schema.maximum}`);
  if (schema.minItems !== undefined) constraints.push(`min items ${schema.minItems}`);
  if (schema.maxItems !== undefined) constraints.push(`max items ${schema.maxItems}`);
  if (schema.pattern) constraints.push(`pattern <code>${escapeHtml(schema.pattern)}</code>`);

  return constraints.length ? `<p>Constraints: ${constraints.join(', ')}</p>` : '';
}

function formatSchema(schema) {
  if (!schema) {
    return '<em>Not documented</em>';
  }

  if (typeof schema === 'string') {
    return `<code>${escapeHtml(schema)}</code>`;
  }

  const badges = [];
  const type = schema.type && schema.type !== 'unknown' ? `<code>${escapeHtml(schema.type)}</code>` : null;
  if (type) {
    badges.push(type);
  }
  if (schema.jsType && schema.jsType !== 'unknown') {
    badges.push(`<span class="schema-js-type">${escapeHtml(schema.jsType)}</span>`);
  }
  if (schema.optional) {
    badges.push('<span class="schema-flag">optional</span>');
  }
  if (schema.nullable) {
    badges.push('<span class="schema-flag">nullable</span>');
  }
  if (schema.default !== undefined) {
    badges.push(`default <code>${escapeHtml(schema.default)}</code>`);
  } else if (schema.hasDefault) {
    badges.push('<span class="schema-flag">default</span>');
  }

  const sections = [];
  if (badges.length) {
    sections.push(`<p>${badges.join(' • ')}</p>`);
  }

  if (schema.description) {
    sections.push(`<p>${escapeHtml(schema.description)}</p>`);
  }

  const constraints = formatConstraints(schema);
  if (constraints) {
    sections.push(constraints);
  }

  if (schema.enum && Array.isArray(schema.enum) && schema.enum.length > 0) {
    sections.push(
      `<p>Allowed: ${schema.enum.map(value => `<code>${escapeHtml(String(value))}</code>`).join(', ')}</p>`
    );
  }

  if (schema.properties) {
    const keys = Object.keys(schema.properties);
    if (keys.length > 0) {
      const items = keys
        .map(key => {
          const fieldHtml = formatSchema(schema.properties[key]);
          return `<li><code>${escapeHtml(key)}</code><div>${fieldHtml}</div></li>`;
        })
        .join('');
      sections.push(`<div class="schema-fields"><p>Fields:</p><ul>${items}</ul></div>`);
    }
  }

  if (schema.items) {
    sections.push(`<div class="schema-items"><p>Items:</p>${formatSchema(schema.items)}</div>`);
  }

  if (schema.innerType) {
    sections.push(`<div class="schema-inner"><p>Inner:</p>${formatSchema(schema.innerType)}</div>`);
  }

  if (schema.oneOf && Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    const options = schema.oneOf.map(opt => `<li>${formatSchema(opt)}</li>`).join('');
    sections.push(`<div class="schema-union"><p>One of:</p><ul>${options}</ul></div>`);
  }

  if (sections.length === 0) {
    return '<em>Not documented</em>';
  }

  return `<div class="schema">${sections.join('')}</div>`;
}

function formatMethod(name, data) {
  const lines = [];
  lines.push(`## ${name}`);
  lines.push('');
  lines.push(formatDescription(data.description));
  lines.push('');
  const sourceCell = data.sourceFile ? createSourceLink(data.sourceFile, data.lineNumber) : '_not documented_';
  lines.push('<table>');
  lines.push(
    `<tr><td><strong>Type</strong><br/>${data.type ?? 'unknown'}</td><td><strong>Auth required</strong><br/>${
      data.requiresAuth ? 'Yes' : 'No'
    }</td><td><strong>Source</strong><br/>${sourceCell}</td></tr>`
  );
  lines.push(`<tr><td colspan="3"><strong>Input</strong><br/>${formatSchema(data.input)}</td></tr>`);
  lines.push(`<tr><td colspan="3"><strong>Output</strong><br/>${formatSchema(data.output)}</td></tr>`);
  lines.push('</table>');
  if (data.examples && data.examples.length > 0) {
    lines.push('<details class="method-examples" markdown="1"><summary>Examples</summary>');
    for (const example of data.examples) {
      const cleaned = sanitizeExample(example);
      if (!cleaned) {
        continue;
      }
      const lang = cleaned.language || 'text';
      const indented = cleaned.code;
      lines.push(`{% highlight ${lang} %}`);
      lines.push(indented);
      lines.push('{% endhighlight %}');
    }
    lines.push('</details>');
  }
  lines.push('');
  return lines.join('\n');
}

function main() {
  const methodsPath = resolveMethodsFile();
  const json = JSON.parse(readFileSync(methodsPath, 'utf8'));
  const procedures = json.procedures || {};

  const namespaces = {};
  for (const [name, data] of Object.entries(procedures)) {
    const [namespace] = name.split('.');
    if (!namespaces[namespace]) {
      namespaces[namespace] = [];
    }
    namespaces[namespace].push({ name, data });
  }

  const targetDir = path.resolve('docs/server-api');
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  const parts = [];
  parts.push('---');
  parts.push('title: Methods');
  parts.push('parent: Server API');
  parts.push('grand_parent: Documentation');
  parts.push('nav_order: 5');
  parts.push('---');
  parts.push('');
  parts.push('> _Generated from `trpc-methods.json`. Run `pnpm trpc:build` then `pnpm docs:methods` to refresh._');
  parts.push('');

  const sortedNamespaces = Object.keys(namespaces).sort();
  for (const ns of sortedNamespaces) {
    parts.push(`# Namespace \`${ns}\``);
    parts.push('');
    const entries = namespaces[ns].sort((a, b) => a.name.localeCompare(b.name));
    for (const { name, data } of entries) {
      parts.push(formatMethod(name, data));
    }
  }

  const outPath = path.join(targetDir, 'methods.md');
  writeFileSync(outPath, parts.join('\n'));
  console.log(`✅ Generated ${outPath} from ${methodsPath}`);
}

try {
  main();
} catch (error) {
  console.error('❌ Failed to generate method docs:', error.message);
  process.exit(1);
}
