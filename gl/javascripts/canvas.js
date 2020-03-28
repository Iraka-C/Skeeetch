/**
 * Canvas manager
 */

CANVAS={};
CANVAS.settings={
	enabled: true, // is canvas drawable?
	method: 2, // webgl:1, cpu16bit:2, ctx2d:3
	smoothness: 3,
	_speed: 0 // a function of smoothness
};
CANVAS.points={ // the points drawn on canvas, under paper coordinate
	p0: [NaN,NaN,NaN], // x,y,pressure(0~1)
	p1: [NaN,NaN,NaN],
	p2: [NaN,NaN,NaN]
};
CANVAS.targetCanvas=null; // display canvas to render to
CANVAS.nowLayer=null; // now operating layer
CANVAS.pointCnt=0;
CANVAS.isChanged=false;
CANVAS.drawSuccessful=false; // if you try to stroke on canvas, will it be successful?

// ========================= Functions ===========================
CANVAS.init=function() {
	console.log("Canvas init");
	CANVAS.drawSuccessful=true;
	
	if(CANVAS.renderer){
		// release some resources
		CANVAS.renderer.free(); // destroy remaining memories
	}
	CANVAS.targetCanvas=$("#main-canvas")[0];
	CANVAS.renderer=new GLRenderer({
		canvas: CANVAS.targetCanvas,
		onRefresh: CANVAS.onRefresh
	});
}
/**
 * Update the target canvas to draw
 */
CANVAS.setTargetLayer=function(targetLayer) {
	CANVAS.nowLayer=targetLayer;
	if(!targetLayer) { // no active target
		CANVAS.settings.enabled=false;
		CANVAS.drawSuccessful=false;
	}
	else {
		CANVAS.settings.enabled=true;
		CANVAS.drawSuccessful=true;
		CANVAS.updateSpeed(); // at init
		CANVAS.renderer.init({
			imageData: targetLayer.rawImageData // render target
		});
	}
}

/**
 * Set the canvas params before each stroke
 */
CANVAS.setCanvasEnvironment=function(event) { // event="pointerdown"
	if(!CANVAS.renderer||!CANVAS.settings.enabled) { // No canvas, can't draw on it
		CANVAS.drawSuccessful=false;
		return;
	}
	CANVAS.drawSuccessful=true;

	// get params of this layer in a tree
	CANVAS.targetLayerVisible=CANVAS.nowLayer.isVisible();
	CANVAS.targetLayerLocked=CANVAS.nowLayer.isLocked();
	CANVAS.targetLayerOpacityLocked=CANVAS.nowLayer.isOpacityLocked();

	if(!CANVAS.targetLayerVisible||CANVAS.targetLayerLocked) { // invisible or locked
		return;
	}
	/**
	 * @TODO: for some wacom boards, the first 2/3 events appears not constant
	 */
	CANVAS.pointCnt=0; // count reset
	CANVAS.isChanged=false; // change reset
	CANVAS.isRefreshRequested=false; // refresh screen control
	CANVAS.renderer.initBeforeStroke({ // init renderer before stroke
		brush: BrushManager.activeBrush,
		rgb: PALETTE.rgb,
		sensitivity: BrushManager.general.sensitivity,
		isOpacityLocked: CANVAS.targetLayerOpacityLocked,
		antiAlias: ENV.displaySettings.antiAlias
	});
};

CANVAS.updateSpeed=function() {
	if(CANVAS.settings.smoothness>=0) { // slow down
		CANVAS.settings._speed=Math.pow(0.75,CANVAS.settings.smoothness);
	}
	else { // tremble
		let p1=CANVAS.settings.smoothness+5;
		CANVAS.settings._speed=2-p1*p1/25;
	}
}

/**
 * Update cursor trace, point=[x,y,pressure] relative to div #canvas-window
 */
CANVAS.updateCursor=function(point) {
	const pT=CANVAS.points;
	/**
	 * @TODO: Mysterious behavior
	 * pT seems to contain some of the uncorrect values
	 */
	// if(CURSOR.isDown){
	// 	console.log(pT);
	// 	console.log(pT.p0);
	// }

	pT.p2=pT.p1;
	pT.p1=pT.p0;

	// Coordinate transform
	const pC=ENV.toPaperXY(point[0],point[1]);

	const p=CANVAS.settings._speed;
	const q=1-p;
	if(!isNaN(pT.p1[0])) { // Smooth the trail
		pT.p0=[
			pC[0]*p+pT.p1[0]*q,
			pC[1]*p+pT.p1[1]*q,
			point[2]*p+pT.p1[2]*q
		];
	}
	else {
		pT.p0=[pC[0],pC[1],point[2]];
	}
	CANVAS.pointCnt++;
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

	let pT=CANVAS.points;
	if(isNaN(pT.p2[0])||isNaN(pT.p1[0])||isNaN(pT.p0[0])) { // There's a not-recorded pointer
		return;
	}
	CANVAS.drawSuccessful=true;
	PERFORMANCE.idleTaskManager.startBusy(); // start stroke: busy times

	// Consider changing the way to calculate division
	const nowLayer=CANVAS.nowLayer;
	let p0=pT.p0;
	let p1=pT.p1;
	let p2=pT.p2;


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
	let [wL,wH,hL,hH,kPoints]=param;
	let nowTarget=nowLayer.rawImageData;
	let targetSize={width: wH-wL,height: hH-hL,left: wL,top: hL};

	// render
	CANVAS.renderer.adjustImageDataBorders(nowTarget,targetSize,true);
	CANVAS.renderer.init({imageData: nowTarget}); // renew target imageData
	if(!(nowTarget.width&&nowTarget.height)){ // zero size. may happen when drawing out of canvas border
		return;
	}
	CANVAS.renderer.renderPoints(wL,wH,hL,hH,kPoints);

	// render end
	CANVAS.isChanged=true; // canvas changed
	nowLayer.setRawImageDataInvalid(); // the layers needs to be recomposited
	CANVAS.requestRefresh(); // request a refresh on the screen
};

/**
 * On the end of stroke (Notice: not certainly canvas refreshed!)
 */
CANVAS.strokeEnd=function() {
	CANVAS.points.p0=[NaN,NaN,0];
	PERFORMANCE.idleTaskManager.startIdle();
	/**
	 * @TODO: more precise isChanged detection
	 */
	if(CANVAS.isChanged) { // the place that calls LAYER
		CANVAS.isChanged=false;
		CANVAS.onEndRefresh();
	}
}

// ================= Canvas refresh control ===================
/**
 * request recomposing and rendering all contents in the layer tree
 * multiple requests within 1 animation frame will be combined
 */
CANVAS.lastRefreshTime=NaN;
CANVAS.requestRefresh=function() {
	if(CANVAS.isRefreshRequested) {
		return; // already requested
	}
	CANVAS.isRefreshRequested=true;
	requestAnimationFrame(() => {
		CANVAS.onRefresh(); // call refresh callback
		CANVAS.isRefreshRequested=false;
		const nowTime=Date.now();
		if(!isNaN(CANVAS.lastRefreshTime)){
			PERFORMANCE.submitFpsStat(nowTime-CANVAS.lastRefreshTime);
		}
		CANVAS.lastRefreshTime=nowTime;
	}); // refresh canvas at next frame
}

/**
 * On refreshing canvas, after animation frame
 */
CANVAS.onRefresh=function() {
	CANVAS.refreshScreen();
}

/**
 * Refresh screen display immediately
 * Shall not invoke directly as this may block the UI (synced function)
 * unless you know what you're doing!
 */
CANVAS.refreshScreen=function() {
	CANVAS.recompositeLayers();
	CANVAS.renderer.drawCanvas(LAYERS.layerTree.imageData);
}

/**
 * The last refresh after a stroke stops
 * refresh corresponding layer settings
 * register history
 */
CANVAS.onEndRefresh=function() {
	LAYERS.active.updateThumb();
	CANVAS.lastRefreshTime=NaN;
}

/**
 * Use mid-order traverse: the backdrop of a group is transparent
 * SAI uses mid-order
 * PS, Web use pre-order: the backdrop is the underlaying layers
 * 
 * In this module, size auto-growth is used.
 * If one texture at the leaf node (CanvasNode) expands,
 * All textures along the route to the root will be reallocated.
 * This is time consuming.
 * @TODO: looking for better algorithm to grow texture sizes.
 */
CANVAS.recompositeLayers=function(node) {
	node=node||LAYERS.layerTree; // init: root
	//console.log("Recomposite "+node.id);

	if(!node.isRawImageDataValid&&node.children.length) { // raw data of this node needs recomposition
		// Only group/root will reach here
		if(!node.isChildrenClipMaskOrderValid) { // clip mask order not calculated
			node.constructClipMaskOrder();
		}

		// clip mask order here is correct
		const list=node.children;
		const childrenToBlend=[];
		let initSize={width: 0,height: 0,left: 0,top: 0};
		for(let i=list.length-1;i>=0;i--) { // reversed order
			const child=list[i];
			// for group, only blend non-clip mask layers
			// clip mask parent not itself: a clip mask
			if(child.index!=child.clipMaskParentIndex) continue;

			CANVAS.recompositeLayers(child); // recomposite this level
			if(!child.properties.visible) continue; // invisible: pass this node
			if(!child.imageData.width||!child.imageData.height) continue; // child contains 0 pixel after composition

			childrenToBlend.push(i);
			initSize=GLProgram.extendBorderSize(initSize,child.imageData); // to blend the imageData into layer's raw imageData
		}
		// Now the initSize contains the minimum size to contain the children's imageData
		let bg=node.rawImageData; // present uncleared imagedata
		CANVAS.renderer.adjustImageDataBorders(bg,initSize,false);
		CANVAS.renderer.clearImageData(bg,null,false); // clear the data to blank

		// blend the children
		for(const v of childrenToBlend) {
			const child=list[v];
			if(PERFORMANCE.debugger.isDrawingLayerBorder){ // For DEBUG: draw the edge of each layer
				CANVAS.renderer.drawEdge(child.imageData,bg);
			}
			CANVAS.renderer.blendImageData(child.imageData,bg,{
				mode: child.properties.blendMode,
				srcAlpha: child.properties.opacity
			}); // blend layer with backdrop
		}

	}
	node.isRawImageDataValid=true;

	if(!node.isMaskedImageDataValid) { // masked data needs recomposition
		if(node.maskImageData) { // there is a mask in this layer
			// @TODO: blend raw & mask ==> masked

		}
		// else: node.maskedImageData==node.rawImageData;
	}
	node.isMaskedImageDataValid=true;

	if(!node.isImageDataValid) { // image data needs recomposition (with clip masks)
		if(node.clipMaskChildrenCnt>0) { // there is a clip mask over this layer
			// At here, imageData is surely not equal to rawImageData
			const siblings=node.parent.children;
			const childrenToBlend=[];
			const index=node.getIndex();
			for(let i=0;i<node.clipMaskChildrenCnt;i++) {
				const v=index-1-i; // reversed order
				const clipMaskNode=siblings[v];
				CANVAS.recompositeLayers(clipMaskNode); // recomposite this level
				if(!clipMaskNode.properties.visible) continue; // invisible: pass this node
				if(!clipMaskNode.imageData.width||!clipMaskNode.imageData.height) continue; // contains 0 pixel: do not blend
				childrenToBlend.push(v);
			}

			// Now the initSize contains the minimum size to contain the children's & this node's imageData
			const mask=node.maskedImageData;
			const clipped=node.imageData; // present uncleared imagedata
			CANVAS.renderer.adjustImageDataBorders(clipped,mask,false); // move to the position of mask
			//CANVAS.renderer.clearImageData(clipped,null,false); // clear the data to blank.
			// combine all image data
			CANVAS.renderer.blendImageData(mask,clipped,{mode: BasicRenderer.SOURCE}); // copy masked image
			for(const v of childrenToBlend) {
				const clipMaskNode=siblings[v];
				// for DEBUG, blend with normal mode. @TODO: add blend mode
				if(PERFORMANCE.debugger.isDrawingLayerBorder){ // For DEBUG: draw the edge of each layer
					CANVAS.renderer.drawEdge(clipMaskNode.imageData,clipped);
				}
				CANVAS.renderer.blendImageData(clipMaskNode.imageData,clipped,{
					mode: clipMaskNode.properties.blendMode,
					alphaLock: true, // lock alpha
					srcAlpha: clipMaskNode.properties.opacity
				});
			}
		}
		// else: clipped==node.maskedImageData
	}
	node.isImageDataValid=true;
}

// ===================== Clear function ====================

CANVAS.clearAll=function() {
	if(!CANVAS.renderer||!CANVAS.settings.enabled) {
		// No canvas, can't draw on it
		return;
	}

	// get params of this layer in a tree
	CANVAS.targetLayerVisible=CANVAS.nowLayer.isVisible();
	CANVAS.targetLayerLocked=CANVAS.nowLayer.isLocked();
	CANVAS.targetLayerOpacityLocked=CANVAS.nowLayer.isOpacityLocked();
	if(!CANVAS.targetLayerVisible||CANVAS.targetLayerLocked) { // locked
		return;
	}

	// @TODO: consider mask
	CANVAS.renderer.clearImageData(CANVAS.nowLayer.rawImageData,null,CANVAS.targetLayerOpacityLocked);
	CANVAS.nowLayer.updateThumb();
	CANVAS.nowLayer.setRawImageDataInvalid(); // the data is invalid now
	CANVAS.refreshScreen(); // refresh immediately
}

// ================ Other tools ==================

CANVAS.pickColor=function(x,y) { // ALL visible layers, (x,y) is under the window coordinate
	const EXT=1; // p-EXT to p+EXT pixels. 1 for 3pix
	const RANGE=2*EXT+1;
	const SIZE=RANGE*RANGE;

	const p=ENV.toPaperXY(x,y);
	const imgData=LAYERS.layerTree.imageData;
	const buffer=CANVAS.renderer.getUint8ArrayFromImageData(
		imgData,null,[Math.round(p[0])-EXT-imgData.left,Math.round(p[1])-EXT-imgData.top,RANGE,RANGE]);
	
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

	return SMath.blendNormal([...PALETTE.rgb,1],pSum);
}

// ========= Panning translation on imageData =========
// @TODO: move this to a new class?

/**
 * set the contents of targetLayer at {left:x,top:y}
 * Also move all child layers
 */
CANVAS.panLayer=function(targetLayer,dx,dy){
	const imgData=targetLayer.rawImageData;
	imgData.left+=dx;
	imgData.top+=dy;
	// @TODO: pan Mask data // @TODO: link Mask data
	if(targetLayer.children.length){
		for(const v of targetLayer.children) {
			CANVAS.panLayer(v,dx,dy);
		}
	}
}