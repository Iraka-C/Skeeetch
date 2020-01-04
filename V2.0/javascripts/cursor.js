/**
 * Pointer cursor / event manager
 */

CURSOR={};

// present position: (x,y,pressure)
// The posistion is relative to the #canvas-window
CURSOR.point=[NaN,NaN,NaN];
CURSOR.isShown=false; // is the pointer visible
CURSOR.isDown=false; //is the pointer pressed on screen
CURSOR.id=NaN;
CURSOR.eventIdList=["","",""]; // a list to record now id

/**
 * @TODO: fix brush moving delay (change svg into canvas?)
 */

CURSOR.init=function(){
	$("#brush-cursor-layer").attr({
		width:ENV.window.SIZE.width,
		height:ENV.window.SIZE.height
	});
	$("#brush-cursor-round").attr({
		stroke:PALETTE.getColorString()
	});
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

	CURSOR.point=[ // new movement
		event.originalEvent.offsetX,
		event.originalEvent.offsetY,
		type=="pen"?event.originalEvent.pressure:1 // 1 as default
	];
	CANVAS.updateCursor(CURSOR.point);

	$("#brush-cursor-round").attr({
		"cx":CURSOR.point[0],
		"cy":CURSOR.point[1],
		"r":BrushManager.activeBrush.size*ENV.window.scale/2
	});
	if(CURSOR.isDown){ // is drawing
		CANVAS.stroke();
	}
};

CURSOR.updateColor=function(str){
	$("#brush-cursor-round").attr({
		stroke:str
	});
}

/**
 * Disable cursor data
 */
CURSOR.disableCursor=function(){
	CURSOR.point=[NaN,NaN,NaN];
	CANVAS.updateCursor(CURSOR.point,NaN);
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
	//CURSOR.enableCursor();
};

CURSOR.down=function(event){
	if(!CURSOR.isDown){
		CURSOR.isDown=true;
		//CURSOR.id=event.originalEvent.pointerId;
	}
}

CURSOR.up=function(event){
	if(CURSOR.isDown&&CURSOR.id==event.originalEvent.pointerType){
		CURSOR.isDown=false;
		//CURSOR.id=NaN;
	}
}