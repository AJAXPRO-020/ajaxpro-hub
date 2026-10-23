# Social Generator — wedstrijdvideo

De bestaande generator bevat het format **Wedstrijd in cijfers: video**.
Shotstack rendert 17 seconden op 1080 × 1920 / 30 fps, met de geteste versie-11
canvascode, fonts, logo en audiofade van 14 tot 17 seconden. De tekenlogica en
het ontwerp zijn overgenomen uit de geslaagde proef; er is geen nieuwe template
ontworpen. De lichte kleur-/antialiasingafwijkingen van de Shotstack-proef blijven.

## Lokaal beoordelen

Start vanuit deze repository met `npm run dev:socials`.
Open <http://localhost:3000/club/tools/socials?format=video>.

Deze reviewserver bindt uitsluitend aan 127.0.0.1. Hij gebruikt een aparte,
iedere start willekeurig gegenereerde sessiesleutel en een lokale staff-testsessie.
De echte API-handlers voeren de bestaande Discord-permissionchecks uit.
De reviewserver wordt niet als Vercel-function gedeployd en vervangt de echte
Discord-login niet. Een volledige OAuth-login is lokaal niet end-to-end getest.

De lokale `.env.local` wijst naar het afzonderlijke Neon-project **MOTM**
(`calm-bar-43783135`), dat in Vercel aan Preview gekoppeld is. Met expliciete toestemming zijn uitsluitend
35 wedstrijdrecords en 3 bestaande snapshots uit productie gelezen in een
READ ONLY-transactie en naar preview gekopieerd. Er zijn geen productierecords
gewijzigd. Het spelersregister in preview is uit bestaande repo-migraties opgebouwd.

De selector toont uitsluitend wedstrijden waarvan de aftrap minder dan
veertien dagen geleden was of minder dan veertien dagen in de toekomst ligt.
Alle wedstrijden binnen dat venster staan in de lijst, ook wanneer nog geen
snapshot beschikbaar is. Wedstrijd en format blijven in de URL staan bij
herladen. Bestaande statische formats blijven beschikbaar.

## Serverconfiguratie voor Vercel

Behoud de bestaande `DATABASE_URL`, Discord-configuratie en
`PORTAL_TEAM_TOOL_ROLE_IDS`. Voeg servermatig toe:

| Variabele | Waarde/doel |
| --- | --- |
| `SHOTSTACK_API_KEY` | Productiesleutel van het account met beschikbare credits; nooit publiek |
| `SHOTSTACK_MUSIC_URL` | Bestaande HTTPS-bron van de goedgekeurde muziek |
| `SHOTSTACK_ENV` | `v1`; `stage` is alleen voor watermerkproeven |
| `SOCIALS_VIDEO_ENABLED` | `true` om nieuwe renders toe te staan; `false` blokkeert nieuwe opdrachten |

Deze waarden zijn op 23 oktober 2026 servermatig voor Vercel Production ingesteld.
Een voorbeeld zonder geheimen staat in `.env.socials-video.example`.

Migratie 033 vereist de bestaande tabellen uit migraties 005 en 032.
Gebruik voor de eenmalige migratie een bewust gekozen directe verbinding:
`DATABASE_URL_UNPOOLED=... npm run db:migrate:socials-video`.
Dit commando voert uitsluitend migratie 033 uit, nooit automatisch bij webverkeer.
Het is op preview uitgevoerd. Dezelfde additieve migratie is op 23 oktober 2026
ook op de hoofdbranch van **MOTM-Production** uitgevoerd. De tabel was daar
vooraf afwezig; bestaande snapshots bleven behouden.

`vercel.json` bundelt de zelfvoorzienende template en geeft de bestaande
club-tools-function maximaal 60 seconden voor het streamen van downloads.
De renderaanvraag zelf is kort en asynchroon; het renderen gebeurt bij Shotstack.
Er is geen nieuwe function, wachtrij, cron of eigen videoserver toegevoegd.

## Gedrag en kostenbeveiliging

De server kiest de fixture en snapshot zelf. Teamvolgorde, eindstand, datum en
match-ID moeten overeenkomen. Onvolledige, ongeldige of live-data blokkeert een
render. Vier complete statistieken worden gekozen; ontbrekende waarden worden
niet als nul ingevuld. Bestaande echte nullen blijven wel behouden.

Iedere opdracht bewaart de gebruikte fixture, volledige genormaliseerde snapshot,
rendergegevens, templateversie, gebruiker, aanvraagcode en Shotstack-render-ID.
Een databasevergrendeling en unieke index laten één actieve render over alle
medewerkers/instances toe. Per wedstrijd is maximaal één succesvolle render
toegestaan, voor alle medewerkers samen. Die blokkade blijft staan wanneer een
tijdelijke downloadlink verloopt. Alleen na een bevestigde technische mislukking
kan een medewerker, na bevestiging, opnieuw proberen.

Er is geen automatische retry van POST-renderaanvragen. Bij een onduidelijke
netwerkuitkomst blijft de opdracht `uncertain` en blokkeert hij nieuwe renders.
Controleer in dat uitzonderingsgeval eerst de Shotstack-renderhistorie en de
opdracht-ID. Pas na bevestiging dat geen render is aangenomen mag een beheerder
de opdracht als mislukt vrijgeven. Bij een bevestigde render moet het render-ID
worden gekoppeld. Geen blinde nieuwe aanvraag starten.

Shotstack werkt door wanneer de browser sluit. Bij terugkeer wordt de opgeslagen
opdracht met alleen-lezen statusaanvragen ververst. Een webhook is niet nodig.
De Serve API levert waar beschikbaar een CDN-link; tijdelijke output krijgt een
expiratietijd van 24 uur. Verlopen links leiden niet tot automatisch opnieuw
renderen en heffen de één-video-beperking niet op. Preview en downloads lopen via de bestaande beveiligde club-tools-route
met ondersteuning voor byte ranges. Sleutels blijven aan de serverkant.

CDN-bestanden en de muziek tellen mee voor Shotstack-opslag/bandbreedte. Controleer
het werkelijke accountlimiet; het proefdashboard toont 500 MB. Deze integratie
belooft geen onbeperkte of gratis permanente opslag. Bewaar gewenste archieven
zelf via de download; er is geen nieuw archiefsysteem gebouwd.

## Uitgevoerde eindtest — 22 oktober 2026

- Eén echte integratierender met de opgeslagen snapshot **Fortuna Sittard–Ajax,
  12 september 2026, 1–5**. Geen nieuwe providerimport nodig.
- Balbezit 35–65%, schoten 8–27, op doel 4–10, xG 0,92–4,50.
- Render-ID `88b927e0-1ef9-43f8-9b80-71b9d7604453`;
  lokale opdracht `6f858815-7747-43b7-ba3e-488088ea6c33`.
- Provider: `freeTrial`, `billable: 17` seconden, circa 0,283333 credit.
  Precies één echte renderopdracht in de previewdatabase; via Neon-MCP bevestigd.
- Serverherstart, paginaverversing, browserplayback tot 17/17 s en volledige
  download gecontroleerd. MP4: 7.065.142 bytes, 510 frames, 1080 × 1920, 30 fps.
- Volledige video- en audiodecodering geslaagd. Audio vanaf nul, lineaire fade
  14–17; AAC-trackduur 17,003 s door codecafronding. Tekst en lange teamnaam
  visueel gecontroleerd. Originele video's zijn niet gewijzigd.
- De overige technische controles gebruiken mocks: ontbrekende data, foutieve
  team-/score-/datumkoppeling, dubbele aanvragen, bewuste regeneratie, onzekere
  verzending, preprocessing, verlopen links, autorisatie en range-downloads.

Video en verificatie staan lokaal, niet gecommit, in `test-results/socials-video/`.

## Productiecontrole

Controleer na een deployment de buildstatus, Discord-stafflogin, wedstrijdlijst,
browserpreview en een bestaande download zonder een nieuwe Shotstack-render te
starten. De eerste definitieve productierender gebeurt pas door een staflid.
