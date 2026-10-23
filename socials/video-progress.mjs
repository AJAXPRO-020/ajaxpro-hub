export const progressLabel=(status,stage=status)=>({
 submitting:'Aanvraag versturen',queued:'In wachtrij',fetching:'Bestanden voorbereiden',preprocessing:'Bestanden voorbereiden',
 rendering:'Video renderen',saving:'Video opslaan',done:'Video klaar',
})[stage]??({uncertain:'Status onbekend',failed:'Video mislukt'})[status]??'Status controleren';
