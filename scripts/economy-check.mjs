import {ClickGame,BOXES} from '../src/engine.ts';
import {BRAWLERS} from '../src/data.ts';
import {writeFile} from 'node:fs/promises';
let state=54873;const rng=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296};
const reports=[];
for(const [label,tap,level,stars] of [['start',0,1,0],['trained',5,5,0],['advanced',12,11,5]]){
 const g=new ClickGame(undefined,rng,1000);g.state.upgrades.tap=tap;g.state.stars=stars;g.state.fighters=[{id:BRAWLERS[0].id,level,cards:0},{id:BRAWLERS[1].id,level,cards:0},{id:BRAWLERS[2].id,level,cards:0}];g.state.team=g.state.fighters.map(f=>f.id);const start=g.state.coins;
 for(let round=0;round<20;round++){g.startRush();for(let tick=0;tick<250;tick++){const now=1000+round*30000+tick*100;g.tick(100,now);if(!g.state.rush)break;if(g.state.rush.skill.cooldown===0)g.useAbility();if(g.state.rush?.charge>=100)g.activateSuper(now);if(tick%3===0&&g.state.rush){const target=g.state.rush.targets.find(t=>t.kind!=='bomb');if(target)g.rushHit(target.id,now)}}g.dismiss()}
 const average=(g.state.coins-start)/20;reports.push({profile:label,assumption:'20 simulated 25s rounds at about 3 taps/s, uses skill/Super, avoids bombs',averageCoinsPerRound:Math.round(average),boxes:BOXES.filter(b=>b.currency==='coins').map(b=>({id:b.id,cost:b.cost,roundsAtThisIncome:Math.round(b.cost/average*10)/10}))});
}
await writeFile('artifacts/economy-0.1.1.json',JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
