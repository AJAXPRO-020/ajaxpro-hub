const driveBase = "https://www.googleapis.com/drive/v3";
const uploadBase = "https://www.googleapis.com/upload/drive/v3/files";
import { createHmac, timingSafeEqual } from "node:crypto";

const env = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} ontbreekt.`);
  return value;
};

export const contentHubFolderId = () => env("GOOGLE_DRIVE_CONTENT_HUB_FOLDER_ID");

let cachedToken: { value: string; expiresAt: number } | undefined;
const accessToken = async () => {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_DRIVE_CLIENT_ID"),
      client_secret: env("GOOGLE_DRIVE_CLIENT_SECRET"),
      refresh_token: env("GOOGLE_DRIVE_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new Error(`Google OAuth mislukt (${response.status}).`);
  const payload = await response.json() as { access_token?: string; expires_in?: number };
  if (!payload.access_token) throw new Error("Google OAuth gaf geen access token terug.");
  cachedToken = { value: payload.access_token, expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000 };
  return payload.access_token;
};

const driveRequest = async (path: string, init: RequestInit = {}) => {
  const response = await fetch(`${driveBase}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, ...(init.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`Google Drive gaf ${response.status}.`);
  return response;
};

export const assertInContentHub = async (fileId: string) => {
  const response = await driveRequest(`/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,parents,trashed,appProperties,createdTime`);
  const file = await response.json() as { id?: string; name?: string; mimeType?: string; size?: string; parents?: string[]; trashed?: boolean; appProperties?: Record<string, string>; createdTime?: string };
  if (file.id !== fileId || file.trashed || !file.parents?.includes(contentHubFolderId())) throw new Error("Bestand staat niet in de Content Hub-map.");
  return file;
};

export const createResumableUpload = async (input: { name: string; mimeType: string; size: number }) => {
  const response = await fetch(`${uploadBase}?uploadType=resumable&fields=id,name,mimeType,size,parents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": input.mimeType,
      "X-Upload-Content-Length": String(input.size),
    },
    body: JSON.stringify({ name: input.name, mimeType: input.mimeType, parents: [contentHubFolderId()], appProperties: { ajaxproContentHubUpload: "true" } }),
  });
  if (!response.ok) throw new Error(`Drive-uploadsessie kon niet worden gestart (${response.status}).`);
  const location = response.headers.get("location");
  if (!location || !location.startsWith("https://www.googleapis.com/upload/drive/v3/files")) throw new Error("Google gaf geen veilige uploadsessie terug.");
  return location;
};

const sign = (payload: string) => createHmac("sha256", env("GOOGLE_DRIVE_CLIENT_SECRET")).update(payload).digest("base64url");
export const uploadTicket = (url: string, size: number, userId: string) => {
  const payload = Buffer.from(JSON.stringify({ url, size, userId, expires: Date.now() + 60 * 60 * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
};

export const uploadChunk = async (ticket: string, userId: string, start: number, bytes: Uint8Array) => {
  const [payload, signature] = ticket.split(".");
  if (!payload || !signature || !/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]+$/.test(signature) || ticket.length > 4096) throw new Error("Ongeldige uploadsessie.");
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error("Ongeldige uploadsessie.");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { url: string; size: number; userId: string; expires: number };
  const target = new URL(data.url);
  if (data.userId !== userId || data.expires < Date.now() || target.protocol !== "https:" || target.hostname !== "www.googleapis.com" || target.pathname !== "/upload/drive/v3/files" || target.searchParams.get("uploadType") !== "resumable" || !Number.isSafeInteger(data.size) || data.size < 1 || !Number.isSafeInteger(start) || start < 0 || bytes.length < 1 || bytes.length > 2 * 1024 * 1024 || start + bytes.length > data.size) throw new Error("Ongeldige uploadchunk.");
  const response = await fetch(data.url, { method: "PUT", redirect: "manual", headers: { "Content-Length": String(bytes.length), "Content-Range": `bytes ${start}-${start + bytes.length - 1}/${data.size}` }, body: Buffer.from(bytes) });
  if (response.status === 308) {
    const next = Number(response.headers.get("range")?.match(/^bytes=0-(\d+)$/)?.[1] ?? -1) + 1;
    if (next <= start || next > start + bytes.length) throw new Error("Google Drive gaf geen geldige uploadvoortgang terug.");
    return { complete: false, next };
  }
  if (!response.ok) throw new Error(`Google Drive-upload gaf HTTP ${response.status}.`);
  const file = await response.json() as { id?: string; name?: string; mimeType?: string; size?: string };
  if (!file.id) throw new Error("Google Drive gaf geen bestand terug.");
  return { complete: true, file };
};

export const listUnclaimedUploads = async (claimedIds: string[]) => {
  const folderId = contentHubFolderId();
  const q = `'${folderId.replace(/'/g, "\\'")}' in parents and trashed = false and appProperties has { key='ajaxproContentHubUpload' and value='true' }`;
  const response = await driveRequest(`/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,parents,trashed,createdTime)&pageSize=100`);
  const payload = await response.json() as { files?: Array<{ id?: string; name?: string; mimeType?: string; size?: string; parents?: string[]; trashed?: boolean; createdTime?: string }> };
  const claimed = new Set(claimedIds);
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return (payload.files ?? []).filter((file) => file.id && !claimed.has(file.id) && !file.trashed && file.parents?.includes(folderId) && file.createdTime && Date.parse(file.createdTime) < cutoff);
};

export const getFile = async (fileId: string, range?: string) => {
  await assertInContentHub(fileId);
  return driveRequest(`/files/${encodeURIComponent(fileId)}?alt=media`, range ? { headers: { Range: range } } : {});
};

export const deleteFile = async (fileId: string) => {
  await assertInContentHub(fileId);
  await driveRequest(`/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
};
