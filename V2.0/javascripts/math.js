SMath={};


Number.prototype.clamp=function(min,max){
	return Math.min(Math.max(this,min),max);
};

/*
	Check if line segment p1~p2 intersect with q1~q2
	If true, return the intersection
	{x:xCoord, y:yCoord, t:position of the int.point,
		dir:+1 for q1~q2 crosses from the right, -1 elsewise}
	Line segment includes p1,q1, excludes p2,q2
 */

SMath.lineIntersection=function(p1,p2,q1,q2){
	// Cross Rect
	/*if(Math.min(p1.x,p2.x)>Math.max(q1.x,q2.x)
	|| Math.min(q1.x,q2.x)>Math.max(p1.x,p2.x)
	|| Math.min(p1.y,p2.y)>Math.max(q1.y,q2.y)
	|| Math.min(q1.y,q2.y)>Math.max(p1.y,p2.y)){
		return null;
	}*/

	// Intersection Point
	let g1=[p2[0]-p1[0],p2[1]-p1[1]];
	let g2=[q2[0]-q1[0],q2[1]-q1[1]];
	let g0=[q1[0]-p1[0],q1[1]-p1[1]];
	let t1=SMath.cross(g2,g0);
	let t2=SMath.cross(g2,g1);
	let tn=SMath.cross(g1,g0);
	//let d=SMath.dot(g2,g1);
	let tp=t1/t2; // t is the position of pS on p1~p2
	let tq=tn/t2;
	let pS=[p1[0]+tp*g1[0],p1[1]+tp*g1[1],tp,tq];
	return pS;
}

SMath.cross=(v1,v2)=>v1[0]*v2[1]-v1[1]*v2[0];
SMath.dot=(v1,v2)=>v1[0]*v2[0]+v1[1]*v2[1];

// ======================= Other tools =======================
// Distance function
function dis2(x0,y0,x1,y1){
	let dx=x1-x0;
	let dy=y1-y0;
	return dx*dx+dy*dy;
}
function dis(p1,p2){
	let dx=p1[0]-p2[0];
	let dy=p1[1]-p2[1];
	return Math.sqrt(dx*dx+dy*dy);
}
/**
 * Line l does through (x1,y1) & (x2,y2)
 * Circle c centers at (x0,y0) with radius r
 * return the intersection part length of l & c
 */
function getLineCircleIntersectionLength(x1,y1,x2,y2,x0,y0,r){
	let dx=x2-x1,dy=y2-y1;
	let dis=Math.sqrt(dx*dx+dy*dy);
	let tx=x1-x0,ty=y1-y0;
	let a=dx*dx+dy*dy;
	if(a<=1E-4)return 0;
	let b=2*(dx*tx+dy*ty);
	let c=tx*tx+ty*ty-r*r;
	let p=b/(2*a);
	let q=c/a;

	let d=p*p-q;
	if(d<=0)return 0;

	let sd=Math.sqrt(d);
	let t1=-p-sd;
	let t2=-p+sd;
	t1=Math.max(Math.min(t1,1),0);
	t2=Math.max(Math.min(t2,1),0);
	return dis*(t2-t1);
}

/**
 * Line l does through (x1,y1) & (x2,y2)
 * return the distance from l to (x0,y0)
 */
function getPointToLineDis(x1,y1,x2,y2,x0,y0){
	let dx=x2-x1,dy=y2-y1;
	let dis2_=dx*dx+dy*dy;
	if(dis2_<1E-6){
		return dis2(x0,y0,x1,y1);
	}
	return Math.abs(dx*y0-dy*x0+x1*y2-x2*y1)/Math.sqrt(dis2_);
}

// ========================= color blends ===========================
SMath.blendNormal=function(p1,p2){ // [r,g,b,a], p2 over p1
	const op1=p1[3],op2=p2[3];
	const op=op1+op2-op1*op2;
	if(op<1E-10){ // fully transparent
		return p2;
	}
	const k=op2/op;
	return [
		k*(p2[0]-p1[0])+p1[0],
		k*(p2[1]-p1[1])+p1[1],
		k*(p2[2]-p1[2])+p1[2],
		op
	];
}