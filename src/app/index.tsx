import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

type Side = 'BLUE' | 'RED';
type Kind = 'BAN' | 'PICK';
type Role = 'ALL' | 'EXP' | 'JUNGLE' | 'MID' | 'GOLD' | 'ROAM';
type Hero = { name: string; role: Exclude<Role,'ALL'>; flex?: Exclude<Role,'ALL'>[]; meta: number };
type Action = { side: Side; kind: Kind; slot: number };

const sequence: Action[] = [
  {side:'BLUE',kind:'BAN',slot:1},{side:'RED',kind:'BAN',slot:1},{side:'RED',kind:'BAN',slot:2},
  {side:'BLUE',kind:'BAN',slot:2},{side:'BLUE',kind:'BAN',slot:3},{side:'RED',kind:'BAN',slot:3},
  {side:'BLUE',kind:'PICK',slot:1},{side:'RED',kind:'PICK',slot:1},{side:'RED',kind:'PICK',slot:2},
  {side:'BLUE',kind:'PICK',slot:2},{side:'BLUE',kind:'PICK',slot:3},{side:'RED',kind:'PICK',slot:3},
  {side:'BLUE',kind:'BAN',slot:4},{side:'RED',kind:'BAN',slot:4},{side:'RED',kind:'BAN',slot:5},
  {side:'BLUE',kind:'BAN',slot:5},{side:'RED',kind:'PICK',slot:4},{side:'BLUE',kind:'PICK',slot:4},
  {side:'BLUE',kind:'PICK',slot:5},{side:'RED',kind:'PICK',slot:5}
];

const heroes: Hero[] = [
{name:'Fanny',role:'JUNGLE',meta:96},{name:'Nolan',role:'JUNGLE',meta:91},{name:'Aulus',role:'JUNGLE',flex:['EXP'],meta:89},
{name:'Belerick',role:'ROAM',flex:['EXP'],meta:90},{name:'Masha',role:'EXP',flex:['ROAM'],meta:93},{name:'Phoveus',role:'EXP',meta:86},
{name:'Esmeralda',role:'EXP',meta:88},{name:'Gloo',role:'EXP',flex:['ROAM'],meta:84},{name:'Yu Zhong',role:'EXP',meta:81},
{name:'Zhuxin',role:'MID',meta:94},{name:'Lylia',role:'MID',meta:87},{name:'Novaria',role:'MID',meta:85},{name:'Valentina',role:'MID',meta:83},
{name:'Bruno',role:'GOLD',meta:92},{name:'Claude',role:'GOLD',meta:88},{name:'Clint',role:'GOLD',meta:84},{name:'Obsidia',role:'GOLD',meta:90},
{name:'Minotaur',role:'ROAM',meta:91},{name:'Atlas',role:'ROAM',meta:82},{name:'Carmilla',role:'ROAM',meta:85},{name:'Mathilda',role:'ROAM',meta:88},
{name:'Paq',role:'EXP',flex:['JUNGLE'],meta:82},{name:'Hayabusa',role:'JUNGLE',meta:80},{name:'Ling',role:'JUNGLE',meta:85},
{name:'Fredrinn',role:'JUNGLE',flex:['EXP'],meta:83},{name:'Harith',role:'GOLD',flex:['MID'],meta:87},{name:'Granger',role:'GOLD',meta:86},
{name:'Kalea',role:'ROAM',flex:['EXP'],meta:86},{name:'Chou',role:'EXP',flex:['ROAM'],meta:79},{name:'Ruby',role:'EXP',flex:['ROAM'],meta:84}
];

const roleOrder = ['EXP','JUNGLE','MID','GOLD','ROAM'] as const;

export default function Home() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<{hero: Hero; action: Action}[]>([]);
  const [role, setRole] = useState<Role>('ALL');
  const [query, setQuery] = useState('');
  const action = sequence[step];
  const unavailable = useMemo(() => new Set(draft.map(d => d.hero.name)), [draft]);
  const allies = (side: Side) => draft.filter(d => d.action.side===side && d.action.kind==='PICK').map(d=>d.hero);
  const blue = allies('BLUE');
  const red = allies('RED');

  function dynamicScore(hero: Hero) {
    let score = hero.meta;
    if (!action) return score;
    const sidePicks = allies(action.side);
    const enemyPicks = allies(action.side==='BLUE'?'RED':'BLUE');
    const filled = new Set(sidePicks.flatMap(h => [h.role, ...(h.flex||[])]));
    if (action.kind==='PICK' && !filled.has(hero.role)) score += 5;
    if (hero.flex?.length) score += 4;
    if (action.kind==='BAN') score += Math.round(hero.meta*0.05);
    if (step>=12 && action.kind==='BAN') {
      const likelyOpen = roleOrder.filter(r => !filled.has(r));
      if (likelyOpen.includes(hero.role)) score += 7;
      if (hero.flex?.some(r=>likelyOpen.includes(r))) score += 4;
    }
    if (enemyPicks.some(e => e.role===hero.role)) score += 2;
    if (hero.name==='Belerick' && enemyPicks.some(e=>['Claude','Bruno','Granger'].includes(e.name))) score += 5;
    if (hero.name==='Masha' && enemyPicks.some(e=>['Fanny','Ling','Nolan'].includes(e.name))) score += 3;
    return Math.max(0,Math.min(100,score));
  }

  const recommendations = useMemo(() => heroes.filter(h=>!unavailable.has(h.name)).map(h=>({...h,score:dynamicScore(h)})).sort((a,b)=>b.score-a.score).slice(0,5), [draft, step]);
  const visible = heroes.filter(h=>!unavailable.has(h.name)).filter(h=>role==='ALL'||h.role===role||h.flex?.includes(role as any)).filter(h=>h.name.toLowerCase().includes(query.toLowerCase()));

  function choose(hero: Hero) {
    if (!action || unavailable.has(hero.name)) return;
    setDraft(v=>[...v,{hero,action}]);
    setStep(s=>s+1);
    setQuery('');
  }

  function reset() { setDraft([]); setStep(0); setRole('ALL'); setQuery(''); }
  function undo() { if (!draft.length) return; setDraft(v=>v.slice(0,-1)); setStep(s=>Math.max(0,s-1)); }

  const picksFor = (side: Side) => draft.filter(d=>d.action.side===side&&d.action.kind==='PICK');
  const bansFor = (side: Side) => draft.filter(d=>d.action.side===side&&d.action.kind==='BAN');
  const complete = step>=sequence.length;
  const blueScore = blue.reduce((n,h)=>n+h.meta,0) + blue.filter(h=>h.flex?.length).length*3;
  const redScore = red.reduce((n,h)=>n+h.meta,0) + red.filter(h=>h.flex?.length).length*3;
  const total = Math.max(1,blueScore+redScore);
  const bluePct = Math.round(blueScore/total*100);

  return <SafeAreaView style={s.root}>
    <ScrollView stickyHeaderIndices={[1]} contentContainerStyle={s.pad}>
      <View style={s.header}>
        <Text style={s.title}>MPL PH DRAFT COACH</Text>
        <Text style={s.sub}>Week 6+ competitive mock draft simulator</Text>
      </View>

      <View style={s.sticky}>
        <Text style={s.vs}>BLUE SIDE  <Text style={s.muted}>vs</Text>  RED SIDE</Text>
        <Text style={s.stage}>{complete?'DRAFT COMPLETE':`${action.side} ${action.kind} ${action.slot}`}</Text>
      </View>

      <View style={s.row}>
        <Team title="BLUE" picks={picksFor('BLUE')} bans={bansFor('BLUE')} />
        <Team title="RED" picks={picksFor('RED')} bans={bansFor('RED')} />
      </View>

      {!complete && <>
        <View style={s.card}>
          <Text style={s.cardTitle}>DRAFT COACH · TOP RECOMMENDATIONS</Text>
          {recommendations.map((h,i)=><Pressable key={h.name} onPress={()=>choose(h)} style={s.rec}>
            <Text style={s.rank}>{i+1}</Text><View style={{flex:1}}><Text style={s.hero}>{h.name}</Text><Text style={s.small}>{h.role}{h.flex?.length?` · Flex ${h.flex.join('/')}`:''}</Text></View><Text style={s.score}>{h.score}</Text>
          </Pressable>)}
          <Text style={s.note}>Scores recalculate after every action using meta priority, side, remaining roles, flex value, enemy pressure and second-phase targeting. Inferred coaching values are not official MPL statistics.</Text>
        </View>

        <TextInput value={query} onChangeText={setQuery} placeholder="Search hero" placeholderTextColor="#73819a" style={s.search}/>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
          {(['ALL','EXP','JUNGLE','MID','GOLD','ROAM'] as Role[]).map(r=><Pressable key={r} onPress={()=>setRole(r)} style={[s.filter,role===r&&s.filterOn]}><Text style={s.filterText}>{r}</Text></Pressable>)}
        </ScrollView>

        <FlatList scrollEnabled={false} data={visible} numColumns={2} keyExtractor={h=>h.name} columnWrapperStyle={{gap:10}} renderItem={({item})=><Pressable style={s.heroCard} onPress={()=>choose(item)}>
          <View style={[s.dot,{backgroundColor:item.role==='EXP'?'#ff8c42':item.role==='JUNGLE'?'#65c466':item.role==='MID'?'#b279ff':item.role==='GOLD'?'#f5c451':'#42b8ff'}]} />
          <Text style={s.hero}>{item.name}</Text><Text style={s.small}>{item.role}</Text><Text style={s.priority}>{dynamicScore(item)} Draft Score</Text>{item.flex?.length?<Text style={s.flex}>FLEX · {item.flex.join(' / ')}</Text>:null}
        </Pressable>} />
      </>}

      {complete && <View style={s.card}>
        <Text style={s.cardTitle}>POST-DRAFT REPORT</Text>
        <Text style={s.adv}>Draft Advantage</Text><Text style={s.big}>Blue {bluePct}% · Red {100-bluePct}%</Text><Text style={s.conf}>Confidence · MEDIUM</Text>
        <Text style={s.note}>Draft advantage is an analytical estimate and does not predict the actual match winner.</Text>
        <Lineups blue={blue} red={red}/>
        <Text style={s.adv}>Blue Win Condition</Text><Text style={s.report}>Protect the Gold Laner through first-item timing, use frontline pressure around Turtle, and convert early objective control into lane priority.</Text>
        <Text style={s.adv}>Red Win Condition</Text><Text style={s.report}>Avoid low-value forced fights, preserve key cooldowns for objective setups, and pressure the weakest side lane before committing to 5v5 engagements.</Text>
      </View>}

      <View style={s.controls}><Pressable onPress={undo} style={s.secondary}><Text style={s.btnText}>Undo</Text></Pressable><Pressable onPress={reset} style={s.primary}><Text style={s.btnText}>New Draft</Text></Pressable></View>
      <Text style={s.footer}>OFFICIAL MPL PH DATA · CALCULATED DATA · ANALYTICAL INFERENCE · COACHING RECOMMENDATION</Text>
    </ScrollView>
  </SafeAreaView>;
}

function Team({title,picks,bans}:{title:string;picks:{hero:Hero}[];bans:{hero:Hero}[]}) {
  return <View style={s.team}><Text style={s.teamTitle}>{title}</Text><Text style={s.label}>PICKS</Text>{[0,1,2,3,4].map(i=><Text key={i} style={s.slot}>{picks[i]?.hero.name||'—'}</Text>)}<Text style={s.label}>BANS</Text><Text style={s.bans}>{bans.map(x=>x.hero.name).join(' · ')||'—'}</Text></View>
}
function Lineups({blue,red}:{blue:Hero[];red:Hero[]}) {
  const roleName=(team:Hero[],r:string)=>team.find(h=>h.role===r||h.flex?.includes(r as any))?.name||'Flexible';
  return <View style={{marginTop:14}}>{roleOrder.map(r=><View key={r} style={s.match}><Text style={s.matchHero}>{roleName(blue,r)}</Text><Text style={s.matchRole}>{r}</Text><Text style={s.matchHero}>{roleName(red,r)}</Text></View>)}</View>
}

const s=StyleSheet.create({root:{flex:1,backgroundColor:'#090d14'},pad:{padding:14,paddingBottom:40},header:{paddingVertical:12},title:{color:'#fff',fontWeight:'900',fontSize:22},sub:{color:'#8793a8',marginTop:4},sticky:{backgroundColor:'#101722',borderWidth:1,borderColor:'#27334a',borderRadius:14,padding:12,marginBottom:12},vs:{color:'#fff',textAlign:'center',fontWeight:'800'},muted:{color:'#647089'},stage:{color:'#56b4ff',textAlign:'center',fontSize:18,fontWeight:'900',marginTop:5},row:{flexDirection:'row',gap:10},team:{flex:1,backgroundColor:'#101722',borderRadius:14,padding:10,borderWidth:1,borderColor:'#202b3d'},teamTitle:{color:'#fff',fontWeight:'900',fontSize:17},label:{color:'#71809a',fontSize:10,fontWeight:'900',marginTop:9},slot:{color:'#eaf1ff',paddingVertical:3},bans:{color:'#ff8181',fontSize:12,lineHeight:18},card:{backgroundColor:'#101722',borderRadius:14,padding:12,borderWidth:1,borderColor:'#26334a',marginTop:12},cardTitle:{color:'#f3f6ff',fontWeight:'900',fontSize:14,marginBottom:8},rec:{flexDirection:'row',alignItems:'center',borderTopWidth:1,borderTopColor:'#1c2739',paddingVertical:9},rank:{color:'#6bbcff',fontWeight:'900',width:24},hero:{color:'#fff',fontWeight:'800'},small:{color:'#8896ad',fontSize:11,marginTop:2},score:{color:'#63e89e',fontWeight:'900',fontSize:18},note:{color:'#7e8ba0',fontSize:11,lineHeight:16,marginTop:8},search:{backgroundColor:'#101722',color:'#fff',borderRadius:12,paddingHorizontal:14,paddingVertical:12,marginTop:12,borderWidth:1,borderColor:'#26334a'},filters:{gap:8,paddingVertical:10},filter:{backgroundColor:'#151d2a',borderRadius:20,paddingHorizontal:13,paddingVertical:8},filterOn:{backgroundColor:'#176db5'},filterText:{color:'#fff',fontWeight:'800',fontSize:11},heroCard:{flex:1,minHeight:112,backgroundColor:'#101722',borderRadius:13,padding:12,marginBottom:10,borderWidth:1,borderColor:'#202b3d'},dot:{width:10,height:10,borderRadius:5,marginBottom:9},priority:{color:'#63e89e',fontWeight:'800',marginTop:6},flex:{color:'#f3c468',fontSize:10,fontWeight:'900',marginTop:5},controls:{flexDirection:'row',gap:10,marginTop:14},primary:{flex:1,backgroundColor:'#176db5',borderRadius:12,padding:14},secondary:{flex:1,backgroundColor:'#202b3d',borderRadius:12,padding:14},btnText:{color:'#fff',textAlign:'center',fontWeight:'900'},adv:{color:'#8ebfff',fontWeight:'900',marginTop:12},big:{color:'#fff',fontSize:24,fontWeight:'900',marginTop:4},conf:{color:'#f3c468',fontWeight:'900',marginTop:5},report:{color:'#c1cada',lineHeight:19,marginTop:5},match:{flexDirection:'row',alignItems:'center',paddingVertical:7,borderTopWidth:1,borderTopColor:'#1e2a3c'},matchHero:{flex:1,color:'#fff',fontWeight:'700'},matchRole:{width:70,textAlign:'center',color:'#70819c',fontSize:10,fontWeight:'900'},footer:{color:'#526078',fontSize:9,textAlign:'center',lineHeight:14,marginTop:20}}
);
