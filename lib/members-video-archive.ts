type ArchiveVideo = {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  views: number;
  durationSeconds: number;
  category: string;
};
type ArchiveCategory = { id: string; label: string };
type VideoArchive = { categories: readonly ArchiveCategory[]; videos: readonly ArchiveVideo[] };

const archive = require("../data/ajaxpro-video-archive.json") as VideoArchive;
const apiRoot = "https://www.googleapis.com/youtube/v3";
const newestArchivedAt = Math.max(...archive.videos.map(video => Date.parse(video.publishedAt)));
const archivedIds = new Set(archive.videos.map(video => video.id));
let cached: VideoArchive | undefined;
let expiresAt = 0;
let pending: Promise<VideoArchive> | undefined;

const durationSeconds = (value: string) => {
  const match = /^P(?:([0-9]+)D)?T?(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+)S)?$/.exec(value);
  return match ? Number(match[1] || 0) * 86400 + Number(match[2] || 0) * 3600 + Number(match[3] || 0) * 60 + Number(match[4] || 0) : 0;
};

async function youtube(path: string, params: Record<string, string>, key: string) {
  const url = new URL(`${apiRoot}/${path}`);
  for (const [name, value] of Object.entries({ ...params, key })) url.searchParams.set(name, value);
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`YouTube API ${path}: ${response.status}`);
  return response.json();
}

async function refresh(key: string): Promise<VideoArchive> {
  const channel = await youtube("channels", { part: "contentDetails", forHandle: "@AjaxPro020" }, key);
  const playlistId = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!playlistId) throw new Error("AjaxPro uploads-playlist ontbreekt");

  const ids: string[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 5; page++) {
    const result = await youtube("playlistItems", {
      part: "contentDetails", playlistId, maxResults: "50", ...(pageToken ? { pageToken } : {}),
    }, key);
    let reachedArchive = false;
    for (const item of result.items ?? []) {
      const id = item.contentDetails?.videoId;
      const publishedAt = Date.parse(item.contentDetails?.videoPublishedAt ?? "");
      if (Number.isFinite(publishedAt) && publishedAt <= newestArchivedAt) reachedArchive = true;
      if (id && !archivedIds.has(id) && Number.isFinite(publishedAt) && publishedAt > newestArchivedAt) ids.push(id);
    }
    pageToken = result.nextPageToken;
    if (reachedArchive || !pageToken) break;
  }

  const newVideos: ArchiveVideo[] = [];
  for (let offset = 0; offset < ids.length; offset += 50) {
    const result = await youtube("videos", {
      part: "snippet,contentDetails,statistics,status", id: ids.slice(offset, offset + 50).join(","), maxResults: "50",
    }, key);
    for (const item of result.items ?? []) {
      if (item.status?.privacyStatus !== "public" || item.status?.embeddable === false) continue;
      const publishedAt = item.snippet?.publishedAt;
      if (!item.id || !publishedAt || !item.snippet?.title) continue;
      newVideos.push({
        id: item.id,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails?.maxres?.url ?? item.snippet.thumbnails?.high?.url ?? `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
        publishedAt,
        views: Number(item.statistics?.viewCount ?? 0),
        durationSeconds: durationSeconds(item.contentDetails?.duration ?? ""),
        category: "nieuwe-videos",
      });
    }
  }
  newVideos.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  return {
    categories: newVideos.length ? [{ id: "nieuwe-videos", label: "Nieuwe video’s" }, ...archive.categories] : archive.categories,
    videos: [...newVideos, ...archive.videos],
  };
}

export async function loadMembersVideoArchive(): Promise<VideoArchive> {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) return archive;
  if (cached && Date.now() < expiresAt) return cached;
  pending ??= refresh(key).then(result => {
    cached = result;
    expiresAt = Date.now() + 60 * 60_000;
    return result;
  }).catch(error => {
    console.error("Members-videoarchief verversen mislukt", error);
    expiresAt = Date.now() + 60_000;
    return cached ?? archive;
  }).finally(() => { pending = undefined; });
  return pending;
}
