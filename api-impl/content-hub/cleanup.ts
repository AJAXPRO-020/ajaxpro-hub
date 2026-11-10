import { dueContentHubPosts, deleteContentHubPost, markContentHubCleanupError } from "../../lib/content-hub-db";
import { deleteFile } from "../../lib/content-hub-drive";

export async function runContentHubCleanup(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Unauthorized", { status: 401 });
  const posts = await dueContentHubPosts();
  for (const post of posts) {
    try { await deleteFile(post.drive_file_id); await deleteContentHubPost(post.id); }
    catch (error) { await markContentHubCleanupError(post.id, error instanceof Error ? error.message : "Onbekende cleanup-fout"); }
  }
  return Response.json({ ok: true, processed: posts.length });
}
