// Lightweight offline-safe template engine.
//
// Syntax:
//   {{key}}                 — scalar substitution (dot-notation: {{items.0.name}})
//   {{#key}} ... {{/key}}   — array/truthy block; repeated for each element of an array
//
// Security: values are HTML-escaped by default. Pass escape=false for raw text templates
// (ESC/POS layouts). Never throws — missing keys render as empty string.

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function resolvePath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((curr, key) => {
    if (curr == null || typeof curr !== 'object') return undefined
    return (curr as Record<string, unknown>)[key]
  }, obj)
}

function renderScalar(value: unknown, escape: boolean): string {
  if (value == null) return ''
  const str = String(value)
  return escape ? escapeHtml(str) : str
}

function renderBlock(
  template: string,
  data: Record<string, unknown>,
  escape: boolean,
): string {
  // Replace array/block sections: {{#key}} ... {{/key}}
  const blockRe = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g
  const withBlocks = template.replace(blockRe, (_, key, inner) => {
    const value = resolvePath(data, key)
    if (!value) return ''
    if (Array.isArray(value)) {
      return value
        .map((item) =>
          renderBlock(inner, item as Record<string, unknown>, escape),
        )
        .join('')
    }
    // Truthy non-array — render once with same context
    return renderBlock(inner, data, escape)
  })

  // Replace scalar tokens: {{key}} and {{dot.path}}
  return withBlocks.replace(/\{\{([\w.]+)\}\}/g, (_, path) =>
    renderScalar(resolvePath(data, path), escape),
  )
}

/**
 * Merges `data` into `template`, replacing all `{{placeholders}}`.
 *
 * @param template  Template string (HTML or plain text)
 * @param data      Flat or nested data object
 * @param escape    HTML-escape values (default true). Pass false for ESC/POS text templates.
 */
export function renderTemplate(
  template: string,
  data: Record<string, unknown>,
  escape = true,
): string {
  return renderBlock(template, data, escape)
}

// Dev-time smoke test (tree-shaken in production builds)
if (import.meta.env.DEV) {
  const out = renderTemplate('Hello {{name}}! {{#items}}{{qty}}x {{label}} {{/items}}', {
    name: 'World',
    items: [
      { qty: 2, label: 'Coffee' },
      { qty: 1, label: 'Tea' },
    ],
  }, false)
  console.assert(out === 'Hello World! 2x Coffee 1x Tea ', 'renderTemplate smoke test failed')
}
