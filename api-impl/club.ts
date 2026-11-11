import { redirect } from "../lib/discord-auth";
import { getSessionWithCurrentRoles } from "../lib/server-permissions";
import { db, resultsFor } from "../lib/motm-db";
import { esc, formatMoment, matchTitle, page, remainingTime } from "../lib/motm-view";
import { synchronizeAllMatches } from "../lib/motm-scheduling";
import { verifiedClubStatus } from "../lib/club-profile";
import { clubIntroForSession } from "../lib/portal-tools.config";
import { createMotmVisualData, MOTM_VISUAL_HEIGHT, MOTM_VISUAL_TEMPLATE_URL, MOTM_VISUAL_WIDTH } from "../lib/motm-visual";

export async function GET(request:Request){
  const session=await getSessionWithCurrentRoles(request);if(!session)return redirect("/api/auth/discord-login");
  let spotlight=`<section class="club-spotlight unavailable"><div><span class="status">Geen stemming</span><p class="eyebrow">Man of the Match</p><h2>Nog geen stemming</h2><p>Zodra er een stemming klaarstaat, verschijnt die hier.</p></div></section>`;
  try{
    await synchronizeAllMatches();
    const [open]=await db()`SELECT * FROM motm_matches WHERE deleted_at IS NULL AND status='open' ORDER BY opened_at DESC LIMIT 1`;
    if(open){
      const [vote]=await db()`SELECT p.name_snapshot,p.image_url_snapshot FROM motm_votes v JOIN motm_match_players p ON p.match_id=v.match_id AND p.player_id=v.player_id WHERE v.match_id=${open.id} AND v.voter_discord_user_id=${session.userId}`;
      spotlight=`<section class="club-spotlight club-spotlight--open${vote?" has-vote":""}"><div class="club-spotlight__match"><span class="status status-open">Open</span><p class="eyebrow">${esc(open.competition)} · Man of the Match</p><h2>${esc(matchTitle(open))}</h2><p>Sluit ${esc(formatMoment(open.scheduled_close_at))} · nog ${esc(remainingTime(open.scheduled_close_at))}</p></div>${vote?`<article class="home-vote-receipt"><img src="${esc(vote.image_url_snapshot)}" alt=""><div><p class="eyebrow">Jouw stem</p><h3>${esc(vote.name_snapshot)}</h3><strong>Stem opgeslagen</strong></div></article>`:""}<div class="spotlight-actions"><a class="button" href="/club/stemmen/${esc(open.slug)}">${vote?"Stem wijzigen":"Stem nu"}</a></div></section>`;
    }else{
      const [planned]=await db()`SELECT * FROM motm_matches WHERE deleted_at IS NULL AND status='draft' AND scheduled_open_at IS NOT NULL ORDER BY scheduled_open_at LIMIT 1`;
      const [last]=await db()`SELECT * FROM motm_matches WHERE deleted_at IS NULL AND status='closed' ORDER BY closed_at DESC LIMIT 1`;
      if(last){
        const results=await resultsFor(last.id),winner=results.find(row=>row.rank===1),[winnerPlayer]=winner?await db()`SELECT shirt_number_snapshot FROM motm_match_players WHERE match_id=${last.id} AND player_id=${winner.player_id}`:[];
        const visual=createMotmVisualData({status:last.status,slug:last.slug,opponent:last.opponent,homeOrAway:last.home_or_away,shirtNumber:winnerPlayer?.shirt_number_snapshot??null,winner});
        const resultUrl=new URL(`/club/stemmen/${last.slug}`,request.url).href,shareText=winner?`${winner.name_snapshot} is AjaxPro Man of the Match tegen ${last.opponent} (${winner.percentage}%).`:`Bekijk de AjaxPro Man of the Match-uitslag tegen ${last.opponent}.`;
        spotlight=`<section class="club-spotlight result-visual-spotlight" data-result-share data-share-title="AjaxPro Man of the Match" data-share-text="${esc(shareText)}" data-share-url="${esc(resultUrl)}"><header class="result-visual-context"><p class="eyebrow">Vorige uitslag</p><h2>Laatste Man of the Match</h2><p>${esc(matchTitle(last))}</p></header>${visual?`<div class="home-winner-visual" data-winner-visual data-template-url="${MOTM_VISUAL_TEMPLATE_URL}" data-match-title="${esc(visual.matchTitle)}" data-first-name="${esc(visual.firstName)}" data-last-name="${esc(visual.lastName)}" data-shirt-number="${visual.shirtNumber}" data-percentage="${visual.percentage}" data-player-id="${esc(visual.playerId)}" data-player-image="${esc(visual.playerImageUrl)}" data-filename="${esc(visual.filename)}"><figure class="winner-visual-frame"><canvas width="${MOTM_VISUAL_WIDTH}" height="${MOTM_VISUAL_HEIGHT}" aria-label="Man of the Match-resultaatvisual voor ${esc(visual.firstName)} ${esc(visual.lastName)}"></canvas><figcaption data-visual-status>Resultaatvisual laden…</figcaption></figure></div>`:""}<div class="spotlight-actions result-visual-actions">${visual?`<button class="button secondary desktop-visual-download" type="button" data-download-visual disabled>Download PNG</button>`:""}<button class="button secondary mobile-visual-share" type="button" data-native-share>Deel</button><a class="button secondary" href="/club/stemmen/${esc(last.slug)}">Bekijk volledige uitslag</a>${planned?`<p class="next-poll-note">Nieuwe stemming opent ${esc(formatMoment(planned.scheduled_open_at))}</p>`:""}</div></section>`;
      }
      else if(planned)spotlight=`<section class="club-spotlight"><div><span class="status status-planned">Gepland</span><p class="eyebrow">${esc(planned.competition)} · Man of the Match</p><h2>${esc(matchTitle(planned))}</h2><p>Opent ${esc(formatMoment(planned.scheduled_open_at))}</p></div></section>`;
    }
  }catch(error){console.error("Club MOTM spotlight failed",error);spotlight=`<section class="club-spotlight unavailable"><div><p class="eyebrow">Man of the Match</p><h2>Tijdelijk niet beschikbaar</h2><p>Probeer het later opnieuw.</p></div></section>`;}
  return page("Club",`<main class="motm-main club-main"><header class="club-intro"><div><p class="eyebrow">Home</p><h1>Welkom, ${esc(session.username)}</h1><p class="page-intro">${esc(clubIntroForSession(session))}</p></div>${verifiedClubStatus(session)}</header>${spotlight}</main>`,"/club.js",session,"home");
}
