import * as THREE from '/vendor/three.module.js';
/*219 session-only local discovery. No points, saves, server requests or real-world directions. */
export function createDiscovery({getPlayer,getWorld,getCity,onReveal,onMap}){
 const stops=[
  {x:99,z:18,r:1.5,title:'The eastern watch',clue:'Find the tall eastern gate beside the bridge.',story:'A fictional keeper leaves a brass token at the gate: every journey begins by noticing what is close.'},
  {x:78,z:13.6,r:2.2,title:'Above the river',clue:'Walk west along the stone bridge. Find its middle span.',story:'In this fictional tale, the token warms above the river. Its keeper counted crossings, never coins.'},
  {x:60,z:9.3,r:1.4,title:'Two towers, one ending',clue:'Stop on the bridge before the western towers. Look ahead at the unequal pair.',story:'The keeper hid the last message between two towers: a place becomes yours when you learn to find your way.'}
 ];
 const challenges=[
  {question:'Look at the gate ahead. What shape is its dark roof?',answers:['A pointed roof','A round dome','No roof at all'],correct:0,hint:'Look above the square opening for the sharp peak.'},
  {question:'Look to both sides of the bridge. What lies below?',answers:['A dry courtyard','River water','A forest path'],correct:1,hint:'The blue surface runs along both sides of this crossing.'},
  {question:'Look at the two towers beside the western gate. Are they equal in height?',answers:['Yes, identical','There is only one tower','No, one is taller'],correct:2,hint:'Compare the tops of the two neighboring tower bodies.'}
 ];
 let active=false,index=0,seen=[],finished=false,inspecting=false,feedback='';
 let compact=false,marker=null,markerWorld=null;
 //238 DOM updates only when visible distance/proximity changes. Explicit actions still render immediately.
 let renderedDistance,renderedNear,renderedWorld;
 const directDistance=()=>{const p=getPlayer(),s=stops[index];return Math.round(Math.hypot(s.x-p.x,s.z-p.z)*9.5);};
 function clearMarker(){if(marker){marker.removeFromParent();marker.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});marker=null;}markerWorld=null;}
 function updateMarker(){
  const w=getWorld();if(!active||finished||getCity()!=='prague'||!w||!w.group){clearMarker();return;}
  if(markerWorld!==w){clearMarker();markerWorld=w;marker=new THREE.Group();marker.name='fictional-discovery-marker';
   const ring=new THREE.Mesh(new THREE.TorusGeometry(.48,.045,6,28),new THREE.MeshStandardMaterial({color:'#f0d78a',emissive:'#d8aa44',emissiveIntensity:.2}));ring.rotation.x=-Math.PI/2;ring.position.y=.07;marker.add(ring);w.group.add(marker);}
  const p=stops[index];marker.position.set(p.x,w.groundY(p.x,p.z),p.z);
 }

 const hud=document.createElement('section');hud.id='discovery-hud';hud.hidden=true;hud.setAttribute('aria-label','Local discovery walk');
 hud.innerHTML='<button type="button" id="discovery-expand" hidden>Show discovery</button><button type="button" id="discovery-minimize">Hide for view</button><div class="discovery-detail"><small>FICTIONAL DISCOVERY · LOCAL PREVIEW</small><strong id="discovery-title"></strong><p id="discovery-clue"></p><p id="discovery-status" aria-live="polite"></p></div><button type="button" id="discovery-inspect">Inspect nearby spot</button><div id="discovery-question" hidden><button type="button" id="discovery-look">Look around first</button><p id="discovery-prompt"></p><div id="discovery-answers"></div><p id="discovery-feedback" aria-live="polite"></p></div><button type="button" id="discovery-map">Trail map</button><button type="button" id="discovery-read">Read finds</button><button type="button" id="discovery-restart">Start over</button><button type="button" id="discovery-stop" aria-label="Pause discovery walk">×</button>';
 document.getElementById('play').append(hud);
 hud.querySelector('#discovery-stop').onclick=()=>{active=false;hud.hidden=true;clearMarker();};
 const near=()=>{const p=getPlayer(),s=stops[index];return Math.hypot(p.x-s.x,p.z-s.z)<=s.r;};
 const inspect=hud.querySelector('#discovery-inspect'),question=hud.querySelector('#discovery-question');
 function inspectSpot(){if(!active||finished||!near())return;inspecting=true;feedback='';const c=challenges[index];hud.querySelector('#discovery-prompt').textContent=c.question;const answers=hud.querySelector('#discovery-answers');answers.replaceChildren();c.answers.forEach((text,i)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=()=>answer(i);answers.append(b);});render();}
 function answer(i){if(!active||finished||!inspecting)return;if(!near()){feedback='Move back to the spot to answer.';render();return;}const c=challenges[index];if(i!==c.correct){feedback='Not quite. '+c.hint;render();return;}const s=stops[index];seen.push({title:s.title,story:s.story,observation:c.answers[c.correct]});inspecting=false;feedback='';if(index===stops.length-1)finished=true;else index++;if(finished&&matchMedia('(max-width:640px)').matches)compact=true;onReveal(seen,finished,stops.map((s,i)=>({title:s.title,found:i<seen.length,current:!finished&&i===index,clue:i===index?s.clue:''})));render();}
 inspect.onclick=inspectSpot;hud.querySelector('#discovery-look').onclick=()=>{inspecting=false;feedback='';compact=matchMedia('(max-width:640px)').matches;render();};
 hud.querySelector('#discovery-minimize').onclick=()=>{compact=true;render();};
 hud.querySelector('#discovery-expand').onclick=()=>{compact=false;if(!finished&&near())inspectSpot();else render();};
 hud.querySelector('#discovery-map').onclick=()=>onMap();
 hud.querySelector('#discovery-read').onclick=()=>onReveal(seen,finished,stops.map((s,i)=>({title:s.title,found:i<seen.length,current:!finished&&i===index,clue:i===index?s.clue:''})));
 function render(){updateMarker();hud.classList.toggle('is-compact',compact);hud.querySelector('#discovery-expand').hidden=!compact;hud.querySelector('#discovery-expand').textContent=!finished&&near()?'Inspect this spot':finished?'Show discovery':'Show discovery · '+seen.length+'/3';const s=stops[index];inspect.hidden=finished||inspecting;inspect.disabled=!near();inspect.textContent=near()?'Inspect this spot':'Walk closer to inspect';question.hidden=!inspecting;hud.querySelector('#discovery-feedback').textContent=feedback;hud.querySelector('#discovery-title').textContent=finished?'Walk complete':s.title;hud.querySelector('#discovery-clue').textContent=finished?'All three story fragments found. No points or stamps awarded.':s.clue;hud.querySelector('#discovery-status').textContent=finished?'3 / 3 found':seen.length+' / 3 found · '+Math.round(Math.hypot(s.x-getPlayer().x,s.z-getPlayer().z)*9.5)+' m direct distance · not a route. Gold ring marks the spot.';renderedDistance=directDistance();renderedNear=near();renderedWorld=getWorld();}
 function start(){if(getCity()!=='prague')return false;active=true;inspecting=false;feedback='';compact=false;hud.hidden=false;render();return true;}
 hud.querySelector('#discovery-restart').onclick=()=>{index=0;seen=[];finished=false;start();};
 function tick(){if(!active)return;if(getCity()!=='prague'){active=false;hud.hidden=true;clearMarker();return;}if(getWorld()!==renderedWorld||directDistance()!==renderedDistance||near()!==renderedNear)render();}
 return {start,tick,get mapStops(){return active?stops.map((s,i)=>({x:s.x,z:s.z,number:i+1,found:i<seen.length,current:!finished&&i===index})):[];},get state(){return{active,index,seen:[...seen],finished,inspecting,marker:!!marker};}};
}
