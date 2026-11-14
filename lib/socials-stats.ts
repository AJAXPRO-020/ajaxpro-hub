export type StatsFieldKind = "decimal" | "percentage" | "integer";
export type StatsFieldId = "xg" | "xgot" | "possession" | "shots" | "shotsOnTarget" | "bigChances" | "corners";

export type StatsFieldDefinition = {
  id: StatsFieldId;
  label: string;
  kind: StatsFieldKind;
  min: number;
  max: number;
  step: number;
  suffix?: string;
};

export const statsFields: readonly StatsFieldDefinition[] = [
  {id:"xg",label:"xG",kind:"decimal",min:0,max:20,step:0.01},
  {id:"xgot",label:"xGOT",kind:"decimal",min:0,max:20,step:0.01},
  {id:"possession",label:"Balbezit",kind:"percentage",min:0,max:100,step:0.1,suffix:"%"},
  {id:"shots",label:"Schoten",kind:"integer",min:0,max:99,step:1},
  {id:"shotsOnTarget",label:"Schoten op doel",kind:"integer",min:0,max:99,step:1},
  {id:"bigChances",label:"Grote kansen",kind:"integer",min:0,max:99,step:1},
  {id:"corners",label:"Corners",kind:"integer",min:0,max:99,step:1},
];

export const statsFieldById = (id:string) => statsFields.find(field=>field.id===id);

export const isValidStatsValue = (id:string,value:string) => {
  const field=statsFieldById(id);
  if(!field)return false;
  if(value.trim()==="")return true;
  const number=Number(value);
  if(!Number.isFinite(number)||number<field.min||number>field.max)return false;
  if(field.kind==="integer")return Number.isInteger(number);
  const precision=String(field.step).split(".")[1]?.length??0;
  return value.trim().match(new RegExp(`^\\d+(?:[.,]\\d{1,${precision}})?$`))!==null;
};
