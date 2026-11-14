import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);
const cacheRoot = path.join(root, 'cache');
const playersRoot = path.join(root, 'players');
const imagesRoot = path.join(root, 'images');
for (const dir of [cacheRoot, playersRoot, imagesRoot]) fs.mkdirSync(dir, { recursive: true });

const base = 'https://www.afc-ajax.info';
const indexUrl = `${base}/en/overview/soccer-players`;
const collectedAt = new Date().toISOString();
const delayMs = Number(process.env.AJAX_INFO_DELAY_MS || 400);
const concurrency = Math.max(1, Number(process.env.AJAX_INFO_CONCURRENCY || 2));
const limit = process.env.AJAX_INFO_LIMIT ? Number(process.env.AJAX_INFO_LIMIT) : Infinity;
const retryable = new Set([408, 425, 429, 500, 502, 503, 504]);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const htmlDecode = s => String(s ?? '').replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&#x27;', "'").replaceAll('&#x2F;', '/');
const clean = s => htmlDecode(String(s ?? '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
const abs = u => { const x = htmlDecode(u); if (!x) return null; return x.startsWith('http') ? x : new URL(x, base).href; };
const stableId = slug => `afc_ajax_${slug}`;

function cachePath(slug, page) { return path.join(cacheRoot, slug, `${page}.html`); }
function readCached(slug, page) { const p = cachePath(slug, page); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }
function saveCached(slug, page, html) { const dir = path.dirname(cachePath(slug, page)); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(cachePath(slug, page), html); }

async function fetchText(url, slug, page) {
  const cached = readCached(slug, page);
  if (cached) return { html: cached, cached: true, status: 200, url };
  let last = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    await sleep(delayMs);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'AjaxPro-research-collector/1.0 (local read-only research)' } });
      const html = await res.text();
      if (res.ok && /<html/i.test(html)) { saveCached(slug, page, html); return { html, cached: false, status: res.status, url }; }
      last = { status: res.status, body: html.slice(0, 300), url };
      if (!retryable.has(res.status)) break;
    } catch (error) { last = { status: 0, error: String(error), url }; }
    await sleep(1000 * (attempt + 1));
  }
  throw Object.assign(new Error(`FETCH_FAILED ${url}`), last ?? {});
}

function parseRows(html) {
  const tables = [];
  for (const table of html.matchAll(/<table\b[\s\S]*?<\/table>/gi)) {
    const tableHtml = table[0];
    const caption = clean(tableHtml.match(/<caption[^>]*>([\s\S]*?)<\/caption>/i)?.[1] ?? '');
    const rows = [];
    for (const row of tableHtml.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)) {
      const cells = [...row[0].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(x => clean(x[1]));
      if (cells.length) rows.push(cells);
    }
    if (rows.length) {
      const headers = rows[0].map(x => x.toLowerCase());
      const body = rows.slice(1).map(cells => Object.fromEntries(headers.map((h, i) => [h || `column_${i + 1}`, cells[i] ?? null])));
      tables.push({ caption: caption || null, headers, rows: body, raw_row_count: rows.length });
    }
  }
  return tables;
}

function parseProfile(html, url) {
  const field = label => {
    const re = new RegExp(`<td[^>]*class="firstcolumn"[^>]*>\\s*${label}\\s*<\\/td>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`, 'i');
    return clean(html.match(re)?.[1] ?? '') || null;
  };
  const time = (prop, label) => { const m = html.match(new RegExp(`<time[^>]*itemprop="${prop}"[^>]*datetime="([^"]+)"`, 'i')); return m?.[1] ?? field(label); };
  const external = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map(m => ({ label: clean(m[2]) || null, url: abs(m[1]) })).filter(x => x.url && !x.url.startsWith(base));
  const related = [...html.matchAll(/href="(\/en\/player\/[^"/?]+)"/gi)].map(m => abs(m[1]));
  return { source_url: url, name: field('Name'), full_name: field('Full name'), alternative_names: field('Alternative names') ? field('Alternative names').split(/[,;|]/).map(x => x.trim()).filter(Boolean) : [], birth_date: time('birthDate', 'Born on'), death_date: time('deathDate', 'Died on'), nationality: field('Nationality'), roles: field('Role') ? [field('Role')] : [], ajax_club: field('Club'), last_known_club: field('Last Known Club'), external_links: [...new Map(external.map(x => [x.url, x])).values()], related_player_urls: [...new Set(related)].filter(x => x !== url) };
}

function parseImages(html) {
  return [...html.matchAll(/<img\b[^>]*>/gi)].map(m => { const tag=m[0]; const src=tag.match(/\bsrc="([^"]+)"/i)?.[1] ?? tag.match(/\bdata-src="([^"]+)"/i)?.[1]; return src ? { url: abs(src), alt: clean(tag.match(/\balt="([^"]*)"/i)?.[1] ?? ''), source_rights: 'AFC-Ajax.info page image; no separate reuse licence established', downloaded: false, local_path: null } : null; }).filter(Boolean).filter(x => x.url && !x.url.endsWith('/images/ajaxinfo.png'));
}

function parsePlayer(slug, profile, stats, matches, transfers) {
  const url = `${base}/en/player/${slug}`;
  const sections = { profile: parseProfile(profile.html, url), statistics: parseRows(stats.html), matches: parseRows(matches.html), transfers_and_media: parseRows(transfers.html) };
  const allHtml = [profile.html, stats.html, matches.html, transfers.html].join('\n');
  const image_urls = parseImages(allHtml);
  return { local_id: stableId(slug), slug, collected_at: collectedAt, source: 'AFC-Ajax.info', source_urls: [url, `${url}/statistics`, `${url}/matches`, `${url}/transfers-and-media`], ...sections, media: { images: image_urls, download_policy: 'Do not download AFC-hosted images without explicit permission; preserve URL and rights status.' }, quality: { profile_pages_fetched: 4, statistics_tables: sections.statistics.length, match_tables: sections.matches.length, transfer_tables: sections.transfers_and_media.length, has_statistics: sections.statistics.length > 0, has_match_data: sections.matches.length > 0, missing_fields: ['death_date', 'full_name', 'alternative_names', 'photo'].filter(k => !sections.profile[k] && !(k === 'photo' && image_urls.length)) } };
}

function parseIndex(html) {
  const links = [...html.matchAll(/href="(\/en\/player\/([a-z0-9-]+))"/gi)].map(m => ({ slug: m[2], profile_url: abs(m[1]) }));
  return [...new Map(links.map(x => [x.slug, x])).values()].sort((a,b) => a.slug.localeCompare(b.slug));
}

async function main() {
  const index = await fetchText(indexUrl, '_index', 'index');
  const allPlayers = parseIndex(index.html);
  const selected = allPlayers.slice(0, limit);
  fs.writeFileSync(path.join(root, 'index.json'), JSON.stringify({ source_url: indexUrl, collected_at: collectedAt, unique_player_links: allPlayers.length, players: allPlayers }, null, 2) + '\n');
  const failed = fs.existsSync(path.join(root, 'failed-urls.json')) ? JSON.parse(fs.readFileSync(path.join(root, 'failed-urls.json'), 'utf8')) : [];
  const failedKeys = new Set(failed.map(x => `${x.slug}|${x.page}`));
  let completed = 0;
  async function worker(items) {
    for (const item of items) {
      const out = path.join(playersRoot, `${item.slug}.json`);
      if (fs.existsSync(out)) { completed++; continue; }
      try {
        const url = item.profile_url;
        const pages = [];
        for (const [page, pageUrl] of [['profile', url], ['statistics', `${url}/statistics`], ['matches', `${url}/matches`], ['transfers-and-media', `${url}/transfers-and-media`]]) pages.push(await fetchText(pageUrl, item.slug, page));
        const player = parsePlayer(item.slug, pages[0], pages[1], pages[2], pages[3]);
        fs.writeFileSync(out, JSON.stringify(player, null, 2) + '\n');
      } catch (error) {
        for (const page of ['profile','statistics','matches','transfers-and-media']) {
          const key = `${item.slug}|${page}`;
          if (!failedKeys.has(key)) { failed.push({ slug:item.slug, page, url:`${item.profile_url}${page==='profile'?'':`/${page}`}`, collected_at: new Date().toISOString(), error:String(error), retryable:true }); failedKeys.add(key); }
        }
        fs.writeFileSync(path.join(root, 'failed-urls.json'), JSON.stringify(failed, null, 2) + '\n');
      }
      completed++;
      if (completed % 25 === 0 || completed === selected.length) console.log(JSON.stringify({ completed, total: selected.length, profiles_on_disk: fs.readdirSync(playersRoot).length, failures: failed.length }));
    }
  }
  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(selected.filter((_, j) => j % concurrency === i))));
  const playerFiles = fs.readdirSync(playersRoot).filter(x => x.endsWith('.json')).sort();
  const players = playerFiles.map(x => JSON.parse(fs.readFileSync(path.join(playersRoot, x), 'utf8')));
  fs.writeFileSync(path.join(root, 'players.json'), JSON.stringify({ source: indexUrl, collected_at: collectedAt, players }, null, 2) + '\n');
  const statsCount = players.filter(x => x.quality.has_statistics).length;
  const photos = players.flatMap(x => x.media.images);
  const summary = { source_url:indexUrl, collected_at:collectedAt, index_unique_player_links:allPlayers.length, requested_profiles:selected.length, complete_profiles:players.length, failed_url_entries:failed.length, players_with_statistics:statsCount, players_with_match_tables:players.filter(x=>x.quality.has_match_data).length, players_with_any_image_url:players.filter(x=>x.media.images.length).length, photos_locally_downloaded:photos.filter(x=>x.downloaded).length, photos_not_downloaded_rights_unclear:photos.filter(x=>!x.downloaded).length, detail_pages_per_profile:['profile','statistics','matches','transfers-and-media'], field_availability:{name:players.filter(x=>x.profile.name).length,birth_date:players.filter(x=>x.profile.birth_date).length,death_date:players.filter(x=>x.profile.death_date).length,nationality:players.filter(x=>x.profile.nationality).length,role:players.filter(x=>x.profile.roles.length).length,last_known_club:players.filter(x=>x.profile.last_known_club).length,external_links:players.filter(x=>x.profile.external_links.length).length}, missing_field_policy:'null for absent scalar values; empty arrays for absent collections; no inferred dates or zero statistics', image_policy:'AFC-hosted images are not downloaded because no reuse licence was established.' };
  fs.writeFileSync(path.join(root, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
