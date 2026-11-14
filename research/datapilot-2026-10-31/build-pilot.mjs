import fs from 'node:fs';
import path from 'node:path';

const outDir = path.dirname(new URL(import.meta.url).pathname);
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const csv = rows => {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const esc = v => `"${String(v ?? '').replaceAll('"', '""')}"`;
  return [keys.map(esc).join(','), ...rows.map(r => keys.map(k => esc(r[k])).join(','))].join('\n') + '\n';
};
function parseCsv(text) {
  const rows=[]; let row=[], field='', quoted=false;
  for (let i=0;i<text.length;i++) { const c=text[i], n=text[i+1];
    if (quoted && c==='"' && n==='"') { field+='"'; i++; }
    else if (c==='"') quoted=!quoted;
    else if (!quoted && c===',') { row.push(field); field=''; }
    else if (!quoted && (c==='\n' || c==='\r')) { if (c==='\r'&&n==='\n') i++; row.push(field); if(row.some(Boolean)) rows.push(row); row=[]; field=''; }
    else field+=c;
  }
  if(field||row.length){row.push(field);rows.push(row)}
  const [head,...body]=rows; return body.map(r=>Object.fromEntries(head.map((h,i)=>[h,r[i]??''])));
}

const seasons=['2018-19','2019-20','2020-21','2021-22','2022-23','2023-24','2024-25','2025-26','2026-27'];
const ofMatches=[]; const ofSeasons=[];
for (const season of seasons) {
  const data=readJson(`/tmp/ajaxpro-openfootball/${season}.json`);
  const matches=data.matches.filter(m=>m.team1==='Ajax'||m.team2==='Ajax'||m.team1==='AFC Ajax'||m.team2==='AFC Ajax');
  let w=0,d=0,l=0,gf=0,ga=0,complete=0;
  for(const m of matches){
    const home=m.team1==='Ajax'||m.team1==='AFC Ajax'; const ft=m.score?.ft;
    const row={season,date:m.date,time:m.time??'',round:m.round??'',home_team:m.team1,away_team:m.team2,home_goals:ft?.[0]??'',away_goals:ft?.[1]??'',source_url:`https://raw.githubusercontent.com/openfootball/football.json/master/${season}/nl.1.json`};
    ofMatches.push(row);
    if(Array.isArray(ft)){complete++;const a=home?ft[0]:ft[1],b=home?ft[1]:ft[0];gf+=a;ga+=b;if(a>b)w++;else if(a===b)d++;else l++;}
  }
  ofSeasons.push({season,ajax_records:matches.length,completed_scores:complete,wins:w,draws:d,losses:l,goals_for:gf,goals_against:ga,source_url:`https://raw.githubusercontent.com/openfootball/football.json/master/${season}/nl.1.json`});
}

const wdRows=parseCsv(fs.readFileSync('/tmp/ajaxpro-wikidata-sparql.csv','utf8'));
const qidFrom=u=>u.split('/').pop(); const wdMap=new Map();
for(const r of wdRows){const qid=qidFrom(r.player);if(!wdMap.has(qid))wdMap.set(qid,{qid,name:r.playerLabel,birth_date:r.birthDate?.slice(0,10)||'',birth_place:r.birthPlaceLabel||'',citizenships:new Set(),positions:new Set(),careers:[]});const p=wdMap.get(qid);if(r.countryLabel)p.citizenships.add(r.countryLabel);if(r.positionLabel)p.positions.add(r.positionLabel);if(r.team)p.careers.push({team_qid:qidFrom(r.team),team:r.teamLabel,start:r.teamStart?.slice(0,10)||'',end:r.teamEnd?.slice(0,10)||''});}
const entityData=readJson('/tmp/ajaxpro-wikidata-25.json').entities;
const localMap={Q160472:'ter-stegen',Q86849563:'rosa',Q113254264:'gaaei',Q18428483:'amrabat',Q28753836:'wijndal',Q20823439:'kehrer',Q107742783:'adingra',Q3189078:'brandt',Q19973862:'dolberg',Q111588237:'gloukh',Q26267167:'tsygankov',Q27929648:'caio-henrique',Q104153643:'baas',Q128912:'blind',Q129101:'klaassen',Q68362571:'edvardsen',Q133876886:'jofre-torrents',Q134410441:'heerkens',Q128721:'berghuis',Q125130980:'mokio',Q56257847:'paes',Q130479109:'bouwman',Q122683676:'dies-janse',Q98534760:'leonardo',Q111087062:'bounida'};
const neon=readJson(path.join(outDir,'neon-readonly-snapshot.json')); const neonPlayers=new Map(neon.players.map(p=>[p.id,p]));
const neonFixtures=readJson(path.join(outDir,'neon-matchday-fixtures-readonly.json')).fixtures;
const wdPlayers=[]; const wdCareers=[];
for(const [qid,id] of Object.entries(localMap)){
  const p=wdMap.get(qid)??{qid,name:entityData[qid]?.labels?.en?.value||'',birth_date:'',birth_place:'',citizenships:new Set(),positions:new Set(),careers:[]};
  const claims=entityData[qid]?.claims??{}; const image=claims.P18?.[0]?.mainsnak?.datavalue?.value??''; const ajaxInfo=claims.P11987?.[0]?.mainsnak?.datavalue?.value??''; const np=neonPlayers.get(id);
  const uniqueCareers=[...new Map(p.careers.map(x=>[`${x.team_qid}|${x.start}|${x.end}`,x])).values()];
  wdPlayers.push({local_id:id,qid,wikidata_name:p.name,neon_name:np?.name??'',birth_date:p.birth_date,birth_place:p.birth_place,citizenships:[...p.citizenships].join('|'),positions:[...p.positions].join('|'),career_memberships:uniqueCareers.length,commons_image:image,ajax_info_id:ajaxInfo,link_status:np?'linked_exact_qid_to_existing_neon_id':'not_in_neon',comparison_name:np?.name===p.name?'duplicate':'variant_or_conflict',new_fields:'birth_date|birth_place|citizenship|career_memberships|external_ids',source_url:`https://www.wikidata.org/wiki/${qid}`});
  for(const c of uniqueCareers)wdCareers.push({local_id:id,qid,...c,source_url:`https://www.wikidata.org/wiki/${qid}`});
}

const uefaMatches=[
['2018-07-25','Qualifying second round','Ajax','Sturm Graz',2,0,''],['2018-08-01','Qualifying second round','Sturm Graz','Ajax',1,3,'2024636'],['2018-08-07','Qualifying third round','Standard Liège','Ajax',2,2,'2025313'],['2018-08-14','Qualifying third round','Ajax','Standard Liège',3,0,'2025323'],['2018-08-22','Play-offs','Ajax','Dynamo Kyiv',3,1,'2025300'],['2018-08-28','Play-offs','Dynamo Kyiv','Ajax',0,0,'2025306'],['2018-09-19','Group stage','Ajax','AEK Athens',3,0,'2025061'],['2018-10-02','Group stage','Bayern München','Ajax',1,1,'2025069'],['2018-10-23','Group stage','Ajax','Benfica',1,0,'2025086'],['2018-11-07','Group stage','Benfica','Ajax',1,1,'2025110'],['2018-11-27','Group stage','AEK Athens','Ajax',0,2,'2025117'],['2018-12-12','Group stage','Ajax','Bayern München',3,3,'2025141'],['2019-02-13','Round of 16','Ajax','Real Madrid',1,2,'2026847'],['2019-03-05','Round of 16','Real Madrid','Ajax',1,4,'2026853'],['2019-04-10','Quarter-finals','Ajax','Juventus',1,1,'2027149'],['2019-04-16','Quarter-finals','Juventus','Ajax',1,2,'2027155'],['2019-04-30','Semi-finals','Tottenham Hotspur','Ajax',0,1,'2027158'],['2019-05-08','Semi-finals','Ajax','Tottenham Hotspur',2,3,'2027159']
].map(x=>({season:'2018/19',date:x[0],stage:x[1],home_team:x[2],away_team:x[3],home_goals:x[4],away_goals:x[5],uefa_match_id:x[6],source_url:x[6]?`https://www.uefa.com/uefachampionsleague/match/${x[6]}--${x[2].toLowerCase().replaceAll(' ','-')}-vs-${x[3].toLowerCase().replaceAll(' ','-')}/`:'https://www.uefa.com/MultimediaFiles/Download/Publications/uefaorg/General/02/61/96/22/2619622_DOWNLOAD.pdf'}));
const statScope='UEFA Champions League group stage to final (12 matches; qualifiers excluded)';
const uefaStats=[
{player:'André Onana',appearances:12,minutes:1080},{player:'Matthijs de Ligt',appearances:11,minutes:990,goals:2,recoveries:94,tackles_won:12,interceptions:15},{player:'Daley Blind',appearances:12,minutes:1080,recoveries:84,tackles_won:11,interceptions:20},{player:'Donny van de Beek',appearances:12,minutes:985,goals:3,assists:2,attempts:21,on_target:11,xg:4.3},{player:'Noussair Mazraoui',appearances:11,minutes:827,goals:2},{player:'Lasse Schöne',appearances:11,minutes:886,goals:1,assists:2,key_passes:16},{player:'Frenkie de Jong',appearances:11,minutes:986,passes_attempted:828,passes_completed:749,recoveries:83,tackles_won:16,interceptions:19},{player:'Hakim Ziyech',appearances:11,minutes:985,goals:3,assists:3,attempts:56,on_target:21,xg:4.5,key_passes:21},{player:'David Neres',appearances:11,minutes:852,goals:2,assists:2,key_passes:10},{player:'Dušan Tadić',appearances:12,minutes:1080,goals:6,assists:5,attempts:21,on_target:10,xg:4.8,key_passes:33},{player:'Kasper Dolberg',appearances:9,minutes:297},{player:'Nicolás Tagliafico',appearances:10,minutes:900,goals:3}
].map(x=>({season:'2018/19',scope:statScope,player:x.player,appearances:x.appearances,minutes:x.minutes,goals:x.goals??'',assists:x.assists??'',attempts:x.attempts??'',on_target:x.on_target??'',xg:x.xg??'',key_passes:x.key_passes??'',passes_attempted:x.passes_attempted??'',passes_completed:x.passes_completed??'',recoveries:x.recoveries??'',tackles_won:x.tackles_won??'',interceptions:x.interceptions??'',source_url:'https://www.uefa.com/MultimediaFiles/Download/Publications/uefaorg/General/02/61/96/22/2619622_DOWNLOAD.pdf'}));
let W=0,D=0,L=0,GF=0,GA=0;for(const m of uefaMatches){const home=m.home_team==='Ajax',a=home?m.home_goals:m.away_goals,b=home?m.away_goals:m.home_goals;GF+=a;GA+=b;if(a>b)W++;else if(a===b)D++;else L++;}
const normTeam=s=>s.toLowerCase().replace('afc ','').replace('sc ','').replace('sbv ','').replace('1963','').replace('tilburg','').replace('rotterdam','').replace('alkmaar','').replace('nijmegen','').replace(/fc /g,'').replace(/[^a-z0-9]/g,'');
const neonLeague=neonFixtures.filter(x=>x.competition.includes('Eredivisie'));
const ofCurrent=ofMatches.filter(x=>x.season==='2026-27');
const fixtureComparison=ofCurrent.map(m=>{const n=neonLeague.find(x=>x.kickoff_at.slice(0,10)===m.date&&normTeam(x.home_team)===normTeam(m.home_team)&&normTeam(x.away_team)===normTeam(m.away_team));const scoresPresent=n&&m.home_goals!==''&&n.goals_home!==null;return {season:m.season,date:m.date,home_team:m.home_team,away_team:m.away_team,neon_fixture_key:n?.fixture_key??'',classification:n?(scoresPresent?(Number(m.home_goals)===n.goals_home&&Number(m.away_goals)===n.goals_away?'duplicate_fixture_and_score':'conflicting_score'):'duplicate_fixture_new_openfootball_result_pending'):'new_or_schedule_mismatch',openfootball_score:m.home_goals===''?'':`${m.home_goals}-${m.away_goals}`,neon_score:n?.goals_home==null?'':`${n.goals_home}-${n.goals_away}`,source_url:m.source_url};});

const missing=[
{dataset:'OpenFootball',field:'lineups/player identities/events',status:'absent_in_source',impact:'cannot enrich player careers or match events'},
{dataset:'OpenFootball 2026-27',field:'future/full-season results',status:'not_yet_available',impact:'file is live and only records currently published fixtures/results'},
{dataset:'Wikidata',field:'career membership start/end dates',status:'partially_missing',impact:'many P54 statements lack one or both qualifiers'},
{dataset:'Wikidata',field:'youth versus senior team classification',status:'not_explicit',impact:'must infer from team entity; do not import blindly'},
{dataset:'UEFA 2018/19',field:'UEFA match id Ajax-Sturm Graz first leg',status:'not_confirmed',impact:'result verified, deep-link unavailable'},
{dataset:'UEFA player stats',field:'qualifying-round player stats',status:'excluded_by_official_report_scope',impact:'player totals cover 12 group/knockout matches, not all 18 campaign matches'},
{dataset:'Neon',field:'historical 2018/19 matches',status:'absent',impact:'0 overlap records; UEFA campaign is wholly new'},
{dataset:'Neon ajax_players',field:'birth/citizenship/birthplace/career history/Wikidata QID',status:'absent',impact:'all are additive fields/relations'}
];

const summary={generated_at:'2026-10-31',mode:'read-only',fotmob_touched:false,openfootball:{files:seasons.length,total_ajax_records:ofMatches.length,seasons:ofSeasons,source_tree:'https://api.github.com/repos/openfootball/football.json/git/trees/master?recursive=1'},wikidata:{requested_players:25,linked_to_neon:wdPlayers.filter(x=>x.link_status.startsWith('linked')).length,players_with_birth_date:wdPlayers.filter(x=>x.birth_date).length,players_with_citizenship:wdPlayers.filter(x=>x.citizenships).length,players_with_career_memberships:wdPlayers.filter(x=>x.career_memberships>0).length,total_career_memberships:wdCareers.length,source_query:'wikidata-pilot.rq'},uefa:{season:'2018/19',campaign_matches:uefaMatches.length,wins:W,draws:D,losses:L,goals_for:GF,goals_against:GA,history_total_validated:(uefaMatches.length===18&&W===10&&D===6&&L===2),player_stat_scope:statScope,neon_overlap_records:neon.uefa_2018_19_overlap.length},neon:{comparison_mode:'read-only',players_found:neon.players.length,dataset_coverage:neon.dataset_coverage,openfootball_2026_27:{openfootball_records:ofCurrent.length,neon_eredivisie_fixtures:neonLeague.length,matched_fixtures:fixtureComparison.filter(x=>x.neon_fixture_key).length,duplicate_scores:fixtureComparison.filter(x=>x.classification==='duplicate_fixture_and_score').length,score_conflicts:fixtureComparison.filter(x=>x.classification==='conflicting_score').length}},missing_fields:missing};
for(const [name,rows] of Object.entries({'openfootball-ajax-matches.csv':ofMatches,'openfootball-season-counts.csv':ofSeasons,'openfootball-neon-comparison.csv':fixtureComparison,'wikidata-players.csv':wdPlayers,'wikidata-careers.csv':wdCareers,'uefa-2018-19-matches.csv':uefaMatches,'uefa-2018-19-player-stats.csv':uefaStats,'missing-fields.csv':missing}))fs.writeFileSync(path.join(outDir,name),csv(rows));
fs.writeFileSync(path.join(outDir,'pilot-summary.json'),JSON.stringify(summary,null,2)+'\n');
fs.writeFileSync(path.join(outDir,'wikidata-players.json'),JSON.stringify(wdPlayers,null,2)+'\n');
fs.writeFileSync(path.join(outDir,'wikidata-careers.json'),JSON.stringify(wdCareers,null,2)+'\n');
fs.writeFileSync(path.join(outDir,'openfootball-ajax-matches.json'),JSON.stringify(ofMatches,null,2)+'\n');
fs.writeFileSync(path.join(outDir,'uefa-2018-19.json'),JSON.stringify({summary:summary.uefa,matches:uefaMatches,player_stats:uefaStats},null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
