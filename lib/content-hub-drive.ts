const driveBase = "https://www.googleapis.com/drive/v3";
const uploadBase = "https://www.googleapis.com/upload/drive/v3/files";

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
  const response = await driveRequest(`/files/${encodeURIComponent(fileId)}?fields=id,parents,trashed`);
  const file = await response.json() as { id?: string; parents?: string[]; trashed?: boolean };
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
    body: JSON.stringify({ name: input.name, mimeType: input.mimeType, parents: [contentHubFolderId()] }),
  });
  if (!response.ok) throw new Error(`Drive-uploadsessie kon niet worden gestart (${response.status}).`);
  const location = response.headers.get("location");
  if (!location || !location.startsWith("https://www.googleapis.com/upload/drive/v3/files")) throw new Error("Google gaf geen veilige uploadsessie terug.");
  return location;
};

export const getFile = async (fileId: string) => {
  await assertInContentHub(fileId);
  return driveRequest(`/files/${encodeURIComponent(fileId)}?alt=media`);
};

export const deleteFile = async (fileId: string) => {
  await assertInContentHub(fileId);
  await driveRequest(`/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
};
