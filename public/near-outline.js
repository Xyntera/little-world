// Read-only early-exit proximity check. Same closed segment geometry, no temporary nearest-point objects.
export function nearOutline(x,z,rings,radius){
 const rr=radius*radius;
 for(const ring of rings)for(let i=0;i+1<ring.length;i++){
  const a=ring[i],b=ring[i+1],dx=b[0]-a[0],dz=b[1]-a[1],ll=dx*dx+dz*dz||1;
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/ll));
  const qx=x-a[0]-dx*t,qz=z-a[1]-dz*t;
  if(qx*qx+qz*qz<rr)return true;
 }
 return false;
}
