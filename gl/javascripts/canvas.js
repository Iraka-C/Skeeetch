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
CANVAS.nowLayer=null; // now operating layer
CANVAS.pointCnt=0;
CANVAS.isChanged=false;

// ========================= Functions ===========================
CANVAS.init=function(){
	CANVAS.renderer=new GLRenderer({
		canvas: $("#main-canvas")[0],
		onRefresh: CANVAS.onRefresh
	});
}
/**
 * Update the target canvas to draw
 * targetCV is a DOM canvas element!
 * imgData is the data in targetLayer (if any), type: imgData from Renderer!
 */
CANVAS.setTargetLayer=function(targetLayer,imgData){
	CANVAS.nowLayer=targetLayer;
	if(!targetLayer){ // no active target
		CANVAS.settings.enabled=false;
	}
	else{
		CANVAS.settings.enabled=true;
		CANVAS.updateSpeed(); // at init
		CANVAS.renderer.init({
			imageData:imgData // render target
		});
	}
}

/**
 * Set the canvas params before each stroke
 */
CANVAS.setCanvasEnvironment=function(event){ // event="pointerdown"
	if(!CANVAS.renderer||!CANVAS.settings.enabled){ // No canvas, can't draw on it
		return;
	}
	if(!CANVAS.nowLayer.properties.visible||CANVAS.nowLayer.properties.locked){ // locked
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
		isOpacityLocked: CANVAS.nowLayer.properties.pixelOpacityLocked,
		antiAlias:ENV.displaySettings.antiAlias
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
	
	if(!CANVAS.renderer||!CANVAS.settings.enabled){ // disabled
		return;
	}
	
	if(!CANVAS.nowLayer.properties.visible||CANVAS.nowLayer.properties.locked){ // locked
		return;
	}
	
	let pT=CANVAS.points;
	if(isNaN(pT.p2[0])||isNaN(pT.p1[0])||isNaN(pT.p0[0])){ // There's a not-recorded pointer
		return;
	}
	
	// Consider changing the way to calculate division
	let p0=pT.p0;
	let p1=pT.p1;
	let p2=pT.p2;

	CANVAS.isChanged=true; // canvas changed
	CANVAS.nowLayer.setRawImageDataInvalid(); // the layers needs to be recomposited
	
	let s2=[(p1[0]+p2[0])/2,(p1[1]+p2[1])/2,(p1[2]+p2[2])/2];
	let s1=[p1[0],p1[1],p1[2]];
	let s0=[(p1[0]+p0[0])/2,(p1[1]+p0[1])/2,(p1[2]+p0[2])/2];
	CANVAS.renderer.strokeBezier(s2,s1,s0); // old->new

	CANVAS.requestRefresh(); // request a refresh on the screen
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
		CANVAS.onEndRefresh.isToRefresh=true; // canvas changed, refresh layer info
	}
}

// ================= Canvas refresh control ===================
/**
 * request recomposing and rendering all contents in the layer tree
 * multiple requests within 1 animation frame will be combined
 */
CANVAS.requestRefresh=function(){
	if(CANVAS.isRefreshRequested){
		return; // already requested
	}
	CANVAS.isRefreshRequested=true;
	requestAnimationFrame(()=>{
		CANVAS.onRefresh(); // call refresh callback
		CANVAS.isRefreshRequested=false;
	}); // refresh canvas at next frame
}

/**
 * On refreshing canvas, after animation frame
 */
CANVAS.onRefresh=function(){
	CANVAS.refreshScreen();
	if(CANVAS.onEndRefresh.isToRefresh){
		CANVAS.onEndRefresh();
	}
}

// refresh screen display immediately
CANVAS.refreshScreen=function(){
	CANVAS.recompositeLayers();
	CANVAS.renderer.drawCanvas(LAYERS.layerTree.imageData);
}

/**
 * The last refresh after a stroke stops
 * refresh corresponding layer settings
 * register history
 */
CANVAS.onEndRefresh=function(){
	LAYERS.active.updateThumb();
	CANVAS.onEndRefresh.isToRefresh=false;
}
CANVAS.onEndRefresh.isToRefresh=false;

/**
 * Use mid-order traverse: the backdrop of a group is transparent
 * SAI uses mid-order
 * PS, Web use pre-order: the backdrop is the underlaying layers
 */
CANVAS.recompositeLayers=function(node){
	node=node||LAYERS.layerTree; // init: root
	//console.log("Recomposite "+node.id);

	if(!node.isRawImageDataValid){ // raw data of this node needs recomposition
		// Only group/root will reach here
		if(!node.isChildrenClipMaskOrderValid){ // clip mask order not calculated
			node.constructClipMaskOrder();
		}
		// clip mask order here is correct
		const bg=node.rawImageData; // present uncleared imagedata
		CANVAS.renderer.clearImageData(bg,null,false); // clear the data to blank
		const list=node.children;
		for(let i=list.length-1;i>=0;i--){ // reversed order
			const child=list[i];
			// for group, only blend non-clip mask layers
			// clip mask parent not itself: a clip mask
			if(child.index!=child.clipMaskParentIndex)continue;

			CANVAS.recompositeLayers(child); // recomposite this level
			if(!child.properties.visible)continue; // invisible: pass this node
			// for DEBUG, blend with normal mode
			CANVAS.renderer.blendImageData(child.imageData,bg,{
				mode:"normal",
				srcAlpha: child.properties.opacity
			}); // blend layer with backdrop
		}
		node.isRawImageDataValid=true;
	}

	if(!node.isMaskedImageDataValid){ // masked data needs recomposition
		if(node.maskImageData){ // there is a mask in this layer
			// @TODO: blend raw & mask ==> masked

		}
		// else: node.maskedImageData==node.rawImageData;
		node.isMaskedImageDataValid=true;
	}

	if(!node.isImageDataValid){ // image data needs recomposition (with clip masks)
		if(node.clipMaskChildrenCnt>0){ // there is a clip mask over this layer
			const siblings=node.parent.children;
			const index=node.getIndex();
			const clipped=node.imageData; // present uncleared imagedata
			CANVAS.renderer.blendImageData(node.maskedImageData,clipped,{mode:"source"}); // copy masked image
			for(let i=0;i<node.clipMaskChildrenCnt;i++){
				const clipMaskNode=siblings[index-1-i];
				CANVAS.recompositeLayers(clipMaskNode); // recomposite this level
				if(!clipMaskNode.properties.visible)continue; // invisible: pass this node
				CANVAS.renderer.blendImageData(clipMaskNode.imageData,clipped,{
					mode:"normal",
					alphaLock:true, // lock alpha
					srcAlpha: clipMaskNode.properties.opacity
				});
			}
		}
		// else: clipped==node.maskedImageData
		node.isImageDataValid=true;
	}
}

// ===================== Clear function ====================

CANVAS.clearAll=function(){
	if(!CANVAS.renderer||!CANVAS.settings.enabled){
		// No canvas, can't draw on it
		return;
	}
	if(!CANVAS.nowLayer.properties.visible||CANVAS.nowLayer.properties.locked){ // locked
		return;
	}
	
	CANVAS.renderer.clearImageData(CANVAS.nowLayer.imageData,null,
		CANVAS.nowLayer.properties.pixelOpacityLocked);
	CANVAS.nowLayer.updateThumb();
	CANVAS.nowLayer.setRawImageDataInvalid(); // the data is invalid now
	CANVAS.refreshScreen(); // refresh immediately
	
}

// ================ Other tools ==================
// Mixing pixels should be pre-order or **mid-order**? Not post-order certainly.
CANVAS._takePixel=function($div,x,y,pix){
	if($div.is("canvas")){ // a group
		const tmpRenderer=CANVAS.getNewRenderer($div[0],{
			disableBuffer:true // do not construct whole buffer
		})
		const data=tmpRenderer.getImageData(x,y,1,1).data.data; // 2d way, not gl
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