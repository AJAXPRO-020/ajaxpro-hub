import { dueContentHubPosts, deleteContentHubPost, listContentHubPosts, markContentHubCleanupError } from "../../lib/content-hub-db";
import { deleteFile, listUnclaimedUploads } from "../../lib/content-hub-drive";

export async function runContentHubCleanup(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Unauthorized", { status: 401 });
  const posts = await dueContentHubPosts();
  for (const post of posts) {
    try { await deleteFile(post.drive_file_id); await deleteContentHubPost(post.id); }
    catch (error) { await markContentHubCleanupError(post.id, error instanceof Error ? error.message : "Onbekende cleanup-fout"); }
  }
  const claimed = (await listContentHubPosts("1900-01-01", "2999-12-31")).map((post) => post.drive_file_id);
  const orphans = await listUnclaimedUploads(claimed);
  for (const file of orphans) {
    try { await deleteFile(file.id!); }
    catch (error) { console.error("Content Hub orphan cleanup failed", file.id, error); }
  }
  return Response.json({ ok: true, processed: posts.length, orphans: orphans.length });
}
