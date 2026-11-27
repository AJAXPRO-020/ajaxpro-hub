import { readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function checkFunctionLimit(root = resolve(import.meta.dirname, '..'), limit = 11) {
  const entries = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (/\.(?:[cm]?[jt]s|tsx|jsx|py|go|rb)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) entries.push(relative(root, path));
    }
  }
  await walk(join(root, 'api'));
  entries.sort();
  console.log(`Vercel function entrypoints: ${entries.length}/${limit}\n${entries.join('\n')}`);
  if (entries.length > limit) throw new Error(`Vercel function budget exceeded: ${entries.length} > ${limit}`);
  return entries;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await checkFunctionLimit();
