import { isSameOrigin } from "../lib/discord-auth";
import { getSessionWithPermission } from "../lib/server-permissions";
import type { Session } from "../lib/discord-auth";
import { permissions } from "../lib/permissions.config";
import { db } from "../lib/motm-db";
import { esc, errorPage, page, pageHeader } from "../lib/motm-view";
import { playerMainStatus } from "../lib/player-registry";

const selectionOptions = [["", "Onbekend"],["first_team", "Eerste elftal"],["youth", "Jeugd"],["outside", "Buiten selectie"]] as const;
const contractOptions = [["", "Onbekend"],["owned", "Eigen speler"],["loaned_in", "Gehuurd"],["no_contract", "Geen contract"],["unknown", "Onbekend"]] as const;
const photoOptions = [["normal", "Normale foto"],["meme", "Meme-foto"]] as const;
const selectionValues: Set<string> = new Set(selectionOptions.map(([value]) => value));
const contractValues: Set<string> = new Set(contractOptions.map(([value]) => value));
const photoValues: Set<string> = new Set(photoOptions.map(([value]) => value));

const manager = (request: Request) => getSessionWithPermission(request, permissions.playerRegistryManage);
const optionMarkup = (options: readonly (readonly [string, string])[], value: unknown) => options.map(([key, label]) => `<option value="${key}"${String(value ?? "") === key ? " selected" : ""}>${label}</option>`).join("");
const label = (value: unknown, options: readonly (readonly [string, string])[]) => options.find(([key]) => key === value)?.[1] ?? "Onbekend";
const dealContext = (value: unknown) => {
  if (!value || typeof value !== "object") return "Niet vastgelegd";
  const deal = value as { fromClub?: string; transferType?: string; status?: string; terms?: string[]; note?: string; sources?: {label?: string; url?: string}[] };
  return [deal.fromClub, deal.transferType, deal.status === "confirmed" ? "Bron bevestigd" : deal.status === "partly_reported" || deal.status === "reported" ? "Deels gemeld" : null, ...(Array.isArray(deal.terms) ? deal.terms : []), deal.note, ...(Array.isArray(deal.sources) ? deal.sources.map(source => source.label) : [])].filter(Boolean).join(" · ") || "Niet vastgelegd";
};
const statusConflicts = (row: any) => {
  const issues: string[] = [];
  if (row.loaned_out && !row.loan_club) issues.push("Verhuurd, maar uitleenclub ontbreekt");
  if (!row.loaned_out && row.loan_club) issues.push("Uitleenclub vastgelegd, maar verhuurstatus staat op nee");
  if (row.contract_form === "loaned_in" && !/^gehuurd van\s+/i.test(row.contract_note ?? "") && !row.arrival_deal?.fromClub) issues.push("Gehuurd, maar herkomstclub ontbreekt");
  if (row.contract_form === "no_contract" && row.contract_end) issues.push("Geen contract, maar contracteinde is nog ingevuld");
  return issues;
};
const validImageUrl = (value: string) => value.length <= 2000 && !/[\\\s]/.test(value) && (/^\/assets\//.test(value) || (() => {try {const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}})());
const imageUrlIsUsable = async (request: Request, value: string) => {
  try {
    const target = new URL(value, request.url);
    let response = await fetch(target, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    if (!response.ok || !/^image\//i.test(response.headers.get("content-type") ?? "")) {
      response = await fetch(target, { headers: { Range: "bytes=0-1023" }, signal: AbortSignal.timeout(5000) });
      response.body?.cancel();
    }
    return response.ok && /^image\//i.test(response.headers.get("content-type") ?? "");
  } catch {
    return false;
  }
};

const photoActions = (photo: any, playerId: string) => `<details class="player-photo__menu"><summary>Acties</summary><div class="player-photo__actions">${photo.photo_type === "normal" ? `<form method="post" action="/api/club-tools?view=player-registry"><input type="hidden" name="intent" value="set-default"><input type="hidden" name="playerId" value="${esc(playerId)}"><input type="hidden" name="photoId" value="${esc(photo.id)}"><button class="button secondary" type="submit">Als standaard instellen</button></form>` : ""}<form method="post" action="/api/club-tools?view=player-registry"><input type="hidden" name="intent" value="move-photo"><input type="hidden" name="playerId" value="${esc(playerId)}"><input type="hidden" name="photoId" value="${esc(photo.id)}"><input type="hidden" name="photoType" value="${esc(photo.photo_type)}"><input type="hidden" name="direction" value="up"><button class="button secondary" type="submit">Omhoog</button></form><form method="post" action="/api/club-tools?view=player-registry"><input type="hidden" name="intent" value="move-photo"><input type="hidden" name="playerId" value="${esc(playerId)}"><input type="hidden" name="photoId" value="${esc(photo.id)}"><input type="hidden" name="photoType" value="${esc(photo.photo_type)}"><input type="hidden" name="direction" value="down"><button class="button secondary" type="submit">Omlaag</button></form><form method="post" action="/api/club-tools?view=player-registry"><input type="hidden" name="intent" value="delete-photo"><input type="hidden" name="photoId" value="${esc(photo.id)}"><button class="button danger" type="submit">Foto verwijderen</button></form></div></details>`;
const photoCard = (photo: any, playerId: string, position: number) => `<article class="player-photo player-photo--${photo.photo_type}" data-photo-id="${esc(photo.id)}"><div class="player-photo__media"><img src="${esc(photo.image_url)}" alt="" loading="lazy"><span class="player-photo__missing" role="status" hidden>Afbeelding niet beschikbaar</span></div><div class="player-photo__copy"><strong>${photo.photo_type === "meme" ? "Meme-foto" : "Alternatieve normale foto"}</strong><small>Positie ${position + 1}</small></div>${photoActions(photo, playerId)}</article>`;
const photoCards = (photos: any[], officialUrl: string, playerId: string) => {
  const normal = photos.filter(photo => photo.photo_type === "normal");
  const memes = photos.filter(photo => photo.photo_type === "meme");
  const group = (title: string, items: any[], className = "") => items.length ? `<section class="player-photo-group ${className}"><div class="player-photo-group__heading"><h4>${title}</h4><span>${items.length} ${items.length === 1 ? "foto" : "foto's"}</span></div><div class="player-photo-grid">${items.map((photo, index) => photoCard(photo, playerId, index)).join("")}</div></section>` : "";
  return `<section class="player-photo-group player-photo-group--official"><div class="player-photo-group__heading"><h4>Officiële foto</h4><span>Standaard voor alle tools</span></div><div class="player-photo-grid"><article class="player-photo player-photo--official"><div class="player-photo__media"><img src="${esc(officialUrl)}" alt="" loading="lazy"><span class="player-photo__missing" role="status" hidden>Afbeelding niet beschikbaar</span></div><div class="player-photo__copy"><strong>Officiële standaardfoto</strong><small>Gebruikt door MOTM, Match Center, Socials en Opstellingmaker</small></div><span class="player-photo__badge">Standaard</span></article></div></section>${group("Alternatieve foto's", normal, "player-photo-group--normal")}${group("Meme-foto's", memes, "player-photo-group--meme")}`;
};

export async function GET(request: Request) {
  const session = await manager(request);
  if (!session) return errorPage("Geen toegang", "Deze beheerfunctie is alleen beschikbaar voor AjaxPro-staf.", 403, undefined, "/club/tools", "tools");
  const rows = await db()`SELECT id,name,position,shirt_number,image_url,active,selection_group,contract_form,loaned_out,loan_club,contract_end,contract_position,contract_note,loan_end,loan_note,loan_deal,arrival_deal FROM ajax_players ORDER BY name`;
  const photos = await db()`SELECT id,player_id,photo_type,image_url,sort_order,is_default FROM ajax_player_photos ORDER BY player_id,CASE photo_type WHEN 'official' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,sort_order,id`;
  const byPlayer = new Map<string, any[]>();
  for (const photo of photos) byPlayer.set(String(photo.player_id), [...(byPlayer.get(String(photo.player_id)) ?? []), photo]);
  const body = rows.map((row: any) => { const mainStatus = playerMainStatus({active: Boolean(row.active), selectionGroup: row.selection_group, contractForm: row.contract_form, loanedOut: Boolean(row.loaned_out)}); return `<article class="management-section" data-player-id="${esc(row.id)}" data-number="${row.shirt_number ?? "–"}" data-official-image="${esc(row.image_url)}" data-main-status="${mainStatus}"><header><p class="eyebrow">${esc(row.position)}</p><h2>${esc(row.name)}</h2></header>${statusConflicts(row).map(issue => `<p class="registry-conflict" role="status">Controleer gegevens: ${esc(issue)}</p>`).join("")}<dl class="registry-contract-context"><div><dt>Contractpositie</dt><dd>${esc(row.contract_position || "Niet vastgelegd")}</dd></div><div><dt>Contracteinde</dt><dd>${esc(row.contract_end ? new Date(row.contract_end).toLocaleDateString("nl-NL") : "Niet vastgelegd")}</dd></div><div><dt>Uitleenclub</dt><dd>${esc(row.loan_club || "Niet van toepassing")}</dd></div><div><dt>Uitgeleend tot</dt><dd>${esc(row.loan_end ? new Date(row.loan_end).toLocaleDateString("nl-NL") : "Niet vastgelegd")}</dd></div><div><dt>Contractopmerking</dt><dd>${esc(row.contract_note || "Geen opmerking")}</dd></div><div><dt>Uitleenopmerking</dt><dd>${esc(row.loan_note || "Geen opmerking")}</dd></div><div><dt>Uitleenafspraken</dt><dd>${esc(dealContext(row.loan_deal))}</dd></div><div><dt>Herkomst en transfer</dt><dd>${esc(dealContext(row.arrival_deal))}</dd></div></dl><form method="post" action="/api/club-tools?view=player-registry"><input type="hidden" name="intent" value="save-player"><input type="hidden" name="playerId" value="${esc(row.id)}"><div class="form-grid"><label>Naam<input required name="name" value="${esc(row.name)}"></label><label>Rugnummer<input name="shirtNumber" type="number" min="0" max="99" value="${row.shirt_number ?? ""}"></label><label>Positie<input required name="position" value="${esc(row.position)}"></label><label>Selectie<select name="selectionGroup">${optionMarkup(selectionOptions,row.selection_group)}</select></label><label>Contractvorm<select name="contractForm">${optionMarkup(contractOptions,row.contract_form)}</select></label><label>Verhuurd<select name="loanedOut"><option value="0"${!row.loaned_out ? " selected" : ""}>Nee</option><option value="1"${row.loaned_out ? " selected" : ""}>Ja</option></select></label></div><button class="button secondary" type="submit">Speler opslaan</button></form><section class="player-photos"><h3>Fotobibliotheek</h3><div class="player-photo-library">${photoCards(byPlayer.get(String(row.id)) ?? [], String(row.image_url), String(row.id))}</div><form method="post" action="/api/club-tools?view=player-registry" class="photo-add-form"><input type="hidden" name="intent" value="add-photo"><input type="hidden" name="playerId" value="${esc(row.id)}"><div class="form-grid"><label>Afbeeldings-URL<input required name="imageUrl" type="text" inputmode="url" placeholder="/assets/... of https://..."></label><label>Type<select name="photoType">${optionMarkup(photoOptions,"normal")}</select></label></div><button class="button secondary" type="submit">Foto registreren</button></form></section></article>`; }).join("");
  return page("Spelersbeheer", `<main class="motm-main admin registry" data-registry><div class="page-heading">${pageHeader("Spelersbeheer","Staff-tools","/club/tools","Terug")}</div><p class="page-intro">Beheer spelersgegevens, selectie en contractinformatie. De officiële foto blijft de standaard voor alle bestaande tools.</p>${body || '<section class="empty"><h2>Geen spelers gevonden</h2></section>'}</main>`, "/player-registry.js?v=20261122-current-archive-3", session, "tools", undefined, {stylesheets:["/player-registry.css?v=20261122-current-archive-3"]});
}

export async function POST(request: Request) {
  const session: Session | null = await manager(request);
  if (!session) return new Response("Forbidden", { status: 403 });
  if (!isSameOrigin(request)) return new Response("Ongeldige aanvraag", { status: 403 });
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const redirectBack = () => new Response(null, { status: 303, headers: { Location: "/club/tools/player-registry?saved=1" } });
  if (intent === "save-player") {
    const playerId = String(form.get("playerId") ?? ""), name = String(form.get("name") ?? "").trim(), position = String(form.get("position") ?? "").trim(), shirtNumber = String(form.get("shirtNumber") ?? "").trim(), selectionGroup = String(form.get("selectionGroup") ?? ""), contractForm = String(form.get("contractForm") ?? "");
    if (!playerId || !selectionValues.has(selectionGroup) || !contractValues.has(contractForm)) return new Response("Ongeldige status", { status: 400 });
    if (!name || !position || (shirtNumber && (!/^\d+$/.test(shirtNumber) || Number(shirtNumber) > 99))) return new Response("Ongeldige spelergegevens", { status: 400 });
    await db()`UPDATE ajax_players SET name=${name},position=${position},shirt_number=${shirtNumber ? Number(shirtNumber) : null},selection_group=${selectionGroup || null},contract_form=${contractForm || null},loaned_out=${String(form.get("loanedOut") ?? "") === "1"} WHERE id=${playerId}`;
    return redirectBack();
  }
  if (intent === "add-photo") {
    const playerId = String(form.get("playerId") ?? ""), imageUrl = String(form.get("imageUrl") ?? "").trim(), photoType = String(form.get("photoType") ?? ""), sortOrder = Number(form.get("sortOrder") ?? 0);
    if (!playerId || !validImageUrl(imageUrl) || !photoValues.has(photoType) || !Number.isInteger(sortOrder) || sortOrder < 0 || !(await imageUrlIsUsable(request, imageUrl))) return new Response("Afbeelding is niet bereikbaar", { status: 400 });
    const [player] = await db()`SELECT image_url FROM ajax_players WHERE id=${playerId}`;
    if (!player || player.image_url === imageUrl) return new Response("Deze foto is al de officiële standaardfoto", { status: 400 });
    await db()`INSERT INTO ajax_player_photos(player_id,photo_type,image_url,sort_order) VALUES(${playerId},${photoType},${imageUrl},${sortOrder}) ON CONFLICT (player_id,photo_type,image_url) DO UPDATE SET sort_order=EXCLUDED.sort_order,updated_at=now()`;
    return redirectBack();
  }
  if (intent === "delete-photo") {
    const photoId = Number(form.get("photoId"));
    if (!Number.isInteger(photoId) || photoId < 1) return new Response("Ongeldige foto", { status: 400 });
    await db()`DELETE FROM ajax_player_photos WHERE id=${photoId} AND photo_type IN ('normal','meme')`;
    return redirectBack();
  }
  if (intent === "save-order") {
    const photoId=Number(form.get('photoId')),sortOrder=Number(form.get('sortOrder'));
    if(!Number.isSafeInteger(photoId)||photoId<1||!Number.isSafeInteger(sortOrder)||sortOrder<0)return new Response('Ongeldige volgorde',{status:400});
    await db()`UPDATE ajax_player_photos SET sort_order=${sortOrder},updated_at=now() WHERE id=${photoId} AND photo_type IN ('normal','meme')`;
    return redirectBack();
  }
  if (intent === "move-photo") {
    const playerId = String(form.get("playerId") ?? ""), photoId = Number(form.get("photoId")), photoType = String(form.get("photoType") ?? ""), direction = String(form.get("direction") ?? "");
    if (!playerId || !Number.isSafeInteger(photoId) || photoId < 1 || !photoValues.has(photoType) || !["up", "down"].includes(direction)) return new Response("Ongeldige foto-volgorde", { status: 400 });
    await db().begin(async tx => {
      const photos = await tx`SELECT id FROM ajax_player_photos WHERE player_id=${playerId} AND photo_type=${photoType} ORDER BY sort_order,id`;
      const index = photos.findIndex((photo: any) => Number(photo.id) === photoId);
      const target = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || target < 0 || target >= photos.length) return;
      const reordered = [...photos];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      for (let order = 0; order < reordered.length; order++) await tx`UPDATE ajax_player_photos SET sort_order=${order},updated_at=now() WHERE id=${reordered[order].id}`;
    });
    return redirectBack();
  }
  if (intent === "set-default") {
    const playerId = String(form.get("playerId") ?? ""), photoId = Number(form.get("photoId"));
    if (!playerId || !Number.isInteger(photoId) || photoId < 1) return new Response("Ongeldige standaardfoto", { status: 400 });
    try {
      await db().begin(async tx => {
        const [player] = await tx`SELECT image_url FROM ajax_players WHERE id=${playerId} FOR UPDATE`;
        const [selected] = await tx`SELECT image_url FROM ajax_player_photos WHERE id=${photoId} AND player_id=${playerId} AND photo_type='normal'`;
        if (!player || !selected) throw new Error("Foto hoort niet bij deze speler");
        if (!(await imageUrlIsUsable(request, String(selected.image_url)))) throw new Error("Afbeelding is niet bereikbaar");
        await tx`UPDATE ajax_player_photos SET is_default=false WHERE player_id=${playerId} AND photo_type='normal' AND is_default=true`;
        await tx`DELETE FROM ajax_player_photos WHERE id=${photoId}`;
        await tx`DELETE FROM ajax_player_photos WHERE player_id=${playerId} AND photo_type='official'`;
        if (!String(player.image_url).endsWith("/motm-winner-placeholder.svg")) await tx`INSERT INTO ajax_player_photos(player_id,photo_type,image_url,sort_order) VALUES(${playerId},'normal',${player.image_url},0) ON CONFLICT (player_id,photo_type,image_url) DO NOTHING`;
        await tx`UPDATE ajax_players SET image_url=${selected.image_url},updated_at=now() WHERE id=${playerId}`;
        await tx`INSERT INTO ajax_player_photos(player_id,photo_type,image_url,sort_order) VALUES(${playerId},'official',${selected.image_url},0)`;
      });
    } catch (error) {
      if (error instanceof Error && ["Foto hoort niet bij deze speler", "Afbeelding is niet bereikbaar"].includes(error.message)) return new Response(error.message, { status: 400 });
      throw error;
    }
    return redirectBack();
  }
  return new Response("Ongeldige actie", { status: 400 });
}
