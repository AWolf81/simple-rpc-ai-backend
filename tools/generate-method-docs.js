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

function stringifyForCode(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return JSON.stringify({ error: 'Unable to serialize schema' }, null, 2);
  }
}

function hasInputPayload(schema) {
  if (!schema) {
    return false;
  }
  const info = unwrapSchema(schema);
  const base = info.base;
  if (!base) {
    return false;
  }
  if (base.type === 'ZodVoid' || base.type === 'ZodUndefined') {
    return false;
  }
  if (base.type === 'ZodObject') {
    const obj = findObjectSchema(base);
    if (!obj || !obj.properties) {
      return false;
    }
    return Object.keys(obj.properties).length > 0;
  }
  return true;
}

const TYPE_LABEL_MAP = {
  ZodString: 'string',
  ZodNumber: 'number',
  ZodBoolean: 'boolean',
  ZodBigInt: 'bigint',
  ZodDate: 'date',
  ZodEnum: 'enum',
  ZodNativeEnum: 'enum',
  ZodUnion: 'union',
  ZodDiscriminatedUnion: 'union',
  ZodLiteral: 'literal',
  ZodObject: 'object',
  ZodArray: 'array',
  ZodTuple: 'tuple',
  ZodRecord: 'record',
  ZodMap: 'map',
  ZodSet: 'set',
  ZodAny: 'any',
  ZodUnknown: 'unknown',
  ZodNever: 'never',
  ZodVoid: 'void',
  ZodNull: 'null',
  ZodUndefined: 'undefined',
  ZodSymbol: 'symbol',
  ZodEffects: 'effects',
  ZodLazy: 'lazy',
  ZodPromise: 'promise'
};

function deriveTypeLabel(schema) {
  if (!schema) {
    return 'unknown';
  }
  if (schema.jsType) {
    return String(schema.jsType);
  }
  if (schema.type && TYPE_LABEL_MAP[schema.type]) {
    return TYPE_LABEL_MAP[schema.type];
  }
  if (schema.type && schema.type.startsWith('Zod')) {
    return schema.type.replace(/^Zod/, '').toLowerCase();
  }
  if (schema.type) {
    return String(schema.type).toLowerCase();
  }
  return 'unknown';
}

function unwrapSchema(schema) {
  const meta = {
    base: schema,
    optional: false,
    nullable: false,
    hasDefault: false,
    wrappers: [],
    description: schema && schema.description ? schema.description : null
  };

  let current = schema;
  const visited = new Set();

  while (current && !visited.has(current)) {
    visited.add(current);

    if (current.description && !meta.description) {
      meta.description = current.description;
    }

    const type = current.type;

    if ((type === 'ZodOptional' || current.optional) && current.innerType) {
      meta.optional = true;
      meta.wrappers.push('optional');
      current = current.innerType;
      continue;
    }

    if (type === 'ZodNullable' && current.innerType) {
      meta.nullable = true;
      meta.wrappers.push('nullable');
      current = current.innerType;
      continue;
    }

    if ((type === 'default' || type === 'ZodDefault' || current.hasDefault) && current.innerType) {
      meta.hasDefault = true;
      meta.wrappers.push('default');
      current = current.innerType;
      continue;
    }

    if ((type === 'ZodEffects' || type === 'ZodBranded') && current.innerType) {
      meta.wrappers.push(type === 'ZodEffects' ? 'effects' : 'branded');
      current = current.innerType;
      continue;
    }

    break;
  }

  if (current && current.description && !meta.description) {
    meta.description = current.description;
  }

  meta.base = current || schema;
  return meta;
}

function findObjectSchema(schema) {
  let current = schema;
  const visited = new Set();
  while (current && !visited.has(current)) {
    visited.add(current);
    if ((current.type === 'ZodObject' || current.jsType === 'object' || current.properties) && current.properties) {
      return current;
    }
    if (current.innerType) {
      current = current.innerType;
      continue;
    }
    break;
  }
  return null;
}

function renderFieldBadges(info) {
  const badges = [];
  const typeLabel = deriveTypeLabel(info.base);
  badges.push(`<span class="method-badge method-badge--type">${escapeHtml(typeLabel)}</span>`);

  if (info.optional) {
    badges.push('<span class="method-badge method-badge--optional">optional</span>');
  }
  if (info.nullable) {
    badges.push('<span class="method-badge method-badge--nullable">nullable</span>');
  }
  if (info.hasDefault) {
    badges.push('<span class="method-badge method-badge--default">default</span>');
  }

  if (info.base && info.base.type === 'ZodArray') {
    badges.push('<span class="method-badge method-badge--meta">array</span>');
  } else if (info.base && info.base.type === 'ZodRecord') {
    badges.push('<span class="method-badge method-badge--meta">record</span>');
  } else if (info.base && info.base.type === 'ZodUnion') {
    badges.push('<span class="method-badge method-badge--meta">union</span>');
  }

  return badges.join('');
}

function renderField(name, schema, depth = 0) {
  const info = unwrapSchema(schema);
  const description = info.description ? `<div class="method-field__description">${escapeHtml(info.description)}</div>` : '';
  const enumHtml = renderEnumValues(info.base);
  const nested = renderNestedStructure(info.base, depth + 1);
  const indicatorClass = info.optional ? 'optional' : 'required';
  const indicatorTitle = info.optional ? 'Optional parameter' : 'Required parameter';

  return `<li class="method-field${nested ? ' method-field--has-children' : ''}">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--${indicatorClass}" title="${indicatorTitle}"></span>
      <span class="method-field__name">${escapeHtml(name)}</span>
      <span class="method-field__badges">${renderFieldBadges(info)}</span>
    </div>
    ${description}
    ${enumHtml}
    ${nested}
  </li>`;
}

function renderEnumValues(schema) {
  if (!schema) {
    return '';
  }

  const values = gatherEnumValues(schema);
  if (!values.length) {
    return '';
  }

  const chips = values
    .map(value => `<code>${escapeHtml(formatEnumValue(value))}</code>`)
    .join('');

  return `<div class="method-field__enum"><span class="method-field__label">Allowed values</span><div class="method-field__enum-items">${chips}</div></div>`;
}

function gatherEnumValues(schema, visited = new Set()) {
  if (!schema || typeof schema !== 'object' || visited.has(schema)) {
    return [];
  }

  visited.add(schema);

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return dedupeEnumValues(schema.enum);
  }

  if (schema.const !== undefined) {
    return [schema.const];
  }

  let collected = [];

  if (Array.isArray(schema.oneOf)) {
    for (const option of schema.oneOf) {
      collected = collected.concat(gatherEnumValues(option, visited));
    }
  }

  if (schema.innerType) {
    collected = collected.concat(gatherEnumValues(schema.innerType, visited));
  }

  return dedupeEnumValues(collected);
}

function dedupeEnumValues(values) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    const key = typeof value === 'string' ? value : JSON.stringify(value);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }

  return result;
}

function formatEnumValue(value) {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }
  return String(value);
}

function renderNestedStructure(schema, depth = 0) {
  if (!schema || depth > 6) {
    return '';
  }

  if (schema.type === 'ZodArray' && schema.items) {
    const nested = renderNestedStructure(schema.items, depth + 1);
    if (nested) {
      return `<div class="method-field__children method-field__children--array"><div class="method-field__label">Items</div>${nested}</div>`;
    }
  }

  if (schema.type === 'ZodTuple' && Array.isArray(schema.items)) {
    const tupleItems = schema.items
      .map(
        (item, index) =>
          `<div class="method-field__tuple-item"><div class="method-field__label">Item ${index + 1}</div>${
            renderNestedStructure(item, depth + 1) || `<span class="method-field__type">${escapeHtml(deriveTypeLabel(item))}</span>`
          }</div>`
      )
      .join('');
    if (tupleItems) {
      return `<div class="method-field__children method-field__children--tuple">${tupleItems}</div>`;
    }
  }

  const nestedObject = findObjectSchema(schema);
  if (nestedObject && nestedObject.properties && Object.keys(nestedObject.properties).length > 0) {
    return `<div class="method-field__children">${renderFieldList(schema, depth + 1)}</div>`;
  }

  if (schema.innerType) {
    return renderNestedStructure(schema.innerType, depth + 1);
  }

  if (schema.items && typeof schema.items === 'object') {
    return renderNestedStructure(schema.items, depth + 1);
  }

  return '';
}

function renderFieldList(schema, depth = 0) {
  if (!schema) {
    return '<div class="method-field-empty">Not documented.</div>';
  }
  const objectSchema = findObjectSchema(schema);
  if (!objectSchema || !objectSchema.properties) {
    const info = unwrapSchema(schema);
    const typeLabel = deriveTypeLabel(info.base);
    return `<div class="method-field-empty">No structured fields (${escapeHtml(typeLabel)})</div>`;
  }

  const entries = Object.entries(objectSchema.properties);
  if (entries.length === 0) {
    return '<div class="method-field-empty">No fields defined.</div>';
  }

  const items = entries.map(([key, value]) => renderField(key, value, depth)).join('');
  const listClass = depth > 0 ? 'method-field-list method-field-list--nested' : 'method-field-list';
  return `<ul class="${listClass}">${items}</ul>`;
}

function renderParameterColumn(title, icon, schema, idSuffix, options = {}) {
  const schemaJson = schema ? stringifyForCode(schema) : null;
  const schemaId = `schema-${idSuffix}`;
  const actions = [];

  if (options.invocationTarget) {
    actions.push(
      `<button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="${escapeHtml(
        options.invocationTarget
      )}" aria-haspopup="dialog" aria-controls="${escapeHtml(options.invocationTarget)}" title="Invocation examples">⚡</button>`
    );
  }

  if (schemaJson) {
    actions.push(
      `<button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="${schemaId}" aria-expanded="false" aria-controls="${schemaId}" title="Show full schema">{}</button>`
    );
  }

  const actionsHtml = actions.length ? `<div class="method-section__actions">${actions.join('')}</div>` : '';
  const schemaBlock = schemaJson
    ? `<div class="method-section__schema" id="${schemaId}" hidden><pre><code class="language-json">${escapeHtml(schemaJson)}</code></pre></div>`
    : '';

  return `<div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">${icon}</span>${escapeHtml(title)}</div>
    ${actionsHtml}
  </div>
  <div class="method-section__body">
    ${renderFieldList(schema)}
    ${schemaBlock}
  </div>
</div>`;
}

function renderInvocationModal(name, data, modalId, hasInput) {
  const [namespace, procedure] = name.includes('.') ? name.split('.') : ['app', name];
  const jsonParams = hasInput ? '      "params": { /* ... */ },' : '      "params": {},';
  const curlCodeId = `${modalId}-curl-code`;
  const trpcCodeId = `${modalId}-trpc-code`;
  const curl = [
    'curl -X POST http://localhost:8000/rpc \\',
    '  -H "Content-Type: application/json" \\',
    "  -d '{",
    '      "jsonrpc": "2.0",',
    `      "method": "${name}",`,
    jsonParams,
    '      "id": "request-1"',
    "  }'"
  ].join('\n');

  const callKind = data.type === 'mutation' ? 'mutate' : 'query';
  let trpcCall = `const result = await client.${namespace}.${procedure}.${callKind}`;
  if (hasInput) {
    trpcCall += `({\n  /* ... */\n});`;
  } else {
    trpcCall += `();`;
  }
  trpcCall += `\nconsole.log(result);`;

  return `<div class="method-modal" id="${modalId}" hidden role="dialog" aria-modal="true" aria-labelledby="${modalId}-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="${modalId}" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="${modalId}-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="${modalId}" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="${curlCodeId}"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="${curlCodeId}" data-lang="bash">${escapeHtml(
            curl
          )}</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="${trpcCodeId}"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="${trpcCodeId}" data-lang="ts">${escapeHtml(
            trpcCall
          )}</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>`;
}

function formatMethod(name, data) {
  const lines = [];
  lines.push(`## ${name}`);
  lines.push('');
  const sourceCell = data.sourceFile ? createSourceLink(data.sourceFile, data.lineNumber) : '_not documented_';
  const slug = name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const modalId = `modal-${slug}`;
  const hasInput = hasInputPayload(data.input);
  const descriptionHtml = data.description ? formatDescription(data.description) : '';
  lines.push('<div class="method-card">');
  const typeLabel = (data.type || 'unknown').toUpperCase();
  const typeModifier =
    data.type === 'query'
      ? 'method-card__badge--type-query'
      : data.type === 'subscription'
      ? 'method-card__badge--type-subscription'
      : data.type === 'mutation'
      ? 'method-card__badge--type-mutation'
      : 'method-card__badge--type-default';
  lines.push(
    `<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type ${typeModifier}">${escapeHtml(
      typeLabel
    )}</span><code class="method-card__method">${escapeHtml(name)}</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">${
      data.requiresAuth ? 'Auth required' : 'Public'
    }</span><span class="method-card__source">${sourceCell}</span></div></div>`
  );
  if (data.summary) {
    lines.push(`<div class="method-card__summary">${escapeHtml(data.summary)}</div>`);
  }
  if (descriptionHtml) {
    lines.push(`<div class="method-card__description">${descriptionHtml}</div>`);
  }
  lines.push('<div class="method-card__columns">');
  lines.push(
    `<div class="method-card__column">${renderParameterColumn(
      'Input Parameters',
      '📥',
      data.input,
      `${slug}-input`,
      {
        invocationTarget: modalId
      }
    )}</div>`
  );
  lines.push(
    `<div class="method-card__column">${renderParameterColumn(
      'Response',
      '📤',
      data.output,
      `${slug}-output`
    )}</div>`
  );
  lines.push('</div>');
  if (data.examples && data.examples.length > 0) {
    lines.push('<div class="method-card__examples"><details class="method-examples" markdown="1"><summary>Examples</summary>');
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
    lines.push('</details></div>');
  }
  lines.push('</div>');
  lines.push(renderInvocationModal(name, data, modalId, hasInput));
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
  parts.push('> _Do not edit this page manually – use the generator instead._');
  parts.push('');

  const priorityNamespaces = ['ai', 'mcp'];
  const allNamespaces = Object.keys(namespaces);
  const sortedNamespaces = [
    ...priorityNamespaces.filter(ns => allNamespaces.includes(ns)),
    ...allNamespaces.filter(ns => !priorityNamespaces.includes(ns)).sort()
  ];
  parts.push('<ul class="namespace-index">');
  for (const ns of sortedNamespaces) {
    parts.push(`<li><a href="#namespace-${ns}">${ns}</a></li>`);
  }
  parts.push('</ul>');
  parts.push('');

  for (const ns of sortedNamespaces) {
    parts.push(`<h2 id="namespace-${ns}">Namespace ${escapeHtml(ns)}</h2>`);
    parts.push('');
    const entries = namespaces[ns].sort((a, b) => a.name.localeCompare(b.name));
    for (const { name, data } of entries) {
      parts.push(formatMethod(name, data));
    }
  }

  parts.push('<script>');
  parts.push(`(() => {
    const body = document.body;
    function toggleSchema(button) {
      const targetId = button.dataset.target;
      if (!targetId) return;
      const block = document.getElementById(targetId);
      if (!block) return;
      const isHidden = block.hasAttribute('hidden');
      if (isHidden) {
        block.removeAttribute('hidden');
      } else {
        block.setAttribute('hidden', '');
      }
      button.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
      button.classList.toggle('is-active', isHidden);
    }

    function openModal(button) {
      const targetId = button.dataset.target;
      if (!targetId) return;
      const modal = document.getElementById(targetId);
      if (!modal) return;
      modal.removeAttribute('hidden');
      body.classList.add('method-modal-open');
      const closeButton = modal.querySelector('[data-action="close-modal"]');
      if (closeButton) {
        closeButton.focus({ preventScroll: true });
      }
    }

    function closeModal(targetId) {
      if (!targetId) return;
      const modal = document.getElementById(targetId);
      if (!modal) return;
      modal.setAttribute('hidden', '');
      if (!document.querySelector('.method-modal:not([hidden])')) {
        body.classList.remove('method-modal-open');
      }
    }

    document.addEventListener('click', event => {
      const control = event.target.closest('[data-action]');
      if (!control) {
        return;
      }
      const action = control.dataset.action;
      if (action === 'toggle-schema') {
        event.preventDefault();
        toggleSchema(control);
      } else if (action === 'open-modal') {
        event.preventDefault();
        openModal(control);
      } else if (action === 'close-modal') {
        event.preventDefault();
        closeModal(control.dataset.target);
      } else if (action === 'copy-code') {
        event.preventDefault();
        copyCode(control);
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        const openModalElement = document.querySelector('.method-modal:not([hidden])');
        if (openModalElement) {
          event.preventDefault();
          const targetId = openModalElement.id;
          closeModal(targetId);
        }
      }
    });

    function copyCode(button) {
      const targetId = button.dataset.target;
      if (!targetId) return;
      const codeEl = document.getElementById(targetId);
      if (!codeEl) return;
      const text = codeEl.textContent || '';
      try {
        navigator.clipboard.writeText(text).then(
          () => indicateCopied(button),
          () => fallbackCopy(text, button)
        );
      } catch (error) {
        fallbackCopy(text, button);
      }
    }

    function fallbackCopy(text, button) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        indicateCopied(button);
      } catch (err) {
        console.warn('Copy failed', err);
      }
      document.body.removeChild(textarea);
    }

    function indicateCopied(button) {
      button.classList.add('is-copied');
      setTimeout(() => {
        button.classList.remove('is-copied');
      }, 1500);
    }
  })();`);
  parts.push('</script>');

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
