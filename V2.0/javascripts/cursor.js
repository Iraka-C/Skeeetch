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
CURSOR.id=null;
CURSOR.eventIdList=["","",""]; // a list to record now id

/**
 * @TODO: fix brush moving delay (change svg into canvas?)
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

	if(!CURSOR.isDown
	 &&CURSOR.eventIdList[2]==CURSOR.eventIdList[1]
	 &&CURSOR.eventIdList[1]==type){ // same and not drawing
		CURSOR.id=type;
	}
	if(CURSOR.id!=type){ // not the present id, no moving
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
	if(CURSOR.isDown){
		if(EVENTS.key.shift){ // shift pressed
			let dx=CURSOR.p0[0]-CURSOR.p1[0];
			let dy=CURSOR.p0[1]-CURSOR.p1[1];
			if(!isNaN(dx)){ // all available
				let newTx=ENV.window.trans.x+dx;
				let newTy=ENV.window.trans.y+dy;
				ENV.translateTo(newTx,newTy);
			}
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
}

CURSOR.updateColor=function(){
	$("#brush-cursor-round").attr({
		stroke:PALETTE.getColorString()
	});
	$("#brush-cursor-outer").attr({
		stroke:PALETTE.hsv[2]>150?"#00000022":"#ffffff22"
	});
}

/**
 * Disable cursor data
 */
CURSOR.disableCursor=function(){
	CURSOR.p0=[NaN,NaN,NaN];
	CURSOR.p1=[NaN,NaN,NaN];
	CANVAS.updateCursor(CURSOR.p0);
};

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

CURSOR.down=function(event){
	
	if(!CURSOR.isDown){
		CURSOR.isDown=true;
		//CURSOR.id=event.originalEvent.pointerId;
	}
}

CURSOR.up=function(event){
	if(CURSOR.isDown&&(
		CURSOR.id==event.originalEvent.pointerType // on the target leave
		||CURSOR.id===null)){ // on init
		CURSOR.isDown=false;
		//CURSOR.id=NaN;
	}
}