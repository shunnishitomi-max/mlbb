(function(){
  const oldLoadData=loadData;

  function inferRoleFromLanes(ls){
    const out=[];
    if(ls.includes('GOLD'))out.push('Marksman');
    if(ls.includes('MID'))out.push('Mage');
    if(ls.includes('JUNGLE'))out.push('Assassin');
    if(ls.includes('EXP'))out.push('Fighter');
    if(ls.includes('ROAM'))out.push('Support','Tank');
    return [...new Set(out)];
  }

  function rosterLanes(name){
    const r=window.MLBB_COMPLETE_HEROES;
    if(!r)return[];
    return Object.entries(r.lanes||{}).filter(([,names])=>names.includes(name)).map(([lane])=>lane);
  }

  function mergeRoster(feedHeroes){
    const r=window.MLBB_COMPLETE_HEROES;
    if(!r)return feedHeroes;
    const map=new Map(feedHeroes.map(h=>[h.name,h]));
    for(const name of r.names){
      const ls=rosterLanes(name);
      const override=(r.roleOverrides||{})[name];
      if(map.has(name)){
        const h=map.get(name);
        h.lanes=[...new Set([...(h.lanes||[]),...ls])];
        if((!h.roles||!h.roles.length)&&override)h.roles=override;
      }else{
        map.set(name,{id:'roster-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),name,roles:override||inferRoleFromLanes(ls),lanes:ls,icon_url:''});
      }
    }
    return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
  }

  loadHeroes=async function(){
    let feed=[];
    try{
      const r=await fetch(HERO_FEED,{cache:'no-store'});
      if(!r.ok)throw 0;
      const data=await r.json();
      const arr=Array.isArray(data)?data:(data.heroes||data.data||[]);
      feed=arr.map((h,i)=>({id:h.id||h.heroid||i,name:h.name||h.hero_name||h.heroName,roles:Array.isArray(h.roles)?h.roles:(h.role?[h.role]:[]),lanes:Array.isArray(h.lanes)?h.lanes:(h.lane?[h.lane]:[]),icon_url:h.icon_url||h.icon||h.imageUrl||h.image_url||''})).filter(h=>h.name);
    }catch{
      feed=FALLBACK;
    }
    heroes=mergeRoster(feed);
    renderAll();
  };

  function seasonEntry(heroName){
    const m=window.MLBB_SEASON_META;
    if(!m)return null;
    const scope=state.scope;
    if(scope==='MPL PH')return m.ph.heroes[heroName]?{games:m.ph.games,...m.ph.heroes[heroName]}:null;
    if(scope==='MPL ID')return m.id.heroes[heroName]?{games:m.id.games,...m.id.heroes[heroName]}:null;
    if(scope==='Combined'){
      const a=m.ph.heroes[heroName],b=m.id.heroes[heroName];
      if(!a&&!b)return null;
      const ga=a?m.ph.games:0,gb=b?m.id.games:0,total=ga+gb;
      return{games:total,p:(a?.p||0)+(b?.p||0),b:(a?.b||0)+(b?.b||0),wr:((a?.wr||0)*(a?.p||0)+(b?.wr||0)*(b?.p||0))/Math.max(1,(a?.p||0)+(b?.p||0))};
    }
    return null;
  }

  metaComponent=function(hero){
    const m=window.MLBB_SEASON_META;
    const season=seasonEntry(hero.name);
    const recent=(m?.recent_week6_plus?.priority||{})[hero.name]||0;
    const verified=verifiedStats(hero.name);
    if(state.scope==='Asian Games 2026'){
      if(!verified.sample)return{score:45,label:'Insufficient Data',sample:0,seasonSample:0,recentPriority:0};
      const win=verified.wr===null?50:Math.round(verified.wr*100);
      const presence=Math.min(100,40+Math.log2(verified.sample+1)*11);
      return{score:Math.round(presence*.7+win*.3),label:verified.sample>=12?'High':verified.sample>=5?'Medium':'Low',sample:verified.sample,seasonSample:0,recentPriority:0};
    }
    if(!season&&!recent&&!verified.sample)return{score:40,label:'Insufficient Data',sample:0,seasonSample:0,recentPriority:0};
    let seasonScore=45,seasonSample=0;
    if(season){
      seasonSample=(season.p||0)+(season.b||0);
      const presence=seasonSample/Math.max(1,season.games)*100;
      seasonScore=Math.min(100,Math.round(presence*.78+(season.wr||50)*.22));
    }else if(verified.sample){
      seasonSample=verified.sample;
      seasonScore=Math.min(100,45+Math.log2(verified.sample+1)*9);
    }
    const recentScore=recent?Math.min(100,50+recent*5):45;
    const score=Math.round(seasonScore*.4+recentScore*.6);
    const evidence=Math.max(seasonSample,verified.sample);
    const label=recent>=8&&evidence>=30?'High':recent>=6||evidence>=12?'Medium':evidence>=5?'Low':'Insufficient Data';
    return{score,label,sample:evidence,seasonSample,recentPriority:recent};
  };

  const oldRenderDataset=renderDataset;
  renderDataset=function(){
    oldRenderDataset();
    const root=document.getElementById('datasetText');
    if(!root)return;
    const m=window.MLBB_SEASON_META;
    const roster=window.MLBB_COMPLETE_HEROES;
    const extra=` Complete hero roster: ${roster?.total||heroes.length} heroes. Meta model uses the whole current MPL PH S18 and MPL ID S18 as the season baseline, then gives 60% of the meta weight to verified Week 6+ recency signals and 40% to full-season priority.`;
    root.textContent+=extra;
    const f=document.getElementById('coachFramework');
    if(f)f.innerHTML+=`<div class="framework-item"><b>META WEIGHTING</b><span>Whole current MPL season baseline + stronger Week 6-to-current recency priority. Heroes without verified professional evidence remain selectable but are not artificially promoted.</span></div>`;
  };

  const oldOpenHero=openHero;
  openHero=function(hero){
    oldOpenHero(hero);
    const a=metaComponent(hero);
    const body=document.getElementById('drawerBody');
    if(body){
      const note=document.createElement('div');
      note.className='analysis-section';
      note.innerHTML=`<h3>Current-Season Meta Layer</h3><div class="analysis-list"><div class="analysis-row"><b>FULL-SEASON BASELINE</b><span>${a.seasonSample?`${a.seasonSample} pick+ban appearances from available MPL PH/ID S18 aggregate tables.`:'No aggregate row available for this hero.'}</span></div><div class="analysis-row"><b>WEEK 6+ RECENCY PRIORITY</b><span>${a.recentPriority?`${a.recentPriority}/10 recent-priority signal.`:'No verified recent-priority signal stored.'}</span></div></div>`;
      body.appendChild(note);
    }
  };

  loadHeroes();
  oldLoadData();
})();
