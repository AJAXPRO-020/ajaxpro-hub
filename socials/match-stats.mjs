const readFixtures=root=>{
  const template=root.querySelector("template[data-socials-match-context]");
  if(!template)return [];
  try{const value=JSON.parse(template.content.textContent||"[]");return Array.isArray(value)?value:[]}catch{return []}
};
const readAvailability=root=>{
  const template=root.querySelector("template[data-socials-stats-availability]");
  if(!template)return new Set();
  try{const value=JSON.parse(template.content.textContent||"[]");return new Set(Array.isArray(value)?value:[])}catch{return new Set()}
};
const readStored=root=>{
  const template=root.querySelector('template[data-socials-stats-stored]');
  if(!template)return new Set();
  try{const value=JSON.parse(template.content.textContent||'[]');return new Set(Array.isArray(value)?value:[])}catch{return new Set()}
};

export const fixtureStatsState=(fixture,available,now=Date.now())=>available.has(fixture.fixture_key)?"available":new Date(fixture.kickoff_at).getTime()>now?"upcoming":"missing";

const matchLabel=fixture=>{
  const date=new Intl.DateTimeFormat("nl-NL",{day:"numeric",month:"short",year:"numeric",timeZone:"Europe/Amsterdam"}).format(new Date(fixture.kickoff_at));
  return `${fixture.home_team} — ${fixture.away_team} · ${date}`;
};

export const initMatchStats=(root,sharedState)=>{
  const button=root.querySelector("[data-socials-stats-fetch]");
  const status=root.querySelector("[data-socials-stats-status]");
  const selectedMatch=root.querySelector("[data-socials-stats-match]");
  const matchSelect=root.querySelector("[data-socials-match-select]");
  const fixtures=readFixtures(root),available=readAvailability(root),stored=readStored(root);
  sharedState.matchStatsByFixture=new Map();
  sharedState.getMatchStats=fixtureKey=>sharedState.matchStatsByFixture.get(fixtureKey)??null;
  if(!button||!status||!fixtures.length)return {activate(){}};

  const requestedFixture=new URL(location.href).searchParams.get("fixture");
  let selectedFixtureKey=fixtures.some(f=>f.fixture_key===requestedFixture)?requestedFixture:fixtures[0].fixture_key;
  if(matchSelect)matchSelect.value=selectedFixtureKey;
  const loading=new Set();
  const selectedFixture=()=>fixtures.find(fixture=>fixture.fixture_key===selectedFixtureKey)??fixtures[0];
  const setStatus=(message,state)=>{status.textContent=message;status.dataset.state=state;root.dataset.socialsStatsState=state;root.dispatchEvent(new CustomEvent("socials:stats-status-change"))};
  const loadSaved=async fixture=>{
    if(sharedState.matchStatsByFixture.has(fixture.fixture_key)){if(selectedFixtureKey===fixture.fixture_key)setStatus("Stats beschikbaar.","available");return}
    if(loading.has(fixture.fixture_key))return;
    loading.add(fixture.fixture_key);
    if(selectedFixtureKey===fixture.fixture_key)setStatus("Stats laden…","loading");
    try{
      const response=await fetch(`/api/club-tools?view=socials-match-stats&fixture=${encodeURIComponent(fixture.fixture_key)}`,{headers:{Accept:"application/json"}}),payload=await response.json();
      if(!response.ok)throw new Error("snapshot unavailable");
      sharedState.matchStatsByFixture.set(fixture.fixture_key,payload);
      root.dispatchEvent(new CustomEvent("socials:match-stats",{detail:{fixtureKey:fixture.fixture_key}}));
      if(selectedFixtureKey===fixture.fixture_key)setStatus("Stats beschikbaar.","available");
    }catch{
      available.delete(fixture.fixture_key);
      if(selectedFixtureKey===fixture.fixture_key)setStatus("Nog geen stats opgeslagen.","missing");
    }finally{loading.delete(fixture.fixture_key)}
  };
  const selectFixture=fixtureKey=>{
    if(fixtures.some(fixture=>fixture.fixture_key===fixtureKey))selectedFixtureKey=fixtureKey;
    const fixture=selectedFixture();
    sharedState.selectedFixtureKey=fixture.fixture_key;
    const currentUrl=new URL(location.href);currentUrl.searchParams.set("fixture",fixture.fixture_key);history.replaceState(null,"",currentUrl);
    if(selectedMatch)selectedMatch.textContent=matchLabel(fixture);
    const state=fixtureStatsState(fixture,available);
    button.hidden=state!=="missing";
    button.textContent=stored.has(fixture.fixture_key)?'Stats vernieuwen':'Stats ophalen';
    if(state==="available")void loadSaved(fixture);
    else if(state==="upcoming")setStatus("Nog niet gespeeld.","upcoming");
    else if(stored.has(fixture.fixture_key))setStatus("Opgeslagen stats passen niet bij deze wedstrijd. Vernieuw de stats.","mismatch");
    else setStatus("Nog geen stats opgeslagen.","missing");
    root.dispatchEvent(new CustomEvent("socials:match-selection",{detail:{fixtureKey:fixture.fixture_key}}));
  };

  matchSelect?.addEventListener("change",()=>selectFixture(matchSelect.value));
  button.addEventListener("click",async()=>{
    const fixture=selectedFixture();
    button.disabled=true;
    button.setAttribute("aria-busy","true");
    setStatus("Stats ophalen…","loading");
    try{
      const response=await fetch("/api/club-tools?view=socials-match-stats-import",{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify({fixture:fixture.fixture_key})});
      const payload=await response.json();
      const stillSelected=()=>selectedFixtureKey===fixture.fixture_key;
      if(response.status===409){if(stillSelected())setStatus(payload?.error||"Nog geen wedstrijdstats beschikbaar.","not-found");return}
      if(response.status===404){if(stillSelected())setStatus("Wedstrijd niet gevonden.","not-found");return}
      if(!response.ok)throw new Error("request failed");
      available.add(fixture.fixture_key);
      stored.add(fixture.fixture_key);
      sharedState.matchStatsByFixture.set(fixture.fixture_key,payload);
      root.dispatchEvent(new CustomEvent("socials:match-stats",{detail:{fixtureKey:fixture.fixture_key}}));
      if(stillSelected())setStatus("Stats beschikbaar.","available");
    }catch{if(selectedFixtureKey===fixture.fixture_key)setStatus("Fout bij ophalen.","error")}
    finally{button.disabled=false;button.removeAttribute("aria-busy")}
  });
  selectFixture(selectedFixtureKey);
  return {activate(){selectFixture(sharedState.selectedFixtureKey??selectedFixtureKey)}};
};
