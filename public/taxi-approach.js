// Validate the complete incoming taxi segment, including both endpoints.
export function taxiApproachClear(x0,z0,x1,z1,road,blocked,spacing=.5){
 const n=Math.max(1,Math.ceil(Math.hypot(x1-x0,z1-z0)/spacing));
 for(let i=0;i<=n;i++){const t=i/n,x=x0+(x1-x0)*t,z=z0+(z1-z0)*t;if(!road(x,z,-1.4)||blocked(x,z,2.4))return false;}
 return true;
}
export function chooseTaxiApproach(bay,horiz,road,blocked){
 for(const s of [1,-1]){const x=horiz?bay.x+s*24:bay.x,z=horiz?bay.z:bay.z+s*24;
  if(taxiApproachClear(x,z,bay.x,bay.z,road,blocked))return {x,z,heading:Math.atan2(bay.x-x,bay.z-z),parked:false};}
 return {x:bay.x,z:bay.z,heading:horiz?Math.PI/2:0,parked:true};
}
