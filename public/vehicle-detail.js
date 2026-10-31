import * as THREE from '/vendor/three.module.js';
import { mergeStatic } from './merge.js';
// Shared low-poly exterior detail for every road car. No physics/centers change. Hub caps extend tire faces by 0.0003u.
export function detailVehicle(root,kind){
 const spec={car:[.8,1.55,.76,1.14,.6,-1,.36,1],taxi:[.875,1.9,.79,1.23,.75,-1.15,.38,1.2],roadster:[.925,2.05,.7,.98,.4,-.5,.4,1.3],supercar:[.975,2.15,.75,.83,.6,-.95,.42,1.4],suv:[.95,1.95,.92,1.48,.709,-1.709,.46,1.17],van:[.95,2.1,.92,1.63,1.45,-2.05,.46,1.26],pickup:[.95,2.2,.92,1.46,1.45,-.05,.48,1.4]}[kind];
 if(!spec)return;const [hw,hl,cw,wy,front,rear,wr,wz]=spec,d=new THREE.Group();
 const mats={};const mat=c=>mats[c]||(mats[c]=new THREE.MeshStandardMaterial({color:c,roughness:c==='#263e4d'?.28:.65,metalness:0}));
 function box(w,h,l,c,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,l),mat(c));m.position.set(x,y,z);d.add(m);return m;}
 function pane(w,h,c,x,y,z,ry=0){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat(c));m.position.set(x,y,z);m.rotation.y=ry;d.add(m);return m;}
 const trim='#252b31',glass='#263e4d',chrome='#adb8be',rubber='#14191c';
 // Window glass sits outside the colored cabin, split by real visible body pillars.
 if(!['roadster','supercar'].includes(kind))for(const s of [-1,1]){
  const length=front-rear,split=kind==='pickup'?1:2;
  for(let k=0;k<split;k++){const len=length/split-.10,z=rear+(k+.5)*length/split;
   pane(len,.32,glass,s*(cw+.008),wy,z,s*Math.PI/2);
   pane(.055,.32,chrome,s*(cw+.011),wy,z-len*.34,s*Math.PI/2);
  }
  box(.025,.07,front-rear+.1,trim,s*(hw-.008),wy-.25,(front+rear)/2);
 }
 if(kind!=='roadster'){
  pane(cw*1.75,.3,glass,0,wy,front+.012);
  pane(cw*1.7,.28,glass,0,wy,rear-.012,Math.PI);
 }
 // Bumpers, grille slats and rear lamps are legible at normal camera distances.
 box(hw*1.75,.11,.025,trim,0,.4,hl-.013);box(hw*1.75,.11,.025,trim,0,.4,-hl+.013);
 for(const y of [.48,.55,.62])pane(.65,.027,chrome,0,y,hl+.002);
 for(const s of [-1,1])pane(.29,.14,'#bd332e',s*hw*.65,.72,-hl-.0002,Math.PI);
 pane(.38,.14,'#e4dfcb',0,.52,-hl-.0002,Math.PI); // blank plate, no brand/identifier
 // Door cuts and handles. Stay under glass and within existing body extent.
 for(const s of [-1,1]){
  const zs=kind==='pickup'?[.02]:kind==='roadster'||kind==='supercar'?[-.35]:[-.85,.35];
  for(const z of zs){pane(.025,.38,trim,s*(hw+.002),.69,z,s*Math.PI/2);box(.025,.045,.20,chrome,s*(hw+.004),.87,z-.12);}
 }
 // Silver wheel hub faces with dark center caps, same wheel radius/centers; hub planes sit 0.0003u beyond tire face.
 const wheels=[];root.traverse(o=>{if(o.isMesh&&o.geometry?.type==='CylinderGeometry'&&Math.abs(o.rotation.z-Math.PI/2)<.01)wheels.push(o);});
 for(const wheel of wheels){const {x,y,z}=wheel.position,s=Math.sign(x)||1,r=wheel.geometry.parameters.radiusTop*.58;
  const hub=new THREE.Mesh(new THREE.CircleGeometry(r,10),mat(chrome));hub.rotation.y=s*Math.PI/2;hub.position.set(x+s*.1402,y,z);d.add(hub);
  const cap=new THREE.Mesh(new THREE.CircleGeometry(r*.3,8),mat(rubber));cap.rotation.y=s*Math.PI/2;cap.position.set(x+s*.1403,y,z);d.add(cap);
 }
 if(kind==='taxi')for(const s of [-1,1])for(let i=0;i<8;i++)pane(.14,.12,i%2?chrome:trim,s*(hw+.008),.84,-.7+i*.2,s*Math.PI/2);
 if(kind==='pickup')for(let i=-3;i<=3;i++)box(.035,.02,1.6,trim,i*.2,1.36,-1.25);
 d.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;}});root.add(d);
 const owned=new Set();root.traverse(o=>{if(o.material)owned.add(o.material);});
 const clearMeshes=[];root.traverse(o=>{if(o.isMesh&&o.material.transparent)clearMeshes.push(o);});mergeStatic(root,clearMeshes,undefined,true);
 const retained=new Set();root.traverse(o=>{if(o.material)retained.add(o.material);});for(const m of owned)if(!retained.has(m))m.dispose();
}
