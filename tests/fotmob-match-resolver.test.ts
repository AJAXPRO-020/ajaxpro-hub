import assert from "node:assert/strict";
import test from "node:test";
import { FotMobMatchResolverError, resolveFotMobMatch } from "../lib/fotmob-match-resolver";

const fortunaAjax = {
  id: 5781747,
  home: { id: 6422, name: "Fortuna Sittard" },
  away: { id: 8593, name: "Ajax" },
  pageUrl: "/matches/fortuna-sittard-vs-ajax/1v4fod#5781747",
  status: { utcTime: "2026-09-12T18:00:00.000Z" },
};

const page = (fixtures: unknown[]) => `<!doctype html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
  props: { pageProps: { fallback: { "team-8593": { fixtures: { allFixtures: { fixtures } } } } } },
})}</script>`;

const fetcherFor = (fixtures: unknown[]): typeof fetch => async () =>
  new Response(page(fixtures), { status: 200, headers: { "content-type": "text/html" } });

test("matcht de wedstrijd exact op datum, thuisteam en uitteam", async () => {
  const result = await resolveFotMobMatch(
    { date: "2026-09-12", homeTeam: "Fortuna Sittard", awayTeam: "Ajax" },
    { fetcher: fetcherFor([fortunaAjax]) },
  );
  assert.deepEqual(result, {
    fotmobId: 5781747,
    url: "https://www.fotmob.com/matches/fortuna-sittard-vs-ajax/1v4fod",
  });
});

test("accepteert een korte fixtureclubnaam tegenover de officiële providernaam", async () => {
  const result = await resolveFotMobMatch(
    { date: "2026-09-12", homeTeam: "Sparta", awayTeam: "Ajax" },
    { fetcher: fetcherFor([{ ...fortunaAjax, home: { id: 6422, name: "Sparta Rotterdam" } }]) },
  );
  assert.equal(result?.fotmobId, 5781747);
});

test("geeft geen resultaat bij een verkeerde datum of teamcombinatie", async () => {
  const options = { fetcher: fetcherFor([fortunaAjax]) };
  assert.equal(await resolveFotMobMatch(
    { date: "2026-09-13", homeTeam: "Fortuna Sittard", awayTeam: "Ajax" }, options,
  ), null);
  assert.equal(await resolveFotMobMatch(
    { date: "2026-09-12", homeTeam: "Ajax", awayTeam: "Fortuna Sittard" }, options,
  ), null);
});

test("geeft een duidelijke foutmelding bij meerdere exacte kandidaten", async () => {
  await assert.rejects(
    resolveFotMobMatch(
      { date: "2026-09-12", homeTeam: "Fortuna Sittard", awayTeam: "Ajax" },
      { fetcher: fetcherFor([fortunaAjax, { ...fortunaAjax, id: 9999999 }]) },
    ),
    (error: unknown) => error instanceof FotMobMatchResolverError &&
      error.code === "AMBIGUOUS" && /Meerdere mogelijke/.test(error.message),
  );
});
