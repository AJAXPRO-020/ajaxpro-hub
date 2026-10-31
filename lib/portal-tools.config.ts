import type { Session } from "./discord-auth";
import { esc } from "./motm-view";
import { permissions, type Permission } from "./permissions.config";
import { sessionHasPermission } from "./server-permissions";

export type ToolSection = "team" | "admin";
export type PortalTool = {
  id: string;
  title: string;
  description: string;
  href: string;
  section: ToolSection;
  external: boolean;
  requiredPermission?: Permission;
  status?: string;
  order: number;
};

export const portalTools: readonly PortalTool[] = [
  {id:"system-status",title:"Systeemstatus",description:"Controleer de belangrijkste AjaxPro-systemen en automatiseringen.",href:"/club/tools?view=system-status",section:"admin",external:false,requiredPermission:permissions.staffAccess,order:0},
  {id:"tactics",title:"Tactiekbord",description:"Werk wedstrijdideeën uit op het digitale tactiekbord.",href:"https://ajaxpro-tactics-board.vercel.app",section:"team",external:true,requiredPermission:permissions.toolsTactics,order:10},
  {id:"screenshot",title:"Screenshot Editor",description:"Maak screenshots klaar voor AjaxPro-publicaties.",href:"https://screenshot-bewerker.vercel.app",section:"team",external:true,requiredPermission:permissions.toolsScreenshot,order:20},
  {id:"socials",title:"Socials",description:"Maak vaste AjaxPro-formats klaar voor social media.",href:"/club/tools/socials",section:"team",external:false,requiredPermission:permissions.toolsSocials,order:30},
  {id:"jeugddossiers-admin",title:"Jeugddossiers beheren",description:"Genereer researchruns en publiceer gevalideerde dossierupdates.",href:"/club/tools/jeugddossiers",section:"admin",external:false,requiredPermission:permissions.jeugddossiersManage,order:20},
  {id:"motm-admin",title:"MOTM-stemmingen beheren",description:"Plan, open en beheer Man of the Match-stemmingen.",href:"/club/motm/beheer",section:"admin",external:false,requiredPermission:permissions.motmManage,order:10},
];

const sectionOrder:Record<ToolSection,number>={team:0,admin:1};
export const toolsForSession = (session: Session) => portalTools.filter(tool => !tool.requiredPermission || sessionHasPermission(session,tool.requiredPermission)).sort((a,b)=>sectionOrder[a.section]-sectionOrder[b.section]||a.order-b.order);
export const teamToolsForSession = (session: Session) => toolsForSession(session).filter(tool => tool.section === "team");
export const adminToolsForSession = (session: Session) => toolsForSession(session).filter(tool => tool.section === "admin");
export const clubIntroForSession = (session: Session) => {
  if(sessionHasPermission(session,permissions.motmManage))return "Stem mee, open je AjaxPro-tools en beheer de Man of the Match.";
  if(toolsForSession(session).length)return "Stem mee en open je AjaxPro-tools.";
  return "Stem op de Man of the Match en bekijk de uitslagen.";
};
export const sectionTitles: Record<ToolSection,string>={team:"Analistentools",admin:"Beheer"};
export const renderToolSections = (tools: readonly PortalTool[]) => (["team","admin"] as const).map(section=>{
  const items=tools.filter(tool=>tool.section===section);if(!items.length)return "";
  const rows=items.map(tool=>`<a class="tool-card tool-card--${esc(tool.id)}" href="${esc(tool.href)}"${tool.external?' target="_blank" rel="noreferrer"':""}><span class="tool-card__icon" aria-hidden="true"></span><span class="tool-card__copy"><strong>${esc(tool.title)}</strong><small>${esc(tool.description)}</small>${tool.status?`<em>${esc(tool.status)}</em>`:""}</span><b>${tool.external?"Open extern ↗":"Open →"}</b></a>`).join("");
  return `<section class="tool-section tool-section--${section}"><div class="section-heading"><div><p class="eyebrow">${section==="team"?"Voor analisten":"Voor staf"}</p><h2>${sectionTitles[section]}</h2></div></div><div class="tool-grid">${rows}</div></section>`;
}).join("");
export const renderToolsGrid = (tools: readonly PortalTool[]) => `<section class="tool-section"><div class="tool-grid">${tools.map(tool=>`<a class="tool-card tool-card--${esc(tool.id)}" href="${esc(tool.href)}"${tool.external?' target="_blank" rel="noreferrer"':""}><span class="tool-card__icon" aria-hidden="true"></span><span class="tool-card__copy"><strong>${esc(tool.title)}</strong><small>${esc(tool.description)}</small></span><b>${tool.external?"Open extern ↗":"Open →"}</b></a>`).join("")}</div></section>`;
