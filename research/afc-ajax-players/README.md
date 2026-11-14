# Lokale AFC-Ajax.info-spelerscollectie

Dit is een eenmalige, uitsluitend lokale onderzoekscollectie van de publieke spelersindex van [AFC-Ajax.info](https://www.afc-ajax.info/en/overview/soccer-players). Er zijn geen Neon-writes, productiewijzigingen, deployments of FotMob-wijzigingen uitgevoerd.

## Methode

- De volledige index wordt één keer gelezen en unieke `/en/player/{slug}`-links worden vastgelegd in `index.json`.
- Per speler worden vier openbare routes verwerkt: profiel, statistieken, wedstrijden en transfers/media.
- HTML-responses worden gecachet in `cache/{slug}/`, zodat een onderbroken run hervat kan worden.
- Bestaande speler-JSON’s worden overgeslagen; tijdelijke fouten worden beperkt opnieuw geprobeerd en geregistreerd in `failed-urls.json`.
- De collector gebruikt standaard drie workers en minimaal 250 ms vertraging vóór iedere nieuwe request. Pas dit alleen lokaal aan wanneer de site dit toelaat.
- Voer uit met `node research/afc-ajax-players/collect.mjs`.
- Voor een kleine parserproef kan `AJAX_INFO_LIMIT=5 node research/afc-ajax-players/collect.mjs` worden gebruikt.

## Bestanden

- `index.json`: exacte indexlinks en telling.
- `players.json`: alle lokaal geslaagde spelerrecords.
- `players/{slug}.json`: afzonderlijke records.
- `cache/{slug}/`: bron-HTML per detailpagina.
- `images/`: lokale onderzoeks kopieën van gevonden AFC-hosted afbeeldingen; dit is geen publicatierechtenclaim.
- `image-manifest.json`: per unieke foto de bron-URL, lokale naam, MIME-type, bytes, SHA-256 en status.
- `image-failures.json`: afbeeldings-URL’s die niet konden worden opgehaald.
- `summary.json`: dekking, veldtellingen en fotobeleid.
- `failed-urls.json`: mislukte pagina’s met URL en fout.

## Gegevensmodel

Ontbrekende scalars zijn `null`; ontbrekende collecties zijn lege arrays. Een lege statistiekcel wordt niet als nul geïnterpreteerd. Datums worden alleen opgeslagen wanneer de bron ze als datum of `datetime` levert. De parser verzint geen volledige naam, overlijdensdatum, seizoen of loopbaanperiode.

De detailpagina’s bevatten tabellen met bronlabels en rijen. Omdat tabelstructuren per profiel kunnen verschillen, worden de originele kolomlabels en tekstwaarden behouden. Een volgende normalisatiestap moet deze tabellen eerst steekproefsgewijs valideren voordat ze voor berekeningen worden gebruikt.

## Foto’s en rechten

In een afzonderlijke, door de gebruiker gevraagde lokale downloadronde zijn 481 unieke foto-URL’s opnieuw gecontroleerd: 478 bestanden zijn lokaal opgeslagen en 3 URL’s gaven HTTP 404. AFC-Ajax.info vermeldt copyright en er is geen algemene open-datalicentie vastgesteld. De lokale kopieën zijn daarom uitsluitend voor onderzoek; er is voor geen enkele foto publicatie- of hergebruiktoestemming vastgesteld. Een bron-URL is geen toestemming voor AjaxPro-publicatie.

De ronde is hervatbaar met `node research/afc-ajax-players/download-images.mjs`. Het manifest voorkomt dubbele downloads en bewaart integriteitsinformatie. De 3 ontbrekende URL’s staan in `image-failures.json`.

## Beperkingen

- AFC-Ajax.info is technisch publiek toegankelijk, maar hergebruikvoorwaarden voor bulkcollectie en foto's zijn niet vastgesteld.
- De site beschrijft historische dekking vóór 1956 als onvolledig; assists en gele kaarten zijn ook later niet volledig.
- Profiel-, statistiek- en matchtabellen kunnen lege cellen bevatten. Deze blijven leeg/null.
- `failed-urls.json` is onderdeel van de dataset en moet na een volledige run worden gecontroleerd.
