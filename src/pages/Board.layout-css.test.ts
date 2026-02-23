import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Board workspace layout CSS', () => {
  it('uses full-width workspace without fixed 1440px cap', () => {
    const cssPath = resolve(process.cwd(), 'src/pages/Board.css');
    const css = readFileSync(cssPath, 'utf8');

    expect(css).toMatch(/\.figma-board-workspace\s*\{[\s\S]*width:\s*100%;/);
    expect(css).toMatch(/\.figma-board-workspace\s*\{[\s\S]*margin:\s*0;/);
    expect(css).not.toContain('width: min(1440px, 100%);');
  });
});
