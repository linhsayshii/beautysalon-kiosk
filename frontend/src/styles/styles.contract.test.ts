import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guards for the unified UI template (docs/superpowers/specs/2026-09-25-unified-ui-template-design.md).
const SRC = resolve(__dirname, '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(SRC);
const cssFiles = files.filter((file) => file.endsWith('.css'));
const sourceFiles = files.filter((file) => /\.(tsx?|jsx?)$/.test(file) && !/\.test\.(tsx?|jsx?)$/.test(file));
const rel = (file: string) => relative(SRC, file).split('\\').join('/');

/** Classes a stylesheet styles directly (a rule whose first compound selector is that class). */
function definedClasses(css: string): string[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // Only the rule subject counts: `.btn:hover` defines .btn, `.sheet .app-select-trigger` does not.
  return [...withoutComments.matchAll(/(?:^|[},]\s*)\.([a-zA-Z][\w-]*)(?=[:.[]|\s*[{,])/gm)].map((match) => match[1]);
}

const STANDARD_CLASS = /^(btn|btn-(primary|secondary|soft|ghost|danger|danger-soft|success|link|sm|lg|block|icon|group|group-end)|card|card-(flat|header|title|subtitle|body|footer|inset)|badge|badge-(sm|success|info|warning|danger|violet|neutral|sky|pink|outline)|chip|chip-icon|field|field-(label|required|hint|help|error)|input|input-(sm|group)|textarea|form-(grid|grid-3|stack)|choice|choice-(list|body|title|text)|modal|modal-(backdrop|sm|md|lg|xl|fill|header|heading|title|subtitle|close|body|body-block|description|footer|footer-start)|sheet|sheet-(backdrop|full|muted|handle|header|heading|title|subtitle|close|toolbar|body|footer)|page|page-(stack|header|header-main|header-copy|title|subtitle|actions|grid)|m-[\w-]+|state|state-(compact|inner|icon|title|text|action)|skeleton|tabs|tab|segmented|segmented-block)$/;

describe('stylesheet contract', () => {
  it('never uses a btn modifier without the btn base class', () => {
    const offenders = sourceFiles.flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return [...text.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)]
        .map((match) => match[1] ?? match[2])
        .filter((value) => /(^|\s)btn-(primary|secondary|soft|ghost|danger|danger-soft|success|link|sm|lg|block|icon)(\s|$)/.test(value) && !/(^|\s)btn(\s|$)/.test(value))
        .map((value) => `${rel(file)}: ${value}`);
    });
    expect(offenders).toEqual([]);
  });

  it('loads every stylesheet from the global manifest only', () => {
    const offenders = sourceFiles
      .filter((file) => !file.endsWith('main.tsx'))
      .filter((file) => /^import\s+['"](?!leaflet\/)[^'"]+\.css['"]/m.test(readFileSync(file, 'utf8')))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('lists every stylesheet in styles/index.css', () => {
    const manifest = readFileSync(join(SRC, 'styles/index.css'), 'utf8');
    const uiManifest = readFileSync(join(SRC, 'styles/ui/index.css'), 'utf8');
    const imported = new Set(
      [...manifest.matchAll(/@import '([^']+)'/g)].map((match) => rel(resolve(SRC, 'styles', match[1])))
        .concat([...uiManifest.matchAll(/@import '([^']+)'/g)].map((match) => rel(resolve(SRC, 'styles/ui', match[1])))),
    );
    const missing = cssFiles.map(rel).filter((file) => file !== 'styles/index.css' && file !== 'styles/ui/index.css' && !imported.has(file));
    expect(missing).toEqual([]);
  });

  it('takes every colour from tokens.css', () => {
    // Pure white/black are allowed; any other hex literal must become a token first.
    const offenders = cssFiles
      .filter((file) => rel(file) !== 'styles/tokens.css')
      .flatMap((file) => {
        const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        return [...css.matchAll(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g)]
          .map((match) => match[0].toLowerCase())
          .filter((hex) => !['#fff', '#ffffff', '#000', '#000000'].includes(hex))
          .map((hex) => `${rel(file)}: ${hex}`);
      });
    expect(offenders).toEqual([]);
  });

  it('uses colour tokens in component styles', () => {
    // This hands colours to Leaflet, which draws them as SVG attributes outside CSS.
    const libraryColours = new Set(['components/map/LocationMapPicker.tsx']);
    const offenders = sourceFiles
      .filter((file) => !libraryColours.has(rel(file)))
      .flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/['"`][^'"`\n]*#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])[^'"`\n]*['"`]/g)]
        .map((match) => match[0])
        .filter((value) => !/^['"`]#(?:fff|ffffff|000|000000)['"`]$/i.test(value))
        .map((value) => `${rel(file)}: ${value}`));
    expect(offenders).toEqual([]);
  });

  it('keeps inline styles for computed geometry only', () => {
    // Colour, type and spacing come from classes; inline styles may only carry values computed
    // at runtime (positions, sizes, progress, transforms).
    const decorative = /\b(color|background|backgroundColor|border\w*|padding\w*|margin\w*|font\w*|gap|boxShadow|textAlign|display|flex\w*|alignItems|justifyContent)\s*:/;
    const offenders = sourceFiles.flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      // Also catches style-like props such as triggerStyle={{…}}.
      return [...text.matchAll(/[sS]tyle=\{\{([\s\S]*?)\}\}/g)]
        .filter((match) => decorative.test(match[1]))
        .map((match) => `${rel(file)}: style={{${match[1].replace(/\s+/g, ' ').trim()}}}`);
    });
    expect(offenders).toEqual([]);
  });

  it('uses only the Phosphor weight that main.tsx loads', () => {
    // Only @phosphor-icons/web/regular is imported, so other weights render as blank squares.
    const offenders = sourceFiles.flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/\bph-(fill|bold|duotone|light|thin)\b/g)]
      .map((match) => `${rel(file)}: ${match[0]}`));
    expect(offenders).toEqual([]);
  });

  it('defines standard UI classes only in styles/ui', () => {
    // tokens.css may retarget density variables on .sheet; it defines no styles.
    const offenders = cssFiles
      .filter((file) => !rel(file).startsWith('styles/ui/') && rel(file) !== 'styles/tokens.css')
      .flatMap((file) => definedClasses(readFileSync(file, 'utf8'))
        .filter((name) => STANDARD_CLASS.test(name))
        .map((name) => `${rel(file)}: .${name}`));
    expect([...new Set(offenders)]).toEqual([]);
  });
});
