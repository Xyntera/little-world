// Clip road triangles onto the terrain's existing planar grid. Source x/z area is unchanged.
const EPS=1e-9;
const side=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
function half(poly,a,b){const out=[];if(!poly.length)return out;let p=poly.at(-1),s=side(a,b,p),yes=s>=-EPS;
 for(const q of poly){const t=side(a,b,q),next=t>=-EPS;if(yes!==next){const k=s/(s-t);out.push([p[0]+(q[0]-p[0])*k,p[1]+(q[1]-p[1])*k]);}if(next)out.push(q);p=q;s=t;yes=next;}return out;}
export function terrainRibbon(pos,idx,Y){
 const step=1.625,origin=-118,out=[];
 function emit(poly,height){for(let j=1;j+1<poly.length;j++){const t=[poly[0],poly[j],poly[j+1]],a=side(...t);if(Math.abs(a)<EPS)continue;if(a>0)[t[1],t[2]]=[t[2],t[1]];for(const [x,z] of t)out.push(x,height(x,z),z);}}
 for(let i=0;i<idx.length;i+=3){const p=idx.slice(i,i+3).map(j=>[pos[j*3],pos[j*3+2]]),xs=p.map(q=>q[0]),zs=p.map(q=>q[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
  if(maxX<=-52||minX>=44||maxZ<=-60||minZ>=8||(minX>=-38&&maxX<=30&&minZ>=-46&&maxZ<=-6)){emit(p,Y);continue;}
  for(let ix=Math.floor((minX-origin)/step);ix<=Math.floor((maxX-origin)/step);ix++)for(let iz=Math.floor((minZ-origin)/step);iz<=Math.floor((maxZ-origin)/step);iz++){
   const x=origin+ix*step,z=origin+iz*step,a=[x,z],b=[x+step,z],c=[x+step,z+step],d=[x,z+step];
   for(const tri of [[a,b,d],[b,c,d]]){let clipped=p;for(let k=0;k<3&&clipped.length;k++)clipped=half(clipped,tri[k],tri[(k+1)%3]);if(clipped.length<3)continue;
    const [v0,v1,v2]=tri,y0=Y(...v0),y1=Y(...v1),y2=Y(...v2),det=side(v0,v1,v2);
    emit(clipped,(qx,qz)=>{const v=[qx,qz],u=side(v0,v,v2)/det,w=side(v0,v1,v)/det;return y0+u*(y1-y0)+w*(y2-y0);});
   }
  }
 }return out;
}
