// Exact even-odd polygon test with precomputed z buckets; no simplified shore geometry.
export function polygonQuery(poly,cell=4){
 if(!poly.length)return()=>false;
 let xmin=Infinity,xmax=-Infinity,zmin=Infinity,zmax=-Infinity;const bins=new Map();
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const [xi,zi]=poly[i],[xj,zj]=poly[j];xmin=Math.min(xmin,xi);xmax=Math.max(xmax,xi);zmin=Math.min(zmin,zi);zmax=Math.max(zmax,zi);
  if(zi===zj)continue;
  const edge=[xi,zi,xj,zj];for(let b=Math.floor(Math.min(zi,zj)/cell);b<=Math.floor(Math.max(zi,zj)/cell);b++){if(!bins.has(b))bins.set(b,[]);bins.get(b).push(edge);}
 }
 return(x,z)=>{if(x<xmin||x>xmax||z<zmin||z>zmax)return false;let inside=false;for(const [xi,zi,xj,zj]of bins.get(Math.floor(z/cell))||[]){if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)inside=!inside;}return inside;};
}
