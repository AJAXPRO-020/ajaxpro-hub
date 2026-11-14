# Publieke Ajax-data — bronnenonderzoek

Datum: 31 oktober 2026. Modus: uitsluitend lezen. FotMob is niet benaderd of gewijzigd.

## Uitkomst in cijfers

- 47 afzonderlijke bronnen gecatalogiseerd.
- Acht nieuwe bronnen leverden een lokale representatieve export op.
- Drie bronnen uit de eerdere pilot zijn alleen als baseline hergebruikt.
- Eén proef (Wayback CDX) mislukte aantoonbaar met HTTP 504.
- Neon bevat momenteel 39 spelers en 28 jeugddossiers; een extern archief moet dus vooral historische spelers en relaties toevoegen.

## Vijf waardevolste ontdekkingen

### 1. AFC-Ajax.info kan de ruggengraat van een historisch spelersarchief worden

De Club-van-100-proef bevat 184 spelers met officiële wedstrijden uitgesplitst naar competitie, beker, Europa en periode. De site meldt vrijwel complete officiële wedstrijden, opstellingen, wissels en goals sinds 1956. Voor 1956 is de dekking wisselend; assists en gele kaarten zijn ook later onvolledig. Voorbeeld: Sjaak Swart staat op 603 officiële duels, 463 competitieduels en 72 Europese duels.

Waarde: spelersprofielen, samen-speelden-met-relaties, debuut- en mijlpaalfeiten. Jeugddossiers kunnen doorstroom naar Ajax 1 aantonen. Moeilijkheid: technisch middelmatig, juridisch eerst toestemming vragen; er is geen open-datalicentie gevonden.

### 2. TopMarx bevat actuele speler-metrieken die Neon niet opslaat

De CSV-proef bevat 42 Ajax-spelers met Opta-ID, status, blessure-/huurtekst, minuten, goals, assists, kaarten en fantasy-punten. Voorbeeld: een spelerregel koppelt een Opta-ID rechtstreeks aan Ajax en seizoensminuten.

Waarde: actuele feitenmachine en selectiecontrole. Moeilijkheid: laag technisch, maar upstream herkomst en hergebruik moeten vóór productie worden opgehelderd. Niet gebruiken als vervanging van FotMob.

### 3. Football-Data.co.uk levert wedstrijdcontext die OpenFootball mist

Voor 2025/26 zijn 34 Ajax-duels aangetroffen met uitslag, schoten, schoten op doel, corners, kaarten en odds. OpenFootball heeft voor vergelijkbare records vooral datum, teams en score.

Waarde: automatische feiten over schotverhoudingen, discipline en uitslagen. Moeilijkheid: laag; publicatierechten en de ontbrekende spelerslaag beperken directe inzet.

### 4. Gelicentieerde historische media is vindbaar, maar rechten moeten per object mee

De directe Commons-categorie leverde 23 mediabestanden met URL, licentie, maker en beschrijving. Dit is geen volledige Ajax-collectie: subcategorieën moeten afzonderlijk worden doorlopen.

Waarde: profiel- en storytellingbeeld waarbij licentie en attributie machineleesbaar worden opgeslagen. Moeilijkheid: middelmatig door subcategorieën, persoonsmatching en verschillende Creative Commons-licenties.

### 5. RSSSF bewaart vergeten vriendschappelijke Ajax-historie

De Amsterdam Tournament-proef bevat 59 concrete Ajax-wedstrijdregels, vanaf 1975, inclusief tegenstanders en regelmatig doelpuntenmakers. Voorbeeld: Ajax–Barcelona 3–1 in 1975 en Ajax–Liverpool 2–1 in 1977.

Waarde: onverwachte historische feiten en verhalen die reguliere competitiebronnen missen. Moeilijkheid: parsing is eenvoudig, maar bronlicentie is niet expliciet en records moeten met een tweede bron worden gecontroleerd.

## Kritisch productadvies

Bouw niet eerst één gigantische import. De kleinste waardevolle stap is een bron-onafhankelijke historische speleridentiteit met externe ID's, Ajax-periodes en bewijsregels. Vul die eerst met een beperkte, gecontroleerde selectie van AFC-Ajax.info + Wikidata + Commons. Daarmee ontstaan direct rijke profielen en relaties.

De feitenmachine wordt pas betrouwbaar nadat wedstrijden, spelers en deelnames dezelfde canonical IDs gebruiken. Begin met reproduceerbare feiten: debuten, jubilea, gezamenlijke seizoenen, Europese mijlpalen en tegenstanderreeksen. Vermijd voorlopig assists en gele-kaartrecords uit historische bronnen, omdat de beste Ajax-bron die zelf onvolledig noemt.

## Bronnen die niet direct importeerbaar zijn

Transfermarkt, FBref, Soccerway en vergelijkbare commerciële sites zijn inhoudelijk rijk maar zonder vastgestelde automatiserings- en hergebruiktoestemming geen importbasis. Delpher is uitstekend voor redactioneel onderzoek, maar bulkdata na 1879 vereist juridische toegang. GDELT helpt artikelen vinden; het geeft geen recht om artikeltekst te publiceren.

## Bestanden

- `sources.csv`: volledige catalogus.
- `endpoints.csv`: werkelijk bekeken endpoints en statussen.
- `coverage-quality.json`: gecontroleerde aantallen en beperkingen.
- `samples/`: acht kleine exports.
- `raw/`: gecachte bronresponses.
- `neon-baseline.json`: uitsluitend-lezen tellingen.
- `build-research.mjs`: reproduceerbare lokale verwerking.
