# AjaxPro Hub

De centrale AjaxPro-hub voor Ajax-nieuws, tools, de volgende wedstrijd en
contractinformatie.

## Actuele projectcontext

Lees `AGENTS.md`, `PRODUCT.md` en `START-PROMPT-BOUWEN.md` voor de werkwijze en
productgrenzen. De Hub bevat de publieke website en beveiligde Club-tools,
waaronder MOTM, Socials en Jeugddossiers. Frontendbestanden staan in de root en
toolmappen; `api/`, `api-impl/`, `lib/`, `db/migrations/` en `tests/` bevatten de
serverlaag, schemahistorie en controles. Behoud bestaande routes en permissions.
Projectskills in `.agents/skills/` en de lokale hookdefinitie `.codex/hooks.json`
zijn versieerbare context; providerlinks en sessie-/secretbestanden niet.

## Hosting

De productieversie wordt automatisch vanuit `main` naar Vercel gedeployed.

- Productie: https://ajaxpro-hub.vercel.app
- Domein: https://ajaxpro.fans

Vercel-project `ajaxpro-hub`, ID `prj_M5MmCE5TYk1ecA9r3bKiA4D9nX2S`, team
`ajaxpro` / `team_zAAokeaxc6bbpUXAoHfJlWcl`. GitHub is
`AJAXPRO-020/ajaxpro-hub`; de oude `ajaxpro020`-remote verwijst via GitHub naar
dezelfde repository. **Pushes naar `main` kunnen productie deployen en vereisen
expliciet akkoord.** De lokale `.vercel/project.json` blijft buiten Git.

Huidige productie was bij de audit Gitcommit `b16aa75f`. De migratievoorbereiding
bewaart context in een nieuwe lokale commit, zonder push of deployment. Het oude
Vercel-project `ajax-pro-tools` en de Netlify-site
`b66ac072-582f-4b20-bc4f-8d390bf736e0` zijn historische omgevingen; niet als
publicatiedoel gebruiken. `.vercelignore` sluit instructies/skills al uit van
CLI-publicatie; de bestaande deploymentconfig blijft intact.

Hub-production gebruikt Neon `MOTM-Production` (`twilight-breeze-93820218`),
preview gebruikt `MOTM` (`calm-bar-43783135`). Preview-main was archived bij de
audit. Git bewaart geen databasegegevens. Gebruik lokaal een afgesproken
testdatabase, Discord-testconfiguratie en credentials uit hun eigen beheerplek;
pull niet automatisch productie-env. OIDC/Actions vertrouwen op
`AJAXPRO-020/ajaxpro-hub` en `main`: behoud die namen en bestaande workflows.

## Discord-toegang en rechten

De knop **Inloggen met Discord** gebruikt Discord OAuth2 met uitsluitend de scopes
`identify` en `guilds.members.read`. De route `/club` is server-side afgeschermd en
ieder geldig lid van de AjaxPro Discord-server krijgt standaard `portal.access`.
`DISCORD_GUILD_ID` bepaalt welke Discord-server wordt gecontroleerd. Discord-rol-ID's
worden later centraal gekoppeld aan aanvullende rechten; onbekende rollen krijgen
geen aanvullende rechten.

Benodigde environment variables:

```text
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=
DISCORD_GUILD_ID=
DISCORD_BOT_TOKEN=
SESSION_SECRET=
DATABASE_URL=
MOTM_MANAGER_ROLE_IDS=
MOTM_DELETE_ROLE_IDS=
```

Gebruik voor `SESSION_SECRET` een cryptografisch willekeurige waarde van minimaal
32 tekens. Zet voor lokale ontwikkeling
`DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/discord-callback` en voor
productie `DISCORD_REDIRECT_URI=https://ajaxpro.fans/api/auth/discord-callback`.
Vercel Preview gebruikt een aparte preview-URL en dus een eigen redirect URI.

`MOTM_MANAGER_ROLE_IDS` is een kommagescheiden lijst Discord-rol-ID's. Leden met
minimaal één van deze rollen krijgen server-side `motm.manage`. Laat de variabele
leeg om niemand beheerrechten te geven. `DATABASE_URL` wijst naar een PostgreSQL-
database die vanuit Vercel bereikbaar is (bijvoorbeeld Neon of Vercel Postgres).

Voeg in het Discord Developer Portal bij **OAuth2 → Redirects** elke gebruikte URI
exact toe. Kopieer onder **General Information** de Application ID naar
`DISCORD_CLIENT_ID` en het Client Secret naar `DISCORD_CLIENT_SECRET`. Gebruik voor
`DISCORD_BOT_TOKEN` de raw token van de bestaande AjaxPro Login-bot; deze wordt
uitsluitend server-side gebruikt om gevoelige beheerrollen maximaal iedere vijftien
minuten opnieuw bij Discord te controleren. Gewone portalsessies blijven acht uur
geldig; beheerrechten zijn daarnaast beperkt tot het eerste uur na de Discord-login.

Stel de variabelen in Vercel per environment in. Omdat `DISCORD_REDIRECT_URI` per
omgeving verschilt, hoort de productie-URI alleen bij Production en een concrete
Vercel Preview-URI alleen bij Preview.

## Man of the Match – oorspronkelijke fase 1

Onderstaande beschrijft de oorspronkelijke basis. De actuele repository bevat
meer migraties en MOTM-/beheerfunctionaliteit. Voer de twee basisbestanden niet
blind uit als volledige herstel- of productieprocedure: controleer bestaande
schemahistorie en voer databaseacties alleen na expliciete opdracht uit.

Installeer dependencies met `npm install`. Voer op een nieuwe database eerst
migratie 001 en daarna migratie 002 uit:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/001_motm.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/002_motm_scheduling.sql
```

Beide migraties zijn additief en verwijderen geen data. Migratie 001 maakt de
MOTM-tabellen en unieke beperkingen aan. Migratie 002 voegt de geplande openings-
en sluitingstijden toe. PostgreSQL moet `gen_random_uuid()` ondersteunen (dit is
standaard in moderne managed Postgres-installaties).

### Oorspronkelijke production-checklist

1. Maak of koppel een afzonderlijke Production PostgreSQL-database en stel de
   Production-waarde van `DATABASE_URL` in Vercel in.
2. Voer op die Production-database migratie 001 en daarna migratie 002 uit.
3. Stel in Vercel voor Production `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`,
   `DISCORD_GUILD_ID`, `DISCORD_BOT_TOKEN`, `SESSION_SECRET` en
   `MOTM_MANAGER_ROLE_IDS` in.
4. Stel `DISCORD_REDIRECT_URI=https://ajaxpro.fans/api/auth/discord-callback` alleen
   voor Production in en voeg exact die URI toe in het Discord Developer Portal.
5. Merge pas daarna naar `main`, wacht op een geslaagde Production-deployment en
   test login, beheer, stemmen, automatisch sluiten en de uitslag op het domein.

Lokaal testen:

1. Vul een niet-gecommit `.env.local` met alle bovengenoemde variabelen.
2. Voer `npm test` uit voor de TypeScript-controle.
3. Start de Vercel-omgeving met `npx vercel dev`.
4. Log in via Discord en open `/club`.

Een gebruiker met `motm.manage` maakt via `/club/motm/nieuw` een concept of open
stemming, selecteert de wedstrijdspelers en deelt daarna de stabiele stemlink. De
next-match-bron vult het formulier als voorstel; handmatig invullen blijft altijd
mogelijk. Een geldig Discord-serverlid stemt via `/club/stemmen/{slug}`. De unieke
databasebeperking werkt een bestaande stem bij in plaats van een tweede record te
maken. Na sluiten toont dezelfde URL de server-side berekende winnaar en top drie.

De oude faseplanning is geen actuele volledigheidsclaim. Controleer de bestaande
serverroutes, tests en migraties voor seizoenstand, aankondigingen en beheer.
`npm test` is de lokale typecheck plus unit-tests; het voert geen deployment uit.
`npx vercel dev` gebruikt de volledige lokale runtime, maar vereist vooraf veilig
afgesproken testconfiguratie. Niet automatisch database- of cronroutes aanroepen.

## Nog open voor accountwissel

GitHub-schrijf-/organisatieautorisatie onder de nieuwe Codex-login bevestigen,
naast providertoegang voor Neon, Discord en API-Football. Bron en context zijn
in Git; externe gegevensherstel blijft apart. De lokale archiefbranch
`archive/media-watch-before-removal` blijft behouden en is niet automatisch op
GitHub gepubliceerd. Geen nieuwe hostingomgeving of database nodig voor alleen
de accountwissel.
