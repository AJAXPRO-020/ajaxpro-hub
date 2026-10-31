import assert from "node:assert/strict";
import test from "node:test";
import { parseFotMobAjaxMatchHtml } from "../lib/fotmob-socials-parser";

const field = (key: string, value: number, total?: number) => ({
  key,
  stat: total === undefined ? { type: "integer", value } : { type: "fractionWithPercentage", value, total },
});

const player = (id: number, teamId: number, name: string, fields: Record<string, unknown>, optaId?: string) => ({
  id,
  optaId,
  teamId,
  name,
  stats: [{ key: "top_stats", title: "Top stats", stats: fields }],
});

const html = (overrides: { teamRows?: unknown[]; players?: Record<string, unknown> } = {}) => `<!doctype html><html><body>
<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
  props: { pageProps: {
    general: {
      matchId: "5781747",
      matchTimeUTCDate: "2026-09-12T18:00:00.000Z",
      homeTeam: { id: 6422, name: "Fortuna Sittard" },
      awayTeam: { id: 8593, name: "Ajax" },
    },
    header: { status: { finished: true }, teams: [{ id: 6422, score: 1 }, { id: 8593, score: 5 }] },
    content: {
      stats: { Periods: { All: { stats: [{ key: "top_stats", stats: overrides.teamRows ?? [
        { key: "BallPossesion", type: "graph", stats: [35, 65] },
        { key: "expected_goals", type: "text", stats: ["0.92", "4.50"] },
        { key: "expected_goals_on_target", type: "text", stats: ["0.72", "5.75"] },
        { key: "total_shots", type: "text", stats: [8, 27] },
        { key: "ShotsOnTarget", type: "text", stats: [4, 10] },
        { key: "corners", type: "text", stats: [3, 11] },
        { key: "passes", type: "text", stats: [332, 618] },
        { key: "accurate_passes", type: "text", stats: ["272 (82%)", "562 (91%)"] },
        { key: "big_chance", type: "text", stats: [1, 9] },
        { key: "fouls", type: "text", stats: [5, 12] },
        { key: "yellow_cards", type: "text", stats: [1, 5] },
        { key: "red_cards", type: "text", stats: [0, 0] },
      ] }] } } },
      playerStats: overrides.players ?? {
        "516846": player(516846, 8593, "Julian Brandt", {
          Minutes: field("minutes_played", 74), Goals: field("goals", 1), Assists: field("assists", 0),
          Xg: field("expected_goals", 0.77), Xa: field("expected_assists", 0.09),
          Xgot: field("expected_goals_on_target_variant", 1.51),
          Shots: field("total_shots", 4), OnTarget: field("ShotsOnTarget", 4), Chances: field("chances_created", 0),
          Passes: field("accurate_passes", 51, 58), Tackles: field("matchstats.headers.tackles", 0),
          Interceptions: field("interceptions", 0), Recoveries: field("recoveries", 2), Ground: field("ground_duels_won", 0, 1),
          Aerial: field("aerials_won", 0, 1), Rating: field("rating_title", 8.07),
        }, "177591"),
        "999": player(999, 6422, "Fortuna-speler", { Minutes: field("minutes_played", 90) }),
      },
    },
  } },
})}</script></body></html>`;

test("parseert de FotMob-pagina naar het afgeschermde Socials-model", () => {
  const result = parseFotMobAjaxMatchHtml(html());
  assert.deepEqual(result.match, {
    fotmobId: 5781747,
    homeTeam: "Fortuna Sittard",
    awayTeam: "Ajax",
    homeScore: 1,
    awayScore: 5,
    date: "2026-09-12T18:00:00.000Z",
    finished: true,
  });
  assert.deepEqual(result.teamStats, {
    possession: 65, xg: 4.5, xgot: 5.75, shots: 27, shotsOnTarget: 10, corners: 11,
    passes: 618, accuratePasses: 562, passAccuracy: 90.9, bigChances: 9,
    fouls: 12, yellowCards: 5, redCards: 0,
  });
  assert.deepEqual(result.opponentTeamStats, {
    possession: 35, xg: .92, xgot: .72, shots: 8, shotsOnTarget: 4, corners: 3,
    passes: 332, accuratePasses: 272, passAccuracy: 81.9, bigChances: 1,
    fouls: 5, yellowCards: 1, redCards: 0,
  });
  assert.deepEqual(result.players[0], {
    fotmobId: 516846, optaId: 177591, name: "Julian Brandt", minutes: 74, goals: 1, assists: 0,
    xg: 0.77, xa: 0.09, xgot: 1.51,
    shots: 4, shotsOnTarget: 4, chancesCreated: 0, passes: 58, accuratePasses: 51,
    passAccuracy: 87.9, tackles: 0, interceptions: 0, recoveries: 2, groundDuelsWon: 0,
    aerialDuelsWon: 0, duelsWon: null, rating: 8.07,
  });
});

test("zet werkelijk ontbrekende team- en spelervelden op null", () => {
  const result = parseFotMobAjaxMatchHtml(html({
    teamRows: [],
    players: { "1": player(1, 8593, "Onvolledige Ajacied", {}) },
  }));
  assert.deepEqual(Object.values(result.teamStats), Array(13).fill(null));
  assert.deepEqual(Object.values(result.opponentTeamStats), Array(13).fill(null));
  assert.deepEqual(result.players[0], {
    fotmobId: 1, optaId: null, name: "Onvolledige Ajacied", minutes: null, goals: null, assists: null,
    xg: null, xa: null, xgot: null,
    shots: null, shotsOnTarget: null, chancesCreated: null, passes: null, accuratePasses: null,
    passAccuracy: null, tackles: null, interceptions: null, recoveries: null, groundDuelsWon: null,
    aerialDuelsWon: null, duelsWon: null, rating: null,
  });
});

test("neemt uitsluitend spelers met het stabiele Ajax-team-ID op", () => {
  const result = parseFotMobAjaxMatchHtml(html({ players: {
    "10": player(10, 8593, "Ajax-speler", {}),
    "20": player(20, 6422, "Fortuna-speler", {}),
    "30": player(30, 9999, "Andere speler", {}),
  } }));
  assert.deepEqual(result.players.map(candidate => candidate.name), ["Ajax-speler"]);
});
