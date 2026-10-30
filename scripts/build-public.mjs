import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve, extname } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = join(root, "dist-public");
const marker = join(output, ".ajaxpro-generated");

// Only these files become public. Server modules, data, migrations, tests and
// configuration remain available to Vercel Functions but outside the CDN root.
const rootFiles = [
  "404.html", "geen-toegang.html", "index.html", "programma.html",
  "club.js", "contracten-ui.js", "jeugddossiers-manage.js", "jeugddossiers.js",
  "members-video.js", "motm-admin.js", "portal-nav.js", "programma.js", "script.js",
  "contracten.css", "jeugddossiers.css", "members.css", "motm.css",
  "programma.css", "socials-png.css", "socials-quote-large.css",
  "socials.css", "styles.css",
  "llms.txt", "openapi.json", "robots.txt", "sitemap.xml",
];
const publicExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg", ".woff2", ".otf", ".ico"]);

async function copyFile(relativePath) {
  const source = join(root, relativePath);
  if (!(await stat(source)).isFile()) throw new Error(`Not a regular public file: ${relativePath}`);
  const destination = join(output, relativePath);
  await mkdir(resolve(destination, ".."), { recursive: true });
  await cp(source, destination);
}

async function copyAssets(directory) {
  for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
    const relativePath = join(directory, entry.name);
    if (entry.isDirectory()) await copyAssets(relativePath);
    else if (entry.isFile() && publicExtensions.has(extname(entry.name).toLowerCase())) await copyFile(relativePath);
  }
}

let outputExists = false;
try { outputExists = (await stat(output)).isDirectory(); }
catch (error) { if (error.code !== "ENOENT") throw error; }
if (outputExists) {
  let generated = false;
  try { generated = (await readFile(marker, "utf8")) === "Generated AjaxPro public assets\n"; }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (!generated) throw new Error("Refusing to replace an unmanaged output directory");
  await rm(output, { recursive: true });
}

await mkdir(output, { recursive: true });
await writeFile(marker, "Generated AjaxPro public assets\n");
for (const file of rootFiles) await copyFile(file);
for (const directory of ["assets", "jeugddossiers/players"]) await copyAssets(directory);
for (const entry of await readdir(join(root, "Favicon"), { withFileTypes: true })) {
  if (entry.isFile() && (publicExtensions.has(extname(entry.name).toLowerCase()) || entry.name === "site.webmanifest")) await copyFile(join("Favicon", entry.name));
}
for (const entry of await readdir(join(root, "socials"), { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith(".mjs")) await copyFile(join("socials", entry.name));
  else if (entry.isDirectory() && entry.name === "formats") {
    for (const format of await readdir(join(root, "socials", "formats"), { withFileTypes: true })) {
      if (format.isFile() && format.name.endsWith(".mjs")) await copyFile(join("socials", "formats", format.name));
    }
  }
}
for (const file of ["storyboard-frame.html", "storyboard-frame.css", "storyboard-frame.js"]) await copyFile(join("assets", "social-video", file));
