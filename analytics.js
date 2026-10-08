/* Arhorngor privacy-friendly usage events. No scorecards or personal data are sent. */
(function(){
  const allowed=new Set(['round_started','round_finished']);
  window.ArhorngorAnalytics={
    track:function(name){
      if(!allowed.has(name))return;
      try{if(window.umami&&typeof window.umami.track==='function')window.umami.track(name)}catch(e){}
    }
  };
})();
