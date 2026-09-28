import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// iOS Safari resolves 100vh to the viewport with its toolbar hidden. A document
// root that tall scrolls by the toolbar height, so swipes on a page that fits the
// screen move the whole fixed mobile shell and bounce back instead of scrolling.
const SRC = resolve(__dirname, '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const cssFiles = walk(SRC).filter((file) => file.endsWith('.css'));

/** Declarations of rules whose selector list targets html, body or #root directly. */
function documentRootRules(css: string) {
  return [...stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selector]) => selector.split(',').some((part) => /^\s*(html|body|#root)\s*$/.test(part)))
    .map(([, selector, body]) => ({ selector: selector.trim(), body }));
}

describe('mobile viewport contract', () => {
  it('never sizes the document root with the large viewport height', () => {
    const offenders = cssFiles.flatMap((file) => documentRootRules(readFileSync(file, 'utf8'))
      .filter(({ body }) => /height\s*:[^;]*\b100(vh|lvh)\b/.test(body))
      .map(({ selector }) => `${relative(SRC, file)}: ${selector}`));
    expect(offenders).toEqual([]);
  });

  it('keeps swipes inside the mobile shell instead of chaining to the document', () => {
    const css = stripComments(readFileSync(join(SRC, 'styles/mobile.css'), 'utf8'));
    expect(css).toMatch(/html:has\(\.mobile-app-shell\)[^{]*\{[^}]*overscroll-behavior:\s*none/);
    expect(css).toMatch(/\.mobile-main-content\s*\{[^}]*overscroll-behavior-y:\s*contain/);
  });
});
