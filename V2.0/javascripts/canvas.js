/**
 * Canvas manager
 */

CANVAS={};
CANVAS.settings={
	enabled: true, // is canvas drawable?
	method: 2, // webgl:1, cpu16bit:2, ctx2d:3
	strokeRectification: false,
	smoothness: 3,
	_speed: 0 // a function of smoothness
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
CANVAS.setTargetCanvas=function(targetCV,imgData){ // imgData is the data in targetCV
	CANVAS.nowCanvas=targetCV;
	RENDER.init({ // init after setActiveLayer || change renderer
		canvas: targetCV,
		method: CANVAS.settings.method,
		onRefresh: CANVAS.onRefresh,
		imgData:imgData
	});
	CANVAS.updateSpeed(); // at init
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

CANVAS.updateSpeed=function(){
	if(CANVAS.settings.smoothness>=0){ // slow down
		CANVAS.settings._speed=Math.pow(0.75,CANVAS.settings.smoothness);
	}
	else{ // tremble
		let p1=CANVAS.settings.smoothness+5;
		CANVAS.settings._speed=2-p1*p1/25;
	}
}

/**
 * Update cursor trace, point=[x,y,pressure] relative to div #canvas-window
 */
CANVAS.updateCursor=function(point){
	const pT=CANVAS.points;
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
	const pC=ENV.toPaperXY(point[0],point[1]);

	const p=CANVAS.settings._speed;
	const q=1-p;
	if(!isNaN(pT.p1[0])){ // Smooth the trail
		pT.p0=[
			pC[0]*p+pT.p1[0]*q,
			pC[1]*p+pT.p1[1]*q,
			point[2]*p+pT.p1[2]*q
		];
	}
	else{
		pT.p0=[pC[0],pC[1],point[2]];
	}
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
	if(CANVAS.settings.strokeRectification&&CANVAS.pointCnt==1){ // Only one point down
		return;
	}
	
	// Consider changing the way to calculate division
	let p0=pT.p0;
	let p1=pT.p1;
	let p2=pT.p2;

	CANVAS.isChanged=true; // canvas changed
	if(CANVAS.settings.strokeRectification&&CANVAS.pointCnt==2){
		// first stroke considering a point updated before down
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
	CANVAS.points.p0=[NaN,NaN,0];
	/**
	 * @TODO: more precise isChanged detection
	 */
	if(CANVAS.isChanged){ // the place that calls LAYER
		CANVAS.isChanged=false;
		//console.log("end");
		requestAnimationFrame(()=>{
			LAYERS.active.updateLatestImageData(RENDER.getImageData());
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

CANVAS.clearAll=function(){
	if(!RENDER.renderer||!CANVAS.settings.enabled){
		// No canvas or locked, can't draw on it
		return;
	}
	const cv=CANVAS.nowCanvas;
	cv.width=cv.width;
	RENDER.init({ // init after setActiveLayer || change renderer
		canvas: cv,
		method: CANVAS.settings.method,
		onRefresh: CANVAS.onRefresh
	});
	requestAnimationFrame(()=>{
		LAYERS.active.updateLatestImageData(RENDER.getImageData());
		LAYERS.active.updateThumb();
	});
}

// ================ Other tools ==================
// Mixing pixels should be pre-order or **mid-order**? Not post-order certainly.
CANVAS._takePixel=function($div,x,y,pix){
	if($div.is("canvas")){ // a group
		const data=RENDER.getImageData($div[0],x,y,1,1).data; // 2d way, not gl
		const layer=LAYERS.layerHash[$div.attr("data-layer-id")]; // get layer opacity
		const opa=layer.visible?layer.opacity/100:0;
		return [data[0],data[1],data[2],data[3]*opa/255]; // Uint8[4] => float
	}
	const cdiv=$div.children();
	let tPix=[0,0,0,0];
	cdiv.each(function(id){
		// blend
		const data=CANVAS._takePixel($(this),x,y);
		tPix=SMath.blendNormal(tPix,data);
	});
	return tPix;
}

CANVAS.pickColor=function(x,y){ // ALL visible layers, (x,y) is under the window coordinate
	const p=ENV.toPaperXY(x,y);
	let pix=CANVAS._takePixel($("#canvas-layers-container"),p[0],p[1]);
	
	return SMath.blendNormal([PALETTE.rgb[0],PALETTE.rgb[1],PALETTE.rgb[2],1],pix);
}