export const filenameSlug=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("nl-NL").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70);

export const amsterdamDate=(value=new Date())=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Amsterdam",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value));

export const socialFilename=({date,home,away,subject,format,ratio="4x5",extension="png"})=>{
  const context=home&&away?`${home}-${away}`:subject;
  const calendarDate=/^\d{4}-\d{2}-\d{2}$/.test(String(date??""))?String(date):amsterdamDate(date||new Date());
  const parts=[context,calendarDate,format,ratio].map(filenameSlug).filter(Boolean);
  return `${parts.join("-")}.${filenameSlug(extension)||"png"}`;
};
