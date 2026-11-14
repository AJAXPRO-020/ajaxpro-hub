import { db } from "./motm-db";

const MAX_TEXT_LENGTH = 2_000;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const STALE_PENDING_MS = 15 * 60_000;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
]);

export type DiscordPublicationStatus = "pending" | "sent" | "failed" | "unknown";
export type DiscordAttachment = {
  data: Uint8Array;
  filename: string;
  mimeType: string;
};
export type DiscordPublication = {
  idempotencyKey: string;
  sourceType: string;
  sourceId: string;
  text?: string;
  attachment?: DiscordAttachment;
  actorDiscordUserId?: string;
};
export type DiscordSendResult =
  | { status: "sent"; messageId: string | null }
  | { status: "failed" | "unknown"; error: string; retryAfterSeconds?: number };

const requiredWebhook = () => {
  const value = process.env.DISCORD_PUBLICATION_WEBHOOK?.trim();
  if (!value) throw new Error("DISCORD_PUBLICATION_WEBHOOK ontbreekt");
  const url = new URL(value);
  if (url.protocol !== "https:" || !url.hostname.endsWith("discord.com")) {
    throw new Error("DISCORD_PUBLICATION_WEBHOOK is geen geldige Discord-webhook");
  }
  return url;
};

const validatePublication = (input: DiscordPublication) => {
  if (!input.idempotencyKey || input.idempotencyKey.length > 200) throw new Error("Ongeldige idempotency key");
  if (!input.sourceType || !input.sourceId) throw new Error("Bron van publicatie ontbreekt");
  if (!input.text?.trim() && !input.attachment) throw new Error("Publicatie bevat geen tekst of bestand");
  if (input.text && input.text.length > MAX_TEXT_LENGTH) throw new Error("Discord-tekst is te lang");
  if (input.attachment) {
    if (!ALLOWED_MIME_TYPES.has(input.attachment.mimeType)) throw new Error("Bestandstype wordt niet ondersteund");
    if (!input.attachment.data.byteLength || input.attachment.data.byteLength > MAX_FILE_SIZE) throw new Error("Bestand is te groot voor Discord");
    if (!input.attachment.filename || /[\r\n]/.test(input.attachment.filename)) throw new Error("Ongeldige bestandsnaam");
  }
};

export const sendDiscordWebhook = async (
  webhook: URL | string,
  input: Pick<DiscordPublication, "text" | "attachment">,
): Promise<DiscordSendResult> => {
  const url = new URL(webhook.toString());
  url.searchParams.set("wait", "true");
  const form = new FormData();
  form.append("payload_json", JSON.stringify({ content: input.text?.trim() || undefined }));
  if (input.attachment) {
    const bytes = new Uint8Array(input.attachment.data);
    form.append("files[0]", new Blob([bytes.buffer as ArrayBuffer], { type: input.attachment.mimeType }), input.attachment.filename);
  }
  try {
    const response = await fetch(url, { method: "POST", body: form, signal: AbortSignal.timeout(10_000) });
    if (response.ok) {
      let messageId: string | null = null;
      try { messageId = ((await response.json()) as { id?: string }).id ?? null; } catch { /* Discord may return no body. */ }
      return { status: "sent", messageId };
    }
    const error = `Discord-publicatie mislukt (${response.status})`;
    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfter = retryAfterHeader === null ? Number.NaN : Number(retryAfterHeader);
    const retryAfterSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined;
    return response.status >= 500 || response.status === 429
      ? { status: "unknown", error, ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }) }
      : { status: "failed", error };
  } catch (error) {
    return { status: "unknown", error: error instanceof Error ? error.message : "Onbekende Discord-fout" };
  }
};

export const publishDiscord = async (input: DiscordPublication) => {
  validatePublication(input);
  const sql = db();
  const [existing] = await sql`SELECT * FROM discord_publications WHERE idempotency_key=${input.idempotencyKey}`;
  if (existing?.status === "sent") return { status: "already_sent" as const, messageId: existing.discord_message_id ?? null };
  if (existing?.status === "unknown") return { status: "unknown" as const, error: existing.error ?? "Verzendstatus onbekend" };
  if (existing?.status === "pending" && Date.now() - new Date(existing.attempted_at).getTime() < STALE_PENDING_MS) return { status: "in_progress" as const };

  const [claimed] = existing
    ? await sql`UPDATE discord_publications SET status='pending',attempted_at=now(),error=NULL,actor_discord_user_id=${input.actorDiscordUserId ?? null},updated_at=now() WHERE id=${existing.id} AND status IN ('failed','pending') RETURNING id`
    : await sql`INSERT INTO discord_publications(idempotency_key,source_type,source_id,actor_discord_user_id) VALUES(${input.idempotencyKey},${input.sourceType},${input.sourceId},${input.actorDiscordUserId ?? null}) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`;
  if (!claimed) return { status: "in_progress" as const };

  const result = await sendDiscordWebhook(requiredWebhook(), input);
  if (result.status === "sent") {
    await sql`UPDATE discord_publications SET status='sent',discord_message_id=${result.messageId},published_at=now(),error=NULL,updated_at=now() WHERE id=${claimed.id} AND status='pending'`;
    return { status: "sent" as const, messageId: result.messageId };
  }
  const retryHint = "retryAfterSeconds" in result && result.retryAfterSeconds !== undefined ? ` Probeer opnieuw na ${result.retryAfterSeconds} seconden.` : "";
  const error = `${result.error}${retryHint}`;
  await sql`UPDATE discord_publications SET status=${result.status},error=${error.slice(0, 1000)},updated_at=now() WHERE id=${claimed.id} AND status='pending'`;
  return { status: result.status, error };
};
