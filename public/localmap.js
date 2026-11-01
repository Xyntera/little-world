/* Original local wayfinding UI. Read-only geometry; no server, tracking or auto-travel. */
export function mapRoads(w) {
  // Canonical map convention: ax x is constant x (north-south).
  // Both generators and the taxi consumer use this convention.
  // Keep copies so map display cannot change shared taxi-stop metadata.
  return (w.roads || []).map(r => ({ ...r }));
}
//324 display-only coast sampled from the rendered shoreline; mapped water stays authoritative.
// The blue band is schematic, not swimming depth or navigable/public access.
const coastCache=new WeakMap();
export function mapCoast(w) {
  if(coastCache.has(w))return coastCache.get(w);
  const sf=w.surf;if(w.mapWater||!sf||!['n','s','e','w'].includes(sf.ori)||!Number.isFinite(sf.lim)||sf.lim<=0)return null;
  const eastWest=sf.ori==='e'||sf.ori==='w',sign=sf.ori==='e'||sf.ori==='s'?1:-1,edge=[];
  for(let a=-sf.lim;a<=sf.lim;a+=2){const v=sf.at(a);if(!Number.isFinite(v))return null;edge.push(eastWest?[v,a]:[a,v]);}
  if(edge.at(-1)[eastWest?1:0]<sf.lim){const v=sf.at(sf.lim);if(!Number.isFinite(v))return null;edge.push(eastWest?[v,sf.lim]:[sf.lim,v]);}
  const outer=sign>0?Math.max(...edge.map(p=>p[eastWest?0:1]))+18:Math.min(...edge.map(p=>p[eastWest?0:1]))-18;
  const ring=[...edge,eastWest?[outer,sf.lim]:[sf.lim,outer],eastWest?[outer,-sf.lim]:[-sf.lim,outer]];coastCache.set(w,ring);return ring;
}
export function createLocalMap({ getWorld, getPlayer, getCityName, getLandmarkName, getDiscovery, getTaxiPickup, onChoose }) {
  const canvas = document.getElementById('local-map'), ctx = canvas.getContext('2d');
  let selected = null, cityKey = null, bounds = null;
  let zoom = 1, center = null, drag = null, showGuide=false;
  const controls = document.createElement('div'); controls.className = 'map-view-controls';
  controls.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0';
  const button = (text, label, action) => { const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',label);b.onclick=action;controls.append(b);return b; };
  const setZoom = n => { zoom=Math.max(1,Math.min(8,n));if(!center){const p=getPlayer();center=p?{x:p.x,z:p.z}:null;}boundCenter();draw(); };
  const minus=button('-', 'Zoom map out',()=>setZoom(zoom/2));
  const plus=button('+', 'Zoom map in',()=>setZoom(zoom*2));
  button('Find me','Center map on your position',()=>{const p=getPlayer();if(p)center={x:p.x,z:p.z};boundCenter();draw();});
  button('Whole map','Reset to whole map',()=>{zoom=1;center=null;showGuide=false;draw();});
  const guideButton=button('Game walk','Show local game walking guide',()=>{showGuide=!showGuide;draw();});
  const guideNote=document.createElement('p');guideNote.className='lk-sub';guideNote.hidden=true;canvas.after(guideNote);
  const zoomLabel=document.createElement('span');zoomLabel.setAttribute('aria-live','polite');controls.append(zoomLabel);canvas.before(controls);
  const trailNote=document.createElement('p');trailNote.className='lk-sub';trailNote.id='map-discovery-note';trailNote.hidden=true;canvas.after(trailNote);
  const unitScale=()=>bounds?Math.min(352/(bounds[1]-bounds[0]),352/(bounds[3]-bounds[2]))*zoom:1;
  function boundCenter(){if(!bounds||!center)return;const [a,b,c,d]=bounds;center.x=Math.max(a,Math.min(b,center.x));center.z=Math.max(c,Math.min(d,center.z));}
  canvas.style.touchAction='none';canvas.style.cursor='grab';
  canvas.addEventListener('pointerdown',e=>{e.stopPropagation();if(!bounds||drag)return;const r=canvas.getBoundingClientRect();if(zoom>1&&!center)center={x:(bounds[0]+bounds[1])/2,z:(bounds[2]+bounds[3])/2};drag={id:e.pointerId,x:e.clientX,z:e.clientY,cx:center?.x,cz:center?.z,scale:unitScale()*r.width/400,moved:false,world:getWorld()};canvas.setPointerCapture(e.pointerId);if(zoom>1)canvas.style.cursor='grabbing';});
  canvas.addEventListener('pointermove',e=>{e.stopPropagation();if(!drag||e.pointerId!==drag.id)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.z)>8)drag.moved=true;if(zoom>1&&drag.moved){center={x:drag.cx-(e.clientX-drag.x)/drag.scale,z:drag.cz-(e.clientY-drag.z)/drag.scale};boundCenter();draw();}});
  const stopDrag=e=>{e.stopPropagation();if(!drag||e.pointerId!==drag.id)return;const press=drag;drag=null;canvas.style.cursor='grab';if(e.type!=='pointerup'||press.moved||press.world!==getWorld()||Math.hypot(e.clientX-press.x,e.clientY-press.z)>8)return;
    const r=canvas.getBoundingClientRect(),cx=center?center.x:(bounds[0]+bounds[1])/2,cz=center?center.z:(bounds[2]+bounds[3])/2,scale=unitScale();
    const px=(e.clientX-r.left)*400/r.width,pz=(e.clientY-r.top)*400/r.height;if(px<24||px>376||pz<24||pz>352)return;
    let best=null,distance=18;for(const q of choices(getWorld())){const x=200+(q.x-cx)*scale,z=200+(q.z-cz)*scale;if(x<24||x>376||z<24||z>352)continue;const d=Math.hypot((x-px)*r.width/400,(z-pz)*r.height/400);if(d<distance){distance=d;best=q;}}
    if(best){selected={...best,direct:true,name:stopLabel(best,choices(getWorld()))};onChoose(best);draw();}
  };canvas.addEventListener('pointerup',stopDrag);canvas.addEventListener('pointercancel',stopDrag);canvas.addEventListener('lostpointercapture',stopDrag);


  const previewLegend = document.createElement('p');
  previewLegend.className = 'lk-sub'; previewLegend.hidden = true;
  previewLegend.textContent = 'Gold: OSM preview. Gray: generated taxi roads. Partial slice. © OpenStreetMap · ODbL.';
  canvas.after(previewLegend);
  const targets = w => w.mapPlaces || w.places || [];
  const stopName = q => q.name || (getLandmarkName && getLandmarkName()) || 'Landmark square';
  const stopLabel = (q, places) => {
    const name = stopName(q);
    return places.filter(p => stopName(p) === name).length > 1 ? name + ' (' + (q.z < 0 ? 'north' : 'south') + (q.x < 0 ? 'west' : 'east') + ')' : name;
  };
  const stageStop=w=>w.stage?{x:w.stage.x,z:w.stage.z,name:'Stage',r:2,stage:true}:null;
  const choices = w => [...targets(w),...(w.stage?[stageStop(w)]:[]),...(getDiscovery?getDiscovery():[]).map(q=>({...q,name:'Discovery '+q.number+': '+(q.name||'Story spot'),discovery:true}))];
  const clear = () => { selected = null; document.getElementById('map-marker').hidden = true; };
  function refresh(key) {
    const w = getWorld(); if (!w) return;
    if (cityKey !== key) { clear(); cityKey = key; zoom=1;center=null;showGuide=false; }
    document.getElementById('localmap-title').textContent = getCityName() + ' map';
    canvas.setAttribute('aria-label',w.mapPlaces?'Partial mapped geography with water, landmarks and your position':'Generated city layout with your position and named stops. Tap a named stop pin for a bearing; use the destination list for overlapping pins.');
    const desc=document.querySelector('#panel-localmap .lk-sub');if(desc){if(!desc.dataset.original)desc.dataset.original=desc.textContent;desc.textContent=w.mapPlaces?'White: you. Cream: mapped ways and landmarks. Blue: water. Choose a landmark for a bearing, not a routed path. Gray: game buildings. Dashed pink: original outlines where widened. Drag to look around. Partial local preview; no access guarantee.':desc.dataset.original+' Tap a stop pin, or use the list for overlapping pins. Purple square: stage.'+(mapCoast(w)?' Blue: schematic water edge, not swimming depth.':'');}

    const select = document.getElementById('localmap-select'); select.replaceChildren();
    const first = document.createElement('option'); first.value = ''; first.textContent = w.mapPlaces ? 'Choose a map landmark' : 'Choose a named stop'; select.append(first);
    const available=choices(w);
    available.forEach((q, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = stopLabel(q, available)+(q.discovery?(q.found?' (found)':q.current?' (next)':' (later)'):''); select.append(o); });
    if (selected) { const i = available.findIndex(q => stopLabel(q, available) === selected.name && q.x === selected.x && q.z === selected.z); if (i >= 0) select.value = String(i); }
    select.onchange = () => { const q = available[+select.value];if(getWorld()!==w){clear();return;} if (select.value && q) { selected = { ...q, name: stopLabel(q, available) }; onChoose(q); draw(); } else { clear(); draw(); } };
    document.getElementById('localmap-clear').onclick = () => { clear(); select.value = ''; draw(); };
    bounds = w.mapBounds || [w.clamp(-1e6,0)[0],w.clamp(1e6,0)[0],w.clamp(0,-1e6)[1],w.clamp(0,1e6)[1]];
    const coast=mapCoast(w);if(coast&&!w.mapBounds)bounds=[Math.min(bounds[0],...coast.map(p=>p[0])),Math.max(bounds[1],...coast.map(p=>p[0])),Math.min(bounds[2],...coast.map(p=>p[1])),Math.max(bounds[3],...coast.map(p=>p[1]))];
    draw();
  }
  function draw() {
    const w = getWorld(), p = getPlayer(); if (!w || !p || !bounds) return;
    const [x0,x1,z0,z1] = bounds, scale = unitScale();
    const cx=center?center.x:(x0+x1)/2,cz=center?center.z:(z0+z1)/2;
    const X = x => 200+(x-cx)*scale, Z = z => 200+(z-cz)*scale;
    guideButton.hidden=!w.mapGuide;guideButton.setAttribute('aria-pressed',String(showGuide));guideButton.textContent=showGuide?'Hide game walk':'Game walk';guideNote.hidden=!(showGuide&&w.mapGuide);guideNote.textContent='Gold: checked local game walk, not public directions. Dashed start: short unmapped connector. No auto-travel.';
    zoomLabel.textContent=zoom+'x';minus.disabled=zoom===1;plus.disabled=zoom===8;
    ctx.fillStyle='#12394a';ctx.fillRect(0,0,400,400);
    ctx.fillStyle='#53745a';ctx.fillRect(X(x0),Z(z0),(x1-x0)*scale,(z1-z0)*scale);
    ctx.save();ctx.beginPath();ctx.rect(24,24,352,328);ctx.clip();ctx.beginPath();ctx.rect(X(x0),Z(z0),(x1-x0)*scale,(z1-z0)*scale);ctx.clip();
    const polygon=(ring,color)=>{if(!ring||ring.length<3)return;ctx.fillStyle=color;ctx.beginPath();ring.forEach(([x,z],i)=>i?ctx.lineTo(X(x),Z(z)):ctx.moveTo(X(x),Z(z)));ctx.closePath();ctx.fill();};
    for(const ring of w.mapWater||[])polygon(ring,'#3d829c');
    const coast=mapCoast(w);if(coast)polygon(coast,'#3d829c');
    ctx.strokeStyle='#b8b7a6';ctx.lineWidth=Math.max(1,2*scale);
    for(const r of mapRoads(w)){ctx.lineWidth=r.pts?Math.max(.65,1.2*scale):Math.max(2,6*scale);ctx.beginPath();if(r.pts){r.pts.forEach(([x,z],i)=>i?ctx.lineTo(X(x),Z(z)):ctx.moveTo(X(x),Z(z)));}else{const alongZ=r.ax==='x';if(alongZ){ctx.moveTo(X(r.c),Z(r.from));ctx.lineTo(X(r.c),Z(r.to));}else{ctx.moveTo(X(r.from),Z(r.c));ctx.lineTo(X(r.to),Z(r.c));}}ctx.stroke();}
    for(const ring of w.mapBuildings||[])polygon(ring,'#8d927c');
    ctx.strokeStyle='#f1a7bc';ctx.lineWidth=1.4;ctx.setLineDash([4,3]);for(const ring of w.mapSourceBuildings||[]){ctx.beginPath();ring.forEach(([x,z],i)=>i?ctx.lineTo(X(x),Z(z)):ctx.moveTo(X(x),Z(z)));ctx.stroke();}ctx.setLineDash([]);
    if(showGuide&&w.mapGuide){ctx.strokeStyle='#ffd23f';ctx.lineWidth=3;for(let i=1;i<w.mapGuide.length;i++){ctx.setLineDash(i===1?[4,3]:[]);const a=w.mapGuide[i-1],b=w.mapGuide[i];ctx.beginPath();ctx.moveTo(X(a[0]),Z(a[1]));ctx.lineTo(X(b[0]),Z(b[1]));ctx.stroke();}ctx.setLineDash([]);}

    // The gated NY slice already owns these projected segments. Display only;
    // procedural roads above remain taxi routes, never replace their metadata.
    const previewSegs = w.nyProto && w.nyProto.segs;
    if (previewSegs) {
      ctx.strokeStyle='#e2c680';
      for (const [ax,az,bx,bz,hw] of previewSegs) {
        ctx.lineWidth=Math.max(1,hw*2*scale);ctx.beginPath();ctx.moveTo(X(ax),Z(az));ctx.lineTo(X(bx),Z(bz));ctx.stroke();
      }
    }
    ctx.fillStyle='#253f35';for(const c of (w.mapBuildings ? [] : w.colliders||[])){if(c.off||c.wallEast)continue;if(c.hw)ctx.fillRect(X(c.x-c.hw),Z(c.z-c.hd),c.hw*2*scale,c.hd*2*scale);else if(c.r){ctx.beginPath();ctx.arc(X(c.x),Z(c.z),Math.max(.7,c.r*scale),0,Math.PI*2);ctx.fill();}}
    if(w.pool){const q=w.pool;ctx.fillStyle='#4d9dba';if(q.x!==undefined&&q.z!==undefined){ctx.fillRect(X(q.x-q.hw),Z(q.z-q.hd),q.hw*2*scale,q.hd*2*scale);}}
    if(coast)polygon(coast,'#3d829c'); // coast masks generated roads/obstacles that continue beyond their dry-world predicate
    ctx.fillStyle='#f3ddab';ctx.font='bold 11px system-ui';for(const q of targets(w)){ctx.beginPath();ctx.arc(X(q.x),Z(q.z),3,0,Math.PI*2);ctx.fill();}
    const stage=stageStop(w);if(stage){ctx.fillStyle='#dfaaea';ctx.fillRect(X(stage.x)-4,Z(stage.z)-4,8,8);}
    const trail=getDiscovery?getDiscovery():[];trailNote.hidden=!trail.length;trailNote.textContent='Discovery 1-3: gold ring = next, green = found. Fictional game spots only; no route or real access guarantee.';for(const q of trail){ctx.beginPath();ctx.arc(X(q.x),Z(q.z),q.current?10:7,0,Math.PI*2);ctx.fillStyle=q.found?'#83c69b':'#173d34';ctx.fill();ctx.strokeStyle=q.current?'#ffe188':'#c7ceb8';ctx.lineWidth=q.current?3:1;ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(q.number),X(q.x),Z(q.z));ctx.textAlign='start';ctx.textBaseline='alphabetic';}
    const pickup=getTaxiPickup&&getTaxiPickup();if(pickup){ctx.strokeStyle='#ffd23f';ctx.lineWidth=3;ctx.strokeRect(X(pickup.x)-7,Z(pickup.z)-7,14,14);}
    if(selected){ctx.strokeStyle='#ffd23f';ctx.lineWidth=3;ctx.beginPath();ctx.arc(X(selected.x),Z(selected.z),8,0,Math.PI*2);ctx.stroke();}
    ctx.fillStyle='#fff';ctx.strokeStyle='#0d3f36';ctx.lineWidth=2;ctx.beginPath();ctx.arc(X(p.x),Z(p.z),5,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.restore();
    ctx.fillStyle='#fff';ctx.font='bold 13px system-ui';ctx.fillText('N ↑',14,20);
    if(w.mapMetersPerUnit){const wanted=75/scale*w.mapMetersPerUnit,power=10**Math.floor(Math.log10(wanted)),nice=[1,2,5,10].map(n=>n*power).filter(n=>n<=wanted).pop()||power/2,len=nice/w.mapMetersPerUnit*scale;ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(282,339);ctx.lineTo(282+len,339);ctx.stroke();ctx.font='11px system-ui';ctx.fillText(nice+' m',282,333);}
    ctx.font='11px system-ui';previewLegend.hidden = !previewSegs;
    if(!previewSegs){ctx.font=(w.mapNote?'10':'11')+'px system-ui';ctx.fillText(w.mapNote || 'Main roads + obstacles · not a real street map',14,389);}
    if(selected){ctx.fillStyle='#fff';ctx.font='bold 12px system-ui';ctx.fillText(selected.name,14,369);}
  }
  function tick(key, yaw) {
    if(cityKey!==key){clear();cityKey=key;bounds=null;zoom=1;center=null;showGuide=false;}
    if(selected?.discovery&&!(getDiscovery?getDiscovery():[]).some(q=>q.number===selected.number&&q.x===selected.x&&q.z===selected.z))clear();
    const el=document.getElementById('map-marker'),p=getPlayer(),stage=getWorld()?.stage;
    if(selected?.taxiArrival&&p&&Math.hypot(p.x-selected.x,p.z-selected.z)<=Math.max(3,Math.min(5,selected.r||0)))clear();
    if(selected?.stage&&p&&stage&&Math.abs(p.x-stage.x)<stage.w/2&&Math.abs(p.z-stage.z)<stage.d/2)clear(); //292 arrival completes stage navigation
    const pickup=getTaxiPickup&&getTaxiPickup(),nav=pickup?{...pickup,name:'Taxi pickup',pickup:true}:selected;
    if(nav&&p){const dx=nav.x-p.x,dz=nav.z-p.z,d=Math.hypot(dx,dz);el.hidden=false;
      document.getElementById('map-marker-text').textContent=nav.name+' · '+Math.round(d*(nav.metersPerUnit||(getWorld()||{}).mapMetersPerUnit||1))+' m'+(nav.direct||nav.discovery||nav.stage||nav.pickup||nav.taxiArrival?' direct · not a route':'')+(nav.pickup?' · walk to the cab':nav.taxiArrival?' · finish on foot':d<=(nav.discovery?nav.r:getWorld().mapPlaces?Math.max(.8,nav.r||0):Math.max(5,nav.r||0))?' · nearby':'');
      document.getElementById('map-marker-arrow').style.transform='rotate('+((Math.atan2(dx,dz)-yaw)*-180/Math.PI)+'deg)';
    }else el.hidden=true;
    if (el && !el.hidden) el.style.visibility = document.querySelector('.lk-side:not([hidden])') ? 'hidden' : 'visible';
    if(!document.getElementById('panel-localmap').hidden)draw();
  }
  function chooseStage(key){const q=stageStop(getWorld());if(!q)return false;refresh(key);selected=q;onChoose(q);draw();return true;}
  function chooseTaxiArrival(key,target){refresh(key);selected={...target,name:target.taxiLabel||stopName(target),taxiArrival:true};draw();}
  return {refresh,tick,clear,chooseStage,chooseTaxiArrival};
}

//218 read-only embedded local preview. Shares world metadata, never moves player or changes full-map state.
export function drawExploreMap(canvas,w,p){
  if(!canvas||!w||!p)return;
  const ctx=canvas.getContext('2d'),W=640,H=300,scale=8;
  const X=x=>W/2+(x-p.x)*scale,Z=z=>H/2+(z-p.z)*scale;
  ctx.fillStyle='#53745a';ctx.fillRect(0,0,W,H);
  const poly=(ring,color)=>{if(!ring||ring.length<3)return;ctx.fillStyle=color;ctx.beginPath();ring.forEach(([x,z],i)=>i?ctx.lineTo(X(x),Z(z)):ctx.moveTo(X(x),Z(z)));ctx.closePath();ctx.fill();};
  for(const ring of w.mapWater||[])poly(ring,'#3d829c');
  const coast=mapCoast(w);if(coast)poly(coast,'#3d829c');
  ctx.strokeStyle='#d8d0b8';
  for(const r of mapRoads(w)){ctx.lineWidth=r.pts?7:10;ctx.beginPath();if(r.pts)r.pts.forEach(([x,z],i)=>i?ctx.lineTo(X(x),Z(z)):ctx.moveTo(X(x),Z(z)));else if(r.ax==='x'){ctx.moveTo(X(r.c),Z(r.from));ctx.lineTo(X(r.c),Z(r.to));}else{ctx.moveTo(X(r.from),Z(r.c));ctx.lineTo(X(r.to),Z(r.c));}ctx.stroke();}
  if(w.mapBuildings){for(const ring of w.mapBuildings)poly(ring,'#8d927c');}
  else{ctx.fillStyle='#334f3c';for(const c of w.colliders||[]){if(c.off||c.wallEast)continue;if(c.hw)ctx.fillRect(X(c.x-c.hw),Z(c.z-c.hd),c.hw*2*scale,c.hd*2*scale);else if(c.r){ctx.beginPath();ctx.arc(X(c.x),Z(c.z),c.r*scale,0,Math.PI*2);ctx.fill();}}}
  ctx.strokeStyle='#f1a7bc';ctx.lineWidth=2;ctx.setLineDash([5,4]);for(const ring of w.mapSourceBuildings||[]){ctx.beginPath();ring.forEach(([x,z],i)=>i?ctx.lineTo(X(x),Z(z)):ctx.moveTo(X(x),Z(z)));ctx.stroke();}ctx.setLineDash([]);
  if(coast)poly(coast,'#3d829c');
  ctx.fillStyle='#f3ddab';for(const q of w.mapPlaces||w.places||[]){ctx.beginPath();ctx.arc(X(q.x),Z(q.z),5,0,Math.PI*2);ctx.fill();}
  ctx.fillStyle='#fff';ctx.strokeStyle='#0d3f36';ctx.lineWidth=3;ctx.beginPath();ctx.arc(W/2,H/2,7,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#fff';ctx.font='bold 22px system-ui';ctx.fillText('N ↑',16,30);
}
