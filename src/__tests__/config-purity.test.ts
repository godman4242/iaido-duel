/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Central-config rule (spec §3, §J.4): no gameplay-affecting numeric value may live in
// src/core/** or src/game/** — it must come from src/config/. This test enforces it.
//
// Allowed bare values: 0, 1, 2 (and their negations), numbers in *type* positions
// (e.g. `1 | 2 | 3`), and anything imported from config/. The scanner catches numeric
// literals, BigInt literals, AND numbers smuggled as pure-number string/template text
// (e.g. `Number('500')`, `+('3' + '0')`) so a constant cannot be hidden as a string.
//
// Enforcement is two-tier:
//   1. core/** is held to ZERO violations (the deterministic, render-free sim must be pure).
//      CORE_GRANDFATHERED (now empty) once exempted files whose literals were tunables a later
//      milestone moved to config; M1 retired the last (anim.ts → config/anim.ts).
//   2. game/** (+ grandfathered core) is ratcheted against a committed per-file value MULTISET:
//      the build fails on any new OR substituted value; removals (debt paydown) are allowed.

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SCAN_DIRS = ['src/core', 'src/game'];
const ALLOWED = new Set([0, 1, 2]);
const BASELINE_PATH = join(ROOT, 'src/__tests__/config-purity.baseline.json');

// core/ files exempt from the zero-gate, with the milestone that purifies them.
// M1 retired the last one (anim.ts → config/anim.ts), so ALL of core/ is now literal-free.
const CORE_GRANDFATHERED = new Set<string>([]);

type Violation = { file: string; line: number; value: number; kind: string };

const norm = (p: string): string => p.split(sep).join('/');
const isCore = (rel: string): boolean => rel.startsWith('src/core/');
const mustBePure = (rel: string): boolean => isCore(rel) && !CORE_GRANDFATHERED.has(rel);

const NUMERIC_RE = /^[+-]?(\d+(_\d+)*\.?(\d+(_\d+)*)?|\.\d+(_\d+)*)(e[+-]?\d+)?$/i;
function asNumber(text: string): number | null {
  const t = text.trim();
  if (t === '' || !NUMERIC_RE.test(t)) return null;
  const n = Number(t.replace(/_/g, ''));
  return Number.isFinite(n) ? n : null;
}

function listTsFiles(dirAbs: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dirAbs, { withFileTypes: true })) {
    const abs = join(dirAbs, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      out.push(...listTsFiles(abs));
    } else if (
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.spec.ts') &&
      !entry.name.endsWith('.d.ts')
    ) {
      out.push(abs);
    }
  }
  return out;
}

function scanFile(abs: string): Violation[] {
  const text = readFileSync(abs, 'utf8');
  const sf = ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true);
  const rel = norm(relative(ROOT, abs));
  const out: Violation[] = [];

  const record = (node: ts.Node, value: number, kind: string): void => {
    if (ALLOWED.has(value)) return;
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    out.push({ file: rel, line: line + 1, value, kind });
  };

  const visit = (node: ts.Node): void => {
    const inType = node.parent && ts.isLiteralTypeNode(node.parent);
    if (!inType) {
      if (ts.isNumericLiteral(node)) {
        record(node, Number(node.text), 'numeric');
      } else if (ts.isBigIntLiteral(node)) {
        record(node, Number(node.text.replace(/n$/, '')), 'bigint');
      } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        const n = asNumber(node.text);
        if (n !== null) record(node, n, 'string-number');
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function scanAll(): Violation[] {
  return SCAN_DIRS.flatMap((dir) => listTsFiles(join(ROOT, dir)).flatMap(scanFile));
}

function valuesByFile(violations: Violation[]): Record<string, number[]> {
  const m: Record<string, number[]> = {};
  for (const v of violations) (m[v.file] ??= []).push(v.value);
  for (const f of Object.keys(m)) m[f].sort((a, b) => a - b);
  return m;
}

const counts = (xs: number[]): Map<number, number> => {
  const m = new Map<number, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
};

const violations = scanAll();
const current = valuesByFile(violations);

// Regenerate: `GEN_PURITY_BASELINE=1 npx vitest run src/__tests__/config-purity.test.ts`
if (process.env.GEN_PURITY_BASELINE) {
  const baseline: Record<string, number[]> = {};
  for (const [file, vals] of Object.entries(current)) {
    if (!mustBePure(file)) baseline[file] = vals; // only files allowed to carry debt
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
}

describe('config-purity (spec §3 — no gameplay literals outside src/config/)', () => {
  it('every core/** module is literal-free (except documented motion-feel grandfathers)', () => {
    const offenders = violations
      .filter((v) => mustBePure(v.file))
      .map((v) => `${v.file}:${v.line} ${v.kind} ${v.value}`);
    expect(offenders).toEqual([]);
  });

  it('no new or substituted gameplay value vs the committed baseline multiset', () => {
    expect(existsSync(BASELINE_PATH)).toBe(true);
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Record<string, number[]>;
    const regressions: string[] = [];
    for (const [file, vals] of Object.entries(current)) {
      if (mustBePure(file)) continue; // covered by the zero-gate above
      const base = counts(baseline[file] ?? []);
      for (const [value, n] of counts(vals)) {
        if (n > (base.get(value) ?? 0)) regressions.push(`${file}: value ${value} x${n} > baseline x${base.get(value) ?? 0}`);
      }
    }
    expect(regressions).toEqual([]);
  });
});
