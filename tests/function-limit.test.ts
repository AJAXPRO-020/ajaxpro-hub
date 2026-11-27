import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('deployment budget counts nested entrypoints and rejects the twelfth', async () => {
  const { checkFunctionLimit } = await import('../scripts/check-function-limit.mjs');
  const root = await mkdtemp(join(tmpdir(), 'ajaxpro-functions-'));
  try {
    await mkdir(join(root, 'api/auth'), { recursive: true });
    for (let i = 0; i < 11; i++) await writeFile(join(root, `api/auth/handler-${i}.ts`), 'export function GET() {}');
    assert.equal((await checkFunctionLimit(root)).length, 11);
    await writeFile(join(root, 'api/extra.ts'), 'export function GET() {}');
    await assert.rejects(checkFunctionLimit(root), /12 > 11/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('current deployment fits the function budget', async () => {
  const { checkFunctionLimit } = await import('../scripts/check-function-limit.mjs');
  assert.equal((await checkFunctionLimit()).length, 11);
});
