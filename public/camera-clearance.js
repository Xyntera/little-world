// Conservative ground-footprint clearance for an optional camera offset.
// Heightless colliders may reject a safe overhead view; they never grant clearance through a footprint.
export function cameraLineClear(a,b,colliders,pad=.25) {
 const dx=b.x-a.x,dz=b.z-a.z,ll=dx*dx+dz*dz;
 for(const c of colliders){
  if(c.off||c.wallEast)continue;
  if(c.hw!==undefined){
   let lo=0,hi=1;
   for(const [origin,delta,min,max] of [[a.x,dx,c.x-c.hw-pad,c.x+c.hw+pad],[a.z,dz,c.z-c.hd-pad,c.z+c.hd+pad]]){
    if(Math.abs(delta)<1e-10){if(origin<min||origin>max){lo=2;break;}}
    else{let t0=(min-origin)/delta,t1=(max-origin)/delta;if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);}
   }
   if(lo<=hi)return false;
  }else if(Number.isFinite(c.r)){
   const t=ll?Math.max(0,Math.min(1,((c.x-a.x)*dx+(c.z-a.z)*dz)/ll)):0;
   if((a.x+dx*t-c.x)**2+(a.z+dz*t-c.z)**2<=(c.r+pad)**2)return false;
  }
 }
 return true;
}
