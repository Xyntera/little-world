import * as THREE from '/vendor/three.module.js';
/*219 session-only local discovery. No points, saves, server requests or real-world directions. */
export function createDiscovery({getPlayer,getWorld,getCity,onReveal,onMap}){
 const pragueStops=[
  {x:99,z:18,r:1.5,title:'The eastern watch',clue:'Find the tall eastern gate beside the bridge.',story:'A fictional keeper leaves a brass token at the gate: every journey begins by noticing what is close.'},
  {x:78,z:13.6,r:2.2,title:'Above the river',clue:'Walk west along the stone bridge. Find its middle span.',story:'In this fictional tale, the token warms above the river. Its keeper counted crossings, never coins.'},
  {x:60,z:9.3,r:1.4,title:'Two towers, one ending',clue:'Stop on the bridge before the western towers. Look ahead at the unequal pair.',story:'The keeper hid the last message between two towers: a place becomes yours when you learn to find your way.'}
 ];
 const pragueChallenges=[
  {question:'Look at the gate ahead. What shape is its dark roof?',answers:['A pointed roof','A round dome','No roof at all'],correct:0,hint:'Look above the square opening for the sharp peak.'},
  {question:'Look to both sides of the bridge. What lies below?',answers:['A dry courtyard','River water','A forest path'],correct:1,hint:'The blue surface runs along both sides of this crossing.'},
  {question:'Look at the two towers beside the western gate. Are they equal in height?',answers:['Yes, identical','There is only one tower','No, one is taller'],correct:2,hint:'Compare the tops of the two neighboring tower bodies.'}
 ];
 const sydneyChallenges=[
  {question:'Look at the pale roof cluster ahead. What shape repeats?',answers:['Curving sails','Square chimneys','A single flat slab'],correct:0,hint:'Look for the separate pointed, curved roof shells.'},
  {question:'Look above the bridge deck. What carries its silhouette?',answers:['A round dome','A steel arch','A row of sails'],correct:1,hint:'The gray steel rises toward the middle and falls at the ends.'},
  {question:'Look up at the slender tower. What sits near its top?',answers:['A green dome','Two square towers','A wider round turret'],correct:2,hint:'Find the wider round platform near the top of the shaft.'}
 ];
 const tokyoChallenges=[
  {question:'Look up at the tower. What can you see between its legs?',answers:['Open gaps and braces','A solid stone wall','A hanging bell'],correct:0,hint:'Look through the orange-and-white framework.'},
  {question:'Look at the front of the temple hall. What repeats beneath its dark roof?',answers:['Round glass domes','Red upright posts','A row of sails'],correct:1,hint:'Follow the red vertical lines down from the long roof edge.'},
  {question:'Look at the red gate before the shrine. How many upright posts hold it?',answers:['One central post','Four corner posts','Two upright posts'],correct:2,hint:'Follow the two red posts down from the crossbars.'}
 ];
 const parisChallenges=[
  {question:'Look at the tower legs. What shape spans the gap above them?',answers:['A curved arch','A red gate','A round glass dome'],correct:0,hint:'Follow the curved beam between the spreading legs.'},
  {question:'Look at the pale side path on the lawn. How does it meet the path ahead?',answers:['It never meets it','At a right angle','As a circle'],correct:1,hint:'Look where the side strip joins the straight path ahead.'},
  {question:'Look at the dome stand-in above the stone block. What finishes its top?',answers:['A pair of sails','A flat roof','A pointed cap and thin spire'],correct:2,hint:'Follow the tapered cap upward to its slender tip.'}
 ];
 let stops=pragueStops,challenges=pragueChallenges,trailCity='prague';
 function chooseTrail(){
  const city=getCity();if(city==='prague'){stops=pragueStops;challenges=pragueChallenges;return true;}
  if(city==='paris'){
   const ps=getWorld()?.places||[],lawn=ps.find(p=>p.name?.includes('Champ de Mars')),dome=ps.find(p=>p.name?.includes('Les Invalides'));if(!lawn||!dome)return false;
   stops=[
    {x:0,z:-13,r:2,title:'A curve in the sketch',clue:'Walk north from the central road toward the tower. At the ring south of it, look north between its legs.',story:'In this fictional tale, a gardener opens a blank sketchbook beneath a curved tower arch. The first line bends like a branch.'},
    {x:lawn.x,z:lawn.z+7,r:2,title:'Two paths on a page',clue:'Follow the game streets toward the small lawn. At its southern ring, look north at the pale paths across the green. Use View to see their junction.',story:'A side path meets a straight line at a right angle on the next page. The imaginary gardener leaves the spaces green: a garden needs room between its paths.'},
    {x:dome.x-12,z:dome.z-6,r:2,title:'The last mark',clue:'Continue through the game streets to the dome stand-in. From the ring west of it, look east and up at its pointed cap. Use View if needed.',story:'The last mark is a slender tip above a tapering roof. In this fictional sketchbook, the gardener draws a seed beneath it, then closes the page.'}
   ];challenges=parisChallenges;return true;
  }
  if(city==='tokyo'){
   const ps=getWorld()?.places||[],hall=ps.find(p=>p.name?.includes('Zojoji')),shrine=ps.find(p=>p.name?.includes('Atago Shrine'));if(!hall||!shrine)return false;
   stops=[
    {x:0,z:-10,r:2,title:'The lantern-maker\'s frame',clue:'Walk north from the central road to the orange-and-white tower. Look through its open frame from the ring.',story:'In this fictional tale, a lantern-maker sketches a frame that lets the sky show through. The first fold of the paper remembers the empty spaces.'},
    {x:hall.x+17,z:hall.z+16,r:2,title:'Red lines of shelter',clue:'Follow the game streets east to the temple hall. Find the ring southeast of its dark roof and red posts, and look northwest. Use View for a clear look.',story:'The second fold becomes a row of red lines beneath a dark roof. In the imaginary workshop, the lantern-maker gives the paper ribs to hold its shape.'},
    {x:shrine.x,z:shrine.z+9,r:2,title:'A gate for the light',clue:'Walk north through the game streets to the small shrine. At the ring south of it, look north at the red gate.',story:'The lantern-maker sets the finished paper light beside a red gate. In this fictional story, you carry no treasure away, only the shapes you noticed.'}
   ];challenges=tokyoChallenges;return true;
  }
  if(city!=='sydney')return false;
  const places=getWorld()?.places||[],bridge=places.find(p=>p.name?.includes('Sydney Harbour Bridge')),tower=places.find(p=>p.name?.includes('Sydney Tower'));
  if(!bridge||!tower)return false;
  stops=[
   {x:0,z:-14,r:2,title:'A letter in the sails',clue:'From the central road, walk north toward the pale roof shells. The gold ring is outside the podium.',story:'In this fictional tale, a stagehand leaves a paper boat beside the pale sails. Its first line asks you to notice a shape before following a name.'},
   {x:bridge.x+10,z:bridge.z-20,r:2,title:'Under the arch',clue:'Follow the roads west and north toward the bridge arch. Stay in the game streets; the gold ring is northeast of the arch. Look southwest from there; use View for a clear look.',story:'The paper boat unfolds beneath the arch: a crossing can carry a story even when nobody remembers who wrote it.'},
   {x:tower.x,z:tower.z+10,r:2,title:'The round lookout',clue:'Return south through the game streets toward the slender tower and its wider round top. The ring waits south of its base. Use View and drag upward to see the top.',story:'At the round lookout, the stagehand signs the last line: the city was never the prize. Looking closely was the whole journey.'}
  ];challenges=sydneyChallenges;return true;
 }
 let active=false,index=0,seen=[],finished=false,inspecting=false,feedback='';
 let compact=false,marker=null,markerWorld=null;
 //238 DOM updates only when visible distance/proximity changes. Explicit actions still render immediately.
 let renderedDistance,renderedNear,renderedWorld;
 const directDistance=()=>{const p=getPlayer(),s=stops[index];return Math.round(Math.hypot(s.x-p.x,s.z-p.z)*(trailCity==='prague'?9.5:17));};
 function clearMarker(){if(marker){marker.removeFromParent();marker.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});marker=null;}markerWorld=null;}
 function updateMarker(){
  const w=getWorld();if(!active||finished||getCity()!==trailCity||!w||!w.group){clearMarker();return;}
  if(markerWorld!==w){clearMarker();markerWorld=w;marker=new THREE.Group();marker.name='fictional-discovery-marker';
   const ring=new THREE.Mesh(new THREE.TorusGeometry(.48,.045,6,28),new THREE.MeshStandardMaterial({color:'#f0d78a',emissive:'#d8aa44',emissiveIntensity:.2}));ring.rotation.x=-Math.PI/2;ring.position.y=.07;marker.add(ring);w.group.add(marker);}
  const p=stops[index];marker.position.set(p.x,w.groundY(p.x,p.z),p.z);
 }

 const hud=document.createElement('section');hud.id='discovery-hud';hud.hidden=true;hud.setAttribute('aria-label','Local discovery walk');
 hud.innerHTML='<button type="button" id="discovery-expand" hidden>Show discovery</button><button type="button" id="discovery-minimize">Hide for view</button><div class="discovery-detail"><small>FICTIONAL DISCOVERY · SESSION ONLY</small><strong id="discovery-title"></strong><p id="discovery-clue"></p><p id="discovery-status" aria-live="polite"></p></div><button type="button" id="discovery-inspect">Inspect nearby spot</button><div id="discovery-question" hidden><button type="button" id="discovery-look">Look around first</button><p id="discovery-prompt"></p><div id="discovery-answers"></div><p id="discovery-feedback" aria-live="polite"></p></div><button type="button" id="discovery-map">Trail map</button><button type="button" id="discovery-read">Read finds</button><button type="button" id="discovery-restart">Start over</button><button type="button" id="discovery-stop" aria-label="Pause discovery walk">×</button>';
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
 function render(){updateMarker();hud.classList.toggle('is-compact',compact);hud.querySelector('#discovery-expand').hidden=!compact;hud.querySelector('#discovery-expand').textContent=!finished&&near()?'Inspect this spot':finished?'Show discovery':'Show discovery · '+seen.length+'/3';const s=stops[index];inspect.hidden=finished||inspecting;inspect.disabled=!near();inspect.textContent=near()?'Inspect this spot':'Walk closer to inspect';question.hidden=!inspecting;hud.querySelector('#discovery-feedback').textContent=feedback;hud.querySelector('#discovery-title').textContent=finished?'Walk complete':s.title;hud.querySelector('#discovery-clue').textContent=finished?'All three story fragments found. No points or stamps awarded.':s.clue;hud.querySelector('#discovery-status').textContent=finished?'3 / 3 found':seen.length+' / 3 found · '+Math.round(Math.hypot(s.x-getPlayer().x,s.z-getPlayer().z)*(trailCity==='prague'?9.5:17))+' m direct distance · not a route. Gold ring marks the spot.';renderedDistance=directDistance();renderedNear=near();renderedWorld=getWorld();}
 function start(){const city=getCity();if(!chooseTrail())return false;if(city!==trailCity){index=0;seen=[];finished=false;}trailCity=city;active=true;inspecting=false;feedback='';compact=false;hud.hidden=false;render();return true;}
 hud.querySelector('#discovery-restart').onclick=()=>{index=0;seen=[];finished=false;start();};
 function tick(){if(!active)return;if(getCity()!==trailCity){active=false;hud.hidden=true;clearMarker();return;}if(getWorld()!==renderedWorld||directDistance()!==renderedDistance||near()!==renderedNear)render();}
 return {start,tick,get available(){return getCity()==='paris'?!!getWorld()?.places?.some(p=>p.name?.includes('Champ de Mars'))&&!!getWorld()?.places?.some(p=>p.name?.includes('Les Invalides')):getCity()==='tokyo'?!!getWorld()?.places?.some(p=>p.name?.includes('Zojoji'))&&!!getWorld()?.places?.some(p=>p.name?.includes('Atago Shrine')):getCity()==='prague'||(getCity()==='sydney'&&!!getWorld()?.places?.some(p=>p.name?.includes('Sydney Tower'))&&!!getWorld()?.places?.some(p=>p.name?.includes('Sydney Harbour Bridge')));},get city(){return trailCity;},get ending(){return trailCity==='paris'?'A curve, a right angle, a slender tip. In this fictional tale, the gardener turns three noticed shapes into a small garden on paper. The sketch is finished; the world outside its pages is still waiting.':trailCity==='tokyo'?'An open frame. A row of red lines. Two gate posts. In this fictional tale, the lantern-maker folds those remembered shapes into a paper light. Your walk is its final page.':trailCity==='sydney'?'Curving sails. A steel arch. A wider round turret. In this fictional tale, the stagehand leaves you a paper boat: a reminder to notice what each place makes you look up at.':'A pointed roof. Water on both sides. Two unequal towers. In this fictional tale, those small details are the key: the keeper was never guarding treasure, but the habit of paying attention. The brass token is yours to imagine.';},get mapStops(){return active?stops.map((s,i)=>({x:s.x,z:s.z,name:s.title,r:s.r,metersPerUnit:trailCity==='prague'?9.5:17,number:i+1,found:i<seen.length,current:!finished&&i===index})):[];},get state(){return{active,index,seen:[...seen],finished,inspecting,marker:!!marker};}};
}
