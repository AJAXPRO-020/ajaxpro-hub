import { quoteOnlyPeople } from "/socials/quote-people.mjs?v=20260915-people";

const allowedTypes=new Set(["image/jpeg","image/png","image/webp"]);
const maxBytes=8*1024*1024;
const readTemplate=(root,selector)=>{const template=root.querySelector(selector);if(!template)return [];try{const value=JSON.parse(template.content.textContent||"[]");return Array.isArray(value)?value:[]}catch{return []}};
const personKey=person=>`${person.source}:${person.id}`;
const quoteDensity=length=>length>210?"long":length>115?"medium":"short";

export const quotePeopleFor=(players,people=quoteOnlyPeople)=>[
  ...players.map(player=>({id:player.id,name:player.name,role:"Ajax-speler",photo:player.imageUrl,source:"player",disabled:false})),
  ...people.map(person=>({...person,source:"quote-only"})),
];

export const initQuote=(root)=>{
  const workspace=root.querySelector("[data-quote-workspace]");
  if(!workspace)return {activate(){},deactivate(){},reset(){},getRequirementStatus(){return {}}};
  const people=quotePeopleFor(readTemplate(root,"template[data-socials-players]"));
  const select=workspace.querySelector("[data-quote-person-select]"),quote=workspace.querySelector('[data-quote-field="quote"]'),counter=workspace.querySelector("[data-quote-count]"),lengthNote=workspace.querySelector("[data-quote-length-note]"),backgroundInput=workspace.querySelector("[data-quote-background]"),insetInput=workspace.querySelector("[data-quote-inset]"),error=workspace.querySelector("[data-quote-photo-error]"),preview=workspace.querySelector("[data-quote-preview]"),variantInputs=[...workspace.querySelectorAll("[data-quote-variant]")],outputInputs=[...root.querySelectorAll('[name="social-output"]')];
  const state={personKey:personKey(people[0]),variant:"large",backgroundFile:null,insetFile:null,backgroundUrl:null,insetUrl:null};
  const selected=()=>people.find(person=>personKey(person)===state.personKey)??people[0];
  const revoke=key=>{if(state[key]){URL.revokeObjectURL(state[key]);state[key]=null}};
  const setError=message=>{error.textContent=message;error.hidden=!message};
  const setFile=(kind,input)=>{const [file]=input.files??[];if(!file)return;if(!allowedTypes.has(file.type)||file.size<=0||file.size>maxBytes){input.value="";workspace.querySelector(`[data-quote-${kind}-name]`).textContent="Nog geen beeld gekozen";setError("Kies een JPG-, PNG- of WebP-afbeelding van maximaal 8 MB.");return}revoke(`${kind}Url`);state[`${kind}File`]=file;state[`${kind}Url`]=URL.createObjectURL(file);workspace.querySelector(`[data-quote-${kind}-name]`).textContent=file.name;setError("");render()};
  const setImage=(image,url,visible)=>{image.hidden=!visible;if(visible)image.src=url;else image.removeAttribute("src")};
  const render=()=>{
    const person=selected(),text=quote.value.trim(),density=quoteDensity(text.length),personImage=workspace.querySelector("[data-quote-person-photo]"),personPlaceholder=workspace.querySelector("[data-quote-person-placeholder]"),background=workspace.querySelector("[data-quote-background-preview]"),inset=workspace.querySelector("[data-quote-inset-preview]"),insetFrame=workspace.querySelector("[data-quote-inset-frame]");
    const role=person?.role==="Ajax-speler"?"":person?.role??"";
    preview.dataset.density=density;preview.dataset.variant=state.variant;preview.dataset.pngContext=role;counter.textContent=String(quote.value.length);lengthNote.textContent=density==="long"?"lange quote — compacter gezet":density==="medium"?"middellange quote":"korte quote";
    workspace.querySelector("[data-quote-preview-text]").textContent=text||"Vul een quote in";workspace.querySelector("[data-quote-preview-name]").textContent=person?.name??"Kies een persoon";workspace.querySelector("[data-quote-preview-role]").textContent=role;
    const hasPersonPhoto=Boolean(person?.photo);setImage(personImage,person?.photo,hasPersonPhoto);personImage.alt=hasPersonPhoto?`Foto van ${person.name}`:"";personPlaceholder.hidden=hasPersonPhoto;personPlaceholder.textContent=person?.disabled?"Asset ontbreekt":"Foto ontbreekt";
    setImage(background,state.backgroundUrl,Boolean(state.backgroundUrl));setImage(inset,state.insetUrl,Boolean(state.insetUrl));insetFrame.hidden=!state.insetUrl;
    const output=outputInputs.find(input=>input.checked)??outputInputs[0];if(output)preview.dataset.aspect=output.value;
  };
  select.replaceChildren(...people.map(person=>{const option=new Option(person.disabled?`${person.role} · nog te configureren`:`${person.name} · ${person.role}`,personKey(person));option.disabled=Boolean(person.disabled);return option}));select.value=state.personKey;
  select.addEventListener("change",()=>{state.personKey=select.value;render()});variantInputs.forEach(input=>input.addEventListener("change",()=>{if(input.checked){state.variant=input.value;render()}}));quote.addEventListener("input",render);backgroundInput.addEventListener("change",()=>setFile("background",backgroundInput));insetInput.addEventListener("change",()=>setFile("inset",insetInput));outputInputs.forEach(input=>input.addEventListener("change",render));
  window.addEventListener("beforeunload",()=>{revoke("backgroundUrl");revoke("insetUrl")},{once:true});
  render();
  return {activate:render,deactivate(){},reset(){state.personKey=personKey(people[0]);select.value=state.personKey;state.variant="large";variantInputs.forEach(input=>{input.checked=input.value===state.variant});quote.value="";["background","inset"].forEach(kind=>{revoke(`${kind}Url`);state[`${kind}File`]=null;workspace.querySelector(`[data-quote-${kind}]`).value="";workspace.querySelector(`[data-quote-${kind}-name]`).textContent="Nog geen beeld gekozen"});setError("");render()},getRequirementStatus(){return {}}};
};

export const quoteFormat={id:"quote",label:"Quote",requirements:[],init:initQuote};
