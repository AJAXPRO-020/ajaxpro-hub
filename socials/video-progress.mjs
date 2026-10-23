export const progressLabel=(status,stage=status)=>({
 submitting:'Aanvraag versturen',queued:'In wachtrij',fetching:'Bestanden voorbereiden',preprocessing:'Bestanden voorbereiden',
 rendering:'Video renderen',saving:'Video opslaan',done:'Video klaar',
})[stage]??({uncertain:'Status onbekend',failed:'Video mislukt'})[status]??'Status controleren';

export const elapsedLabel=(createdAt,now=Date.now())=>{
 const start=new Date(createdAt).getTime();
 const seconds=Number.isFinite(start)?Math.max(0,Math.floor((now-start)/1000)):0;
 const minutes=Math.floor(seconds/60),remaining=seconds%60;
 if(!minutes)return `Bezig: ${seconds} ${seconds===1?'seconde':'seconden'}`;
 return `Bezig: ${minutes} ${minutes===1?'minuut':'minuten'}${remaining?` en ${remaining} ${remaining===1?'seconde':'seconden'}`:''}`;
};
