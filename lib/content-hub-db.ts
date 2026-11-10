import { db } from "./motm-db";

export type ContentHubPost = {
  id: string; name: string; scheduled_for: string; content_type: "video" | "photo"; notes: string;
  drive_file_id: string; drive_file_name: string; drive_mime_type: string; drive_file_size: number;
};

export const listContentHubPosts = async (from: string, to: string) => db()<ContentHubPost[]>`
  SELECT id,name,scheduled_for,content_type,notes,drive_file_id,drive_file_name,drive_mime_type,drive_file_size
  FROM content_hub_posts WHERE scheduled_for BETWEEN ${from}::date AND ${to}::date ORDER BY scheduled_for,name,created_at`;

export const createContentHubPost = async (input: { name: string; date: string; type: "video" | "photo"; notes: string; driveFileId: string; driveFileName: string; driveMimeType: string; driveFileSize: number; userId: string }) => {
  const cleanup = new Date(`${input.date}T00:00:00Z`); cleanup.setUTCDate(cleanup.getUTCDate() + 30);
  const [row] = await db()<ContentHubPost[]>`
    INSERT INTO content_hub_posts(name,scheduled_for,content_type,notes,drive_file_id,drive_file_name,drive_mime_type,drive_file_size,drive_parent_folder_id,created_by_discord_user_id,cleanup_after)
    VALUES(${input.name},${input.date}::date,${input.type},${input.notes},${input.driveFileId},${input.driveFileName},${input.driveMimeType},${input.driveFileSize},${process.env.GOOGLE_DRIVE_CONTENT_HUB_FOLDER_ID ?? ""},${input.userId},${cleanup.toISOString().slice(0,10)}) RETURNING *`;
  return row;
};

export const updateContentHubPost = async (id: string, input: { name: string; date: string; notes: string; userId: string }) => {
  const cleanup = new Date(`${input.date}T00:00:00Z`); cleanup.setUTCDate(cleanup.getUTCDate() + 30);
  const [row] = await db()<ContentHubPost[]>`UPDATE content_hub_posts SET name=${input.name},scheduled_for=${input.date}::date,notes=${input.notes},cleanup_after=${cleanup.toISOString().slice(0,10)},updated_at=now() WHERE id=${id} RETURNING *`;
  return row;
};

export const getContentHubPost = async (id: string) => (await db()<ContentHubPost[]>`SELECT * FROM content_hub_posts WHERE id=${id}`)[0];
export const deleteContentHubPost = async (id: string) => db()`DELETE FROM content_hub_posts WHERE id=${id}`;
export const dueContentHubPosts = async () => db()<Array<ContentHubPost & { drive_parent_folder_id: string }>>`SELECT * FROM content_hub_posts WHERE cleanup_after <= CURRENT_DATE AND drive_deleted_at IS NULL ORDER BY cleanup_after LIMIT 50`;
export const markContentHubDriveDeleted = async (id: string) => db()`UPDATE content_hub_posts SET drive_deleted_at=now(),updated_at=now() WHERE id=${id}`;
export const markContentHubCleanupError = async (id: string, error: string) => db()`UPDATE content_hub_posts SET cleanup_attempts=cleanup_attempts+1,cleanup_last_error=${error.slice(0,1000)},updated_at=now() WHERE id=${id}`;
