// Read-only stage grouping from the existing nearby-presence snapshot.
export const STAGE_DANCES=['dance','party','bhangra','disco','robot','spin','moonwalk','garba','kathak','salsa','breakdance','ballet','hula'];
export const danceName=move=>({dance:'Dance',party:'Party',bhangra:'Bhangra',disco:'Disco',robot:'Robot',spin:'Spin',moonwalk:'Moonwalk',garba:'Garba',kathak:'Kathak',salsa:'Salsa',breakdance:'Breakdance',ballet:'Ballet',hula:'Hula'})[move]||'Dance';
export function stageGroups(remotes,stage){
 if(!stage)return[];const counts=new Map();
 for(const r of remotes){const p=r.group?.position;if(!p||r.vkind||!STAGE_DANCES.includes(r.emote)||Math.abs(p.x-stage.x)>=stage.w/2||Math.abs(p.z-stage.z)>=stage.d/2)continue;counts.set(r.emote,(counts.get(r.emote)||0)+1);}
 return [...counts].map(([move,count])=>({move,count})).sort((a,b)=>b.count-a.count||STAGE_DANCES.indexOf(a.move)-STAGE_DANCES.indexOf(b.move));
}
