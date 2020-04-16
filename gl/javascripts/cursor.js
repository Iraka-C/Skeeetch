/**
 * Pointer cursor / event manager
 */

CURSOR={};

// present position: (x,y,pressure)
// The posistion is relative to the #canvas-window
CURSOR.p0=[NaN,NaN,NaN]; // latest point
CURSOR.p1=[NaN,NaN,NaN]; // last point
CURSOR.isShown=false; // is the pointer visible
CURSOR.isDown=false; //is the pointer pressed on screen
CURSOR.type=null;
CURSOR.eventIdList=["","",""]; // a list to record now id

CURSOR.nowActivity=null; // what is the cursor doing at this moment?
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

CURSOR.init=function(){
	$("#brush-cursor-layer").attr({
		width:ENV.window.SIZE.width,
		height:ENV.window.SIZE.height
	});
	CURSOR.updateColor();
}

CURSOR.moveCursor=function(event){
	let type=event.originalEvent.pointerType;
	
	// push one id in
	CURSOR.eventIdList[2]=CURSOR.eventIdList[1];
	CURSOR.eventIdList[1]=CURSOR.eventIdList[0];
	CURSOR.eventIdList[0]=type;

	if(CURSOR.eventIdList[2]==CURSOR.eventIdList[1]
	 &&CURSOR.eventIdList[1]==type){ // same for 3 events
		CURSOR.type=type;
	}
	if(CURSOR.type!=type){ // not the present id, no moving
		return;
	}

	CURSOR.p1=CURSOR.p0; // hand to the last event
	CURSOR.p0=[ // new movement
		event.originalEvent.offsetX,
		event.originalEvent.offsetY,
		type=="pen"?event.originalEvent.pressure:1 // 1 as default
	];
	// set cursor size
	CURSOR.updateXYR();

	// canvas operation
	CANVAS.updateCursor(CURSOR.p0,CURSOR.isDown);
	if(CURSOR.isDown){
		if(CURSOR.nowActivity=="pan-paper"){ // shift: pan the whole canvas
			let dx=CURSOR.p0[0]-CURSOR.p1[0];
			let dy=CURSOR.p0[1]-CURSOR.p1[1];
			if(isNaN(dx)||isNaN(dy))return;
			let newTx=ENV.window.trans.x+dx;
			let newTy=ENV.window.trans.y+dy;
			ENV.translateTo(newTx,newTy);
		}
		else if(CURSOR.nowActivity=="pan-layer"){ // ctrl: pan canvas only
			if(!LAYERS.active.isVisible()||LAYERS.active.isLocked()||LAYERS.active.isOpacityLocked()){
				// if locked/invisible in layer tree, cannot move
				return;
			}
			// @TODO: move all cursor coordinate translate into CURSOR
			const cp0=ENV.toPaperXY(CURSOR.p0[0],CURSOR.p0[1]);
			const cp1=ENV.toPaperXY(CURSOR.p1[0],CURSOR.p1[1]);
			const dxP=cp0[0]-cp1[0]; // difference in paper coordinate
			const dyP=cp0[1]-cp1[1];
			if(isNaN(dxP)||isNaN(dyP))return;
			CANVAS.panLayer(LAYERS.active,cp0[0]-cp1[0],cp0[1]-cp1[1]);
			LAYERS.active.setImageDataInvalid(); // merge with clip mask
			CANVAS.requestRefresh();
			// @TODO: now after layer recomposition the raw data is cropped by canvas viewport
			// This happens at top/left
		}
		else if(CURSOR.nowActivity=="pick"){
			if(isNaN(CURSOR.p0[0])||isNaN(CURSOR.p0[1]))return;
			const pix=CANVAS.pickColor(CURSOR.p0[0],CURSOR.p0[1]);
			PALETTE.setRGB(pix.slice(0,3));
			PALETTE.drawPalette();
			PALETTE.setCursor();
		}
		else{ // is drawing
			CANVAS.stroke();
		}
	}
	
};

CURSOR.updateXYR=function(){
	if(!BrushManager.activeBrush // no brush at present
		||isNaN(CURSOR.p0[0])){ // no valid coordinate (when resizing window)
		return;
	}
	
	let r=BrushManager.activeBrush.size*ENV.window.scale/2;
	$("#brush-cursor-round").attr({
		"cx":CURSOR.p0[0],
		"cy":CURSOR.p0[1],
		"r":r
	});
	$("#brush-cursor-outer").attr({
		"cx":CURSOR.p0[0],
		"cy":CURSOR.p0[1],
		"r":r+1
	});
	$("#brush-cursor-center").attr({
		"cx":CURSOR.p0[0],
		"cy":CURSOR.p0[1]
	});
	$("#brush-cursor-center-outer").attr({
		"cx":CURSOR.p0[0],
		"cy":CURSOR.p0[1]
	});
}

CURSOR.updateColor=function(){
	const colorString=PALETTE.getColorString();
	const outerString=PALETTE.hsv[2]>150?"#00000033":"#ffffff33";
	$("#brush-cursor-round").attr("stroke",colorString);
	$("#brush-cursor-center").attr("fill",colorString);

	$("#brush-cursor-outer").attr("stroke",outerString);
	$("#brush-cursor-center-outer").attr("fill",outerString);
}


CURSOR._isBusy=false;
CURSOR.setBusy=function(isBusy){
	CURSOR._isBusy=isBusy;
	CURSOR.updateAction();
}
CURSOR.setIsShown=function(isShown){
	CURSOR.isShown=isShown;
	CURSOR.updateAction();
}

/**
 * Change the present action of the cursor
 */
CURSOR.updateAction=function(event){
	if(CURSOR._isBusy){ // is busy has the highest priority
		CURSOR.nowActivity="busy";
	}
	else if(!CURSOR.isShown){ // hidden has the next priority
		CURSOR.nowActivity="hidden";
	}
	else if(event&&(event.originalEvent.buttons&0x2)){ // 2^1==2, right button
		CURSOR.nowActivity="pick";
	}
	else if(EVENTS.key.shift){
		CURSOR.nowActivity="pan-paper";
		// used as a flag in ENV._transformAnimation
	}
	else if(EVENTS.key.ctrl){
		CURSOR.nowActivity="pan-layer";
	}
	else if(!CANVAS.drawSuccessful&&CURSOR.isDown){
		CURSOR.nowActivity="disable";
	}
	else{
		CURSOR.nowActivity="stroke";
	}
	
	CURSOR.setCursor();
}

// ================== Appearance ======================

/**
 * Disable cursor data
 */
CURSOR.disableCursor=function(){
	CURSOR.p0=[NaN,NaN,NaN];
	CURSOR.p1=[NaN,NaN,NaN];
	CANVAS.updateCursor(CURSOR.p0,CURSOR.isDown);
};

/**
 * Change the appearance of the cursor
 */
CURSOR.setCursor=function(){
	// filter style
	if(CURSOR.nowActivity==CURSOR.setCursor.lastType){
		return;
	}
	CURSOR.setCursor.lastType=CURSOR.nowActivity;

	if(CURSOR.nowActivity=="busy"){ // is busy has the highest priority
		$("#brush-cursor").css("display","none");
		$("#canvas-area-panel").css("cursor","wait");
		return;
	}

	if(CURSOR.nowActivity=="hidden"){ // hide cursor has the next priority
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
	switch(CURSOR.nowActivity){
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
		case "pan-layer": // dragging
			$("#canvas-area-panel").css("cursor","alias");
			$("#brush-cursor").css("display","none");
			break;
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

CURSOR.down=function(event){
	if(CURSOR.isDown){
		return;
		//CURSOR.type=event.originalEvent.pointerId;
	}
	CURSOR.isDown=true;
}

CURSOR.up=function(event){
	if(CURSOR.isDown&&(
		CURSOR.type==event.originalEvent.pointerType // on the target leave
		||CURSOR.type===null)){ // on init
		CURSOR.isDown=false;
		//CURSOR.type=NaN;
	}
}