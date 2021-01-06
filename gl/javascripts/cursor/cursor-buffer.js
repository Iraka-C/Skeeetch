"use strict";

/**
 * create a buffer for incoming cursor records
 */
CURSOR.settings={
	smoothness: 3,
	_speed: 0, // a function of smoothness
	sensitivity:1.0, // 0.0 ~ 2.0: 1=normal 0: dull, 2: sharp
	//_sPower:1.0, // 5^(sensitivity-1)
};

CURSOR.settings.setSmoothness=function(sm){
	CURSOR.settings.smoothness=sm;
	if(sm>=0) { // slow down
		CURSOR.settings._speed=Math.pow(0.75,sm);
	}
	else { // tremble
		const p1=sm+5;
		CURSOR.settings._speed=2-p1*p1/25;
	}

}
CURSOR.settings.setSensitivity=function(s){
	CURSOR.settings.sensitivity=s;
}

// ===================== buffer operations ======================


CURSOR.BUFFER={
	points: [[NaN,NaN,NaN],[NaN,NaN,NaN]], // valid points
	timer: null // timer for extra event interpolation
};

/**
 * Update cursor trace, point=[x,y,pressure] relative to div #canvas-window
 */
CURSOR.BUFFER.updateCursor=function(point,isPointerDown,originalEvent){
	if(CURSOR.BUFFER.timer){
		clearTimeout(CURSOR.BUFFER.timer);
		CURSOR.BUFFER.timer=null;
	}
	
	const pT=CURSOR.BUFFER.points;

	// Coordinate transform
	const pC=ENV.toPaperXY(point[0],point[1]);

	if(isPointerDown){ // keep tracking a whole sequence
		let newP;
		if(pT.length) { // Smooth the trail
			const p1=pT[pT.length-1]; // last point
			if(isNaN(p1[0])){ // not a valid point
				newP=[pC[0],pC[1],point[2]];
			}
			else{ // interpolate
				const p=CURSOR.settings._speed;
				const q=1-p;
				newP=[
					pC[0]*p+p1[0]*q,
					pC[1]*p+p1[1]*q,
					point[2]*p+p1[2]*q
				];
			}
		}
		else { // no point recorded yet
			newP=[pC[0],pC[1],point[2]];
		}
		pT.push(newP);

		if(dis(newP,pC)>1){ // to interpolate new point more than 1px
			CURSOR.BUFFER.timer=setTimeout(e=>{ // add new event after interval
				CURSOR.BUFFER.timer=null; // already performed
				//CURSOR.BUFFER.updateCursor(point,isPointerDown,originalEvent);
				CURSOR.moveCursor(originalEvent);
			},16); // mouse is normally captured at 60fps
		}
	}
	else{ // keep tracking the first several points
		CURSOR.BUFFER.points=pT.slice(-3); // if [] then => []
		CURSOR.BUFFER.points.push([pC[0],pC[1],point[2]]);
	}

	CANVAS.updateCursor();
}

