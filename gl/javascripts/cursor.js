/**
 * Pointer cursor / event manager
 */
"use strict";
const CURSOR={};

// present position: (x,y,pressure)
// The posistion is relative to the #canvas-window
CURSOR.p0=[NaN,NaN,NaN]; // latest point
CURSOR.p1=[NaN,NaN,NaN]; // last point
CURSOR.isShown=false; // is the pointer visible
CURSOR.isDown=false; //is the pointer pressed on screen
CURSOR.isPressure=false;
CURSOR.type=null; // NOTICE: the "type" here is in fact pointerId
CURSOR.eventIdList=["","",""]; // a list to record now id

CURSOR.nowActivity=null; // what is the cursor doing at this moment?
CURSOR.panRecord={ // recording the status of panning a layer/group
	isPanned: false,
	startPosition: [NaN,NaN] // the original position of rawImageData
};
CURSOR.rotateDown=NaN; // cursor rotation status
/**
 * nowActivity:
 * <null>: nothing
 * stroke: paining on the canvas
 * pick: picking pixels from the canvas
 * pan-paper: panning the whole paper
 * pan-layer: panning a single layer/group
 * select: seleting an area
 */

/**
 * @TODO: fix brush moving delay (change svg into canvas?)
 * The delay is seemingly larger than SAI
 */
/**
 * @TODO: Bug! error cx,cy attribute on window resize
 */

CURSOR.init=function() {
	// $("#brush-cursor-layer").attr({
	// 	width: ENV.window.SIZE.width,
	// 	height: ENV.window.SIZE.height
	// });
	CURSOR.updateColor(PALETTE.colorSelector.getRGB());
	CURSOR.window=$("#canvas-layers-panel");
}

CURSOR.moveCursor=function(event) {
	let type=event.pointerId;

	// push one id in
	CURSOR.eventIdList[2]=CURSOR.eventIdList[1];
	CURSOR.eventIdList[1]=CURSOR.eventIdList[0];
	CURSOR.eventIdList[0]=type;

	if(CURSOR.eventIdList[2]==CURSOR.eventIdList[1]
		&&CURSOR.eventIdList[1]==type) { // same for 3 events
		CURSOR.type=type;
	}
	if(CURSOR.type!=type) { // not the present id, no moving
		return;
	}

	if(event.uPressure!=0.5&&event.uPressure!=0){
		// if no pressure, the value is always 0.5 or 0
		// 0.5 can be precisely represented with float
		// It is extremely rare (probably never till the solar system dies)
		// that a pressured pen stroke only contains 0 or 0.5 pressure value
		CURSOR.isPressure=true;
	}
	CURSOR.p1=CURSOR.p0; // hand to the last event
	const offsetWindow=CURSOR.window.offset(); // relative to document, same as pageX/Y
	CURSOR.p0=[ // new movement
		event.pageX-offsetWindow.left,
		event.pageY-offsetWindow.top,
		CURSOR.isPressure?
			event.uPressure:
			event.uPressure||CURSOR.isDown?1:0 // 1/0 as default
		// Note: Safari doesn't provide event.pressure
	];
	
	// set cursor size
	CURSOR.updateXYR();

	// canvas operation
	CANVAS.updateCursor(CURSOR.p0,CURSOR.isDown);
	if(CURSOR.isDown) {
		if(CURSOR.nowActivity=="pan-paper") { // shift: pan the whole canvas
			let dx=CURSOR.p0[0]-CURSOR.p1[0];
			let dy=CURSOR.p0[1]-CURSOR.p1[1];
			if(isNaN(dx)||isNaN(dy)) return;
			let newTx=ENV.window.trans.x+dx;
			let newTy=ENV.window.trans.y+dy;
			ENV.translateTo(newTx,newTy);
		}
		else if(CURSOR.nowActivity=="rotate-paper"){
			const center=[ENV.window.SIZE.width/2,ENV.window.SIZE.height/2];
			const angle=-Math.atan2(CURSOR.p0[0]-center[0],CURSOR.p0[1]-center[1])/Math.PI*180; // in deg, CW
			if(isNaN(CURSOR.rotateDown)){
				CURSOR.rotateDown=angle-ENV.window.rot;
			}
			else{
				let newRot=angle-CURSOR.rotateDown;
				newRot=(newRot+540)%360-180; // at most -360-180 = -540
				const diffTo90=Math.abs((newRot-45)%90)-45;
				if(Math.abs(diffTo90)<10){ // within 10 degs, round to 90
					newRot=Math.round(newRot/90)*90;
				}
				ENV.rotateTo(newRot);
				$("#rotate-info-input").val(Math.round(newRot));
			}
		}
		else if(CURSOR.nowActivity=="pan-layer"||CURSOR.nowActivity=="pan-disable") { // ctrl: pan canvas only
			if(!LAYERS.active.isVisible()
				||LAYERS.active.isLocked()||LAYERS.active.isDescendantLocked()
				||LAYERS.active.isOpacityLocked()||LAYERS.active.isDescendantOpacityLocked()) {
				// if locked in layer tree, or the layer is invisible, cannot move
				CURSOR.updateAction("pan-disable");
				return;
			}
			// @TODO: move all cursor coordinate translate into CURSOR
			panLayers();
		}
		else if(CURSOR.nowActivity=="pick") {
			if(isNaN(CURSOR.p0[0])||isNaN(CURSOR.p0[1])) return;
			const pix=CANVAS.pickColor(CURSOR.p0[0],CURSOR.p0[1]);
			if(pix){ // a successful color picking
				PALETTE.colorSelector.setRGB(pix.slice(0,3));
			}
			// PALETTE.drawPalette();
			// PALETTE.setCursor();
		}
		else if(CURSOR.nowActivity=="stroke"){ // is drawing
			CANVAS.stroke();
		}
		// else... for future extension

		// cancel cursor position status
		if(CURSOR.nowActivity!="rotate-paper"){
			CURSOR.rotateDown=NaN;
		}
	}
	else{
		CURSOR.rotateDown=NaN;

		if(EVENTS.isCursorInHysteresis){ // hysteresis drawing after pen up
			if(CURSOR.nowActivity=="stroke"&&CURSOR.isPressure){
				CANVAS.stroke();
			}
			// else... just don't care them.
			// Other operations don't require hysteresis
		}
	}

	/**
	 * Pan a layer with its clip masks
	 */
	function panLayers(){
		const cp0=ENV.toPaperXY(CURSOR.p0[0],CURSOR.p0[1]);
		const cp1=ENV.toPaperXY(CURSOR.p1[0],CURSOR.p1[1]);
		const dxP=cp0[0]-cp1[0]; // difference in paper coordinate
		const dyP=cp0[1]-cp1[1];
		if(isNaN(dxP)||isNaN(dyP)) return;

		if(!CURSOR.panRecord.isPanned) { // record panning status
			CURSOR.panRecord.isPanned=true;
			const imgData=LAYERS.active.rawImageData;
			CURSOR.panRecord.startPosition=[imgData.left,imgData.top];
		}

		// TODO: take with clip masks?
		CANVAS.panLayer(LAYERS.active,cp0[0]-cp1[0],cp0[1]-cp1[1],false);
		LAYERS.active.setImageDataInvalid(); // merge with clip mask
		CANVAS.requestRefresh();
	}

};

CURSOR.updateXYR=function() {
	if(!BrushManager.activeBrush // no brush at present
		||isNaN(CURSOR.p0[0])) { // no valid coordinate (when resizing window)
		return;
	}

	let r=BrushManager.activeBrush.size*ENV.window.scale/2;
	$("#brush-cursor-round").attr({
		"cx": CURSOR.p0[0],
		"cy": CURSOR.p0[1],
		"r": r
	});
	$("#brush-cursor-outer").attr({
		"cx": CURSOR.p0[0],
		"cy": CURSOR.p0[1],
		"r": r+1
	});
	$("#brush-cursor-center").attr({
		"cx": CURSOR.p0[0],
		"cy": CURSOR.p0[1]
	});
	$("#brush-cursor-center-outer").attr({
		"cx": CURSOR.p0[0],
		"cy": CURSOR.p0[1]
	});
}

CURSOR.updateColor=function(rgb) {
	const colorString=PaletteSelector.getColorString(rgb);
	const outerString=Math.max(...rgb)>150? "#00000033":"#ffffff33"; // @TODO: use luminosity instead?
	$("#brush-cursor-round").attr("stroke",colorString);
	$("#brush-cursor-center").attr("fill",colorString);

	$("#brush-cursor-outer").attr("stroke",outerString);
	$("#brush-cursor-center-outer").attr("fill",outerString);
}


CURSOR._isBusy=false;
CURSOR.setBusy=function(isBusy) {
	CURSOR._isBusy=isBusy;
	CURSOR.updateAction();
}
CURSOR.setIsShown=function(isShown) {
	CURSOR.isShown=isShown;
	CURSOR.updateAction();
}

/**
 * Change the present action of the cursor
 */
CURSOR.updateAction=function(event) {
	if(CURSOR._isBusy) { // is busy has the highest priority
		CURSOR.nowActivity="busy";
	}
	else if(!CURSOR.isShown) { // hidden has the next priority
		CURSOR.nowActivity="hidden";
	}
	else if((event instanceof Object)&&(event.originalEvent.buttons&0x2)) { // 2^1==2, right button
		if(EVENTS.key.shift){
			CURSOR.nowActivity="rotate-paper";
		}
		else{
			CURSOR.nowActivity="pick";
		}
	}
	else if(EVENTS.key.shift) {
		CURSOR.nowActivity="pan-paper";
		// used as a flag in ENV._transformAnimation
	}
	else if(EVENTS.key.ctrl) {
		if(event=="pan-disable"&&CURSOR.isDown) { // disabled by some reason
			CURSOR.nowActivity="pan-disable";
		}
		else{
			CURSOR.nowActivity="pan-layer";
		}
	}
	else if(EVENTS.key.alt) {
		CURSOR.nowActivity="pick";
	}
	else if(!CANVAS.drawSuccessful&&CURSOR.isDown) {
		CURSOR.nowActivity="disable";
	}
	else {
		CURSOR.nowActivity="stroke";
	}

	CURSOR.setCursor();
}

// ================== Appearance ======================

/**
 * Disable cursor data
 */
CURSOR.disableCursor=function() {
	CURSOR.p0=[NaN,NaN,NaN];
	CURSOR.p1=[NaN,NaN,NaN];
	CANVAS.updateCursor(CURSOR.p0,CURSOR.isDown);
};

/**
 * Change the appearance of the cursor
 */
CURSOR.setCursor=function() {
	// filter style
	if(CURSOR.nowActivity==CURSOR.setCursor.lastType) {
		return;
	}
	CURSOR.setCursor.lastType=CURSOR.nowActivity;

	if(CURSOR.nowActivity=="busy") { // is busy has the highest priority
		$("#brush-cursor").css("display","none");
		$("#canvas-area-panel").css("cursor","wait");
		return;
	}

	if(CURSOR.nowActivity=="hidden") { // hide cursor has the next priority
		$("#brush-cursor").css("display","none");
		$("#canvas-area-panel").css("cursor","none");
		CURSOR.disableCursor(); // provide dummy value
		return;
	}
	// * stroke: paining on the canvas
	// * pick: picking pixels from the canvas
	// * pan-paper: panning the whole paper
	// * pan-layer: panning a single layer/group
	// * select: seleting an area
	// * disable: invalid operation
	switch(CURSOR.nowActivity) {
		default:
		case "stroke": // normal: svg cursor
			$("#canvas-area-panel").css("cursor","none");
			$("#brush-cursor").css("display","block");
			break;
		case "pick": // corss hair color picker
			$("#canvas-area-panel").css("cursor","crosshair");
			$("#brush-cursor").css("display","none");
			break;
		case "pan-paper": // moving
			$("#canvas-area-panel").css("cursor","move");
			$("#brush-cursor").css("display","none");
			break;
		case "rotate-paper": // rotating paper
			$("#canvas-area-panel").css("cursor","url('../gl/resources/cursor/rotate-arrow.cur'), grabbing");
			$("#brush-cursor").css("display","none");
			break;
		case "pan-layer": // dragging
			$("#canvas-area-panel").css("cursor","alias");
			$("#brush-cursor").css("display","none");
			break;
		case "pan-disable": // disabled when panning
		case "disable": // disabling
			$("#canvas-area-panel").css("cursor","not-allowed");
			$("#brush-cursor").css("display","none");
			break;
	}
}
CURSOR.setCursor.lastType=null;

/**
 * Cursor click control
 */

CURSOR.down=function(event) {
	if(CURSOR.isDown) {
		return;
	}
	CURSOR.isDown=true;
	CURSOR.isPressure=false; // set as false first, wait for pressure value
	CURSOR.panRecord.isPanned=false;
	//CURSOR.type=event.originalEvent.pointerId;
}

CURSOR.up=function(event) {
	if(CURSOR.isDown&&(
		CURSOR.type==event.originalEvent.pointerId // on the target leave
		||CURSOR.type===null)) { // on init
		CURSOR.isDown=false;
		//CURSOR.type=NaN;
		if(CURSOR.panRecord.isPanned) { // There was a panning operation
			// make borders integer
			CANVAS.roundLayerPosition(LAYERS.active);
			CANVAS.requestRefresh();
			// record history
			const imgData=LAYERS.active.rawImageData;
			const startPos=CURSOR.panRecord.startPosition;
			HISTORY.addHistory({
				type: "node-pan",
				id: LAYERS.active.id,
				dx: imgData.left-startPos[0],
				dy: imgData.top-startPos[1]
			});
		}
	}
}