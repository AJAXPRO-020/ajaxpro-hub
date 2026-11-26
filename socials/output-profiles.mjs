export const SOCIAL_OUTPUT_PROFILES=Object.freeze({
  feed:Object.freeze({id:'feed',aspect:'portrait-4x5',width:1080,height:1350,safe:Object.freeze({top:0,right:0,bottom:0,left:0})}),
  reel:Object.freeze({id:'reel',aspect:'vertical-9x16',width:1080,height:1920,safe:Object.freeze({top:270,right:220,bottom:420,left:100})}),
  story:Object.freeze({id:'story',aspect:'vertical-9x16',width:1080,height:1920,safe:Object.freeze({top:270,right:80,bottom:300,left:80})}),
});

// Development-only stress profile. Production previews and exports never read this value.
export const META_ADS_STRESS_SAFE=Object.freeze({top:270,right:220,bottom:672,left:100});

export const outputProfile=id=>SOCIAL_OUTPUT_PROFILES[id]??SOCIAL_OUTPUT_PROFILES.feed;
