// Presentation-only copy normalization. Battle state and event handlers remain untouched.
(function(){
  const translate=text=>({'Thuis':'Home','Uit':'Away','Special thuis':'Special Home','UEFA Cup uit':'UEFA Away','Derde shirt':'Third','Champions League thuis':'CL Home','Europees: Champions League thuis':'CL Home','De Meer thuis':'De Meer Home'}[text]||text.replace(/Europees: Champions League/gi,'CL').replace(/Champions League/gi,'CL').replace(/UEFA Cup/gi,'UEFA').replace(/Derde shirt/gi,'Third').replace(/\bThuis\b/gi,'Home').replace(/\bUit\b/gi,'Away'));
  const normalize=()=>{
    document.querySelectorAll('.scene.duel header small').forEach(el=>{if(el.textContent!=='THE ABN AMRO ERA')el.textContent='THE ABN AMRO ERA'});
    document.querySelectorAll('.scene.duel .label small').forEach(el=>{const text=translate(el.textContent.replace(/^\s*\d+\s*\/\s*/,''));if(el.textContent!==text)el.textContent=text});
    document.querySelectorAll('.scene.duel .contender[aria-label],.scene.duel .zoom-trigger[aria-label]').forEach(el=>{const label=el.getAttribute('aria-label').replace(/^Kies /,'Choose ').replace(/^Bekijk details /,'View details ');const next=translate(label);if(next!==el.getAttribute('aria-label'))el.setAttribute('aria-label',next)});
    document.querySelectorAll('.scene.duel img[alt],.shirt-detail img[alt]').forEach(el=>{const alt=el.getAttribute('alt').replace(/^Ajax-shirt /,'Ajax shirt ');const next=translate(alt);if(next!==el.getAttribute('alt'))el.setAttribute('alt',next)});
    document.querySelectorAll('.scene.duel #undo').forEach(el=>{if(el.textContent!=='↶ PREVIOUS PICK')el.textContent='↶ PREVIOUS PICK'});
    document.querySelectorAll('.shirt-detail p').forEach(el=>{const next=translate(el.textContent);if(next!==el.textContent)el.textContent=next});
    document.querySelectorAll('.shirt-detail .detail-close').forEach(el=>{if(el.getAttribute('aria-label')!=='Close')el.setAttribute('aria-label','Close')});
    document.querySelectorAll('#app p').forEach(el=>{
      const errors={
        'Het spel kon niet starten. Laad de pagina opnieuw.':'The battle could not start. Reload the page.',
        'De shirtcollectie kon niet worden geladen.':'The shirt collection could not be loaded.'
      };
      if(errors[el.textContent])el.textContent=errors[el.textContent];
    });
  };
  new MutationObserver(normalize).observe(document.body,{childList:true,subtree:true});
  normalize();
})();
