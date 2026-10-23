export type SocialMatchContextRequirement = "required" | "optional" | "none";

export type SocialFormatDefinition = {
  id: "stats" | "outblinker" | "top-three" | "quote" | "video";
  title: string;
  description: string;
  matchContext: SocialMatchContextRequirement;
  availability: "available" | "planned";
};

export type SocialOutputFormat = {
  id: "portrait-4x5" | "vertical-9x16";
  label: string;
  width: 1080;
  height: 1350 | 1920;
};

export type SocialThemeId = "home" | "away" | "third" | "europa";

export type SocialThemeDefinition = {
  id: SocialThemeId;
  label: "Thuis" | "Uit" | "3e shirt" | "EL";
};

export const socialFormats: readonly SocialFormatDefinition[] = [
  {id:"stats",title:"Wedstrijd in cijfers",description:"Het wedstrijdverhaal in score, xG en vier kernstatistieken.",matchContext:"required",availability:"available"},
  {id:"video",title:"Wedstrijd in cijfers: video",description:"17 seconden wedstrijdstatistieken met muziek · 9:16 MP4.",matchContext:"required",availability:"available"},
  {id:"outblinker",title:"Uitblinker",description:"Eén Ajax-speler en zijn bepalende wedstrijdstatistieken.",matchContext:"required",availability:"available"},
  {id:"top-three",title:"Top 3 spelers",description:"Drie zelfgekozen Ajax-spelers in één editorial compositie.",matchContext:"required",availability:"available"},
  {id:"quote",title:"Quote",description:"Een redactionele quotevisual met eigen beeld en afzender.",matchContext:"none",availability:"available"},
];

export const socialOutputFormats: readonly SocialOutputFormat[] = [
  {id:"portrait-4x5",label:"Instagram en X",width:1080,height:1350},
  {id:"vertical-9x16",label:"TikTok en verticale socials",width:1080,height:1920},
];

export const socialThemes: readonly SocialThemeDefinition[] = [
  {id:"home",label:"Thuis"},
  {id:"away",label:"Uit"},
  {id:"third",label:"3e shirt"},
  {id:"europa",label:"EL"},
];

export const DEFAULT_SOCIAL_THEME: SocialThemeId = "home";
