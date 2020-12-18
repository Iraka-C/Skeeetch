/**
 * The GUIDELINE manipulates the guide lines on the canvas window
 */
"use strict";
const GUIDELINE={
	handlerPoint: [[1,0,0],[0,1,0],[0,0,1]], // the coordinate of three handler directions, in 3D space coordinate
	fRel: 1, // focal length relative to canvas paper diagonal length.
	fPix: NaN, // focal length in pixel
	// suppose the diagonal length is 43.2mm, fRel=1.1574 gives 50mm (135 format) FOV
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
 *      = R / hypot(1, R/f) <== use 1/f to express size
 */
GUIDELINE.r=NaN; // not available at first

GUIDELINE.init=function(){
	/**
	 * Init the DOM ball & handler elements
	 */
	const handlers={};
	function initHandlerElements(){
		handlers.$x=$("#axis-handle-x");
		handlers.$y=$("#axis-handle-y");
		handlers.$z=$("#axis-handle-z");
		handlers.$circle=$("#unit-sphere");
		handlers.$center=$("#unit-sphere-center");
	};

	function renderHandlerElements(){
		// FIXME: Buggy calculation!
		const R=100;
		
		GUIDELINE.r=R/Math.hypot(1,R/GUIDELINE.f);
		const hx=DMath.stretch(GUIDELINE.handlerPoint[0],GUIDELINE.r);
		const hy=DMath.stretch(GUIDELINE.handlerPoint[1],GUIDELINE.r);
		const hz=DMath.stretch(GUIDELINE.handlerPoint[2],GUIDELINE.r);

		const centerP=GUIDELINE.spaceToPaper([0,0,0]);
		const centerW=ENV.toWindowXY(...centerP);

		const hXP=GUIDELINE.spaceToPaper(hx);
		const hYP=GUIDELINE.spaceToPaper(hy);
		const hZP=GUIDELINE.spaceToPaper(hz);

		const hXW=ENV.toWindowXY(...hXP);
		const hYW=ENV.toWindowXY(...hYP);
		const hZW=ENV.toWindowXY(...hZP);

		handlers.$circle.attr({cx:centerW[0],cy:centerW[1]});
		handlers.$center.attr({cx:centerW[0],cy:centerW[1]});
		handlers.$x.attr({
			x1: centerW[0],
			y1: centerW[1],
			x2: hXW[0],
			y2: hXW[1]
		});
		handlers.$y.attr({
			x1: centerW[0],
			y1: centerW[1],
			x2: hYW[0],
			y2: hYW[1]
		});
		handlers.$z.attr({
			x1: centerW[0],
			y1: centerW[1],
			x2: hZW[0],
			y2: hZW[1]
		});
	};
	
	initHandlerElements();
	renderHandlerElements();
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
	const newY=-f*p[1]+GUIDELINE.pan[1]*panZ;
	const xH=newX/panZ
	const yH=newY/panZ;
	return [xH+ENV.paperSize.width/2,yH+ENV.paperSize.height/2];
}