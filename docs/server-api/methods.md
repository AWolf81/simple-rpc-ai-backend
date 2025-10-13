---
title: Methods
parent: Server API
grand_parent: Documentation
nav_order: 5
---

> _Generated from `trpc-methods.json`. Run `pnpm trpc:build` then `pnpm docs:methods` to refresh._
> _Do not edit this page manually – use the generator instead._

<ul class="namespace-index">
<li><a href="#namespace-ai">ai</a></li>
<li><a href="#namespace-mcp">mcp</a></li>
<li><a href="#namespace-admin">admin</a></li>
<li><a href="#namespace-auth">auth</a></li>
<li><a href="#namespace-billing">billing</a></li>
<li><a href="#namespace-system">system</a></li>
<li><a href="#namespace-user">user</a></li>
</ul>

<h2 id="namespace-ai">Namespace ai</h2>

## ai.generateText

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-mutation">MUTATION</span><code class="method-card__method">ai.generateText</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Auth required</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/ai/methods/generation.ts#L63">src/trpc/routers/ai/methods/generation.ts:63</a></span></div></div>
<div class="method-card__summary">Generate structured text completions across supported AI providers.</div>
<div class="method-card__description"><p>Executes guarded text generation with system prompt protection, token metering, and BYOK handling for authenticated and public callers.</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-ai-generatetext" aria-haspopup="dialog" aria-controls="modal-ai-generatetext" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-ai-generatetext-input" aria-expanded="false" aria-controls="schema-ai-generatetext-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">content</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">systemPrompt</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">provider</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">enum</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    
    <div class="method-field__enum"><span class="method-field__label">Allowed values</span><div class="method-field__enum-items"><code>anthropic</code><code>openai</code><code>google</code><code>openrouter</code><code>huggingface</code></div></div>
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">apiKey</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    
    
    
  </li><li class="method-field method-field--has-children">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">metadata</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">object</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    
    
    <div class="method-field__children"><ul class="method-field-list method-field-list--nested"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">name</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">type</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">useWebSearch</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">boolean</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">webSearchPreference</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">enum</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    
    <div class="method-field__enum"><span class="method-field__label">Allowed values</span><div class="method-field__enum-items"><code>duckduckgo</code><code>mcp</code><code>ai-web-search</code><code>never</code></div></div>
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">maxWebSearches</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">number</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">allowedDomains</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">array</span><span class="method-badge method-badge--optional">optional</span><span class="method-badge method-badge--meta">array</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">blockedDomains</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">array</span><span class="method-badge method-badge--optional">optional</span><span class="method-badge method-badge--meta">array</span></span>
    </div>
    
    
    
  </li></ul></div>
  </li><li class="method-field method-field--has-children">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">options</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">object</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    
    
    <div class="method-field__children"><ul class="method-field-list method-field-list--nested"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">model</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">maxTokens</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">number</span><span class="method-badge method-badge--optional">optional</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">temperature</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">number</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    
    
    
  </li></ul></div>
  </li></ul>
    <div class="method-section__schema" id="schema-ai-generatetext-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;content&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;systemPrompt&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;provider&quot;: {
      &quot;type&quot;: &quot;ZodOptional&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;optional&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodEnum&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;enum&quot;,
        &quot;enum&quot;: [
          &quot;anthropic&quot;,
          &quot;openai&quot;,
          &quot;google&quot;,
          &quot;openrouter&quot;,
          &quot;huggingface&quot;
        ]
      }
    },
    &quot;apiKey&quot;: {
      &quot;type&quot;: &quot;ZodOptional&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;optional&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodString&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;string&quot;
      }
    },
    &quot;metadata&quot;: {
      &quot;type&quot;: &quot;ZodOptional&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;optional&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodObject&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;object&quot;,
        &quot;properties&quot;: {
          &quot;name&quot;: {
            &quot;type&quot;: &quot;ZodOptional&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;optional&quot;: true,
            &quot;innerType&quot;: {
              &quot;type&quot;: &quot;ZodString&quot;,
              &quot;description&quot;: null,
              &quot;_source&quot;: null,
              &quot;jsType&quot;: &quot;string&quot;
            }
          },
          &quot;type&quot;: {
            &quot;type&quot;: &quot;ZodOptional&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;optional&quot;: true,
            &quot;innerType&quot;: {
              &quot;type&quot;: &quot;ZodString&quot;,
              &quot;description&quot;: null,
              &quot;_source&quot;: null,
              &quot;jsType&quot;: &quot;string&quot;
            }
          },
          &quot;useWebSearch&quot;: {
            &quot;type&quot;: &quot;ZodOptional&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;optional&quot;: true,
            &quot;innerType&quot;: {
              &quot;type&quot;: &quot;ZodBoolean&quot;,
              &quot;description&quot;: null,
              &quot;_source&quot;: null,
              &quot;jsType&quot;: &quot;boolean&quot;
            }
          },
          &quot;webSearchPreference&quot;: {
            &quot;type&quot;: &quot;ZodOptional&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;optional&quot;: true,
            &quot;innerType&quot;: {
              &quot;type&quot;: &quot;ZodEnum&quot;,
              &quot;description&quot;: null,
              &quot;_source&quot;: null,
              &quot;jsType&quot;: &quot;enum&quot;,
              &quot;enum&quot;: [
                &quot;duckduckgo&quot;,
                &quot;mcp&quot;,
                &quot;ai-web-search&quot;,
                &quot;never&quot;
              ]
            }
          },
          &quot;maxWebSearches&quot;: {
            &quot;type&quot;: &quot;ZodOptional&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;optional&quot;: true,
            &quot;innerType&quot;: {
              &quot;type&quot;: &quot;ZodNumber&quot;,
              &quot;description&quot;: null,
              &quot;_source&quot;: null,
              &quot;jsType&quot;: &quot;number&quot;
            }
          },
          &quot;allowedDomains&quot;: {
            &quot;type&quot;: &quot;ZodOptional&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;optional&quot;: true,
            &quot;innerType&quot;: {
              &quot;type&quot;: &quot;ZodArray&quot;,
              &quot;description&quot;: null,
              &quot;_source&quot;: null,
              &quot;jsType&quot;: &quot;array&quot;,
              &quot;items&quot;: {
                &quot;type&quot;: &quot;String&quot;,
                &quot;description&quot;: null,
                &quot;_source&quot;: null
              }
            }
          },
          &quot;blockedDomains&quot;: {
            &quot;type&quot;: &quot;ZodOptional&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;optional&quot;: true,
            &quot;innerType&quot;: {
              &quot;type&quot;: &quot;ZodArray&quot;,
              &quot;description&quot;: null,
              &quot;_source&quot;: null,
              &quot;jsType&quot;: &quot;array&quot;,
              &quot;items&quot;: {
                &quot;type&quot;: &quot;String&quot;,
                &quot;description&quot;: null,
                &quot;_source&quot;: null
              }
            }
          }
        }
      }
    },
    &quot;options&quot;: {
      &quot;type&quot;: &quot;ZodOptional&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;optional&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodObject&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;object&quot;,
        &quot;properties&quot;: {
          &quot;model&quot;: {
            &quot;type&quot;: &quot;ZodOptional&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;optional&quot;: true,
            &quot;innerType&quot;: {
              &quot;type&quot;: &quot;ZodString&quot;,
              &quot;description&quot;: null,
              &quot;_source&quot;: null,
              &quot;jsType&quot;: &quot;string&quot;
            }
          },
          &quot;maxTokens&quot;: {
            &quot;type&quot;: &quot;ZodOptional&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;optional&quot;: true,
            &quot;innerType&quot;: {
              &quot;type&quot;: &quot;default&quot;,
              &quot;description&quot;: null,
              &quot;_source&quot;: null,
              &quot;hasDefault&quot;: true,
              &quot;innerType&quot;: {
                &quot;type&quot;: &quot;ZodNumber&quot;,
                &quot;description&quot;: null,
                &quot;_source&quot;: null,
                &quot;jsType&quot;: &quot;number&quot;
              }
            }
          },
          &quot;temperature&quot;: {
            &quot;type&quot;: &quot;ZodOptional&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;optional&quot;: true,
            &quot;innerType&quot;: {
              &quot;type&quot;: &quot;ZodNumber&quot;,
              &quot;description&quot;: null,
              &quot;_source&quot;: null,
              &quot;jsType&quot;: &quot;number&quot;
            }
          }
        }
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-ai-generatetext-output" aria-expanded="false" aria-controls="schema-ai-generatetext-output" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">success</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">boolean</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">data</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">any</span></span>
    </div>
    
    
    
  </li><li class="method-field method-field--has-children">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">tokenUsage</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">object</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    
    
    <div class="method-field__children"><ul class="method-field-list method-field-list--nested"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">tokensUsed</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">number</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">tokensCharged</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">number</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">platformFee</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">number</span><span class="method-badge method-badge--nullable">nullable</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">remainingBalance</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">number</span><span class="method-badge method-badge--nullable">nullable</span></span>
    </div>
    
    
    
  </li></ul></div>
  </li><li class="method-field method-field--has-children">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">usageInfo</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">object</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    
    
    <div class="method-field__children"><ul class="method-field-list method-field-list--nested"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">tokensUsed</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">number</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">estimatedCostUsd</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">number</span></span>
    </div>
    
    
    
  </li></ul></div>
  </li></ul>
    <div class="method-section__schema" id="schema-ai-generatetext-output" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;success&quot;: {
      &quot;type&quot;: &quot;ZodBoolean&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;boolean&quot;
    },
    &quot;data&quot;: {
      &quot;type&quot;: &quot;ZodAny&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;any&quot;
    },
    &quot;tokenUsage&quot;: {
      &quot;type&quot;: &quot;ZodOptional&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;optional&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodObject&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;object&quot;,
        &quot;properties&quot;: {
          &quot;tokensUsed&quot;: {
            &quot;type&quot;: &quot;ZodNumber&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;jsType&quot;: &quot;number&quot;
          },
          &quot;tokensCharged&quot;: {
            &quot;type&quot;: &quot;ZodNumber&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;jsType&quot;: &quot;number&quot;
          },
          &quot;platformFee&quot;: {
            &quot;type&quot;: &quot;ZodNullable&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;nullable&quot;: true,
            &quot;innerType&quot;: {
              &quot;type&quot;: &quot;ZodNumber&quot;,
              &quot;description&quot;: null,
              &quot;_source&quot;: null,
              &quot;jsType&quot;: &quot;number&quot;
            }
          },
          &quot;remainingBalance&quot;: {
            &quot;type&quot;: &quot;ZodNullable&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;nullable&quot;: true,
            &quot;innerType&quot;: {
              &quot;type&quot;: &quot;ZodNumber&quot;,
              &quot;description&quot;: null,
              &quot;_source&quot;: null,
              &quot;jsType&quot;: &quot;number&quot;
            }
          }
        }
      }
    },
    &quot;usageInfo&quot;: {
      &quot;type&quot;: &quot;ZodOptional&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;optional&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodObject&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;object&quot;,
        &quot;properties&quot;: {
          &quot;tokensUsed&quot;: {
            &quot;type&quot;: &quot;ZodNumber&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;jsType&quot;: &quot;number&quot;
          },
          &quot;estimatedCostUsd&quot;: {
            &quot;type&quot;: &quot;ZodNumber&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;jsType&quot;: &quot;number&quot;
          }
        }
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
</div>
<div class="method-card__examples"><details class="method-examples" markdown="1"><summary>Examples</summary>
{% highlight ts %}
const { data } = await client.ai.generateText.mutate({
content: 'Compose a friendly onboarding email for new engineers.',
systemPrompt: 'You are a helpful onboarding assistant.',
});
console.log(data.success, data.data?.usage?.totalTokens);
{% endhighlight %}
</details></div>
</div>
<div class="method-modal" id="modal-ai-generatetext" hidden role="dialog" aria-modal="true" aria-labelledby="modal-ai-generatetext-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-ai-generatetext" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-ai-generatetext-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-ai-generatetext" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-ai-generatetext-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-ai-generatetext-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;ai.generateText&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-ai-generatetext-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-ai-generatetext-trpc-code" data-lang="ts">const result = await client.ai.generateText.mutate({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## ai.getRegistryHealth

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">ai.getRegistryHealth</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/ai/methods/providers.ts#L102">src/trpc/routers/ai/methods/providers.ts:102</a></span></div></div>
<div class="method-card__summary">Retrieve the AI model registry health status.</div>
<div class="method-card__description"><p>Reports availability and summary metrics for the registry integration, falling back to error details when checks fail.</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-ai-getregistryhealth" aria-haspopup="dialog" aria-controls="modal-ai-getregistryhealth" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-ai-getregistryhealth-input" aria-expanded="false" aria-controls="schema-ai-getregistryhealth-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">No structured fields (void)</div>
    <div class="method-section__schema" id="schema-ai-getregistryhealth-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodVoid&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;void&quot;
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-ai-getregistryhealth" hidden role="dialog" aria-modal="true" aria-labelledby="modal-ai-getregistryhealth-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-ai-getregistryhealth" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-ai-getregistryhealth-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-ai-getregistryhealth" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-ai-getregistryhealth-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-ai-getregistryhealth-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;ai.getRegistryHealth&quot;,
      &quot;params&quot;: {},
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-ai-getregistryhealth-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-ai-getregistryhealth-trpc-code" data-lang="ts">const result = await client.ai.getRegistryHealth.query();
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## ai.listAllowedModels

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">ai.listAllowedModels</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/ai/methods/providers.ts#L65">src/trpc/routers/ai/methods/providers.ts:65</a></span></div></div>
<div class="method-card__summary">List allowed models for a provider (respects model restrictions)</div>
<div class="method-card__description"><p>List allowed models for a provider (respects model restrictions)
Returns production-ready model IDs that can be used directly with AI SDKs</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-ai-listallowedmodels" aria-haspopup="dialog" aria-controls="modal-ai-listallowedmodels" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-ai-listallowedmodels-input" aria-expanded="false" aria-controls="schema-ai-listallowedmodels-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">provider</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">enum</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    
    <div class="method-field__enum"><span class="method-field__label">Allowed values</span><div class="method-field__enum-items"><code>anthropic</code><code>openai</code><code>google</code><code>openrouter</code><code>huggingface</code></div></div>
    
  </li></ul>
    <div class="method-section__schema" id="schema-ai-listallowedmodels-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodOptional&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;optional&quot;: true,
  &quot;innerType&quot;: {
    &quot;type&quot;: &quot;ZodObject&quot;,
    &quot;description&quot;: null,
    &quot;_source&quot;: null,
    &quot;jsType&quot;: &quot;object&quot;,
    &quot;properties&quot;: {
      &quot;provider&quot;: {
        &quot;type&quot;: &quot;ZodOptional&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;optional&quot;: true,
        &quot;innerType&quot;: {
          &quot;type&quot;: &quot;ZodEnum&quot;,
          &quot;description&quot;: null,
          &quot;_source&quot;: null,
          &quot;jsType&quot;: &quot;enum&quot;,
          &quot;enum&quot;: [
            &quot;anthropic&quot;,
            &quot;openai&quot;,
            &quot;google&quot;,
            &quot;openrouter&quot;,
            &quot;huggingface&quot;
          ]
        }
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-ai-listallowedmodels" hidden role="dialog" aria-modal="true" aria-labelledby="modal-ai-listallowedmodels-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-ai-listallowedmodels" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-ai-listallowedmodels-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-ai-listallowedmodels" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-ai-listallowedmodels-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-ai-listallowedmodels-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;ai.listAllowedModels&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-ai-listallowedmodels-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-ai-listallowedmodels-trpc-code" data-lang="ts">const result = await client.ai.listAllowedModels.query({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## ai.listProviders

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">ai.listProviders</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/ai/methods/providers.ts#L17">src/trpc/routers/ai/methods/providers.ts:17</a></span></div></div>
<div class="method-card__summary">List available AI service providers.</div>
<div class="method-card__description"><p>Returns the providers currently registered in the model registry along with metadata about the registry source.</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-ai-listproviders" aria-haspopup="dialog" aria-controls="modal-ai-listproviders" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-ai-listproviders-input" aria-expanded="false" aria-controls="schema-ai-listproviders-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">No structured fields (void)</div>
    <div class="method-section__schema" id="schema-ai-listproviders-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodVoid&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;void&quot;
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-ai-listproviders" hidden role="dialog" aria-modal="true" aria-labelledby="modal-ai-listproviders-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-ai-listproviders" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-ai-listproviders-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-ai-listproviders" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-ai-listproviders-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-ai-listproviders-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;ai.listProviders&quot;,
      &quot;params&quot;: {},
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-ai-listproviders-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-ai-listproviders-trpc-code" data-lang="ts">const result = await client.ai.listProviders.query();
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## ai.listProvidersBYOK

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">ai.listProvidersBYOK</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/ai/methods/providers.ts#L41">src/trpc/routers/ai/methods/providers.ts:41</a></span></div></div>
<div class="method-card__summary">List available BYOK (Bring Your Own Key) providers.</div>
<div class="method-card__description"><p>Filters the provider catalog to only those eligible for user-supplied API keys.</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-ai-listprovidersbyok" aria-haspopup="dialog" aria-controls="modal-ai-listprovidersbyok" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-ai-listprovidersbyok-input" aria-expanded="false" aria-controls="schema-ai-listprovidersbyok-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">No structured fields (void)</div>
    <div class="method-section__schema" id="schema-ai-listprovidersbyok-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodVoid&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;void&quot;
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-ai-listprovidersbyok" hidden role="dialog" aria-modal="true" aria-labelledby="modal-ai-listprovidersbyok-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-ai-listprovidersbyok" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-ai-listprovidersbyok-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-ai-listprovidersbyok" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-ai-listprovidersbyok-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-ai-listprovidersbyok-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;ai.listProvidersBYOK&quot;,
      &quot;params&quot;: {},
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-ai-listprovidersbyok-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-ai-listprovidersbyok-trpc-code" data-lang="ts">const result = await client.ai.listProvidersBYOK.query();
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## ai.validateProvider

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-mutation">MUTATION</span><code class="method-card__method">ai.validateProvider</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/ai/methods/providers.ts#L143">src/trpc/routers/ai/methods/providers.ts:143</a></span></div></div>
<div class="method-card__summary">Validate AI provider configuration.</div>
<div class="method-card__description"><p>Performs lightweight API key validation for supported providers to catch obvious misconfigurations.</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-ai-validateprovider" aria-haspopup="dialog" aria-controls="modal-ai-validateprovider" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-ai-validateprovider-input" aria-expanded="false" aria-controls="schema-ai-validateprovider-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">provider</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">enum</span></span>
    </div>
    
    <div class="method-field__enum"><span class="method-field__label">Allowed values</span><div class="method-field__enum-items"><code>anthropic</code><code>openai</code><code>google</code><code>openrouter</code><code>huggingface</code></div></div>
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">apiKey</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-ai-validateprovider-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;provider&quot;: {
      &quot;type&quot;: &quot;ZodEnum&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;enum&quot;,
      &quot;enum&quot;: [
        &quot;anthropic&quot;,
        &quot;openai&quot;,
        &quot;google&quot;,
        &quot;openrouter&quot;,
        &quot;huggingface&quot;
      ]
    },
    &quot;apiKey&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-ai-validateprovider" hidden role="dialog" aria-modal="true" aria-labelledby="modal-ai-validateprovider-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-ai-validateprovider" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-ai-validateprovider-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-ai-validateprovider" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-ai-validateprovider-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-ai-validateprovider-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;ai.validateProvider&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-ai-validateprovider-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-ai-validateprovider-trpc-code" data-lang="ts">const result = await client.ai.validateProvider.mutate({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

<h2 id="namespace-mcp">Namespace mcp</h2>

## mcp.apiDocumentationPrompt

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">mcp.apiDocumentationPrompt</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/mcp/methods/prompt.ts#L89">src/trpc/routers/mcp/methods/prompt.ts:89</a></span></div></div>
<div class="method-card__description"><p>Generate comprehensive API documentation from code</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-mcp-apidocumentationprompt" aria-haspopup="dialog" aria-controls="modal-mcp-apidocumentationprompt" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-mcp-apidocumentationprompt-input" aria-expanded="false" aria-controls="schema-mcp-apidocumentationprompt-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">code</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    <div class="method-field__description">API code to document</div>
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">format</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">enum</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    <div class="method-field__description">Output format</div>
    <div class="method-field__enum"><span class="method-field__label">Allowed values</span><div class="method-field__enum-items"><code>markdown</code><code>openapi</code><code>json</code></div></div>
    
  </li></ul>
    <div class="method-section__schema" id="schema-mcp-apidocumentationprompt-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;code&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: &quot;API code to document&quot;,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;format&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: &quot;Output format&quot;,
      &quot;_source&quot;: null,
      &quot;hasDefault&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodEnum&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;enum&quot;,
        &quot;enum&quot;: [
          &quot;markdown&quot;,
          &quot;openapi&quot;,
          &quot;json&quot;
        ]
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-mcp-apidocumentationprompt" hidden role="dialog" aria-modal="true" aria-labelledby="modal-mcp-apidocumentationprompt-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-mcp-apidocumentationprompt" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-mcp-apidocumentationprompt-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-mcp-apidocumentationprompt" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-mcp-apidocumentationprompt-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-mcp-apidocumentationprompt-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;mcp.apiDocumentationPrompt&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-mcp-apidocumentationprompt-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-mcp-apidocumentationprompt-trpc-code" data-lang="ts">const result = await client.mcp.apiDocumentationPrompt.query({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## mcp.codeReviewPrompt

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">mcp.codeReviewPrompt</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/mcp/methods/prompt.ts#L19">src/trpc/routers/mcp/methods/prompt.ts:19</a></span></div></div>
<div class="method-card__description"><p>Comprehensive code review with security, performance, and maintainability analysis</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-mcp-codereviewprompt" aria-haspopup="dialog" aria-controls="modal-mcp-codereviewprompt" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-mcp-codereviewprompt-input" aria-expanded="false" aria-controls="schema-mcp-codereviewprompt-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">code</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    <div class="method-field__description">Code to review</div>
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">language</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    <div class="method-field__description">Programming language</div>
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">focusArea</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    <div class="method-field__description">Focus area</div>
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-mcp-codereviewprompt-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;code&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: &quot;Code to review&quot;,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;language&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: &quot;Programming language&quot;,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;focusArea&quot;: {
      &quot;type&quot;: &quot;ZodOptional&quot;,
      &quot;description&quot;: &quot;Focus area&quot;,
      &quot;_source&quot;: null,
      &quot;optional&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodString&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;string&quot;
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-mcp-codereviewprompt" hidden role="dialog" aria-modal="true" aria-labelledby="modal-mcp-codereviewprompt-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-mcp-codereviewprompt" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-mcp-codereviewprompt-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-mcp-codereviewprompt" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-mcp-codereviewprompt-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-mcp-codereviewprompt-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;mcp.codeReviewPrompt&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-mcp-codereviewprompt-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-mcp-codereviewprompt-trpc-code" data-lang="ts">const result = await client.mcp.codeReviewPrompt.query({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## mcp.currentSystemTime

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">mcp.currentSystemTime</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/mcp/methods/utility.ts#L50">src/trpc/routers/mcp/methods/utility.ts:50</a></span></div></div>
<div class="method-card__description"><p>Get the current system time</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-mcp-currentsystemtime" aria-haspopup="dialog" aria-controls="modal-mcp-currentsystemtime" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-mcp-currentsystemtime-input" aria-expanded="false" aria-controls="schema-mcp-currentsystemtime-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">format</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">enum</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    <div class="method-field__description">Time format</div>
    <div class="method-field__enum"><span class="method-field__label">Allowed values</span><div class="method-field__enum-items"><code>iso</code><code>timestamp</code><code>locale</code></div></div>
    
  </li></ul>
    <div class="method-section__schema" id="schema-mcp-currentsystemtime-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;format&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: &quot;Time format&quot;,
      &quot;_source&quot;: null,
      &quot;hasDefault&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodEnum&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;enum&quot;,
        &quot;enum&quot;: [
          &quot;iso&quot;,
          &quot;timestamp&quot;,
          &quot;locale&quot;
        ]
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-mcp-currentsystemtime" hidden role="dialog" aria-modal="true" aria-labelledby="modal-mcp-currentsystemtime-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-mcp-currentsystemtime" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-mcp-currentsystemtime-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-mcp-currentsystemtime" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-mcp-currentsystemtime-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-mcp-currentsystemtime-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;mcp.currentSystemTime&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-mcp-currentsystemtime-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-mcp-currentsystemtime-trpc-code" data-lang="ts">const result = await client.mcp.currentSystemTime.query({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## mcp.echo

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">mcp.echo</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/mcp/methods/utility.ts#L36">src/trpc/routers/mcp/methods/utility.ts:36</a></span></div></div>
<div class="method-card__description"><p>Echo back a message</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-mcp-echo" aria-haspopup="dialog" aria-controls="modal-mcp-echo" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-mcp-echo-input" aria-expanded="false" aria-controls="schema-mcp-echo-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">message</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    <div class="method-field__description">Message to echo back</div>
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-mcp-echo-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;message&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: &quot;Message to echo back&quot;,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-mcp-echo" hidden role="dialog" aria-modal="true" aria-labelledby="modal-mcp-echo-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-mcp-echo" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-mcp-echo-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-mcp-echo" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-mcp-echo-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-mcp-echo-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;mcp.echo&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-mcp-echo-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-mcp-echo-trpc-code" data-lang="ts">const result = await client.mcp.echo.query({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## mcp.explainConceptPrompt

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">mcp.explainConceptPrompt</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/mcp/methods/prompt.ts#L152">src/trpc/routers/mcp/methods/prompt.ts:152</a></span></div></div>
<div class="method-card__description"><p>Explain technical concepts clearly at different skill levels</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-mcp-explainconceptprompt" aria-haspopup="dialog" aria-controls="modal-mcp-explainconceptprompt" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-mcp-explainconceptprompt-input" aria-expanded="false" aria-controls="schema-mcp-explainconceptprompt-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">concept</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    <div class="method-field__description">Concept to explain</div>
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">level</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">enum</span></span>
    </div>
    <div class="method-field__description">Skill level</div>
    <div class="method-field__enum"><span class="method-field__label">Allowed values</span><div class="method-field__enum-items"><code>beginner</code><code>intermediate</code><code>advanced</code></div></div>
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">includeExamples</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">enum</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    <div class="method-field__description">Include examples</div>
    <div class="method-field__enum"><span class="method-field__label">Allowed values</span><div class="method-field__enum-items"><code>yes</code><code>no</code></div></div>
    
  </li></ul>
    <div class="method-section__schema" id="schema-mcp-explainconceptprompt-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;concept&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: &quot;Concept to explain&quot;,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;level&quot;: {
      &quot;type&quot;: &quot;ZodEnum&quot;,
      &quot;description&quot;: &quot;Skill level&quot;,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;enum&quot;,
      &quot;enum&quot;: [
        &quot;beginner&quot;,
        &quot;intermediate&quot;,
        &quot;advanced&quot;
      ]
    },
    &quot;includeExamples&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: &quot;Include examples&quot;,
      &quot;_source&quot;: null,
      &quot;hasDefault&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodEnum&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;enum&quot;,
        &quot;enum&quot;: [
          &quot;yes&quot;,
          &quot;no&quot;
        ]
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-mcp-explainconceptprompt" hidden role="dialog" aria-modal="true" aria-labelledby="modal-mcp-explainconceptprompt-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-mcp-explainconceptprompt" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-mcp-explainconceptprompt-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-mcp-explainconceptprompt" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-mcp-explainconceptprompt-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-mcp-explainconceptprompt-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;mcp.explainConceptPrompt&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-mcp-explainconceptprompt-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-mcp-explainconceptprompt-trpc-code" data-lang="ts">const result = await client.mcp.explainConceptPrompt.query({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## mcp.getResources

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">mcp.getResources</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/mcp/methods/resource.ts#L12">src/trpc/routers/mcp/methods/resource.ts:12</a></span></div></div>
<div class="method-card__summary">List MCP resources</div>
<div class="method-card__description"><p>List available MCP resources with metadata</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-mcp-getresources" aria-haspopup="dialog" aria-controls="modal-mcp-getresources" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-mcp-getresources-input" aria-expanded="false" aria-controls="schema-mcp-getresources-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">category</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    <div class="method-field__description">Filter resources by category</div>
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">search</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    <div class="method-field__description">Search resources by name or description</div>
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-mcp-getresources-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;category&quot;: {
      &quot;type&quot;: &quot;ZodOptional&quot;,
      &quot;description&quot;: &quot;Filter resources by category&quot;,
      &quot;_source&quot;: null,
      &quot;optional&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodString&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;string&quot;
      }
    },
    &quot;search&quot;: {
      &quot;type&quot;: &quot;ZodOptional&quot;,
      &quot;description&quot;: &quot;Search resources by name or description&quot;,
      &quot;_source&quot;: null,
      &quot;optional&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodString&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;string&quot;
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-mcp-getresources-output" aria-expanded="false" aria-controls="schema-mcp-getresources-output" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">resources</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">array</span><span class="method-badge method-badge--meta">array</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">total</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">number</span></span>
    </div>
    
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-mcp-getresources-output" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;resources&quot;: {
      &quot;type&quot;: &quot;ZodArray&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;array&quot;,
      &quot;items&quot;: {
        &quot;type&quot;: &quot;String&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null
      }
    },
    &quot;total&quot;: {
      &quot;type&quot;: &quot;ZodNumber&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;number&quot;
    }
  }
}</code></pre></div>
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-mcp-getresources" hidden role="dialog" aria-modal="true" aria-labelledby="modal-mcp-getresources-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-mcp-getresources" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-mcp-getresources-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-mcp-getresources" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-mcp-getresources-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-mcp-getresources-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;mcp.getResources&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-mcp-getresources-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-mcp-getresources-trpc-code" data-lang="ts">const result = await client.mcp.getResources.query({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## mcp.greeting

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">mcp.greeting</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/mcp/methods/utility.ts#L15">src/trpc/routers/mcp/methods/utility.ts:15</a></span></div></div>
<div class="method-card__description"><p>Generate a friendly greeting in the specified language</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-mcp-greeting" aria-haspopup="dialog" aria-controls="modal-mcp-greeting" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-mcp-greeting-input" aria-expanded="false" aria-controls="schema-mcp-greeting-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">name</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    <div class="method-field__description">Name to greet</div>
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">language</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">enum</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    <div class="method-field__description">Language for the greeting</div>
    <div class="method-field__enum"><span class="method-field__label">Allowed values</span><div class="method-field__enum-items"><code>en</code><code>es</code><code>fr</code><code>de</code></div></div>
    
  </li></ul>
    <div class="method-section__schema" id="schema-mcp-greeting-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;name&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: &quot;Name to greet&quot;,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;language&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: &quot;Language for the greeting&quot;,
      &quot;_source&quot;: null,
      &quot;hasDefault&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodEnum&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;enum&quot;,
        &quot;enum&quot;: [
          &quot;en&quot;,
          &quot;es&quot;,
          &quot;fr&quot;,
          &quot;de&quot;
        ]
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-mcp-greeting" hidden role="dialog" aria-modal="true" aria-labelledby="modal-mcp-greeting-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-mcp-greeting" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-mcp-greeting-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-mcp-greeting" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-mcp-greeting-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-mcp-greeting-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;mcp.greeting&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-mcp-greeting-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-mcp-greeting-trpc-code" data-lang="ts">const result = await client.mcp.greeting.query({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## mcp.incidentResponsePrompt

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">mcp.incidentResponsePrompt</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/mcp/methods/prompt.ts#L235">src/trpc/routers/mcp/methods/prompt.ts:235</a></span></div></div>
<div class="method-card__description"><p>Guide incident response procedures and provide action steps</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-mcp-incidentresponseprompt" aria-haspopup="dialog" aria-controls="modal-mcp-incidentresponseprompt" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-mcp-incidentresponseprompt-input" aria-expanded="false" aria-controls="schema-mcp-incidentresponseprompt-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">description</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    <div class="method-field__description">Incident description</div>
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">severity</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">enum</span></span>
    </div>
    <div class="method-field__description">Severity level</div>
    <div class="method-field__enum"><span class="method-field__label">Allowed values</span><div class="method-field__enum-items"><code>critical</code><code>high</code><code>medium</code><code>low</code></div></div>
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">status</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    <div class="method-field__description">Current status</div>
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-mcp-incidentresponseprompt-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;description&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: &quot;Incident description&quot;,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;severity&quot;: {
      &quot;type&quot;: &quot;ZodEnum&quot;,
      &quot;description&quot;: &quot;Severity level&quot;,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;enum&quot;,
      &quot;enum&quot;: [
        &quot;critical&quot;,
        &quot;high&quot;,
        &quot;medium&quot;,
        &quot;low&quot;
      ]
    },
    &quot;status&quot;: {
      &quot;type&quot;: &quot;ZodOptional&quot;,
      &quot;description&quot;: &quot;Current status&quot;,
      &quot;_source&quot;: null,
      &quot;optional&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodString&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;string&quot;
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-mcp-incidentresponseprompt" hidden role="dialog" aria-modal="true" aria-labelledby="modal-mcp-incidentresponseprompt-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-mcp-incidentresponseprompt" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-mcp-incidentresponseprompt-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-mcp-incidentresponseprompt" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-mcp-incidentresponseprompt-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-mcp-incidentresponseprompt-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;mcp.incidentResponsePrompt&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-mcp-incidentresponseprompt-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-mcp-incidentresponseprompt-trpc-code" data-lang="ts">const result = await client.mcp.incidentResponsePrompt.query({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## mcp.readResource

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">mcp.readResource</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/mcp/methods/resource.ts#L114">src/trpc/routers/mcp/methods/resource.ts:114</a></span></div></div>
<div class="method-card__summary">Read resource content</div>
<div class="method-card__description"><p>Read the content of a specific MCP resource</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-mcp-readresource" aria-haspopup="dialog" aria-controls="modal-mcp-readresource" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-mcp-readresource-input" aria-expanded="false" aria-controls="schema-mcp-readresource-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">uri</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    <div class="method-field__description">URI of the resource to read</div>
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-mcp-readresource-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;uri&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: &quot;URI of the resource to read&quot;,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-mcp-readresource-output" aria-expanded="false" aria-controls="schema-mcp-readresource-output" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">content</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">any</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">mimeType</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">uri</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-mcp-readresource-output" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;content&quot;: {
      &quot;type&quot;: &quot;ZodAny&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;any&quot;
    },
    &quot;mimeType&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;uri&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    }
  }
}</code></pre></div>
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-mcp-readresource" hidden role="dialog" aria-modal="true" aria-labelledby="modal-mcp-readresource-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-mcp-readresource" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-mcp-readresource-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-mcp-readresource" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-mcp-readresource-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-mcp-readresource-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;mcp.readResource&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-mcp-readresource-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-mcp-readresource-trpc-code" data-lang="ts">const result = await client.mcp.readResource.query({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

<h2 id="namespace-admin">Namespace admin</h2>

## admin.clearCache

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-mutation">MUTATION</span><code class="method-card__method">admin.clearCache</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/admin/index.ts#L346">src/trpc/routers/admin/index.ts:346</a></span></div></div>
<div class="method-card__summary">Clear caches and reset services</div>
<div class="method-card__description"><p>Clear caches and reset services</p><p>Clear system caches and reset services</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-admin-clearcache" aria-haspopup="dialog" aria-controls="modal-admin-clearcache" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-admin-clearcache-input" aria-expanded="false" aria-controls="schema-admin-clearcache-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">target</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">enum</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    
    <div class="method-field__enum"><span class="method-field__label">Allowed values</span><div class="method-field__enum-items"><code>all</code><code>memory</code><code>tokens</code><code>usage</code></div></div>
    
  </li></ul>
    <div class="method-section__schema" id="schema-admin-clearcache-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;target&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;hasDefault&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodEnum&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;enum&quot;,
        &quot;enum&quot;: [
          &quot;all&quot;,
          &quot;memory&quot;,
          &quot;tokens&quot;,
          &quot;usage&quot;
        ]
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-admin-clearcache" hidden role="dialog" aria-modal="true" aria-labelledby="modal-admin-clearcache-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-admin-clearcache" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-admin-clearcache-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-admin-clearcache" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-admin-clearcache-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-admin-clearcache-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;admin.clearCache&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-admin-clearcache-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-admin-clearcache-trpc-code" data-lang="ts">const result = await client.admin.clearCache.mutate({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## admin.getConfig

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">admin.getConfig</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/admin/index.ts#L235">src/trpc/routers/admin/index.ts:235</a></span></div></div>
<div class="method-card__summary">System configuration management</div>
<div class="method-card__description"><p>System configuration management</p><p>Get current system configuration</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-admin-getconfig" aria-haspopup="dialog" aria-controls="modal-admin-getconfig" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-admin-getconfig-input" aria-expanded="false" aria-controls="schema-admin-getconfig-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">section</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">enum</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    
    <div class="method-field__enum"><span class="method-field__label">Allowed values</span><div class="method-field__enum-items"><code>all</code><code>server</code><code>auth</code><code>ai</code><code>billing</code></div></div>
    
  </li></ul>
    <div class="method-section__schema" id="schema-admin-getconfig-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;section&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;hasDefault&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodEnum&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;enum&quot;,
        &quot;enum&quot;: [
          &quot;all&quot;,
          &quot;server&quot;,
          &quot;auth&quot;,
          &quot;ai&quot;,
          &quot;billing&quot;
        ]
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-admin-getconfig" hidden role="dialog" aria-modal="true" aria-labelledby="modal-admin-getconfig-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-admin-getconfig" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-admin-getconfig-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-admin-getconfig" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-admin-getconfig-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-admin-getconfig-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;admin.getConfig&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-admin-getconfig-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-admin-getconfig-trpc-code" data-lang="ts">const result = await client.admin.getConfig.query({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## admin.getUserInfo

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">admin.getUserInfo</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/admin/index.ts#L192">src/trpc/routers/admin/index.ts:192</a></span></div></div>
<div class="method-card__summary">Get user information (admin only)</div>
<div class="method-card__description"><p>Get user information (admin only)</p><p>Get detailed user information and permissions</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-admin-getuserinfo" aria-haspopup="dialog" aria-controls="modal-admin-getuserinfo" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-admin-getuserinfo-input" aria-expanded="false" aria-controls="schema-admin-getuserinfo-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">userId</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    <div class="method-field__description">User ID to lookup</div>
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">includePermissions</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">boolean</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    <div class="method-field__description">Include detailed permissions</div>
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">includeUsage</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">boolean</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    <div class="method-field__description">Include usage statistics</div>
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-admin-getuserinfo-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;userId&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: &quot;User ID to lookup&quot;,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;includePermissions&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: &quot;Include detailed permissions&quot;,
      &quot;_source&quot;: null,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodBoolean&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;boolean&quot;
      }
    },
    &quot;includeUsage&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: &quot;Include usage statistics&quot;,
      &quot;_source&quot;: null,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodBoolean&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;boolean&quot;
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-admin-getuserinfo" hidden role="dialog" aria-modal="true" aria-labelledby="modal-admin-getuserinfo-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-admin-getuserinfo" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-admin-getuserinfo-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-admin-getuserinfo" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-admin-getuserinfo-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-admin-getuserinfo-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;admin.getUserInfo&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-admin-getuserinfo-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-admin-getuserinfo-trpc-code" data-lang="ts">const result = await client.admin.getUserInfo.query({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## admin.healthCheck

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">admin.healthCheck</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/admin/index.ts#L295">src/trpc/routers/admin/index.ts:295</a></span></div></div>
<div class="method-card__summary">System health checks</div>
<div class="method-card__description"><p>System health checks</p><p>Run comprehensive health checks on all services</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-admin-healthcheck" aria-haspopup="dialog" aria-controls="modal-admin-healthcheck" title="Invocation examples">⚡</button></div>
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-admin-healthcheck" hidden role="dialog" aria-modal="true" aria-labelledby="modal-admin-healthcheck-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-admin-healthcheck" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-admin-healthcheck-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-admin-healthcheck" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-admin-healthcheck-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-admin-healthcheck-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;admin.healthCheck&quot;,
      &quot;params&quot;: {},
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-admin-healthcheck-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-admin-healthcheck-trpc-code" data-lang="ts">const result = await client.admin.healthCheck.query();
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## admin.statistics

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">admin.statistics</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/admin/index.ts#L128">src/trpc/routers/admin/index.ts:128</a></span></div></div>
<div class="method-card__summary">Get system statistics</div>
<div class="method-card__description"><p>Get system statistics</p><p>Get detailed system statistics and metrics</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-admin-statistics" aria-haspopup="dialog" aria-controls="modal-admin-statistics" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-admin-statistics-input" aria-expanded="false" aria-controls="schema-admin-statistics-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">days</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">number</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    <div class="method-field__description">Number of days for statistics</div>
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-admin-statistics-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;days&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: &quot;Number of days for statistics&quot;,
      &quot;_source&quot;: null,
      &quot;hasDefault&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodNumber&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;number&quot;
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-admin-statistics" hidden role="dialog" aria-modal="true" aria-labelledby="modal-admin-statistics-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-admin-statistics" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-admin-statistics-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-admin-statistics" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-admin-statistics-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-admin-statistics-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;admin.statistics&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-admin-statistics-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-admin-statistics-trpc-code" data-lang="ts">const result = await client.admin.statistics.query({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## admin.status

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">admin.status</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/admin/index.ts#L65">src/trpc/routers/admin/index.ts:65</a></span></div></div>
<div class="method-card__summary">Server status with detailed information</div>
<div class="method-card__description"><p>Server status with detailed information</p><p>Get detailed server status and health information</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-admin-status" aria-haspopup="dialog" aria-controls="modal-admin-status" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-admin-status-input" aria-expanded="false" aria-controls="schema-admin-status-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">detailed</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">boolean</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    <div class="method-field__description">Include detailed system information</div>
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-admin-status-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;detailed&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: &quot;Include detailed system information&quot;,
      &quot;_source&quot;: null,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodBoolean&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;boolean&quot;
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-admin-status-output" aria-expanded="false" aria-controls="schema-admin-status-output" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">status</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">uptime</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">number</span></span>
    </div>
    
    
    
  </li><li class="method-field method-field--has-children">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">memory</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">object</span></span>
    </div>
    
    
    <div class="method-field__children"><ul class="method-field-list method-field-list--nested"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">used</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">number</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">total</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">number</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">percentage</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">number</span></span>
    </div>
    
    
    
  </li></ul></div>
  </li><li class="method-field method-field--has-children">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">system</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">object</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    
    
    <div class="method-field__children"><ul class="method-field-list method-field-list--nested"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">platform</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">arch</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">nodeVersion</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li></ul></div>
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">timestamp</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-admin-status-output" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;status&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;uptime&quot;: {
      &quot;type&quot;: &quot;ZodNumber&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;number&quot;
    },
    &quot;memory&quot;: {
      &quot;type&quot;: &quot;ZodObject&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;object&quot;,
      &quot;properties&quot;: {
        &quot;used&quot;: {
          &quot;type&quot;: &quot;ZodNumber&quot;,
          &quot;description&quot;: null,
          &quot;_source&quot;: null,
          &quot;jsType&quot;: &quot;number&quot;
        },
        &quot;total&quot;: {
          &quot;type&quot;: &quot;ZodNumber&quot;,
          &quot;description&quot;: null,
          &quot;_source&quot;: null,
          &quot;jsType&quot;: &quot;number&quot;
        },
        &quot;percentage&quot;: {
          &quot;type&quot;: &quot;ZodNumber&quot;,
          &quot;description&quot;: null,
          &quot;_source&quot;: null,
          &quot;jsType&quot;: &quot;number&quot;
        }
      }
    },
    &quot;system&quot;: {
      &quot;type&quot;: &quot;ZodOptional&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;optional&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodObject&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;object&quot;,
        &quot;properties&quot;: {
          &quot;platform&quot;: {
            &quot;type&quot;: &quot;ZodString&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;jsType&quot;: &quot;string&quot;
          },
          &quot;arch&quot;: {
            &quot;type&quot;: &quot;ZodString&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;jsType&quot;: &quot;string&quot;
          },
          &quot;nodeVersion&quot;: {
            &quot;type&quot;: &quot;ZodString&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;jsType&quot;: &quot;string&quot;
          }
        }
      }
    },
    &quot;timestamp&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    }
  }
}</code></pre></div>
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-admin-status" hidden role="dialog" aria-modal="true" aria-labelledby="modal-admin-status-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-admin-status" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-admin-status-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-admin-status" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-admin-status-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-admin-status-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;admin.status&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-admin-status-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-admin-status-trpc-code" data-lang="ts">const result = await client.admin.status.query({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

<h2 id="namespace-auth">Namespace auth</h2>

## auth.deleteUserKey

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-mutation">MUTATION</span><code class="method-card__method">auth.deleteUserKey</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Auth required</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/auth/index.ts#L199">src/trpc/routers/auth/index.ts:199</a></span></div></div>
<div class="method-card__summary">Delete user API key</div>
<div class="method-card__description"><p>Delete user API key</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-auth-deleteuserkey" aria-haspopup="dialog" aria-controls="modal-auth-deleteuserkey" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-auth-deleteuserkey-input" aria-expanded="false" aria-controls="schema-auth-deleteuserkey-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">email</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">provider</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">enum</span></span>
    </div>
    
    <div class="method-field__enum"><span class="method-field__label">Allowed values</span><div class="method-field__enum-items"><code>anthropic</code><code>openai</code><code>google</code></div></div>
    
  </li></ul>
    <div class="method-section__schema" id="schema-auth-deleteuserkey-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;email&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;provider&quot;: {
      &quot;type&quot;: &quot;ZodEnum&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;enum&quot;,
      &quot;enum&quot;: [
        &quot;anthropic&quot;,
        &quot;openai&quot;,
        &quot;google&quot;
      ]
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-auth-deleteuserkey" hidden role="dialog" aria-modal="true" aria-labelledby="modal-auth-deleteuserkey-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-auth-deleteuserkey" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-auth-deleteuserkey-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-auth-deleteuserkey" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-auth-deleteuserkey-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-auth-deleteuserkey-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;auth.deleteUserKey&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-auth-deleteuserkey-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-auth-deleteuserkey-trpc-code" data-lang="ts">const result = await client.auth.deleteUserKey.mutate({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## auth.getUserKey

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">auth.getUserKey</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Auth required</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/auth/index.ts#L52">src/trpc/routers/auth/index.ts:52</a></span></div></div>
<div class="method-card__summary">Get user API key status (without exposing the key)</div>
<div class="method-card__description"><p>Get user API key status (without exposing the key)</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-auth-getuserkey" aria-haspopup="dialog" aria-controls="modal-auth-getuserkey" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-auth-getuserkey-input" aria-expanded="false" aria-controls="schema-auth-getuserkey-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">email</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">provider</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">enum</span></span>
    </div>
    
    <div class="method-field__enum"><span class="method-field__label">Allowed values</span><div class="method-field__enum-items"><code>anthropic</code><code>openai</code><code>google</code></div></div>
    
  </li></ul>
    <div class="method-section__schema" id="schema-auth-getuserkey-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;email&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;provider&quot;: {
      &quot;type&quot;: &quot;ZodEnum&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;enum&quot;,
      &quot;enum&quot;: [
        &quot;anthropic&quot;,
        &quot;openai&quot;,
        &quot;google&quot;
      ]
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-auth-getuserkey" hidden role="dialog" aria-modal="true" aria-labelledby="modal-auth-getuserkey-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-auth-getuserkey" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-auth-getuserkey-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-auth-getuserkey" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-auth-getuserkey-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-auth-getuserkey-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;auth.getUserKey&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-auth-getuserkey-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-auth-getuserkey-trpc-code" data-lang="ts">const result = await client.auth.getUserKey.query({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## auth.getUserProviders

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">auth.getUserProviders</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Auth required</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/auth/index.ts#L90">src/trpc/routers/auth/index.ts:90</a></span></div></div>
<div class="method-card__summary">Get all configured providers for a user</div>
<div class="method-card__description"><p>Get all configured providers for a user</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-auth-getuserproviders" aria-haspopup="dialog" aria-controls="modal-auth-getuserproviders" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-auth-getuserproviders-input" aria-expanded="false" aria-controls="schema-auth-getuserproviders-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">email</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-auth-getuserproviders-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;email&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-auth-getuserproviders" hidden role="dialog" aria-modal="true" aria-labelledby="modal-auth-getuserproviders-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-auth-getuserproviders" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-auth-getuserproviders-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-auth-getuserproviders" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-auth-getuserproviders-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-auth-getuserproviders-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;auth.getUserProviders&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-auth-getuserproviders-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-auth-getuserproviders-trpc-code" data-lang="ts">const result = await client.auth.getUserProviders.query({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## auth.rotateUserKey

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-mutation">MUTATION</span><code class="method-card__method">auth.rotateUserKey</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Auth required</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/auth/index.ts#L162">src/trpc/routers/auth/index.ts:162</a></span></div></div>
<div class="method-card__summary">Rotate (update) user API key</div>
<div class="method-card__description"><p>Rotate (update) user API key</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-auth-rotateuserkey" aria-haspopup="dialog" aria-controls="modal-auth-rotateuserkey" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-auth-rotateuserkey-input" aria-expanded="false" aria-controls="schema-auth-rotateuserkey-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">email</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">provider</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">enum</span></span>
    </div>
    
    <div class="method-field__enum"><span class="method-field__label">Allowed values</span><div class="method-field__enum-items"><code>anthropic</code><code>openai</code><code>google</code></div></div>
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">newApiKey</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-auth-rotateuserkey-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;email&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;provider&quot;: {
      &quot;type&quot;: &quot;ZodEnum&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;enum&quot;,
      &quot;enum&quot;: [
        &quot;anthropic&quot;,
        &quot;openai&quot;,
        &quot;google&quot;
      ]
    },
    &quot;newApiKey&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-auth-rotateuserkey" hidden role="dialog" aria-modal="true" aria-labelledby="modal-auth-rotateuserkey-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-auth-rotateuserkey" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-auth-rotateuserkey-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-auth-rotateuserkey" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-auth-rotateuserkey-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-auth-rotateuserkey-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;auth.rotateUserKey&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-auth-rotateuserkey-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-auth-rotateuserkey-trpc-code" data-lang="ts">const result = await client.auth.rotateUserKey.mutate({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## auth.storeUserKey

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-mutation">MUTATION</span><code class="method-card__method">auth.storeUserKey</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Auth required</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/auth/index.ts#L15">src/trpc/routers/auth/index.ts:15</a></span></div></div>
<div class="method-card__summary">Store user API key (BYOK)</div>
<div class="method-card__description"><p>Store user API key (BYOK)</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-auth-storeuserkey" aria-haspopup="dialog" aria-controls="modal-auth-storeuserkey" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-auth-storeuserkey-input" aria-expanded="false" aria-controls="schema-auth-storeuserkey-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">email</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">provider</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">enum</span></span>
    </div>
    
    <div class="method-field__enum"><span class="method-field__label">Allowed values</span><div class="method-field__enum-items"><code>anthropic</code><code>openai</code><code>google</code></div></div>
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">apiKey</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-auth-storeuserkey-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;email&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;provider&quot;: {
      &quot;type&quot;: &quot;ZodEnum&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;enum&quot;,
      &quot;enum&quot;: [
        &quot;anthropic&quot;,
        &quot;openai&quot;,
        &quot;google&quot;
      ]
    },
    &quot;apiKey&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-auth-storeuserkey" hidden role="dialog" aria-modal="true" aria-labelledby="modal-auth-storeuserkey-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-auth-storeuserkey" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-auth-storeuserkey-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-auth-storeuserkey" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-auth-storeuserkey-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-auth-storeuserkey-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;auth.storeUserKey&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-auth-storeuserkey-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-auth-storeuserkey-trpc-code" data-lang="ts">const result = await client.auth.storeUserKey.mutate({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## auth.validateUserKey

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-mutation">MUTATION</span><code class="method-card__method">auth.validateUserKey</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Auth required</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/auth/index.ts#L128">src/trpc/routers/auth/index.ts:128</a></span></div></div>
<div class="method-card__summary">Validate user API key</div>
<div class="method-card__description"><p>Validate user API key</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-auth-validateuserkey" aria-haspopup="dialog" aria-controls="modal-auth-validateuserkey" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-auth-validateuserkey-input" aria-expanded="false" aria-controls="schema-auth-validateuserkey-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">email</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">provider</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">enum</span></span>
    </div>
    
    <div class="method-field__enum"><span class="method-field__label">Allowed values</span><div class="method-field__enum-items"><code>anthropic</code><code>openai</code><code>google</code></div></div>
    
  </li></ul>
    <div class="method-section__schema" id="schema-auth-validateuserkey-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;email&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;provider&quot;: {
      &quot;type&quot;: &quot;ZodEnum&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;enum&quot;,
      &quot;enum&quot;: [
        &quot;anthropic&quot;,
        &quot;openai&quot;,
        &quot;google&quot;
      ]
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-auth-validateuserkey" hidden role="dialog" aria-modal="true" aria-labelledby="modal-auth-validateuserkey-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-auth-validateuserkey" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-auth-validateuserkey-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-auth-validateuserkey" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-auth-validateuserkey-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-auth-validateuserkey-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;auth.validateUserKey&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-auth-validateuserkey-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-auth-validateuserkey-trpc-code" data-lang="ts">const result = await client.auth.validateUserKey.mutate({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

<h2 id="namespace-billing">Namespace billing</h2>

## billing.getConsumptionHistory

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">billing.getConsumptionHistory</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Auth required</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/billing/index.ts#L92">src/trpc/routers/billing/index.ts:92</a></span></div></div>
<div class="method-card__summary">Get consumption history for user</div>
<div class="method-card__description"><p>Get consumption history for user</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-billing-getconsumptionhistory" aria-haspopup="dialog" aria-controls="modal-billing-getconsumptionhistory" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-billing-getconsumptionhistory-input" aria-expanded="false" aria-controls="schema-billing-getconsumptionhistory-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">limit</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">number</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-billing-getconsumptionhistory-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;limit&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;hasDefault&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodNumber&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;number&quot;
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-billing-getconsumptionhistory" hidden role="dialog" aria-modal="true" aria-labelledby="modal-billing-getconsumptionhistory-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-billing-getconsumptionhistory" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-billing-getconsumptionhistory-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-billing-getconsumptionhistory" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-billing-getconsumptionhistory-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-billing-getconsumptionhistory-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;billing.getConsumptionHistory&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-billing-getconsumptionhistory-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-billing-getconsumptionhistory-trpc-code" data-lang="ts">const result = await client.billing.getConsumptionHistory.query({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## billing.getPurchaseHistory

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">billing.getPurchaseHistory</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Auth required</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/billing/index.ts#L215">src/trpc/routers/billing/index.ts:215</a></span></div></div>
<div class="method-card__summary">Get user&#39;s purchase history (both subscription and one-time)</div>
<div class="method-card__description"><p>Get user&#39;s purchase history (both subscription and one-time)</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-billing-getpurchasehistory" aria-haspopup="dialog" aria-controls="modal-billing-getpurchasehistory" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-billing-getpurchasehistory-input" aria-expanded="false" aria-controls="schema-billing-getpurchasehistory-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">limit</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">number</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">type</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">enum</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    
    <div class="method-field__enum"><span class="method-field__label">Allowed values</span><div class="method-field__enum-items"><code>all</code><code>subscription</code><code>one_time</code></div></div>
    
  </li></ul>
    <div class="method-section__schema" id="schema-billing-getpurchasehistory-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;limit&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;hasDefault&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodNumber&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;number&quot;
      }
    },
    &quot;type&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;hasDefault&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodEnum&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;enum&quot;,
        &quot;enum&quot;: [
          &quot;all&quot;,
          &quot;subscription&quot;,
          &quot;one_time&quot;
        ]
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-billing-getpurchasehistory" hidden role="dialog" aria-modal="true" aria-labelledby="modal-billing-getpurchasehistory-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-billing-getpurchasehistory" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-billing-getpurchasehistory-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-billing-getpurchasehistory" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-billing-getpurchasehistory-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-billing-getpurchasehistory-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;billing.getPurchaseHistory&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-billing-getpurchasehistory-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-billing-getpurchasehistory-trpc-code" data-lang="ts">const result = await client.billing.getPurchaseHistory.query({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## billing.getTokenBalance

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">billing.getTokenBalance</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Auth required</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/billing/index.ts#L111">src/trpc/routers/billing/index.ts:111</a></span></div></div>
<div class="method-card__summary">Get user&#39;s token balance (requires authentication)</div>
<div class="method-card__description"><p>Get user&#39;s token balance (requires authentication)</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-billing-gettokenbalance" aria-haspopup="dialog" aria-controls="modal-billing-gettokenbalance" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-billing-gettokenbalance-input" aria-expanded="false" aria-controls="schema-billing-gettokenbalance-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">No structured fields (void)</div>
    <div class="method-section__schema" id="schema-billing-gettokenbalance-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodVoid&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;void&quot;
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-billing-gettokenbalance" hidden role="dialog" aria-modal="true" aria-labelledby="modal-billing-gettokenbalance-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-billing-gettokenbalance" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-billing-gettokenbalance-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-billing-gettokenbalance" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-billing-gettokenbalance-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-billing-gettokenbalance-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;billing.getTokenBalance&quot;,
      &quot;params&quot;: {},
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-billing-gettokenbalance-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-billing-gettokenbalance-trpc-code" data-lang="ts">const result = await client.billing.getTokenBalance.query();
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## billing.getTopupHistory

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">billing.getTopupHistory</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Auth required</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/billing/index.ts#L163">src/trpc/routers/billing/index.ts:163</a></span></div></div>
<div class="method-card__summary">Get user&#39;s token purchase history (requires authentication)</div>
<div class="method-card__description"><p>Get user&#39;s token purchase history (requires authentication)</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-billing-gettopuphistory" aria-haspopup="dialog" aria-controls="modal-billing-gettopuphistory" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-billing-gettopuphistory-input" aria-expanded="false" aria-controls="schema-billing-gettopuphistory-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">limit</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">number</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-billing-gettopuphistory-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;limit&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;hasDefault&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodNumber&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;number&quot;
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-billing-gettopuphistory" hidden role="dialog" aria-modal="true" aria-labelledby="modal-billing-gettopuphistory-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-billing-gettopuphistory" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-billing-gettopuphistory-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-billing-gettopuphistory" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-billing-gettopuphistory-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-billing-gettopuphistory-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;billing.getTopupHistory&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-billing-gettopuphistory-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-billing-gettopuphistory-trpc-code" data-lang="ts">const result = await client.billing.getTopupHistory.query({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## billing.getUsageAnalytics

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">billing.getUsageAnalytics</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Auth required</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/billing/index.ts#L182">src/trpc/routers/billing/index.ts:182</a></span></div></div>
<div class="method-card__summary">Get user&#39;s complete usage analytics (for both subscription and BYOK users)</div>
<div class="method-card__description"><p>Get user&#39;s complete usage analytics (for both subscription and BYOK users)</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-billing-getusageanalytics" aria-haspopup="dialog" aria-controls="modal-billing-getusageanalytics" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-billing-getusageanalytics-input" aria-expanded="false" aria-controls="schema-billing-getusageanalytics-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">days</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">number</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">includeHistory</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">boolean</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">historyLimit</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">number</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-billing-getusageanalytics-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;days&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;hasDefault&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodNumber&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;number&quot;
      }
    },
    &quot;includeHistory&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodBoolean&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;boolean&quot;
      }
    },
    &quot;historyLimit&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;hasDefault&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodNumber&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;number&quot;
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-billing-getusageanalytics" hidden role="dialog" aria-modal="true" aria-labelledby="modal-billing-getusageanalytics-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-billing-getusageanalytics" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-billing-getusageanalytics-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-billing-getusageanalytics" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-billing-getusageanalytics-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-billing-getusageanalytics-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;billing.getUsageAnalytics&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-billing-getusageanalytics-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-billing-getusageanalytics-trpc-code" data-lang="ts">const result = await client.billing.getUsageAnalytics.query({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## billing.getUsageHistory

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">billing.getUsageHistory</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Auth required</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/billing/index.ts#L144">src/trpc/routers/billing/index.ts:144</a></span></div></div>
<div class="method-card__summary">Get user&#39;s token usage history (requires authentication)</div>
<div class="method-card__description"><p>Get user&#39;s token usage history (requires authentication)</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-billing-getusagehistory" aria-haspopup="dialog" aria-controls="modal-billing-getusagehistory" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-billing-getusagehistory-input" aria-expanded="false" aria-controls="schema-billing-getusagehistory-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">limit</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">number</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-billing-getusagehistory-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;limit&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;hasDefault&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodNumber&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;number&quot;
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-billing-getusagehistory" hidden role="dialog" aria-modal="true" aria-labelledby="modal-billing-getusagehistory-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-billing-getusagehistory" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-billing-getusagehistory-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-billing-getusagehistory" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-billing-getusagehistory-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-billing-getusagehistory-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;billing.getUsageHistory&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-billing-getusagehistory-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-billing-getusagehistory-trpc-code" data-lang="ts">const result = await client.billing.getUsageHistory.query({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## billing.getUserTokenBalances

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">billing.getUserTokenBalances</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Auth required</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/billing/index.ts#L26">src/trpc/routers/billing/index.ts:26</a></span></div></div>
<div class="method-card__summary">Get user&#39;s token balances (all types)</div>
<div class="method-card__description"><p>Get user&#39;s token balances (all types)</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-billing-getusertokenbalances" aria-haspopup="dialog" aria-controls="modal-billing-getusertokenbalances" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-billing-getusertokenbalances-input" aria-expanded="false" aria-controls="schema-billing-getusertokenbalances-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">No structured fields (void)</div>
    <div class="method-section__schema" id="schema-billing-getusertokenbalances-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodVoid&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;void&quot;
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-billing-getusertokenbalances" hidden role="dialog" aria-modal="true" aria-labelledby="modal-billing-getusertokenbalances-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-billing-getusertokenbalances" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-billing-getusertokenbalances-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-billing-getusertokenbalances" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-billing-getusertokenbalances-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-billing-getusertokenbalances-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;billing.getUserTokenBalances&quot;,
      &quot;params&quot;: {},
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-billing-getusertokenbalances-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-billing-getusertokenbalances-trpc-code" data-lang="ts">const result = await client.billing.getUserTokenBalances.query();
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## billing.planConsumption

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">billing.planConsumption</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Auth required</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/billing/index.ts#L58">src/trpc/routers/billing/index.ts:58</a></span></div></div>
<div class="method-card__summary">Plan token consumption for a request (preview before execution)</div>
<div class="method-card__description"><p>Plan token consumption for a request (preview before execution)</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-billing-planconsumption" aria-haspopup="dialog" aria-controls="modal-billing-planconsumption" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-billing-planconsumption-input" aria-expanded="false" aria-controls="schema-billing-planconsumption-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">estimatedTokens</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">number</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">hasApiKey</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">boolean</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-billing-planconsumption-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;estimatedTokens&quot;: {
      &quot;type&quot;: &quot;ZodNumber&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;number&quot;
    },
    &quot;hasApiKey&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodBoolean&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;boolean&quot;
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-billing-planconsumption" hidden role="dialog" aria-modal="true" aria-labelledby="modal-billing-planconsumption-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-billing-planconsumption" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-billing-planconsumption-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-billing-planconsumption" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-billing-planconsumption-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-billing-planconsumption-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;billing.planConsumption&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-billing-planconsumption-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-billing-planconsumption-trpc-code" data-lang="ts">const result = await client.billing.planConsumption.query({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

<h2 id="namespace-system">Namespace system</h2>

## system.addServerWorkspace

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-mutation">MUTATION</span><code class="method-card__method">system.addServerWorkspace</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/system/index.ts#L275">src/trpc/routers/system/index.ts:275</a></span></div></div>
<div class="method-card__summary">Add a new server workspace configuration</div>
<div class="method-card__description"><p>Add a new server workspace configuration</p><p>Add a new server workspace configuration for file operations</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-system-addserverworkspace" aria-haspopup="dialog" aria-controls="modal-system-addserverworkspace" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-system-addserverworkspace-input" aria-expanded="false" aria-controls="schema-system-addserverworkspace-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">id</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    <div class="method-field__description">Unique identifier for the workspace folder</div>
    
    
  </li><li class="method-field method-field--has-children">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">config</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">object</span></span>
    </div>
    
    
    <div class="method-field__children"><ul class="method-field-list method-field-list--nested"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">path</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    <div class="method-field__description">Absolute path to the workspace folder</div>
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">name</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    <div class="method-field__description">Display name for the workspace folder</div>
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">description</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    <div class="method-field__description">Description of the workspace folder purpose</div>
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">readOnly</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">boolean</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    <div class="method-field__description">Whether this server workspace is read-only</div>
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">allowedPaths</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">array</span><span class="method-badge method-badge--optional">optional</span><span class="method-badge method-badge--meta">array</span></span>
    </div>
    <div class="method-field__description">Allowed path patterns (glob)</div>
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">blockedPaths</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">array</span><span class="method-badge method-badge--optional">optional</span><span class="method-badge method-badge--meta">array</span></span>
    </div>
    <div class="method-field__description">Blocked path patterns (glob)</div>
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">maxFileSize</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">number</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    <div class="method-field__description">Maximum file size in bytes</div>
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">allowedExtensions</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">array</span><span class="method-badge method-badge--optional">optional</span><span class="method-badge method-badge--meta">array</span></span>
    </div>
    <div class="method-field__description">Allowed file extensions</div>
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">blockedExtensions</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">array</span><span class="method-badge method-badge--optional">optional</span><span class="method-badge method-badge--meta">array</span></span>
    </div>
    <div class="method-field__description">Blocked file extensions</div>
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">followSymlinks</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">boolean</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    <div class="method-field__description">Whether to follow symbolic links</div>
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">enableWatching</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">boolean</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    <div class="method-field__description">Whether to watch for file changes</div>
    
    
  </li></ul></div>
  </li></ul>
    <div class="method-section__schema" id="schema-system-addserverworkspace-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;id&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: &quot;Unique identifier for the workspace folder&quot;,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;config&quot;: {
      &quot;type&quot;: &quot;ZodObject&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;object&quot;,
      &quot;properties&quot;: {
        &quot;path&quot;: {
          &quot;type&quot;: &quot;ZodString&quot;,
          &quot;description&quot;: &quot;Absolute path to the workspace folder&quot;,
          &quot;_source&quot;: null,
          &quot;jsType&quot;: &quot;string&quot;
        },
        &quot;name&quot;: {
          &quot;type&quot;: &quot;ZodOptional&quot;,
          &quot;description&quot;: &quot;Display name for the workspace folder&quot;,
          &quot;_source&quot;: null,
          &quot;optional&quot;: true,
          &quot;innerType&quot;: {
            &quot;type&quot;: &quot;ZodString&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;jsType&quot;: &quot;string&quot;
          }
        },
        &quot;description&quot;: {
          &quot;type&quot;: &quot;ZodOptional&quot;,
          &quot;description&quot;: &quot;Description of the workspace folder purpose&quot;,
          &quot;_source&quot;: null,
          &quot;optional&quot;: true,
          &quot;innerType&quot;: {
            &quot;type&quot;: &quot;ZodString&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;jsType&quot;: &quot;string&quot;
          }
        },
        &quot;readOnly&quot;: {
          &quot;type&quot;: &quot;default&quot;,
          &quot;description&quot;: &quot;Whether this server workspace is read-only&quot;,
          &quot;_source&quot;: null,
          &quot;innerType&quot;: {
            &quot;type&quot;: &quot;ZodBoolean&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;jsType&quot;: &quot;boolean&quot;
          }
        },
        &quot;allowedPaths&quot;: {
          &quot;type&quot;: &quot;ZodOptional&quot;,
          &quot;description&quot;: &quot;Allowed path patterns (glob)&quot;,
          &quot;_source&quot;: null,
          &quot;optional&quot;: true,
          &quot;innerType&quot;: {
            &quot;type&quot;: &quot;ZodArray&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;jsType&quot;: &quot;array&quot;,
            &quot;items&quot;: {
              &quot;type&quot;: &quot;String&quot;,
              &quot;description&quot;: null,
              &quot;_source&quot;: null
            }
          }
        },
        &quot;blockedPaths&quot;: {
          &quot;type&quot;: &quot;ZodOptional&quot;,
          &quot;description&quot;: &quot;Blocked path patterns (glob)&quot;,
          &quot;_source&quot;: null,
          &quot;optional&quot;: true,
          &quot;innerType&quot;: {
            &quot;type&quot;: &quot;ZodArray&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;jsType&quot;: &quot;array&quot;,
            &quot;items&quot;: {
              &quot;type&quot;: &quot;String&quot;,
              &quot;description&quot;: null,
              &quot;_source&quot;: null
            }
          }
        },
        &quot;maxFileSize&quot;: {
          &quot;type&quot;: &quot;ZodOptional&quot;,
          &quot;description&quot;: &quot;Maximum file size in bytes&quot;,
          &quot;_source&quot;: null,
          &quot;optional&quot;: true,
          &quot;innerType&quot;: {
            &quot;type&quot;: &quot;ZodNumber&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;jsType&quot;: &quot;number&quot;
          }
        },
        &quot;allowedExtensions&quot;: {
          &quot;type&quot;: &quot;ZodOptional&quot;,
          &quot;description&quot;: &quot;Allowed file extensions&quot;,
          &quot;_source&quot;: null,
          &quot;optional&quot;: true,
          &quot;innerType&quot;: {
            &quot;type&quot;: &quot;ZodArray&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;jsType&quot;: &quot;array&quot;,
            &quot;items&quot;: {
              &quot;type&quot;: &quot;String&quot;,
              &quot;description&quot;: null,
              &quot;_source&quot;: null
            }
          }
        },
        &quot;blockedExtensions&quot;: {
          &quot;type&quot;: &quot;ZodOptional&quot;,
          &quot;description&quot;: &quot;Blocked file extensions&quot;,
          &quot;_source&quot;: null,
          &quot;optional&quot;: true,
          &quot;innerType&quot;: {
            &quot;type&quot;: &quot;ZodArray&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;jsType&quot;: &quot;array&quot;,
            &quot;items&quot;: {
              &quot;type&quot;: &quot;String&quot;,
              &quot;description&quot;: null,
              &quot;_source&quot;: null
            }
          }
        },
        &quot;followSymlinks&quot;: {
          &quot;type&quot;: &quot;default&quot;,
          &quot;description&quot;: &quot;Whether to follow symbolic links&quot;,
          &quot;_source&quot;: null,
          &quot;innerType&quot;: {
            &quot;type&quot;: &quot;ZodBoolean&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;jsType&quot;: &quot;boolean&quot;
          }
        },
        &quot;enableWatching&quot;: {
          &quot;type&quot;: &quot;default&quot;,
          &quot;description&quot;: &quot;Whether to watch for file changes&quot;,
          &quot;_source&quot;: null,
          &quot;innerType&quot;: {
            &quot;type&quot;: &quot;ZodBoolean&quot;,
            &quot;description&quot;: null,
            &quot;_source&quot;: null,
            &quot;jsType&quot;: &quot;boolean&quot;
          }
        }
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-system-addserverworkspace-output" aria-expanded="false" aria-controls="schema-system-addserverworkspace-output" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">success</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">boolean</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">id</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">message</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-system-addserverworkspace-output" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;success&quot;: {
      &quot;type&quot;: &quot;ZodBoolean&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;boolean&quot;
    },
    &quot;id&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;message&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    }
  }
}</code></pre></div>
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-system-addserverworkspace" hidden role="dialog" aria-modal="true" aria-labelledby="modal-system-addserverworkspace-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-system-addserverworkspace" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-system-addserverworkspace-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-system-addserverworkspace" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-system-addserverworkspace-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-system-addserverworkspace-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;system.addServerWorkspace&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-system-addserverworkspace-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-system-addserverworkspace-trpc-code" data-lang="ts">const result = await client.system.addServerWorkspace.mutate({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## system.getServerWorkspaces

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">system.getServerWorkspaces</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/system/index.ts#L83">src/trpc/routers/system/index.ts:83</a></span></div></div>
<div class="method-card__summary">Get configured server workspaces for client applications</div>
<div class="method-card__description"><p>Get configured server workspaces for client applications</p><p>Get all configured server workspaces with accessibility status</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-system-getserverworkspaces" aria-haspopup="dialog" aria-controls="modal-system-getserverworkspaces" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-system-getserverworkspaces-input" aria-expanded="false" aria-controls="schema-system-getserverworkspaces-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">No structured fields (void)</div>
    <div class="method-section__schema" id="schema-system-getserverworkspaces-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodVoid&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;void&quot;
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-system-getserverworkspaces-output" aria-expanded="false" aria-controls="schema-system-getserverworkspaces-output" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">No structured fields (record)</div>
    <div class="method-section__schema" id="schema-system-getserverworkspaces-output" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodRecord&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null
}</code></pre></div>
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-system-getserverworkspaces" hidden role="dialog" aria-modal="true" aria-labelledby="modal-system-getserverworkspaces-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-system-getserverworkspaces" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-system-getserverworkspaces-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-system-getserverworkspaces" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-system-getserverworkspaces-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-system-getserverworkspaces-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;system.getServerWorkspaces&quot;,
      &quot;params&quot;: {},
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-system-getserverworkspaces-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-system-getserverworkspaces-trpc-code" data-lang="ts">const result = await client.system.getServerWorkspaces.query();
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## system.health

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">system.health</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/system/index.ts#L69">src/trpc/routers/system/index.ts:69</a></span></div></div>
<div class="method-card__summary">Health check procedure</div>
<div class="method-card__description"><p>Health check procedure</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-system-health" aria-haspopup="dialog" aria-controls="modal-system-health" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-system-health-input" aria-expanded="false" aria-controls="schema-system-health-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">No structured fields (void)</div>
    <div class="method-section__schema" id="schema-system-health-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodVoid&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;void&quot;
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-system-health" hidden role="dialog" aria-modal="true" aria-labelledby="modal-system-health-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-system-health" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-system-health-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-system-health" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-system-health-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-system-health-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;system.health&quot;,
      &quot;params&quot;: {},
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-system-health-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-system-health-trpc-code" data-lang="ts">const result = await client.system.health.query();
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## system.listClientWorkspaces

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">system.listClientWorkspaces</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/system/index.ts#L423">src/trpc/routers/system/index.ts:423</a></span></div></div>
<div class="method-card__summary">List registered client workspaces (MCP client roots)</div>
<div class="method-card__description"><p>List registered client workspaces (MCP client roots)
This is separate from server workspaces and MCP roots/list</p><p>List all registered client workspace folders</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-system-listclientworkspaces" aria-haspopup="dialog" aria-controls="modal-system-listclientworkspaces" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-system-listclientworkspaces-input" aria-expanded="false" aria-controls="schema-system-listclientworkspaces-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">No structured fields (void)</div>
    <div class="method-section__schema" id="schema-system-listclientworkspaces-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodVoid&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;void&quot;
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-system-listclientworkspaces-output" aria-expanded="false" aria-controls="schema-system-listclientworkspaces-output" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">No structured fields (array)</div>
    <div class="method-section__schema" id="schema-system-listclientworkspaces-output" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodArray&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;array&quot;,
  &quot;items&quot;: {
    &quot;type&quot;: &quot;String&quot;,
    &quot;description&quot;: null,
    &quot;_source&quot;: null
  }
}</code></pre></div>
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-system-listclientworkspaces" hidden role="dialog" aria-modal="true" aria-labelledby="modal-system-listclientworkspaces-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-system-listclientworkspaces" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-system-listclientworkspaces-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-system-listclientworkspaces" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-system-listclientworkspaces-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-system-listclientworkspaces-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;system.listClientWorkspaces&quot;,
      &quot;params&quot;: {},
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-system-listclientworkspaces-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-system-listclientworkspaces-trpc-code" data-lang="ts">const result = await client.system.listClientWorkspaces.query();
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## system.listFiles

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">system.listFiles</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/system/index.ts#L16">src/trpc/routers/system/index.ts:16</a></span></div></div>
<div class="method-card__description"><p>List files and directories in a configured root folder</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-system-listfiles" aria-haspopup="dialog" aria-controls="modal-system-listfiles" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-system-listfiles-input" aria-expanded="false" aria-controls="schema-system-listfiles-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">workspaceId</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">enum</span></span>
    </div>
    <div class="method-field__description">Server workspace ID</div>
    <div class="method-field__enum"><span class="method-field__label">Allowed values</span><div class="method-field__enum-items"><code>default</code></div></div>
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">path</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    <div class="method-field__description">Relative path within workspace folder</div>
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">recursive</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">boolean</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    <div class="method-field__description">Include subdirectories recursively</div>
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">includeDirectories</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">boolean</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    <div class="method-field__description">Include directories in results</div>
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-system-listfiles-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;workspaceId&quot;: {
      &quot;type&quot;: &quot;ZodEnum&quot;,
      &quot;description&quot;: &quot;Server workspace ID&quot;,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;enum&quot;,
      &quot;enum&quot;: [
        &quot;default&quot;
      ]
    },
    &quot;path&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: &quot;Relative path within workspace folder&quot;,
      &quot;_source&quot;: null,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodString&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;string&quot;
      }
    },
    &quot;recursive&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: &quot;Include subdirectories recursively&quot;,
      &quot;_source&quot;: null,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodBoolean&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;boolean&quot;
      }
    },
    &quot;includeDirectories&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: &quot;Include directories in results&quot;,
      &quot;_source&quot;: null,
      &quot;hasDefault&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodBoolean&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;boolean&quot;
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-system-listfiles-output" aria-expanded="false" aria-controls="schema-system-listfiles-output" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">No structured fields (array)</div>
    <div class="method-section__schema" id="schema-system-listfiles-output" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodArray&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;array&quot;,
  &quot;items&quot;: {
    &quot;type&quot;: &quot;String&quot;,
    &quot;description&quot;: null,
    &quot;_source&quot;: null
  }
}</code></pre></div>
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-system-listfiles" hidden role="dialog" aria-modal="true" aria-labelledby="modal-system-listfiles-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-system-listfiles" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-system-listfiles-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-system-listfiles" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-system-listfiles-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-system-listfiles-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;system.listFiles&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-system-listfiles-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-system-listfiles-trpc-code" data-lang="ts">const result = await client.system.listFiles.query({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## system.pathExists

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">system.pathExists</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/system/index.ts#L19">src/trpc/routers/system/index.ts:19</a></span></div></div>
<div class="method-card__description"><p>Check if a file or directory exists in a configured root folder</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-system-pathexists" aria-haspopup="dialog" aria-controls="modal-system-pathexists" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-system-pathexists-input" aria-expanded="false" aria-controls="schema-system-pathexists-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">workspaceId</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">enum</span></span>
    </div>
    <div class="method-field__description">Server workspace ID</div>
    <div class="method-field__enum"><span class="method-field__label">Allowed values</span><div class="method-field__enum-items"><code>default</code></div></div>
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">path</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    <div class="method-field__description">Relative path within workspace folder</div>
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-system-pathexists-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;workspaceId&quot;: {
      &quot;type&quot;: &quot;ZodEnum&quot;,
      &quot;description&quot;: &quot;Server workspace ID&quot;,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;enum&quot;,
      &quot;enum&quot;: [
        &quot;default&quot;
      ]
    },
    &quot;path&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: &quot;Relative path within workspace folder&quot;,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-system-pathexists-output" aria-expanded="false" aria-controls="schema-system-pathexists-output" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">exists</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">boolean</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">path</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-system-pathexists-output" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;exists&quot;: {
      &quot;type&quot;: &quot;ZodBoolean&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;boolean&quot;
    },
    &quot;path&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    }
  }
}</code></pre></div>
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-system-pathexists" hidden role="dialog" aria-modal="true" aria-labelledby="modal-system-pathexists-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-system-pathexists" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-system-pathexists-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-system-pathexists" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-system-pathexists-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-system-pathexists-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;system.pathExists&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-system-pathexists-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-system-pathexists-trpc-code" data-lang="ts">const result = await client.system.pathExists.query({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## system.readFile

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">system.readFile</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/system/index.ts#L17">src/trpc/routers/system/index.ts:17</a></span></div></div>
<div class="method-card__description"><p>Read the content of a file from a configured root folder</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-system-readfile" aria-haspopup="dialog" aria-controls="modal-system-readfile" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-system-readfile-input" aria-expanded="false" aria-controls="schema-system-readfile-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">workspaceId</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">enum</span></span>
    </div>
    <div class="method-field__description">Server workspace ID</div>
    <div class="method-field__enum"><span class="method-field__label">Allowed values</span><div class="method-field__enum-items"><code>default</code></div></div>
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">path</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    <div class="method-field__description">Relative file path within workspace folder</div>
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">encoding</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">enum</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    <div class="method-field__description">File encoding</div>
    <div class="method-field__enum"><span class="method-field__label">Allowed values</span><div class="method-field__enum-items"><code>utf8</code><code>base64</code><code>binary</code></div></div>
    
  </li></ul>
    <div class="method-section__schema" id="schema-system-readfile-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;workspaceId&quot;: {
      &quot;type&quot;: &quot;ZodEnum&quot;,
      &quot;description&quot;: &quot;Server workspace ID&quot;,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;enum&quot;,
      &quot;enum&quot;: [
        &quot;default&quot;
      ]
    },
    &quot;path&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: &quot;Relative file path within workspace folder&quot;,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;encoding&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: &quot;File encoding&quot;,
      &quot;_source&quot;: null,
      &quot;hasDefault&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodEnum&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;enum&quot;,
        &quot;enum&quot;: [
          &quot;utf8&quot;,
          &quot;base64&quot;,
          &quot;binary&quot;
        ]
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-system-readfile-output" aria-expanded="false" aria-controls="schema-system-readfile-output" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">content</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">size</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">number</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">encoding</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">mimeType</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-system-readfile-output" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;content&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;size&quot;: {
      &quot;type&quot;: &quot;ZodNumber&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;number&quot;
    },
    &quot;encoding&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;mimeType&quot;: {
      &quot;type&quot;: &quot;ZodOptional&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;optional&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodString&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;string&quot;
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-system-readfile" hidden role="dialog" aria-modal="true" aria-labelledby="modal-system-readfile-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-system-readfile" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-system-readfile-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-system-readfile" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-system-readfile-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-system-readfile-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;system.readFile&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-system-readfile-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-system-readfile-trpc-code" data-lang="ts">const result = await client.system.readFile.query({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## system.registerClientWorkspace

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-mutation">MUTATION</span><code class="method-card__method">system.registerClientWorkspace</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/system/index.ts#L357">src/trpc/routers/system/index.ts:357</a></span></div></div>
<div class="method-card__summary">Register a client workspace (MCP client root)</div>
<div class="method-card__description"><p>Register a client workspace (MCP client root)
This allows MCP clients to dynamically register their workspace folders</p><p>Register a client workspace folder for MCP access</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-system-registerclientworkspace" aria-haspopup="dialog" aria-controls="modal-system-registerclientworkspace" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-system-registerclientworkspace-input" aria-expanded="false" aria-controls="schema-system-registerclientworkspace-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">id</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    <div class="method-field__description">Unique identifier for the client workspace</div>
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">uri</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    <div class="method-field__description">File URI of the client workspace (e.g., file:///path/to/folder)</div>
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">name</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    <div class="method-field__description">Display name for the workspace</div>
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">description</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    <div class="method-field__description">Description of the workspace</div>
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-system-registerclientworkspace-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;id&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: &quot;Unique identifier for the client workspace&quot;,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;uri&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: &quot;File URI of the client workspace (e.g., file:///path/to/folder)&quot;,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;name&quot;: {
      &quot;type&quot;: &quot;ZodOptional&quot;,
      &quot;description&quot;: &quot;Display name for the workspace&quot;,
      &quot;_source&quot;: null,
      &quot;optional&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodString&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;string&quot;
      }
    },
    &quot;description&quot;: {
      &quot;type&quot;: &quot;ZodOptional&quot;,
      &quot;description&quot;: &quot;Description of the workspace&quot;,
      &quot;_source&quot;: null,
      &quot;optional&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodString&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;string&quot;
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-system-registerclientworkspace-output" aria-expanded="false" aria-controls="schema-system-registerclientworkspace-output" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">success</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">boolean</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">id</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">message</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-system-registerclientworkspace-output" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;success&quot;: {
      &quot;type&quot;: &quot;ZodBoolean&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;boolean&quot;
    },
    &quot;id&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;message&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    }
  }
}</code></pre></div>
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-system-registerclientworkspace" hidden role="dialog" aria-modal="true" aria-labelledby="modal-system-registerclientworkspace-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-system-registerclientworkspace" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-system-registerclientworkspace-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-system-registerclientworkspace" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-system-registerclientworkspace-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-system-registerclientworkspace-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;system.registerClientWorkspace&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-system-registerclientworkspace-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-system-registerclientworkspace-trpc-code" data-lang="ts">const result = await client.system.registerClientWorkspace.mutate({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## system.removeServerWorkspace

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-mutation">MUTATION</span><code class="method-card__method">system.removeServerWorkspace</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/system/index.ts#L325">src/trpc/routers/system/index.ts:325</a></span></div></div>
<div class="method-card__summary">Remove a server workspace configuration</div>
<div class="method-card__description"><p>Remove a server workspace configuration</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-system-removeserverworkspace" aria-haspopup="dialog" aria-controls="modal-system-removeserverworkspace" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-system-removeserverworkspace-input" aria-expanded="false" aria-controls="schema-system-removeserverworkspace-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">id</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    <div class="method-field__description">Server workspace ID to remove</div>
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-system-removeserverworkspace-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;id&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: &quot;Server workspace ID to remove&quot;,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-system-removeserverworkspace-output" aria-expanded="false" aria-controls="schema-system-removeserverworkspace-output" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">success</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">boolean</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">id</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">message</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-system-removeserverworkspace-output" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;success&quot;: {
      &quot;type&quot;: &quot;ZodBoolean&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;boolean&quot;
    },
    &quot;id&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;message&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    }
  }
}</code></pre></div>
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-system-removeserverworkspace" hidden role="dialog" aria-modal="true" aria-labelledby="modal-system-removeserverworkspace-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-system-removeserverworkspace" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-system-removeserverworkspace-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-system-removeserverworkspace" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-system-removeserverworkspace-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-system-removeserverworkspace-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;system.removeServerWorkspace&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-system-removeserverworkspace-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-system-removeserverworkspace-trpc-code" data-lang="ts">const result = await client.system.removeServerWorkspace.mutate({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## system.test

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-mutation">MUTATION</span><code class="method-card__method">system.test</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/system/index.ts#L56">src/trpc/routers/system/index.ts:56</a></span></div></div>
<div class="method-card__summary">Simple test procedure with minimal Zod schema</div>
<div class="method-card__description"><p>Simple test procedure with minimal Zod schema</p><p>Just a echo test endpoint</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-system-test" aria-haspopup="dialog" aria-controls="modal-system-test" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-system-test-input" aria-expanded="false" aria-controls="schema-system-test-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">message</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span><span class="method-badge method-badge--optional">optional</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-system-test-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;message&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;hasDefault&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodOptional&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;optional&quot;: true,
        &quot;innerType&quot;: {
          &quot;type&quot;: &quot;ZodString&quot;,
          &quot;description&quot;: null,
          &quot;_source&quot;: null,
          &quot;jsType&quot;: &quot;string&quot;
        }
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-system-test-output" aria-expanded="false" aria-controls="schema-system-test-output" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">message</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-system-test-output" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;message&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    }
  }
}</code></pre></div>
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-system-test" hidden role="dialog" aria-modal="true" aria-labelledby="modal-system-test-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-system-test" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-system-test-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-system-test" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-system-test-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-system-test-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;system.test&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-system-test-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-system-test-trpc-code" data-lang="ts">const result = await client.system.test.mutate({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## system.unregisterClientWorkspace

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-mutation">MUTATION</span><code class="method-card__method">system.unregisterClientWorkspace</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/system/index.ts#L393">src/trpc/routers/system/index.ts:393</a></span></div></div>
<div class="method-card__summary">Unregister a client workspace (MCP client root)</div>
<div class="method-card__description"><p>Unregister a client workspace (MCP client root)</p><p>Unregister a client workspace folder</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-system-unregisterclientworkspace" aria-haspopup="dialog" aria-controls="modal-system-unregisterclientworkspace" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-system-unregisterclientworkspace-input" aria-expanded="false" aria-controls="schema-system-unregisterclientworkspace-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">id</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    <div class="method-field__description">Client workspace ID to unregister</div>
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-system-unregisterclientworkspace-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;id&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: &quot;Client workspace ID to unregister&quot;,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-system-unregisterclientworkspace-output" aria-expanded="false" aria-controls="schema-system-unregisterclientworkspace-output" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">success</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">boolean</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">id</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">message</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-system-unregisterclientworkspace-output" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;success&quot;: {
      &quot;type&quot;: &quot;ZodBoolean&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;boolean&quot;
    },
    &quot;id&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;message&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    }
  }
}</code></pre></div>
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-system-unregisterclientworkspace" hidden role="dialog" aria-modal="true" aria-labelledby="modal-system-unregisterclientworkspace-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-system-unregisterclientworkspace" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-system-unregisterclientworkspace-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-system-unregisterclientworkspace" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-system-unregisterclientworkspace-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-system-unregisterclientworkspace-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;system.unregisterClientWorkspace&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-system-unregisterclientworkspace-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-system-unregisterclientworkspace-trpc-code" data-lang="ts">const result = await client.system.unregisterClientWorkspace.mutate({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## system.writeFile

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-mutation">MUTATION</span><code class="method-card__method">system.writeFile</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Public</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/system/index.ts#L18">src/trpc/routers/system/index.ts:18</a></span></div></div>
<div class="method-card__description"><p>Write content to a file in a configured root folder</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-system-writefile" aria-haspopup="dialog" aria-controls="modal-system-writefile" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-system-writefile-input" aria-expanded="false" aria-controls="schema-system-writefile-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">workspaceId</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">enum</span></span>
    </div>
    <div class="method-field__description">Server workspace ID</div>
    <div class="method-field__enum"><span class="method-field__label">Allowed values</span><div class="method-field__enum-items"><code>default</code></div></div>
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">path</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    <div class="method-field__description">Relative file path within workspace folder</div>
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">content</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    <div class="method-field__description">File content to write</div>
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">encoding</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">enum</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    <div class="method-field__description">Content encoding</div>
    <div class="method-field__enum"><span class="method-field__label">Allowed values</span><div class="method-field__enum-items"><code>utf8</code><code>base64</code><code>binary</code></div></div>
    
  </li></ul>
    <div class="method-section__schema" id="schema-system-writefile-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;workspaceId&quot;: {
      &quot;type&quot;: &quot;ZodEnum&quot;,
      &quot;description&quot;: &quot;Server workspace ID&quot;,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;enum&quot;,
      &quot;enum&quot;: [
        &quot;default&quot;
      ]
    },
    &quot;path&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: &quot;Relative file path within workspace folder&quot;,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;content&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: &quot;File content to write&quot;,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;encoding&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: &quot;Content encoding&quot;,
      &quot;_source&quot;: null,
      &quot;hasDefault&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodEnum&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;enum&quot;,
        &quot;enum&quot;: [
          &quot;utf8&quot;,
          &quot;base64&quot;,
          &quot;binary&quot;
        ]
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-system-writefile-output" aria-expanded="false" aria-controls="schema-system-writefile-output" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">success</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">boolean</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">path</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">string</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">size</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">number</span></span>
    </div>
    
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-system-writefile-output" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;success&quot;: {
      &quot;type&quot;: &quot;ZodBoolean&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;boolean&quot;
    },
    &quot;path&quot;: {
      &quot;type&quot;: &quot;ZodString&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;string&quot;
    },
    &quot;size&quot;: {
      &quot;type&quot;: &quot;ZodNumber&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;jsType&quot;: &quot;number&quot;
    }
  }
}</code></pre></div>
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-system-writefile" hidden role="dialog" aria-modal="true" aria-labelledby="modal-system-writefile-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-system-writefile" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-system-writefile-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-system-writefile" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-system-writefile-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-system-writefile-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;system.writeFile&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-system-writefile-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-system-writefile-trpc-code" data-lang="ts">const result = await client.system.writeFile.mutate({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

<h2 id="namespace-user">Namespace user</h2>

## user.checkRequestEligibility

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">user.checkRequestEligibility</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Auth required</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/user/index.ts#L189">src/trpc/routers/user/index.ts:189</a></span></div></div>
<div class="method-card__summary">Check if user can make AI requests (subscription users need tokens, BYOK users need API key)</div>
<div class="method-card__description"><p>Check if user can make AI requests (subscription users need tokens, BYOK users need API key)</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-user-checkrequesteligibility" aria-haspopup="dialog" aria-controls="modal-user-checkrequesteligibility" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-user-checkrequesteligibility-input" aria-expanded="false" aria-controls="schema-user-checkrequesteligibility-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">estimatedTokens</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">number</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">hasApiKey</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">boolean</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-user-checkrequesteligibility-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;estimatedTokens&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;hasDefault&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodNumber&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;number&quot;
      }
    },
    &quot;hasApiKey&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodBoolean&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;boolean&quot;
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-user-checkrequesteligibility" hidden role="dialog" aria-modal="true" aria-labelledby="modal-user-checkrequesteligibility-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-user-checkrequesteligibility" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-user-checkrequesteligibility-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-user-checkrequesteligibility" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-user-checkrequesteligibility-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-user-checkrequesteligibility-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;user.checkRequestEligibility&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-user-checkrequesteligibility-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-user-checkrequesteligibility-trpc-code" data-lang="ts">const result = await client.user.checkRequestEligibility.query({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## user.configureBYOK

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-mutation">MUTATION</span><code class="method-card__method">user.configureBYOK</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Auth required</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/user/index.ts#L78">src/trpc/routers/user/index.ts:78</a></span></div></div>
<div class="method-card__summary">Configure BYOK providers for user (SECURE - API keys stored server-side)</div>
<div class="method-card__description"><p>Configure BYOK providers for user (SECURE - API keys stored server-side)</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-user-configurebyok" aria-haspopup="dialog" aria-controls="modal-user-configurebyok" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-user-configurebyok-input" aria-expanded="false" aria-controls="schema-user-configurebyok-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">providers</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">record</span><span class="method-badge method-badge--meta">record</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--required" title="Required parameter"></span>
      <span class="method-field__name">enabled</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">boolean</span><span class="method-badge method-badge--default">default</span></span>
    </div>
    
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-user-configurebyok-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;providers&quot;: {
      &quot;type&quot;: &quot;ZodRecord&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null
    },
    &quot;enabled&quot;: {
      &quot;type&quot;: &quot;default&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;hasDefault&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodBoolean&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;boolean&quot;
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-user-configurebyok" hidden role="dialog" aria-modal="true" aria-labelledby="modal-user-configurebyok-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-user-configurebyok" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-user-configurebyok-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-user-configurebyok" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-user-configurebyok-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-user-configurebyok-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;user.configureBYOK&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-user-configurebyok-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-user-configurebyok-trpc-code" data-lang="ts">const result = await client.user.configureBYOK.mutate({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## user.getBYOKStatus

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">user.getBYOKStatus</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Auth required</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/user/index.ts#L119">src/trpc/routers/user/index.ts:119</a></span></div></div>
<div class="method-card__summary">Get BYOK configuration status (without exposing API keys)</div>
<div class="method-card__description"><p>Get BYOK configuration status (without exposing API keys)</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-user-getbyokstatus" aria-haspopup="dialog" aria-controls="modal-user-getbyokstatus" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-user-getbyokstatus-input" aria-expanded="false" aria-controls="schema-user-getbyokstatus-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">No structured fields (void)</div>
    <div class="method-section__schema" id="schema-user-getbyokstatus-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodVoid&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;void&quot;
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-user-getbyokstatus" hidden role="dialog" aria-modal="true" aria-labelledby="modal-user-getbyokstatus-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-user-getbyokstatus" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-user-getbyokstatus-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-user-getbyokstatus" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-user-getbyokstatus-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-user-getbyokstatus-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;user.getBYOKStatus&quot;,
      &quot;params&quot;: {},
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-user-getbyokstatus-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-user-getbyokstatus-trpc-code" data-lang="ts">const result = await client.user.getBYOKStatus.query();
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## user.getUserProfile

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">user.getUserProfile</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Auth required</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/user/index.ts#L28">src/trpc/routers/user/index.ts:28</a></span></div></div>
<div class="method-card__summary">Get user profile with capabilities and preferences (hybrid users)</div>
<div class="method-card__description"><p>Get user profile with capabilities and preferences (hybrid users)</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-user-getuserprofile" aria-haspopup="dialog" aria-controls="modal-user-getuserprofile" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-user-getuserprofile-input" aria-expanded="false" aria-controls="schema-user-getuserprofile-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">No structured fields (void)</div>
    <div class="method-section__schema" id="schema-user-getuserprofile-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodVoid&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;void&quot;
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-user-getuserprofile" hidden role="dialog" aria-modal="true" aria-labelledby="modal-user-getuserprofile-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-user-getuserprofile" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-user-getuserprofile-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-user-getuserprofile" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-user-getuserprofile-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-user-getuserprofile-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;user.getUserProfile&quot;,
      &quot;params&quot;: {},
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-user-getuserprofile-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-user-getuserprofile-trpc-code" data-lang="ts">const result = await client.user.getUserProfile.query();
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## user.getUserStatus

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-query">QUERY</span><code class="method-card__method">user.getUserStatus</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Auth required</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/user/index.ts#L159">src/trpc/routers/user/index.ts:159</a></span></div></div>
<div class="method-card__summary">Get user status (subscription vs BYOK, purchase history)</div>
<div class="method-card__description"><p>Get user status (subscription vs BYOK, purchase history)</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-user-getuserstatus" aria-haspopup="dialog" aria-controls="modal-user-getuserstatus" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-user-getuserstatus-input" aria-expanded="false" aria-controls="schema-user-getuserstatus-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">No structured fields (void)</div>
    <div class="method-section__schema" id="schema-user-getuserstatus-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodVoid&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;void&quot;
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-user-getuserstatus" hidden role="dialog" aria-modal="true" aria-labelledby="modal-user-getuserstatus-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-user-getuserstatus" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-user-getuserstatus-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-user-getuserstatus" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-user-getuserstatus-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-user-getuserstatus-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;user.getUserStatus&quot;,
      &quot;params&quot;: {},
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-user-getuserstatus-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-user-getuserstatus-trpc-code" data-lang="ts">const result = await client.user.getUserStatus.query();
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

## user.updateUserPreferences

<div class="method-card">
<div class="method-card__header"><div class="method-card__title"><span class="method-card__badge method-card__badge--type method-card__badge--type-mutation">MUTATION</span><code class="method-card__method">user.updateUserPreferences</code></div><div class="method-card__meta"><span class="method-card__badge method-card__badge--auth">Auth required</span><span class="method-card__source"><a href="https://github.com/AWolf81/simple-rpc-ai-backend/blob/feature%2Fremote-mcp-sse-connection/src/trpc/routers/user/index.ts#L51">src/trpc/routers/user/index.ts:51</a></span></div></div>
<div class="method-card__summary">Update user consumption preferences</div>
<div class="method-card__description"><p>Update user consumption preferences</p></div>
<div class="method-card__columns">
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📥</span>Input Parameters</div>
    <div class="method-section__actions"><button class="method-section__action method-section__action--invoke" type="button" data-action="open-modal" data-target="modal-user-updateuserpreferences" aria-haspopup="dialog" aria-controls="modal-user-updateuserpreferences" title="Invocation examples">⚡</button><button class="method-section__action method-section__action--schema" type="button" data-action="toggle-schema" data-target="schema-user-updateuserpreferences-input" aria-expanded="false" aria-controls="schema-user-updateuserpreferences-input" title="Show full schema">{}</button></div>
  </div>
  <div class="method-section__body">
    <ul class="method-field-list"><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">consumptionOrder</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">array</span><span class="method-badge method-badge--optional">optional</span><span class="method-badge method-badge--meta">array</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">byokEnabled</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">boolean</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">byokProviders</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">record</span><span class="method-badge method-badge--optional">optional</span><span class="method-badge method-badge--meta">record</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">notifyTokenLowThreshold</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">number</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">notifyFallbackToByok</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">boolean</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    
    
    
  </li><li class="method-field">
    <div class="method-field__row">
      <span class="method-field__indicator method-field__indicator--optional" title="Optional parameter"></span>
      <span class="method-field__name">notifyOneTimeConsumed</span>
      <span class="method-field__badges"><span class="method-badge method-badge--type">boolean</span><span class="method-badge method-badge--optional">optional</span></span>
    </div>
    
    
    
  </li></ul>
    <div class="method-section__schema" id="schema-user-updateuserpreferences-input" hidden><pre><code class="language-json">{
  &quot;type&quot;: &quot;ZodObject&quot;,
  &quot;description&quot;: null,
  &quot;_source&quot;: null,
  &quot;jsType&quot;: &quot;object&quot;,
  &quot;properties&quot;: {
    &quot;consumptionOrder&quot;: {
      &quot;type&quot;: &quot;ZodOptional&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;optional&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodArray&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;array&quot;,
        &quot;items&quot;: {
          &quot;type&quot;: &quot;String&quot;,
          &quot;description&quot;: null,
          &quot;_source&quot;: null
        }
      }
    },
    &quot;byokEnabled&quot;: {
      &quot;type&quot;: &quot;ZodOptional&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;optional&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodBoolean&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;boolean&quot;
      }
    },
    &quot;byokProviders&quot;: {
      &quot;type&quot;: &quot;ZodOptional&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;optional&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodRecord&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null
      }
    },
    &quot;notifyTokenLowThreshold&quot;: {
      &quot;type&quot;: &quot;ZodOptional&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;optional&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodNumber&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;number&quot;
      }
    },
    &quot;notifyFallbackToByok&quot;: {
      &quot;type&quot;: &quot;ZodOptional&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;optional&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodBoolean&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;boolean&quot;
      }
    },
    &quot;notifyOneTimeConsumed&quot;: {
      &quot;type&quot;: &quot;ZodOptional&quot;,
      &quot;description&quot;: null,
      &quot;_source&quot;: null,
      &quot;optional&quot;: true,
      &quot;innerType&quot;: {
        &quot;type&quot;: &quot;ZodBoolean&quot;,
        &quot;description&quot;: null,
        &quot;_source&quot;: null,
        &quot;jsType&quot;: &quot;boolean&quot;
      }
    }
  }
}</code></pre></div>
  </div>
</div></div>
<div class="method-card__column"><div class="method-section">
  <div class="method-section__header">
    <div class="method-section__title"><span class="method-section__icon">📤</span>Response</div>
    
  </div>
  <div class="method-section__body">
    <div class="method-field-empty">Not documented.</div>
    
  </div>
</div></div>
</div>
</div>
<div class="method-modal" id="modal-user-updateuserpreferences" hidden role="dialog" aria-modal="true" aria-labelledby="modal-user-updateuserpreferences-title">
  <div class="method-modal__backdrop" data-action="close-modal" data-target="modal-user-updateuserpreferences" aria-hidden="true"></div>
  <div class="method-modal__dialog">
    <div class="method-modal__header">
      <h4 class="method-modal__title" id="modal-user-updateuserpreferences-title">Invocation Examples</h4>
      <button type="button" class="method-modal__close" data-action="close-modal" data-target="modal-user-updateuserpreferences" aria-label="Close">×</button>
    </div>
    <div class="method-modal__body">
      <section class="method-modal__section">
        <h5>cURL</h5>
        <div class="language-bash highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy cURL" data-action="copy-code" data-target="modal-user-updateuserpreferences-curl-code"><span class="sr-only">Copy cURL</span></button>
          <div class="highlight"><pre class="highlight language-bash"><code class="language-bash" id="modal-user-updateuserpreferences-curl-code" data-lang="bash">curl -X POST http://localhost:8000/rpc \
  -H &quot;Content-Type: application/json&quot; \
  -d &#39;{
      &quot;jsonrpc&quot;: &quot;2.0&quot;,
      &quot;method&quot;: &quot;user.updateUserPreferences&quot;,
      &quot;params&quot;: { /* ... */ },
      &quot;id&quot;: &quot;request-1&quot;
  }&#39;</code></pre></div>
        </div>
      </section>
      <section class="method-modal__section">
        <h5>tRPC Client</h5>
        <div class="language-ts highlighter-rouge method-modal__code">
          <button type="button" class="method-modal__copy" aria-label="Copy tRPC example" data-action="copy-code" data-target="modal-user-updateuserpreferences-trpc-code"><span class="sr-only">Copy tRPC example</span></button>
          <div class="highlight"><pre class="highlight language-ts"><code class="language-ts" id="modal-user-updateuserpreferences-trpc-code" data-lang="ts">const result = await client.user.updateUserPreferences.mutate({
  /* ... */
});
console.log(result);</code></pre></div>
        </div>
      </section>
    </div>
  </div>
</div>

<script>
(() => {
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
  })();
</script>