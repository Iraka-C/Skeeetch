/**
 * Canvas manager
 * @TODO: check all places using texImage2d, this may cause memory leak!
 */
"use strict";

const CANVAS={};
CANVAS.settings={
	enabled: true, // is canvas drawable?
	method: 1, // webgl:1, cpu16bit:2, ctx2d:3
	smoothness: 3,
	_speed: 0
};
CANVAS.rendererBitDepth=32; // init value
CANVAS.points=[[NaN,NaN,NaN],[NaN,NaN,NaN]]; // the points drawn on canvas, under paper coordinate [x,y,pressure(0~1)]
CANVAS.targetCanvas=null; // display canvas to render to
CANVAS.nowLayer=null; // now operating layer
CANVAS.changedArea={width:0,height:0,left:0,top:0};
CANVAS.drawSuccessful=false; // if you try to stroke on canvas, will it be successful?

CANVAS.lastVRAMFreezeCnt=0;
CANVAS.vramCompressCnt=0; // how many times did VRAM compress during stroking
// ========================= Functions ===========================
CANVAS.init=function() {
	//LOGGING&&console.log("Canvas init "+CANVAS.rendererBitDepth+" bit");
	CANVAS.drawSuccessful=true;
	CANVAS.actualFps=300; // actual rendering fps
	
	if(CANVAS.renderer){
		// release some resources
		CANVAS.renderer.free(); // destroy remaining memories
	}
	CANVAS.targetCanvas=$("#main-canvas")[0];
	CANVAS.renderer=new GLRenderer({
		canvas: CANVAS.targetCanvas,
		onRefresh: CANVAS.onRefresh,
		bitDepth: CANVAS.rendererBitDepth,
		maxVRAMSize: PERFORMANCE.maxMem.gpu,
		// In fact, there are compression strategies for VRAM
		// The actual usage will be less than estimated
		onWebGLContextLost: PERFORMANCE.webglContextLost
	});
	PERFORMANCE.reportLowVRAM.reported=false; // reset low VRAM report
	CANVAS.dirtyArea={width:0,height:0,left:0,top:0};
	CANVAS.changedArea={width:0,height:0,left:0,top:0};
}
/**
 * Update the target canvas to draw
 */
CANVAS.setTargetLayer=function(targetLayer) {
	if(CANVAS.nowLayer){ // Ensure to be a CanvasNode
		const lastD=CANVAS.nowLayer.lastRawImageData; // release its lastRawImageData
		CANVAS.renderer.deleteImageData(lastD);
		CANVAS.nowLayer.lastRawImageData=null;
	}
	CANVAS.nowLayer=targetLayer;
	if(!targetLayer) { // no active target
		CANVAS.settings.enabled=false;
		CANVAS.drawSuccessful=false;
	}
	else {
		CANVAS.settings.enabled=true;
		CANVAS.drawSuccessful=true;
		//CANVAS.updateSpeed(); // at init
		CANVAS.renderer.init({
			// @TODO: setup strokeBuffer
			imageData: targetLayer.rawImageData // render target
		});
		targetLayer.lastRawImageData=CANVAS.renderer.createImageData(); // create last buffer
		CANVAS.updateLastImageData(targetLayer);
	}
	CANVAS.vramCompressCnt=0;
}

// update the lastRawImageData in a node
CANVAS.updateLastImageData=function(node){
	const lastD=node.lastRawImageData;
	const rawD=node.rawImageData;
	// copy contents
	if(lastD.width<rawD.validArea.width||lastD.height<rawD.validArea.height){ // enlarge
		CANVAS.renderer.resizeImageData(lastD,rawD.validArea,false);
	}
	else{ // move
		lastD.left=rawD.validArea.left;
		lastD.top=rawD.validArea.top;
	}
	CANVAS.renderer.clearImageData(lastD);
	CANVAS.renderer.blendImageData(rawD,lastD,{mode:BasicRenderer.SOURCE});
}

/**
 * Set the canvas params before each stroke
 */
CANVAS.setCanvasEnvironment=function() {
	if(!CANVAS.renderer||!CANVAS.settings.enabled) { // No canvas, can't draw on it
		CANVAS.drawSuccessful=false;
		return;
	}

	// get params of this layer in a tree
	CANVAS.targetLayerVisible=CANVAS.nowLayer.isVisible();
	CANVAS.targetLayerLocked=CANVAS.nowLayer.isLocked();
	CANVAS.targetLayerOpacityLocked=CANVAS.nowLayer.isOpacityLocked();

	if(!CANVAS.targetLayerVisible||CANVAS.targetLayerLocked) { // invisible or locked
		return;
	}
	CANVAS.drawSuccessful=true;
	/**
	 * @TODO: for some wacom boards, the first 2/3 events appears not constant
	 */
	CANVAS.points=CANVAS.points.slice(-2); // init point list, only save the last points
	
	CANVAS.isRefreshRequested=false; // refresh screen control
	CANVAS.renderer.initBeforeStroke({ // init renderer before stroke
		brush: BrushManager.activeBrush,
		rgb: PALETTE.colorSelector.getRGB(),
		sensitivity: CURSOR.settings.sensitivity,
		isOpacityLocked: CANVAS.targetLayerOpacityLocked,
		antiAlias: ENV.displaySettings.antiAlias,
		defaultColor: CANVAS.nowLayer.properties.blendMode==BasicRenderer.MASKB?0:1
	});
	// init changed area, put this first as isChanged sign init
	// changed area for history
	//CANVAS.changedArea={width:0,height:0,left:0,top:0};
	//CANVAS.dirtyArea={width:0,height:0,left:0,top:0}; // set by refreshScreen
	CANVAS.lastVRAMFreezeCnt=CANVAS.renderer.getVRAMFreezeCnt();
};


/**
 * Update cursor trace, point=[x,y,pressure] relative to div #canvas-window
 */
CANVAS.updateCursor=function() {
	CANVAS.points=CURSOR.BUFFER.points;
}

/**
 * Stroke a curve (between two pointermoves) according to the settings
 */
CANVAS.stroke=function() {
	CANVAS.drawSuccessful=false;
	if(!CANVAS.renderer||!CANVAS.settings.enabled) { // disabled
		return;
	}

	if(!CANVAS.targetLayerVisible||CANVAS.targetLayerLocked) { // locked
		return;
	}

	const pT=CANVAS.points;
	
	if(pT.length<3){
		return;
	}
	
	// if(isNaN(pT.p2[0])||isNaN(pT.p1[0])||isNaN(pT.p0[0])) { // There's a not-recorded pointer
	// 	return;
	// }
	CANVAS.drawSuccessful=true;
	PERFORMANCE.idleTaskManager.startBusy(); // start stroke: busy times

	// Consider changing the way to calculate division
	const nowLayer=CANVAS.nowLayer;
	let p0=pT[pT.length-1];
	let p1=pT[pT.length-2];
	let p2=pT[pT.length-3];


	let s2=[(p1[0]+p2[0])/2,(p1[1]+p2[1])/2,(p1[2]+p2[2])/2];
	let s1=[p1[0],p1[1],p1[2]];
	let s0=[(p1[0]+p0[0])/2,(p1[1]+p0[1])/2,(p1[2]+p0[2])/2];
	const param=CANVAS.renderer.strokeBezier(s2,s1,s0); // old->new
	if(!param){ // No draw occured
		return;
	}
	/**
	 * The following two lines are for non-automatic texture size growth
	 * Using automatic growth saves graphics memory, especially when textures are very large (2048^2+)
	 * However, automatic growth requires frequent dynamic memory allocation.
	 * If the texture size of a canvas is changed,
	 * all imagedata alongside the route in the layer tree will be reallocated.
	 * This is quite time-consuming.
	 */
	//CANVAS.renderer.renderPoints(wL,wH,hL,hH,kPoints);
	//CANVAS.requestRefresh(); // request a refresh on the screen

	// calculate new range
	// expand with [wL,wH)*[hL,hH)
	let [wL,wH,hL,hH,kPoints]=param;
	const nowTarget=nowLayer.rawImageData;
	const targetSize={width: wH-wL,height: hH-hL,left: wL,top: hL};
	let clippedTargetSize=targetSize;
	// render
	if(CANVAS.renderer.brush.blendMode!=GLTextureBlender.NONE&&!CANVAS.targetLayerOpacityLocked){ // need to expand border
		//console.log("now Target",nowTarget,"Clipp",);
		
		CANVAS.renderer.adjustImageDataBorders(nowTarget,clippedTargetSize,true);
		if(!nowTarget.width||!nowTarget.height){ // zero size. may happen when drawing out of canvas border
			return;
		}
		clippedTargetSize=GLProgram.borderIntersection(nowTarget,clippedTargetSize);
		if(!clippedTargetSize.width||!clippedTargetSize.height){ // zero size. drawing out of canvas border
			return;
		}
	}
	else{ // eraser or opacity locked, won't expand target border
		const intsc=GLProgram.borderIntersection(nowTarget.validArea,clippedTargetSize);
		if(!intsc.width||!intsc.height){ // zero size. won't change anything
			return;
		}
	}
	CANVAS.renderer.renderPoints(wL,wH,hL,hH,kPoints); // meanwhile expand valid area when blending brushtip

	// render end
	CANVAS.changedArea=GLProgram.extendBorderSize(CANVAS.changedArea,clippedTargetSize);
	nowLayer.setRawImageDataInvalid(); // the layers needs to be recomposited

	CANVAS.requestRefresh(clippedTargetSize); // request a refresh on the screen. Saved Time?
};

/**
 * On the end of stroke (Notice: not certainly canvas refreshed!)
 */
CANVAS.strokeEnd=function() {
	PERFORMANCE.idleTaskManager.startIdle();
	/**
	 * @TODO: more precise isChanged detection
	 */
	if(CANVAS.changedArea.width<0)CANVAS.changedArea.width=0;
	if(CANVAS.changedArea.height<0)CANVAS.changedArea.height=0;
	const isChanged=CANVAS.changedArea.width>0&&CANVAS.changedArea.height>0;
	
	if(isChanged) { // the place that calls LAYER
		CANVAS.onEndRefresh();
	}
	// reset changedArea here so that won't conflict with other keys
	CANVAS.changedArea={width:0,height:0,left:0,top:0};
	// Also check vram status here
	const vramFreezeCnt=CANVAS.renderer.getVRAMFreezeCnt();
	if(vramFreezeCnt>CANVAS.lastVRAMFreezeCnt){
		CANVAS.vramCompressCnt++;
		CANVAS.lastVRAMFreezeCnt=vramFreezeCnt;
	}
	else{
		CANVAS.vramCompressCnt=0;
	}
	if(CANVAS.vramCompressCnt>=2){ // many vram compression
		PERFORMANCE.reportLowVRAM();
	}
}

// ================= Canvas refresh control ===================
/**
 * request recomposing and rendering all contents in the layer tree
 * multiple requests within 1 animation frame will be combined
 */
CANVAS.requestRefresh=function(targetArea) {
	if(CANVAS.dirtyArea){
		if(targetArea){
			CANVAS.dirtyArea=GLProgram.extendBorderSize(CANVAS.dirtyArea,targetArea);
		}
		else{ // whole view
			CANVAS.dirtyArea=null;
		}
	}
	// else: already full range
	
	if(CANVAS.isRefreshRequested) {
		return; // already requested
	}
	CANVAS.isRefreshRequested=true;

	const expectedFps=ENV.displaySettings.maxFps;
	const reqFunc=()=>{
		CANVAS.onRefresh(); // call refresh callback
		CANVAS.isRefreshRequested=false;
	};

	if(isFinite(expectedFps)){ // refresh canvas at fixed interval
		setTimeout(reqFunc,Math.max(1000/expectedFps-4,0)); // subtract setTimeout initial delay
	}
	else{ // refresh canvas at screen refresh rate
		requestAnimationFrame(reqFunc);
	}

}

/**
 * On refreshing canvas, after animation frame
 * Only called (including async CANVAS.requestRefresh) when no layer structure's changed
 */
CANVAS.onRefresh=function() {
	try{
		CANVAS.refreshScreen(); // sync function
	}catch(err){
		if(err instanceof TypeError){
			if(err.message.indexOf("WebGLTexture")>-1){
				// cannot bind several textures at one time
				// TODO: this is gl-specific
				PERFORMANCE.reportLowVRAM();
			}
		}
	}
}

/**
 * Refresh screen display immediately
 * Shall not invoke directly as this may block the UI (synced function)
 * unless you know what you're doing!
 * 
 * The antialiasing parameter 0.7 is a balance of sharpness and crispiness.
 */
CANVAS.refreshScreen=function() {
	if(!LAYERS.layerTree)return; // not valid layerTree
	const antiAliasRadius=ENV.getAARadius(); // calculate anti-alias filter radius
	COMPOSITOR.recompositeLayers(null,CANVAS.dirtyArea); // recomposite from root.
	CANVAS.renderer.drawCanvas(LAYERS.layerTree.imageData,antiAliasRadius);

	// const endT=window.performance.now();
	// console.log("Refresh Time = "+Math.round(endT-CANVAS.startT)+" ms");
	// CANVAS.startT=endT;

	CANVAS.dirtyArea={width:0,height:0,left:0,top:0};
	CANVAS.lastAARad=antiAliasRadius;
}
// CANVAS.startT=0;
CANVAS.lastAARad=0; // last AA radius when refreshed

/**
 * The last refresh after a stroke stops
 * refresh corresponding layer settings
 * register history
 */
CANVAS.onEndRefresh=function() {
	LAYERS.active.updateThumb();
	const nowLayer=CANVAS.nowLayer
	const nowTarget=nowLayer.rawImageData;
	const lastRaw=nowLayer.lastRawImageData;

	const dLRUB=GLProgram.borderSubtractionLRUB(lastRaw.validArea,nowTarget.validArea); // calc difference
	if(!dLRUB.every(v=>v<1E-6)){ // valid area shrinked
		HISTORY.addHistory({ // add bundle
			type:"bundle",
			children:[
				{ // deleted area
					type:"image-data",
					id:CANVAS.nowLayer.id,
					area:{...lastRaw.validArea}
				},
				{ // new changes
					type:"image-data",
					id:CANVAS.nowLayer.id,
					area:{...CANVAS.changedArea}
				}
			]
		});
	}
	else{ // add raw image data changed history
		HISTORY.addHistory({
			type:"image-data",
			id:CANVAS.nowLayer.id,
			area:{...CANVAS.changedArea}
		});
	}
	STORAGE.FILES.reportUnsavedContentChanges(); // report that there are changes unsaved
	//CANVAS.lastRefreshTime=NaN;
	CANVAS.changedArea={width:0,height:0,left:0,top:0}; // reset changed area
}

// ===================== Clear function ====================

CANVAS.clearAll=function() {
	if(!CANVAS.renderer||!CANVAS.settings.enabled) {
		// No canvas, can't draw on it
		return false;
	}

	// get params of this layer in a tree
	CANVAS.targetLayerVisible=CANVAS.nowLayer.isVisible();
	CANVAS.targetLayerLocked=CANVAS.nowLayer.isLocked();
	CANVAS.targetLayerOpacityLocked=CANVAS.nowLayer.isOpacityLocked();
	if(!CANVAS.targetLayerVisible||CANVAS.targetLayerLocked) { // locked
		return false;
	}

	//const validArea={...CANVAS.nowLayer.rawImageData.validArea}; // the valid area doesn't change or turns 0
	CANVAS.renderer.clearImageData(CANVAS.nowLayer.rawImageData,null,CANVAS.targetLayerOpacityLocked);
	// HISTORY.addHistory({ // add raw image data changed history
	// 	type:"image-data",
	// 	id:CANVAS.nowLayer.id,
	// 	area:validArea // whole image
	// });
	CANVAS.nowLayer.updateThumb();
	CANVAS.nowLayer.setRawImageDataInvalid(); // the data is invalid now
	CANVAS.requestRefresh(); // refresh display
	return true;
}

// ================ Other tools ==================
/**
 * Pick color from visible workspace.
 * Return [r,g,b,a] (r,g,b in 0~255; a in 0~1), non-premultiplied form
 */
CANVAS.pickColor=function(x,y) { // ALL visible layers, (x,y) is under the window coordinate
	const EXT=1; // p-EXT to p+EXT pixels. 1 for 3pix
	const RANGE=2*EXT+1;
	const SIZE=RANGE*RANGE;

	const p=ENV.toPaperXY(x,y);
	if(p[0]<0||p[0]>ENV.paperSize.width||p[1]<0||p[1]>ENV.paperSize.height){
		return null; // out of paper area, return failed (null)
	}
	const imgData=LAYERS.layerTree.imageData;
	const buffer=CANVAS.renderer.getUint8ArrayFromImageData(imgData,{
		left: Math.round(p[0])-EXT,
		top: Math.round(p[1])-EXT,
		width: RANGE,
		height: RANGE
	});
	
	const pSum=[0,0,0,0];
	for(let i=0;i<buffer.length;i+=4){
		pSum[0]+=buffer[i];
		pSum[1]+=buffer[i+1];
		pSum[2]+=buffer[i+2];
		pSum[3]+=buffer[i+3];
	}
	pSum[0]/=SIZE;
	pSum[1]/=SIZE;
	pSum[2]/=SIZE;
	pSum[3]/=SIZE*255;
	//LOGGING&&console.log(pSum);

	return SMath.blendNormal([...PALETTE.colorSelector.getRGB(),1],pSum); //pSum
}

CANVAS.color2Opacity=function(){
	if(!CANVAS.renderer||!CANVAS.settings.enabled) {
		// No canvas, can't draw on it
		return false;
	}
	// get params of this layer in a tree
	CANVAS.targetLayerVisible=CANVAS.nowLayer.isVisible();
	CANVAS.targetLayerLocked=CANVAS.nowLayer.isLocked();
	CANVAS.targetLayerOpacityLocked=CANVAS.nowLayer.isOpacityLocked();
	if(!CANVAS.targetLayerVisible||CANVAS.targetLayerLocked) { // locked
		return false;
	}
	CANVAS.renderer.colorToOpacity(CANVAS.nowLayer.rawImageData);

	// update UI
	CANVAS.nowLayer.updateThumb();
	CANVAS.nowLayer.setRawImageDataInvalid(); // the data is invalid now
	CANVAS.requestRefresh(); // refresh display
	return true;
}

// ========= Panning translation on imageData =========
// @TODO: move this to a new class?

/**
 * set the contents of targetLayer at {left:x,top:y}
 * Also move all child layers
 * 
 * This is a rather low-cost but not logically correct implementation.
 * After panning, the imageData become invalid (as they didn't moved)
 * but if no rendering into these layers happen, there will be no difference.
 */
CANVAS.panLayer=function(targetLayer,dx,dy,isToSetInvalid){
	const imgData=targetLayer.rawImageData;
	imgData.left+=dx;
	imgData.top+=dy;
	imgData.validArea.left+=dx;
	imgData.validArea.top+=dy;
	if(targetLayer.lastRawImageData){ // also pan history records
		const lastD=targetLayer.lastRawImageData;
		lastD.left+=dx;
		lastD.top+=dy;
		lastD.validArea.left+=dx;
		lastD.validArea.top+=dy;
	}
	if(isToSetInvalid){
		targetLayer.setRawImageDataInvalid();
	}
	if(targetLayer.children.length){
		for(const v of targetLayer.children) {
			CANVAS.panLayer(v,dx,dy,isToSetInvalid);
		}
	}
}

// If targetLayer called by CANVAS.panLayer, then all of them should have same decimal part
CANVAS.roundLayerPosition=function(targetLayer){
	const imgData=targetLayer.rawImageData;
	imgData.left=Math.round(imgData.left);
	imgData.top=Math.round(imgData.top);
	imgData.validArea.left=Math.round(imgData.validArea.left);
	imgData.validArea.top=Math.round(imgData.validArea.top);
	if(targetLayer.lastRawImageData){
		const lastD=targetLayer.lastRawImageData;
		lastD.left=Math.round(lastD.left);
		lastD.top=Math.round(lastD.top);
		lastD.validArea.left=Math.round(lastD.validArea.left);
		lastD.validArea.top=Math.round(lastD.validArea.top);
	}
	targetLayer.setRawImageDataInvalid(); // render out-of-viewport-before-panning area
	if(targetLayer.children.length){
		for(const v of targetLayer.children) {
			CANVAS.roundLayerPosition(v);
		}
	}
}