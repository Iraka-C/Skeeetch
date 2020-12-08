/**
 * 3D transform maths
 */

DMath={};

DMath.stretch=function(n3,l){
	return [n3[0]*l,n3[1]*l,n3[2]*l];
};

// normalize n3=[x,y,z] to length l
DMath.normalize=function(n3,l){
	const ln=Math.hypot(...p3);
	return [n3[0]/ln*l,n3[1]/ln*l,n3[2]/ln*l];
};