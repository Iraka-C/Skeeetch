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
CURSOR.isDragging=false; // is the pointer dragging the canvas?
CURSOR.type=null;
CURSOR.eventIdList=["","",""]; // a list to record now id

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
	CANVAS.updateCursor(CURSOR.p0);
	let lastAction=-1; // 0: stroking, 1: dragging paper, 2: dragging layer
	let originalPaperPos=[0,0];
	let originalLayerPos=[0,0];
	if(CURSOR.isDown){
		if(EVENTS.key.shift||EVENTS.key.ctrl){ // pan
			let dx=CURSOR.p0[0]-CURSOR.p1[0];
			let dy=CURSOR.p0[1]-CURSOR.p1[1];
			if(!(isNaN(dx)||isNaN(dy))){ // all available
				CURSOR.isDragging=true;
				if(EVENTS.key.shift){ // shift: pan the whole window
					let newTx=ENV.window.trans.x+dx;
					let newTy=ENV.window.trans.y+dy;
					ENV.translateTo(newTx,newTy);
					lastAction=1;
				}
				else{ // ctrl: pan canvas only
					if(!LAYERS.active.isVisible()||LAYERS.active.isLocked()){ // if locked/invisible in layer tree, cannot move
						return;
					}
					// if(lastAction!=2){ // start panning layer, record original point
					// 	originalPaperPos=ENV.toPaperXY([CURSOR.p1[0],CURSOR.p1[1]]);
					// 	originalLayerPos=[LAYERS.active.imageData.left,LAYERS.active.imageData.top];
					// }
					// @TODO: move all cursor coordinate translate into CURSOR
					const cp0=ENV.toPaperXY(CURSOR.p0[0],CURSOR.p0[1]);
					const cp1=ENV.toPaperXY(CURSOR.p1[0],CURSOR.p1[1]);
					CANVAS.panLayer(LAYERS.active,cp0[0]-cp1[0],cp0[1]-cp1[1]);
					LAYERS.active.setImageDataInvalid(); // merge with clip mask
					/**
					 * **NOTE** here, only se the imagedata invalid:
					 */
					CANVAS.requestRefresh();
					// @TODO: now after layer recomposition the raw data is cropped by canvas viewport
					// This happens at top/left
					lastAction=2;
				}
			}
			else{
				CURSOR.isDragging=false;
			}
		}
		else{ // is drawing
			CURSOR.isDragging=false;
			CANVAS.stroke();
			lastAction=3;
		}
	}
	else{
		lastAction=-1;
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

CURSOR.updateAppearance=function(k){
	if(CURSOR.updateAppearance.setBusy._isBusy){ // is busy has the highest priority
		return;
	}
	let appearance;
	if(k!==undefined){
		appearance=k; // default!
	}
	else if(EVENTS.key.shift){
		appearance=1;
	}
	else if(EVENTS.key.ctrl){
		appearance=2;
	}
	else if(!CANVAS.drawSuccessful&&CURSOR.isDown){
		appearance=3;
	}
	else{
		appearance=0;
	}
	
	if(CURSOR.updateAppearance.lastAppearance==appearance){ // no need to change
		return;
	}
	
	switch(appearance){
		default:
		case 0: // normal: no cursor
			$("#canvas-area-panel").css("cursor","none");
			$("#brush-cursor").css("display","block");
			break;
		case 1: // moving
			$("#canvas-area-panel").css("cursor","move");
			$("#brush-cursor").css("display","none");
			break;
		case 2: // dragging
			$("#canvas-area-panel").css("cursor","alias");
			$("#brush-cursor").css("display","none");
			break;
		case 3: // disabling
			$("#canvas-area-panel").css("cursor","not-allowed");
			$("#brush-cursor").css("display","none");
			break;
	}
	CURSOR.updateAppearance.lastAppearance=appearance;
}
CURSOR.updateAppearance.lastAppearance=0; // allowed
CURSOR.updateAppearance.setBusy=function(isBusy){
	CURSOR.updateAppearance.setBusy._isBusy=isBusy;
	
	if(isBusy){
		$("#canvas-area-panel").css("cursor","wait");
		$("#brush-cursor").css("display","none");
		CURSOR.updateAppearance.lastAppearance=-1; // set apprearance to invalid
	}
	else{
		CURSOR.updateAppearance();
	}
}

/**
 * Disable cursor data
 */
CURSOR.disableCursor=function(){
	CURSOR.p0=[NaN,NaN,NaN];
	CURSOR.p1=[NaN,NaN,NaN];
	CANVAS.updateCursor(CURSOR.p0);
};

/**
 * Cursor appearance
 */
CURSOR.hideCursor=function(){
	if(CURSOR.isShown){
		CURSOR.isShown=false;
	}
	$("#brush-cursor-layer").css("display","none");
	CURSOR.disableCursor();
};
CURSOR.showCursor=function(){
	if(!CURSOR.isShown){
		CURSOR.isShown=true;
	}
	$("#brush-cursor-layer").css("display","block");
};

/**
 * Cursor click control
 */

CURSOR.down=function(event){
	if(!CURSOR.isDown){
		CURSOR.isDown=true;
		//CURSOR.type=event.originalEvent.pointerId;
	}
}

CURSOR.up=function(event){
	if(CURSOR.isDown&&(
		CURSOR.type==event.originalEvent.pointerType // on the target leave
		||CURSOR.type===null)){ // on init
		CURSOR.isDown=false;
		CURSOR.isDragging=false; // stop dragging
		//CURSOR.type=NaN;
	}
}