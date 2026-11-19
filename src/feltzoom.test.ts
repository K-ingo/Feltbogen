import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// iOS zoomer ind på et felt med skrift under 16 px, når man rører ved det —
// fundet på iPhone i tag-feltet. Gulvet står i index.css under en
// berøringsforespørgsel. jsdom regner ikke mediaforespørgsler ud, så testen
// holder fast i reglen og i, at brugerens egen zoom ikke er låst.
const css = readFileSync(fileURLToPath(new URL('./index.css', import.meta.url)), 'utf8');
const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
const tokens = readFileSync(fileURLToPath(new URL('../docs/design/TOKENS.md', import.meta.url)), 'utf8');

describe('felterne zoomer ikke på iOS', () => {
  it('løfter alle felter til --skrift-felt på en berøringsskærm', () => {
    expect(css).toMatch(/@media \(pointer: coarse\)\s*\{\s*input:not\(\.titelfelt\), textarea, select/);
    expect(css).toMatch(/input:not\(\.titelfelt\), textarea, select\s*\{\s*font-size: var\(--skrift-felt\) !important;/);
  });

  it('er --skrift-felt mindst 16 px', () => {
    const vaerdi = /--skrift-felt:\s*([\d.]+)rem/.exec(css)?.[1];
    expect(Number(vaerdi) * 16).toBeGreaterThanOrEqual(16);
  });

  it('låser ikke brugerens zoom', () => {
    const meta = /<meta name="viewport" content="([^"]+)"/.exec(html)?.[1] ?? '';
    expect(meta).not.toBe('');
    expect(meta).not.toMatch(/maximum-scale|user-scalable/);
  });

  // index.css og TOKENS.md er den samme tabel to steder (AGENTS.md → Design).
  it('står i TOKENS.md med samme værdi som i index.css', () => {
    const iCss = /--skrift-felt:\s*([\d.]+rem)/.exec(css)?.[1];
    const raekke = tokens.split('\n').find((l) => l.includes('`--skrift-felt`')) ?? '';
    expect(iCss).toBeTruthy();
    expect(raekke).toContain(`\`${iCss}\``);
    expect(raekke).toContain('16px');
    expect(raekke).toMatch(/titelfelt|title field/);
  });
});
