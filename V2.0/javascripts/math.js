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