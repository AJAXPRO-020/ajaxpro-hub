import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(new URL('.', import.meta.url).pathname);
const playersDir = path.join(root, 'players');
const imagesDir = path.join(root, 'images');
const manifestPath = path.join(root, 'image-manifest.json');
const failuresPath = path.join(root, 'image-failures.json');
fs.mkdirSync(imagesDir, { recursive: true });

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const safe = value => value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 90);

const manifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : {};
const files = fs.readdirSync(playersDir).filter(file => file.endsWith('.json')).sort();
const targets = new Map();
for (const file of files) {
  const player = readJson(path.join(playersDir, file));
  for (const image of player.media?.images ?? []) {
    if (!image.url) continue;
    if (!targets.has(image.url)) targets.set(image.url, { file, player, image });
  }
}

const queue = [...targets.entries()];
let cursor = 0;
let downloaded = 0;
let skipped = 0;
let failed = 0;
const failures = [];
const updatedPlayers = new Map();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function worker() {
  while (true) {
    const item = queue[cursor++];
    if (!item) return;
    const [url, target] = item;
    const { file, player, image } = target;
    if (!updatedPlayers.has(file)) updatedPlayers.set(file, player);
    const currentPlayer = updatedPlayers.get(file);
    const currentImage = (currentPlayer.media?.images ?? []).find(entry => entry.url === url) ?? image;
    const existing = manifest[url];
    if (existing?.status === 'downloaded' && existing.local_path && fs.existsSync(path.join(root, existing.local_path))) {
      const stat = fs.statSync(path.join(root, existing.local_path));
      if (stat.size > 0) {
        Object.assign(currentImage, existing, { downloaded: true });
        skipped++;
        continue;
      }
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || !/^(www\.)?afc-ajax\.info$/i.test(parsed.hostname)) throw new Error('source host not allowed');
      const response = await fetch(url, { headers: { 'user-agent': 'AjaxPro-local-research-image-collector/1.0' }, redirect: 'follow' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
      if (!contentType.startsWith('image/')) throw new Error(`unexpected content-type ${contentType || 'missing'}`);
      const body = Buffer.from(await response.arrayBuffer());
      if (!body.length) throw new Error('empty response');
      const digest = hash(body);
      const ext = path.extname(parsed.pathname).toLowerCase() || (contentType === 'image/png' ? '.png' : contentType === 'image/webp' ? '.webp' : '.jpg');
      const localName = `${safe(path.basename(file, '.json'))}__${digest.slice(0, 12)}${ext}`;
      const localPath = path.join(imagesDir, localName);
      fs.writeFileSync(localPath, body);
      const relative = `images/${localName}`;
      const record = { url, local_path: relative, status: 'downloaded', downloaded: true, bytes: body.length, sha256: digest, mime_type: contentType, http_status: response.status, downloaded_at: new Date().toISOString(), source_rights: 'AFC-Ajax.info; local research copy only; publication/reuse permission not established' };
      manifest[url] = record;
      Object.assign(currentImage, record);
      downloaded++;
    } catch (error) {
      const message = String(error?.message || error);
      manifest[url] = { url, status: 'failed', downloaded: false, error: message, attempted_at: new Date().toISOString(), source_rights: 'AFC-Ajax.info; local research copy only; publication/reuse permission not established' };
      Object.assign(currentImage, manifest[url]);
      failures.push({ url, player_file: file, error: message });
      failed++;
    }
    if ((downloaded + failed) % 25 === 0) writeJson(manifestPath, manifest);
    await delay(100);
  }
}

await Promise.all(Array.from({ length: 12 }, worker));
for (const [file, player] of updatedPlayers) writeJson(path.join(playersDir, file), player);
writeJson(manifestPath, manifest);
writeJson(failuresPath, failures);

const allPlayers = files.map(file => readJson(path.join(playersDir, file)));
writeJson(path.join(root, 'players.json'), allPlayers);
const oldSummary = fs.existsSync(path.join(root, 'summary.json')) ? readJson(path.join(root, 'summary.json')) : {};
const imageRecords = Object.values(manifest);
writeJson(path.join(root, 'summary.json'), { ...oldSummary, photo_download_round: { completed_at: new Date().toISOString(), unique_image_urls: targets.size, photos_locally_downloaded: imageRecords.filter(row => row.status === 'downloaded').length, photos_failed: imageRecords.filter(row => row.status === 'failed').length, total_bytes: imageRecords.filter(row => row.status === 'downloaded').reduce((sum, row) => sum + (row.bytes || 0), 0), publication_permissions_established: 0, rights_status: 'All local copies remain for research only; publication/reuse permission was not established.' } });
console.log(JSON.stringify({ unique_image_urls: targets.size, downloaded, skipped, failed, total_bytes: imageRecords.reduce((sum, row) => sum + (row.bytes || 0), 0) }));
