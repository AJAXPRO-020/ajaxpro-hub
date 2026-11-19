import { readFile } from "node:fs/promises";
import { readSession } from "../lib/discord-auth";

const loginMarkup = `<a class="header-login" href="https://ajaxpro.fans/club">Inloggen</a>`;
const clubMarkup = `<a class="header-login" href="https://ajaxpro.fans/club">Naar de Club</a>`;

export async function GET(request: Request) {
  const html = await readFile("index.html", "utf8");
  const user = await readSession(request);
  const rendered = html.replace(clubMarkup, user ? clubMarkup : loginMarkup);
  return new Response(rendered, {
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
