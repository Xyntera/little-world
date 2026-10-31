export function ribbonStrip(dp,wU,Y){
  // Bevel acute bends instead of extending sharp miter spikes.
  const hw=wU/2,pos=[],idx=[];let previous=null;
  function pair(left,right){const at=pos.length/3;for(const [x,z] of [left,right])pos.push(x,Y(x,z),z);if(previous!==null)idx.push(previous,previous+1,at+1,previous,at+1,at);previous=at;}
  for(let i=0;i<dp.length;i++){
    const [x,z]=dp[i],a=dp[Math.max(0,i-1)],b=dp[Math.min(dp.length-1,i+1)];
    let ax=x-a[0],az=z-a[1],bx=b[0]-x,bz=b[1]-z;
    const al=Math.hypot(ax,az),bl=Math.hypot(bx,bz);if(!al){ax=bx;az=bz;}if(!bl){bx=ax;bz=az;}
    const la=Math.hypot(ax,az)||1,lb=Math.hypot(bx,bz)||1,n1=[-az/la,ax/la],n2=[-bz/lb,bx/lb];
    const mx=n1[0]+n2[0],mz=n1[1]+n2[1],ml=Math.hypot(mx,mz),nx=ml>1e-6?mx/ml:n1[0],nz=ml>1e-6?mz/ml:n1[1],dot=nx*n1[0]+nz*n1[1],scale=1/Math.max(.001,dot);
    const point=(n,side,k=1)=>[x+side*n[0]*hw*k,z+side*n[1]*hw*k];
    if(scale<=1.25){pair(point([nx,nz],-1,scale),point([nx,nz],1,scale));}
    else {pair(point(n1,-1),point(n1,1));pair(point(n2,-1),point(n2,1));}
  }
  // Every triangle faces upward, including tight bevel fans.
  for(let i=0;i<idx.length;i+=3){const a=idx[i]*3,b=idx[i+1]*3,c=idx[i+2]*3;
    const cross=(pos[b]-pos[a])*(pos[c+2]-pos[a+2])-(pos[b+2]-pos[a+2])*(pos[c]-pos[a]);
    if(cross>0)[idx[i+1],idx[i+2]]=[idx[i+2],idx[i+1]];
  }
  return {pos,idx};
}
