/**
 * Canvas manager
 */

CANVAS={};
CANVAS.settings={
	enabled: true, // is canvas drawable?
	isPressureDevice: true, // is the pen using now a pressure device
	is16bit: true, // is the renderer 16-bit deep
	strokeRenderFunction: RENDER16.strokeOverlay // see RENDER (render.js)
};
CANVAS.points={ // the points drawn on canvas, under paper coordinate
	p0: [NaN,NaN,NaN], // x,y,pressure(0~1)
	p1: [NaN,NaN,NaN],
	p2: [NaN,NaN,NaN]
};
CANVAS.nowContext=null; // now operating cv context2D
CANVAS.pointCnt=0;

// ========================= Functions ===========================
/**
 * Update the target canvas to draw
 * targetCV is a DOM canvas element!
 */
CANVAS.setTargetCanvas=function(targetCV){
	if(!targetCV){ // @TODO: condiser reusing the buffer?
		CANVAS.nowContext=null;
		CANVAS.buffer=null; // release buffer
		return;
	}
	CANVAS.nowContext=targetCV.getContext("2d");

	CANVAS.setRender16(CANVAS.settings.is16bit);
}

// init 16bit render
CANVAS.setRender16=function(is16bit){
	CANVAS.settings.is16bit=is16bit;

	if(!is16bit){ // release buffer
		CANVAS.buffer=null; // U16int buffer for calculating the drawings
		CANVAS.settings.strokeRenderFunction=RENDER.strokeOverlay;
		return;
	}
	if(!CANVAS.nowContext){ // no context / active layer
		return;
	}

	let ctx=CANVAS.nowContext;
	let imgData=ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height);
	// Copy the canvas content into buffer
	CANVAS.buffer=new Uint16Array(imgData.data);
	let size=CANVAS.buffer.length;
	for(let i=0;i<size;i++){ // 8bit->16bit
		CANVAS.buffer[i]<<=8;
	}
	CANVAS.settings.strokeRenderFunction=RENDER16.strokeOverlay;
}

/**
 * Set the canvas params before each stroke
 */
CANVAS.setCanvasEnvironment=function(event){ // event="pointerdown"
	if(!CANVAS.nowContext||!CANVAS.settings.enabled){
		// No canvas or locked, can't draw on it
		return;
	}
	CANVAS.settings.isPressureDevice=(event.originalEvent.pointerType=="pen");

	// canvas context settings
	let ctx=CANVAS.nowContext;
	ctx.fillStyle=PALETTE.getColorString();
	
	// ctx.strokeStyle="#000000";
	// ctx.lineWidth=3;
	CANVAS.settings.strokeRenderFunction.init();

	/**
	 * @TODO: for some wacom boards, the first 2/3 events appears not constant
	 */
	CANVAS.pointCnt=0; // count reset
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
	if(BrushManager.activeBrush.isSizePressure&&CANVAS.settings.isPressureDevice){
		pT.p0=[pC[0],pC[1],point[2]];
	}
	else{ // set pressure to 1 when is not a pressure device
		pT.p0=[pC[0],pC[1],1];
	}

	CANVAS.pointCnt++;
	// CANVAS.nowContext.font = '10px serif';
	// if(CURSOR.isDown)
	// 	CANVAS.nowContext.strokeText(""+CANVAS.pointCnt,pC[0]+10,pC[1]);
}

/**
 * Stroke a curve (between two pointermoves) according to the settings
 */
CANVAS.stroke=function(){
	if(!CANVAS.nowContext||!CANVAS.settings.enabled){// disabled
		return;
	}
	
	let pT=CANVAS.points;
	if(isNaN(pT.p2[0])){ // There's a not-recorded pointer
		return;
	}

	
	// Consider changing the way to calculate division
	let p0=pT.p0;
	let p1=pT.p1;
	let p2=pT.p2;

	if(CANVAS.pointCnt==1){ // Only one point down
		return;
	}
	else if(CANVAS.pointCnt==2){ // first stroke considering a point updated before down
		let d1=dis2(p1[0],p1[1],p2[0],p2[1]);
		let d0=dis2(p1[0],p1[1],p0[0],p0[1]);
		if(d0==0)return; // not moved
		let dk=Math.max(Math.sqrt(d1/d0),1); // at least at p1
		let pM=(p1[2]+p0[2])/2;
		// Interpolation
		let s0=[
			(p1[0]+p0[0])/2,(p1[1]+p0[1])/2,
			RENDER.pressureToStrokeRadius(pM)
		];
		let s1=[
			p0[0]+(p1[0]-p0[0])*dk,p0[1]+(p1[1]-p0[1])*dk,
			RENDER.pressureToStrokeRadius(p1[2])
		];
		let s2=[
			p2[0],p2[1],
			RENDER.pressureToStrokeRadius(Math.max(0,pM+(p1[2]-pM)*dk*2))
		];

		CANVAS.settings.strokeRenderFunction(s2,s1,s0);
		return;
	}
	
	let s2=[(p1[0]+p2[0])/2,(p1[1]+p2[1])/2,RENDER.pressureToStrokeRadius((p1[2]+p2[2])/2)];
	let s1=[p1[0],p1[1],RENDER.pressureToStrokeRadius(p1[2])];
	let s0=[(p1[0]+p0[0])/2,(p1[1]+p0[1])/2,RENDER.pressureToStrokeRadius((p1[2]+p0[2])/2)];
	CANVAS.settings.strokeRenderFunction(s2,s1,s0); // old->new
};