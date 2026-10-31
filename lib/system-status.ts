import { db } from "./motm-db";
import { esc, formatMoment } from "./motm-view";

type StatusTone = "ok" | "attention" | "problem" | "unknown";
type StatusCard = { id: string; title: string; tone: StatusTone; label: string; summary: string; detail?: string; href?: string; hrefLabel?: string };

const toneLabel: Record<StatusTone, string> = { ok: "In orde", attention: "Aandacht", problem: "Probleem", unknown: "Onbekend" };
const card = (value: StatusCard) => ({ ...value, label: value.label || toneLabel[value.tone] });

const motmCard = async (): Promise<StatusCard> => {
  const rows = await db()`SELECT opponent,status,scheduled_open_at,scheduled_close_at
    FROM motm_matches
    WHERE deleted_at IS NULL AND status <> 'closed'
    ORDER BY kickoff_at ASC
    LIMIT 8` as Array<{ opponent: string; status: string; scheduled_open_at: Date | string | null; scheduled_close_at: Date | string | null }>;
  const now = Date.now();
  const overdue = rows.find(row =>
    (row.status === "draft" && row.scheduled_open_at && new Date(row.scheduled_open_at).getTime() <= now)
    || (row.status === "open" && row.scheduled_close_at && new Date(row.scheduled_close_at).getTime() <= now));
  if (overdue) return card({ id: "motm", title: "MOTM", tone: "attention", label: "Planning controleren", summary: `Statusovergang voor Ajax — ${overdue.opponent} lijkt achter te lopen.`, detail: "Controleer de stemming en planning in MOTM-beheer.", href: "/club/motm/beheer", hrefLabel: "Open MOTM-beheer" });
  return card({ id: "motm", title: "MOTM", tone: "ok", label: "In orde", summary: rows.length ? `${rows.length} actuele stemming${rows.length === 1 ? "" : "en"} gecontroleerd.` : "Geen actuele stemming gevonden.", href: "/club/motm/beheer", hrefLabel: "Naar MOTM-beheer" });
};

const discordCard = async (): Promise<StatusCard> => {
  const rows = await db()`SELECT opponent,announcement_status,announcement_error,announcement_attempted_at
    FROM motm_matches
    WHERE deleted_at IS NULL AND (
      announcement_status IN ('unknown','sending')
      OR (announcement_status='failed' AND COALESCE(announcement_attempted_at,created_at)>now()-interval '24 hours')
    )
    ORDER BY announcement_attempted_at DESC NULLS LAST
    LIMIT 5` as Array<{ opponent: string; announcement_status: string; announcement_error: string | null; announcement_attempted_at: Date | string | null }>;
  if (!rows.length) return card({ id: "discord", title: "Discord", tone: "ok", label: "In orde", summary: "Geen actuele meldingen vragen herstel of controle.", href: "/club/motm/beheer", hrefLabel: "Naar MOTM-beheer" });
  const row = rows[0];
  const action = row.announcement_status === "unknown" || row.announcement_status === "sending" ? "Controleer Discord handmatig." : "Bevestig de melding en probeer zo nodig opnieuw.";
  return card({ id: "discord", title: "Discord", tone: row.announcement_status === "failed" ? "problem" : "attention", label: row.announcement_status === "failed" ? "Herstel nodig" : "Controle nodig", summary: `${rows.length} melding${rows.length === 1 ? "" : "en"} met aandacht voor Ajax — ${row.opponent}.`, detail: `${action}${row.announcement_error ? ` ${row.announcement_error}` : ""}`, href: "/club/motm/beheer", hrefLabel: "Open MOTM-beheer" });
};

const videoCard = async (): Promise<StatusCard> => {
  const rows = await db()`SELECT status,updated_at,error,created_at
    FROM socials_video_jobs
    WHERE status IN ('submitting','queued','fetching','rendering','uncertain')
       OR (status='failed' AND updated_at>now()-interval '24 hours')
    ORDER BY updated_at DESC
    LIMIT 8` as Array<{ status: string; updated_at: Date | string; error: string | null; created_at: Date | string }>;
  if (!rows.length) return card({ id: "video", title: "Video Generator", tone: "ok", label: "In orde", summary: "Geen actieve of recente mislukte renders." , href: "/club/tools/socials", hrefLabel: "Open Socials" });
  const stale = rows.find(row => ["submitting","queued","fetching","rendering","uncertain"].includes(row.status) && Date.now() - new Date(row.updated_at).getTime() > 30 * 60_000);
  const failed = rows.find(row => row.status === "failed");
  if (stale) return card({ id: "video", title: "Video Generator", tone: "attention", label: "Vastgelopen", summary: "Een render is langer dan 30 minuten niet bijgewerkt.", detail: "Controleer Shotstack in Socials; start geen automatische nieuwe render.", href: "/club/tools/socials", hrefLabel: "Open Socials" });
  if (failed) return card({ id: "video", title: "Video Generator", tone: "attention", label: "Actie nodig", summary: "Een individuele render is mislukt; de generator is niet automatisch defect.", detail: failed.error ?? "Controleer de render in Socials.", href: "/club/tools/socials", hrefLabel: "Open Socials" });
  return card({ id: "video", title: "Video Generator", tone: "ok", label: "Actief", summary: `${rows.length} render${rows.length === 1 ? "" : "s"} wordt verwerkt.`, detail: "De opgeslagen providerstatus is actueel; er wordt hier geen Shotstack-call uitgevoerd.", href: "/club/tools/socials", hrefLabel: "Open Socials" });
};

const footballCard = async (): Promise<StatusCard> => {
  const [row] = await db()`SELECT provider_status,last_success_at,next_refresh_at,finished_at
    FROM matchday_fixtures
    WHERE finished_at IS NULL
    ORDER BY kickoff_at ASC
    LIMIT 1` as Array<{ provider_status: string | null; last_success_at: Date | string | null; next_refresh_at: Date | string | null; finished_at: Date | string | null }>;
  if (!row) return card({ id: "football", title: "API-Football", tone: "unknown", label: "Geen actuele data", summary: "Er is geen actuele fixture om de refreshstatus aan te toetsen." });
  const stale = row.next_refresh_at && new Date(row.next_refresh_at).getTime() < Date.now() && !row.finished_at;
  if (stale) return card({ id: "football", title: "API-Football", tone: "attention", label: "Refresh achterstallig", summary: "De opgeslagen fixture-refresh staat opnieuw gepland.", detail: row.last_success_at ? `Laatste succesvolle refresh: ${formatMoment(row.last_success_at)}.` : "Geen succesvolle refresh vastgelegd." });
  return card({ id: "football", title: "API-Football", tone: row.last_success_at ? "ok" : "unknown", label: row.last_success_at ? "In orde" : "Onbekend", summary: row.last_success_at ? `Fixturestatus: ${row.provider_status ?? "onbekend"}.` : "Nog geen succesvolle refresh vastgelegd.", detail: row.last_success_at ? `Laatste succesvolle refresh: ${formatMoment(row.last_success_at)}.` : "Quota en providerfouten worden niet persistent opgeslagen." });
};

const databaseCard = async (): Promise<StatusCard> => {
  const rows = await db()`SELECT migration_name,checksum_sha256 FROM schema_migrations WHERE migration_name IN ('034_motm_announcement_delivery.sql','035_migration_registry.sql') ORDER BY migration_name` as Array<{ migration_name: string; checksum_sha256: string }>;
  const has034 = rows.some(row => row.migration_name === "034_motm_announcement_delivery.sql");
  const has035 = rows.some(row => row.migration_name === "035_migration_registry.sql");
  if (!has034 || !has035) return card({ id: "database", title: "Database", tone: "problem", label: "Migratie ontbreekt", summary: "De bevestigde migratieregistratie vanaf 035 is niet compleet.", detail: "Stop en controleer de migratiestatus voordat je verder werkt.", href: "/club/tools?view=system-status", hrefLabel: "Status opnieuw controleren" });
  return card({ id: "database", title: "Database", tone: "ok", label: "Bereikbaar", summary: "Database bereikbaar; migraties 034 en 035 geregistreerd.", detail: "Geen wijzigingen uitgevoerd door deze controle." });
};

export const loadSystemStatus = async () => {
  const loaders = [motmCard, discordCard, videoCard, footballCard, databaseCard];
  const results = await Promise.allSettled(loaders.map(load => load()));
  const cards = results.map((result, index) => result.status === "fulfilled" ? result.value : card({ id: ["motm","discord","video","football","database"][index], title: ["MOTM","Discord","Video Generator","API-Football","Database"][index], tone: "unknown", label: "Niet vast te stellen", summary: "Status kon niet betrouwbaar worden opgehaald.", detail: "Probeer opnieuw of open het bestaande beheeronderdeel." }));
  return cards;
};

const cardMarkup = (value: StatusCard) => `<article class="system-status-card system-status-card--${value.tone}"><div class="system-status-card__top"><span class="system-status-card__icon system-status-card__icon--${value.id}" aria-hidden="true"></span><div><p class="eyebrow">${esc(value.label)}</p><h2>${esc(value.title)}</h2></div><span class="system-status-card__signal" aria-hidden="true"></span></div><p class="system-status-card__summary">${esc(value.summary)}</p>${value.detail ? `<p class="system-status-card__detail">${esc(value.detail)}</p>` : ""}${value.href ? `<a class="system-status-card__link" href="${esc(value.href)}">${esc(value.hrefLabel ?? "Open beheer")}</a>` : ""}</article>`;

export const systemStatusMarkup = (cards: readonly StatusCard[]) => {
  const attention = cards.filter(cardValue => cardValue.tone === "attention" || cardValue.tone === "problem").length;
  const label = attention === 0 ? "Alle gecontroleerde systemen zijn in orde" : `${attention} aandachtspunt${attention === 1 ? " vraagt" : "en vragen"} controle`;
  const attentionCards = cards.filter(cardValue => cardValue.tone === "attention" || cardValue.tone === "problem");
  const attentionMarkup = attentionCards.length
    ? `<section class="system-status-attention" aria-labelledby="system-status-attention-title"><div class="system-status-section-heading"><h2 id="system-status-attention-title">Aandachtspunten</h2><span class="system-status-count">${attentionCards.length}</span></div><div class="system-status-attention-list">${attentionCards.map(value => `<article><span class="system-status-attention__signal system-status-attention__signal--${value.tone}" aria-hidden="true"></span><div><strong>${esc(value.title)}</strong><p>${esc(value.summary)}</p></div>${value.href ? `<a class="system-status-attention__link" href="${esc(value.href)}">${esc(value.hrefLabel ?? "Open beheer")}</a>` : ""}</article>`).join("")}</div></section>`
    : "";
  return `<main class="motm-main system-status-main"><header class="page-heading"><a class="back" href="/club/tools">Terug naar staff-tools</a><div class="page-heading__row"><div><h1>Systeemstatus</h1><p class="system-status-checked">Laatste controle: ${esc(formatMoment(new Date()))}</p></div><a class="button secondary system-status-refresh" href="/club/tools?view=system-status">Ververs</a></div></header><section class="system-status-summary" aria-live="polite"><span class="system-status-summary__signal${attention ? " is-attention" : ""}" aria-hidden="true"></span><div><strong>${esc(label)}</strong><p>Op basis van opgeslagen applicatiestatus.</p></div></section>${attentionMarkup}<section class="system-status-grid" aria-label="Systeemstatus">${cards.map(cardMarkup).join("")}</section><footer class="system-status-footer"><span>Workflowstatus is niet beschikbaar binnen AjaxPro.</span><a href="https://github.com/AJAXPRO-020/ajaxpro-hub/actions" target="_blank" rel="noreferrer">GitHub Actions</a></footer></main>`;
};
