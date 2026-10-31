import { db } from "./motm-db";
import { esc, formatMoment } from "./motm-view";

type StatusTone = "ok" | "attention" | "problem" | "unknown";
type ManualAction = "Ja" | "Nee" | "Onbekend";
export type DiagnosticField = { label: string; value: string };
export type StatusCard = { id: string; title: string; tone: StatusTone; label: string; summary: string; detail?: string; href?: string; hrefLabel?: string; diagnostics: DiagnosticField[]; manualAction: ManualAction };

const toneLabel: Record<StatusTone, string> = { ok: "In orde", attention: "Waarschuwing", problem: "Probleem", unknown: "Ontbrekende informatie" };
const ids = ["motm", "discord", "video", "football", "database"] as const;
const titles = ["MOTM", "Discord", "Video Generator", "API-Football", "Database"] as const;
const moment = (value: Date | string | null | undefined) => value ? formatMoment(value) : "Niet geregistreerd";
const field = (label: string, value: unknown): DiagnosticField => ({ label, value: value === null || value === undefined || value === "" ? "Niet beschikbaar" : String(value) });
const card = (value: Omit<StatusCard, "diagnostics" | "manualAction"> & Partial<Pick<StatusCard, "diagnostics" | "manualAction">>): StatusCard => ({ ...value, label: value.label || toneLabel[value.tone], diagnostics: value.diagnostics ?? [], manualAction: value.manualAction ?? "Onbekend" });

const safeErrorCategory = (value: string | null | undefined) => {
  if (!value) return "Geen veilige foutcategorie geregistreerd";
  const text = value.toLowerCase();
  const http = text.match(/(?:http|status)[^0-9]{0,8}([45][0-9]{2})/);
  if (http) return `HTTP ${http[1]}`;
  if (/timeout|timed out|abort/.test(text)) return "Timeout";
  if (/quota|rate.?limit|too many requests|429/.test(text)) return "Quota of rate limit";
  if (/uncertain|unknown|onbekend|niet bevestigd/.test(text)) return "Status niet bevestigd";
  if (/expired|verlopen|stale/.test(text)) return "Verlopen proces";
  return "Provider- of verwerkingsfout (details afgeschermd)";
};

const motmCard = async (): Promise<StatusCard> => {
  const rows = await db()`SELECT id,opponent,status,scheduled_open_at,scheduled_close_at FROM motm_matches WHERE deleted_at IS NULL AND status <> 'closed' ORDER BY kickoff_at ASC LIMIT 8` as Array<{ id: string; opponent: string; status: string; scheduled_open_at: Date | string | null; scheduled_close_at: Date | string | null }>;
  const overdue = rows.find(row => (row.status === "draft" && row.scheduled_open_at && new Date(row.scheduled_open_at).getTime() <= Date.now()) || (row.status === "open" && row.scheduled_close_at && new Date(row.scheduled_close_at).getTime() <= Date.now()));
  if (overdue) return card({ id: "motm", title: "MOTM", tone: "attention", label: "Planning controleren", summary: `Statusovergang voor Ajax — ${overdue.opponent} lijkt achter te lopen.`, detail: "Controleer de geplande openings- of sluitingstijd.", href: `/club/motm/beheer/${overdue.id}`, hrefLabel: "Controleer stemming", manualAction: "Ja", diagnostics: [field("Wedstrijd", `Ajax — ${overdue.opponent}`), field("Opgeslagen status", overdue.status), field("Geplande opening", moment(overdue.scheduled_open_at)), field("Geplande sluiting", moment(overdue.scheduled_close_at))] });
  return card({ id: "motm", title: "MOTM", tone: "ok", label: "In orde", summary: rows.length ? `${rows.length} actuele stemming${rows.length === 1 ? "" : "en"} gecontroleerd.` : "Geen actuele stemming gevonden.", manualAction: "Nee", diagnostics: [field("Actuele stemmingen", rows.length), field("Achterstallige statusovergangen", 0), field("Laatste succesvolle plannercontrole", "Niet afzonderlijk geregistreerd")] });
};

const discordCard = async (): Promise<StatusCard> => {
  const rows = await db()`SELECT id,opponent,announcement_status,announcement_error,announcement_attempted_at FROM motm_matches WHERE deleted_at IS NULL AND (announcement_status IN ('unknown','sending') OR (announcement_status='failed' AND COALESCE(announcement_attempted_at,created_at)>now()-interval '24 hours')) ORDER BY announcement_attempted_at DESC NULLS LAST LIMIT 5` as Array<{ id: string; opponent: string; announcement_status: string; announcement_error: string | null; announcement_attempted_at: Date | string | null }>;
  if (!rows.length) return card({ id: "discord", title: "Discord", tone: "ok", label: "In orde", summary: "Geen actuele meldingen vragen herstel of controle.", manualAction: "Nee", diagnostics: [field("Actuele meldingen met aandacht", 0), field("Laatste succesvolle verzending", "Niet beschikbaar in dit statusoverzicht")] });
  const row = rows[0]; const failed = row.announcement_status === "failed";
  return card({ id: "discord", title: "Discord", tone: failed ? "problem" : "attention", label: failed ? "Niet verstuurd" : "Controle nodig", summary: failed ? `De Discord-mededeling voor Ajax — ${row.opponent} is niet verstuurd.` : `De ontvangst van de Discord-mededeling voor Ajax — ${row.opponent} is niet bevestigd.`, detail: failed ? "Open de wedstrijd om veilig opnieuw te proberen." : "Controleer het Discord-kanaal en leg daarna vast of de melding is geplaatst.", href: `/club/motm/beheer/${row.id}`, hrefLabel: failed ? "Open herstelactie" : "Controleer melding", manualAction: "Ja", diagnostics: [field("Meldingen met aandacht", rows.length), field("Opgeslagen status", row.announcement_status), field("Laatste poging", moment(row.announcement_attempted_at)), field("Foutcategorie", safeErrorCategory(row.announcement_error))] });
};

const videoCard = async (): Promise<StatusCard> => {
  const rows = await db()`SELECT fixture_key,status,updated_at,error,created_at FROM socials_video_jobs WHERE status IN ('submitting','queued','fetching','rendering','uncertain') OR (status='failed' AND updated_at>now()-interval '24 hours') ORDER BY updated_at DESC LIMIT 8` as Array<{ fixture_key: string; status: string; updated_at: Date | string; error: string | null; created_at: Date | string }>;
  if (!rows.length) return card({ id: "video", title: "Video Generator", tone: "ok", label: "In orde", summary: "Geen actieve of recente mislukte renders.", manualAction: "Nee", diagnostics: [field("Actieve of recente probleemjobs", 0), field("Laatste succesvolle render", "Niet beschikbaar in dit statusoverzicht")] });
  const active = rows.filter(row => row.status !== "failed");
  const stale = active.find(row => Date.now() - new Date(row.updated_at).getTime() > 30 * 60_000); const failed = rows.find(row => row.status === "failed"); const selected = stale ?? failed ?? rows[0];
  const diagnostics = [field("Actieve jobs", active.length), field("Opgeslagen status", selected.status), field("Aangemaakt", moment(selected.created_at)), field("Laatst bijgewerkt", moment(selected.updated_at)), field("Foutcategorie", safeErrorCategory(selected.error))];
  if (stale) return card({ id: "video", title: "Video Generator", tone: "attention", label: "Controle nodig", summary: "Een render is langer dan 30 minuten niet bijgewerkt.", detail: "Controleer eerst Shotstack. Bevestig in Socials alleen een vastgelopen opdracht.", href: `/club/tools/socials?fixture=${encodeURIComponent(stale.fixture_key)}&format=video`, hrefLabel: "Controleer render", manualAction: "Ja", diagnostics });
  if (failed) return card({ id: "video", title: "Video Generator", tone: "attention", label: "Render mislukt", summary: "Eén render is mislukt; de Video Generator zelf is niet automatisch defect.", detail: "Controleer de render en probeer alleen bewust opnieuw.", href: `/club/tools/socials?fixture=${encodeURIComponent(failed.fixture_key)}&format=video`, hrefLabel: "Open mislukte render", manualAction: "Ja", diagnostics });
  return card({ id: "video", title: "Video Generator", tone: "ok", label: "Actief", summary: `${rows.length} render${rows.length === 1 ? "" : "s"} wordt verwerkt.`, detail: "De opgeslagen providerstatus is actueel; deze controle vraagt Shotstack niet opnieuw op.", manualAction: "Nee", diagnostics });
};

type FootballStatusRow = { provider_status: string | null; last_success_at: Date | string | null; next_refresh_at: Date | string | null; finished_at: Date | string | null };
export const footballStatusCard = (row: FootballStatusRow | undefined, now = Date.now()): StatusCard => {
  if (!row) return card({ id: "football", title: "API-Football", tone: "unknown", label: "Geen actuele wedstrijd", summary: "Er is geen actuele fixture om de refreshstatus aan te toetsen.", detail: "Geen actie nodig.", manualAction: "Nee", diagnostics: [field("Actuele fixture", "Niet beschikbaar"), field("Quota", "Niet betrouwbaar beschikbaar")] });
  const refreshDue = Boolean(row.next_refresh_at && new Date(row.next_refresh_at).getTime() < now && !row.finished_at);
  return card({ id: "football", title: "API-Football", tone: row.last_success_at ? "ok" : "unknown", label: row.last_success_at ? (refreshDue ? "Refresh beschikbaar" : "In orde") : "Nog geen refreshdata", summary: refreshDue ? "De volgende aanvraag mag de fixturegegevens automatisch vernieuwen." : row.last_success_at ? `Fixturestatus: ${row.provider_status ?? "onbekend"}.` : "Nog geen succesvolle fixture-refresh vastgelegd.", detail: row.last_success_at ? "Geen staffactie nodig." : "Dit is zonder bevestigde providerfout geen storing.", manualAction: "Nee", diagnostics: [field("Providerstatus", row.provider_status ?? "Niet geregistreerd"), field("Laatste succesvolle refresh", moment(row.last_success_at)), field("Volgende refresh toegestaan", moment(row.next_refresh_at)), field("Refresh nu toegestaan", refreshDue ? "Ja" : "Nee"), field("Quota", "Niet betrouwbaar beschikbaar"), field("Providerfouten", "Niet persistent opgeslagen")] });
};
const footballCard = async () => { const [row] = await db()`SELECT provider_status,last_success_at,next_refresh_at,finished_at FROM matchday_fixtures WHERE finished_at IS NULL ORDER BY kickoff_at ASC LIMIT 1` as Array<FootballStatusRow>; return footballStatusCard(row); };

const databaseCard = async (): Promise<StatusCard> => {
  const rows = await db()`SELECT migration_name,checksum_sha256 FROM schema_migrations WHERE migration_name IN ('034_motm_announcement_delivery.sql','035_migration_registry.sql') ORDER BY migration_name` as Array<{ migration_name: string; checksum_sha256: string }>;
  const has034 = rows.some(row => row.migration_name === "034_motm_announcement_delivery.sql"); const has035 = rows.some(row => row.migration_name === "035_migration_registry.sql");
  const diagnostics = [field("Databasequery", "Geslaagd"), field("Migratie 034 geregistreerd", has034 ? "Ja" : "Nee"), field("Migratie 035 geregistreerd", has035 ? "Ja" : "Nee")];
  if (!has034 || !has035) return card({ id: "database", title: "Database", tone: "problem", label: "Technisch beheer nodig", summary: "De bevestigde migratieregistratie vanaf 035 is niet compleet.", detail: "Geen veilige herstelactie in AjaxPro. Laat technisch beheer de productiemigraties controleren.", manualAction: "Ja", diagnostics });
  return card({ id: "database", title: "Database", tone: "ok", label: "Bereikbaar", summary: "Database bereikbaar; migraties 034 en 035 geregistreerd.", detail: "Geen wijzigingen uitgevoerd door deze controle.", manualAction: "Nee", diagnostics });
};

export const loadSystemStatus = async () => {
  const results = await Promise.allSettled([motmCard, discordCard, videoCard, footballCard, databaseCard].map(load => load()));
  return results.map((result, index) => result.status === "fulfilled" ? result.value : card({ id: ids[index], title: titles[index], tone: "unknown", label: "Niet vast te stellen", summary: "Status kon niet betrouwbaar worden opgehaald.", detail: "Probeer opnieuw; de oorzaak is niet veilig beschikbaar in dit overzicht.", manualAction: "Onbekend", diagnostics: [field("Statusquery", "Mislukt"), field("Foutcategorie", "Statusquery mislukt; details afgeschermd")] }));
};

const redact = (input: string) => {
  if (/postgres(?:ql)?:\/\/|(?:api[-_]?key|token|secret|password|cookie|authorization)\s*[:=]/i.test(input) || /^\s*at\s+\S+\s*\(/.test(input)) return "[afgeschermd]";
  return input.replace(/[\r\n]+/g, " ").slice(0, 300);
};
export const buildSystemStatusReport = (cards: readonly StatusCard[], checkedAt = new Date()) => {
  const attention = cards.filter(value => value.tone === "attention" || value.tone === "problem");
  const lines = ["AjaxPro systeemrapport", `Controletijdstip: ${formatMoment(checkedAt)}`, "Tijdzone: Europe/Amsterdam", `Actuele aandachtspunten: ${attention.length ? attention.map(value => value.title).join(", ") : "Geen"}`, ""];
  for (const value of cards) lines.push(`[${value.title}]`, `Classificatie: ${toneLabel[value.tone]}`, `Status: ${redact(value.label)}`, `Samenvatting: ${redact(value.summary)}`, `Handmatige actie noodzakelijk: ${value.manualAction}`, `Toelichting: ${redact(value.detail ?? "Niet beschikbaar")}`, "Technische details:", ...(value.diagnostics.length ? value.diagnostics.map(item => `- ${redact(item.label)}: ${redact(item.value)}`) : ["- Geen verifieerbare technische details beschikbaar" ]), "");
  lines.push("Beoordeel deze AjaxPro-systeemstatus. Maak onderscheid tussen echte problemen, normale situaties en ontbrekende meetgegevens. Geef maximaal drie prioriteiten en maak waar nodig een gerichte Codex-opdracht. Veronderstel geen oorzaken zonder bewijs.");
  return lines.join("\n");
};

const diagnosticMarkup = (value: StatusCard) => `<details class="system-status-card__diagnostics"><summary>Technische details</summary><dl>${value.diagnostics.map(item => `<div><dt>${esc(item.label)}</dt><dd>${esc(item.value)}</dd></div>`).join("")}<div><dt>Handmatige actie</dt><dd>${value.manualAction}</dd></div></dl></details>`;
const cardMarkup = (value: StatusCard) => `<article class="system-status-card system-status-card--${value.tone}"><div class="system-status-card__top"><span class="system-status-card__icon system-status-card__icon--${value.id}" aria-hidden="true"></span><div><p class="eyebrow">${esc(value.label)}</p><h2>${esc(value.title)}</h2></div><span class="system-status-card__signal" aria-hidden="true"></span></div><p class="system-status-card__summary">${esc(value.summary)}</p>${value.detail ? `<p class="system-status-card__detail">${esc(value.detail)}</p>` : ""}${value.href ? `<a class="system-status-card__link" href="${esc(value.href)}">${esc(value.hrefLabel ?? "Open beheer")}</a>` : ""}${diagnosticMarkup(value)}</article>`;

export const systemStatusMarkup = (cards: readonly StatusCard[], checkedAt = new Date()) => {
  const attention = cards.filter(value => value.tone === "attention" || value.tone === "problem").length; const label = attention === 0 ? "Alles in orde" : `${attention} aandachtspunt${attention === 1 ? "" : "en"}`; const report = buildSystemStatusReport(cards, checkedAt);
  return `<main class="motm-main system-status-main"><header class="page-heading"><a class="back" href="/club/tools">Terug naar staff-tools</a><div class="page-heading__row"><div><div class="system-status-title-row"><h1>Systeemstatus</h1><span class="system-status-overall system-status-overall--${attention ? "attention" : "ok"}" role="status">${esc(label)}</span></div><p class="system-status-checked">Laatste controle: ${esc(formatMoment(checkedAt))}</p></div><div class="system-status-header-actions"><button class="button secondary system-status-copy" type="button" data-copy-system-report>Kopieer systeemrapport</button><a class="button secondary system-status-refresh" href="/club/tools?view=system-status">Ververs</a></div></div><p class="system-status-copy-feedback" data-copy-feedback role="status" aria-live="polite"></p></header><section class="system-status-grid" aria-label="Systeemstatus">${cards.map(cardMarkup).join("")}</section><textarea class="system-status-report-source" data-system-report readonly aria-hidden="true" tabindex="-1">${esc(report)}</textarea><footer class="system-status-footer"><span>Workflowstatus is niet beschikbaar binnen AjaxPro.</span><a href="https://github.com/AJAXPRO-020/ajaxpro-hub/actions" target="_blank" rel="noreferrer">GitHub Actions</a></footer></main>`;
};
