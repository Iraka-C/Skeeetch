/**
 * The GUIDELINE manipulates the guide lines on the canvas window
 */
GUIDELINE={
	handlerPoint: [[1,0,0],[0,1,0],[0,0,1]], // the coordinate of three handler directions, in 3D space coordinate
	f: 1, // focal length relative to canvas paper diagonal length.
	// suppose the diagonal length is 43.2mm, f=1.1574 gives 50mm (135 format) FOV
	pan: [0,0] // panning from the paper center, in paper coordinate (pixel unit, vY,X>)
};

/**
 * Suppose there is a ball of radius r, centered [0,0,f] in the 3D space,
 * The transformation matrix from 3D space to paper coordinate is:
 * |f  0 px| |1 0 0 0|
 * |0 -f py|.|0 1 0 0|
 * |0  0 1 | |0 0 1 f|
 * (-f for y focal length because of paper coordinate handness)
 * 
 * To get a projection of the ball with radius R, the radius r should obey:
 *    r = f * R / sqrt(f^2 + R^2)
 */
GUIDELINE.r=NaN; // not available at first

GUIDELINE.init=function(){
	/**
	 * Init the DOM ball & handler elements
	 */
	const handlers={};
	function initHandlerElements(){
		handlers.$x;
	}
}

// ============== Tool functions ================
/**
 * Coordinate transformations
 */

/**
 * 3D space to paper coordinate
 * p is [x,y,z]
 * return [x_,y_] in paper coordinate
 * @TODO: if f = +Inf?
 */
GUIDELINE.spaceToPaper=function(p){
	const f=GUIDELINE.f;

	const panZ=p[2]+f;
	const newX=f*p[0]+GUIDELINE.pan[0]*panZ;
	const newY=f*p[1]+GUIDELINE.pan[1]*panZ;
	return [newX/panZ,newY/panZ];
}