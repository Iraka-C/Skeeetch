/**
 * Canvas manager
 */

CANVAS={};
CANVAS.settings={
	enabled: true, // is canvas drawable?
	method: 2 // webgl:1, cpu16bit:2, ctx2d:3
};
CANVAS.points={ // the points drawn on canvas, under paper coordinate
	p0: [NaN,NaN,NaN], // x,y,pressure(0~1)
	p1: [NaN,NaN,NaN],
	p2: [NaN,NaN,NaN]
};
CANVAS.nowCanvas=null; // now operating canvas
CANVAS.pointCnt=0;
CANVAS.isChanged=false;

// ========================= Functions ===========================
/**
 * Update the target canvas to draw
 * targetCV is a DOM canvas element!
 */
CANVAS.setTargetCanvas=function(targetCV,imgData){ // imgData is the image data in targetCV
	CANVAS.nowCanvas=targetCV;
	RENDER.init({ // init after setActiveLayer || change renderer
		canvas: targetCV,
		method: CANVAS.settings.method,
		onRefresh: CANVAS.onRefresh,
		imgData:imgData
	});
}

/**
 * Set the canvas params before each stroke
 */
CANVAS.setCanvasEnvironment=function(event){ // event="pointerdown"
	if(!RENDER.renderer||!CANVAS.settings.enabled){
		// No canvas or locked, can't draw on it
		return;
	}

	/**
	 * @TODO: for some wacom boards, the first 2/3 events appears not constant
	 */
	CANVAS.pointCnt=0; // count reset
	CANVAS.isChanged=false; // change reset
	RENDER.initBeforeStroke({ // init renderer before stroke
		brush: BrushManager.activeBrush,
		rgb: PALETTE.rgb,
		sensitivity: BrushManager.general.sensitivity
	});
};

/**
 * Update cursor trace, point=[x,y,pressure] relative to div #canvas-window
 */
CANVAS.updateCursor=function(point){
	let pT=CANVAS.points;
	/**
	 * @TODO: Mysterious behavior
	 * pT seems to contain some of the uncorrect values
	 */
	// if(CURSOR.isDown){
	// 	console.log(pT);
	// 	console.log(pT.p0);
	// }

	/**
	 * @TODO: The moving event should also taken into consideration
	 * or the drawing on starts at the third event, which introduces a lag
	 */
	pT.p2=pT.p1;
	pT.p1=pT.p0;

	// Coordinate transform
	let pC=ENV.toPaperXY(point[0],point[1]);
	pT.p0=[pC[0],pC[1],point[2]];
	CANVAS.pointCnt++;
}

/**
 * Stroke a curve (between two pointermoves) according to the settings
 */
CANVAS.stroke=function(){
	if(!RENDER.renderer||!CANVAS.settings.enabled){ // disabled
		return;
	}
	
	let pT=CANVAS.points;
	if(isNaN(pT.p2[0])||isNaN(pT.p1[0])||isNaN(pT.p0[0])){ // There's a not-recorded pointer
		return;
	}
	if(CANVAS.pointCnt==1){ // Only one point down
		return;
	}
	
	// Consider changing the way to calculate division
	let p0=pT.p0;
	let p1=pT.p1;
	let p2=pT.p2;

	CANVAS.isChanged=true; // canvas changed
	if(CANVAS.pointCnt==2){ // first stroke considering a point updated before down
		let d1=dis2(p1[0],p1[1],p2[0],p2[1]);
		let d0=dis2(p1[0],p1[1],p0[0],p0[1]);
		if(d0==0)return; // not moved
		let dk=Math.max(Math.sqrt(d1/d0),1); // at least at p1
		let pM=(p1[2]+p0[2])/2;
		// Interpolation
		let s0=[(p1[0]+p0[0])/2,(p1[1]+p0[1])/2,pM];
		let s1=[p0[0]+(p1[0]-p0[0])*dk,p0[1]+(p1[1]-p0[1])*dk,p1[2]];
		let s2=[p2[0],p2[1],Math.min(Math.max(0,pM+(p1[2]-pM)*dk*2),p1[2])];

		RENDER.strokeBezier(s2,s1,s0);
		return;
	}
	
	let s2=[(p1[0]+p2[0])/2,(p1[1]+p2[1])/2,(p1[2]+p2[2])/2];
	let s1=[p1[0],p1[1],p1[2]];
	let s0=[(p1[0]+p0[0])/2,(p1[1]+p0[1])/2,(p1[2]+p0[2])/2];
	RENDER.strokeBezier(s2,s1,s0); // old->new
};

/**
 * On the end of stroke (Notice: not certainly canvas refreshed!)
 */
CANVAS.strokeEnd=function(){
	/**
	 * @TODO: more precise isChanged detection
	 */
	if(CANVAS.isChanged){ // the place that calls LAYER
		CANVAS.isChanged=false;
		//console.log("end");
		requestAnimationFrame(()=>{
			LAYERS.active.updateLatestImageData();
			LAYERS.active.updateThumb();
		}); // pass in "this"
	}
}

/**
 * On refreshing canvas, after animation frame (Notice: canvas already refreshed!)
 */
CANVAS.onRefresh=function(){
	//console.log("refreshed");
}