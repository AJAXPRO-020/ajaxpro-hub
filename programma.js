const list = document.querySelector("[data-program-list]");
const status = document.querySelector("[data-program-status]");

const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const formatDate = (value) => new Intl.DateTimeFormat("nl-NL", {
  weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam",
}).format(new Date(value));

const formatTime = (value) => new Intl.DateTimeFormat("nl-NL", {
  hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam",
}).format(new Date(value));

const formatShortDate = (value) => new Intl.DateTimeFormat("nl-NL", {
  weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Amsterdam",
}).format(new Date(value)).replace(".", "");

const logo = (team, source, size = "regular") => {
  const wrap = element("span", `program-club-logo program-club-logo--${size}`);
  const fallback = () => {
    wrap.classList.add("is-fallback");
    wrap.textContent = team.split(/\s+/).filter(Boolean).map((word) => word[0]).join("").slice(0, 3).toUpperCase() || "?";
  };
  if (source) {
    const image = element("img");
    image.addEventListener("error", fallback, { once: true });
    image.src = source;
    image.alt = "";
    image.width = size === "large" ? 112 : 56;
    image.height = size === "large" ? 112 : 56;
    image.loading = "eager";
    wrap.append(image);
  } else {
    fallback();
  }
  return wrap;
};

const team = (name, source, large = false) => {
  const node = element("div", `program-team${large ? " program-team--large" : ""}`);
  node.append(logo(name, source, large ? "large" : "regular"), element("strong", "program-team__name", name));
  return node;
};

const metadata = (label, value, muted = false) => {
  const item = element("div", `program-meta__item${muted ? " is-muted" : ""}`);
  item.append(element("span", "program-meta__label", label), element("strong", "program-meta__value", value));
  return item;
};

const featuredFixture = (fixture) => {
  const article = element("article", "program-featured");
  const header = element("header", "program-featured__header");
  header.append(
    element("p", "program-featured__label", "Eerstvolgende wedstrijd"),
    element("p", "program-featured__competition", fixture.competition || "Wedstrijd"),
  );

  const teams = element("div", "program-featured__teams");
  teams.append(team(fixture.home, fixture.homeLogo, true), element("span", "program-featured__versus", "tegen"), team(fixture.away, fixture.awayLogo, true));

  const meta = element("div", "program-meta");
  meta.append(
    metadata("Datum", formatDate(fixture.kickoff)),
    metadata("Aftrap", `${formatTime(fixture.kickoff)} uur`),
    metadata("Live op", fixture.tv || "Nog niet bekend", !fixture.tv),
  );

  if (fixture.score) {
    meta.append(metadata("Stand", `${fixture.score.home} – ${fixture.score.away}`));
  }

  article.append(header, teams, meta);
  return article;
};

const previewFixture = (fixture, index) => {
  const article = element("article", "program-preview");
  article.setAttribute("aria-label", `${index + 1}e komende wedstrijd: ${fixture.home} tegen ${fixture.away}`);

  const date = element("div", "program-preview__date");
  date.append(element("strong", "", formatShortDate(fixture.kickoff)), element("span", "", formatTime(fixture.kickoff)));

  const teams = element("div", "program-preview__teams");
  const home = team(fixture.home, fixture.homeLogo);
  const away = team(fixture.away, fixture.awayLogo);
  teams.append(home, element("span", "program-preview__dash", "–"), away);

  const details = element("p", "program-preview__details", fixture.competition || "Wedstrijd");
  if (fixture.tv) details.append(" · ", element("strong", "", fixture.tv));

  article.append(date, teams, details);
  return article;
};

const listFixture = (fixture) => {
  const row = element("li", "program-row");
  const date = element("time", "program-row__date", formatShortDate(fixture.kickoff));
  date.dateTime = fixture.kickoff;
  const time = element("span", "program-row__time", formatTime(fixture.kickoff));
  const teams = element("strong", "program-row__teams", `${fixture.home} – ${fixture.away}`);
  const competition = element("span", "program-row__competition", fixture.competition || "Wedstrijd");
  row.append(date, time, teams, competition);
  return row;
};

const render = (fixtures) => {
  list.replaceChildren();
  status.textContent = fixtures.length ? `${fixtures.length} komende ${fixtures.length === 1 ? "wedstrijd" : "wedstrijden"}` : "Er zijn nog geen komende wedstrijden bekend.";
  if (!fixtures.length) return;

  list.append(featuredFixture(fixtures[0]));

  const previews = fixtures.slice(1, 3);
  if (previews.length) {
    const previewGroup = element("section", "program-previews");
    previewGroup.setAttribute("aria-label", "Wedstrijden daarna");
    previews.forEach((fixture, index) => previewGroup.append(previewFixture(fixture, index + 1)));
    list.append(previewGroup);
  }

  const remaining = fixtures.slice(3);
  if (remaining.length) {
    const section = element("section", "program-remaining");
    section.append(element("h2", "program-remaining__title", "Later in het programma"));
    const rows = element("ol", "program-rows");
    remaining.forEach((fixture) => rows.append(listFixture(fixture)));
    section.append(rows);
    list.append(section);
  }
};

fetch("/api/next-match?view=program", { headers: { Accept: "application/json" }, cache: "no-store" })
  .then((response) => response.ok ? response.json() : Promise.reject())
  .then((payload) => render(payload.fixtures || []))
  .catch(() => { status.textContent = "Het programma kon tijdelijk niet worden geladen. Probeer het later opnieuw."; });
