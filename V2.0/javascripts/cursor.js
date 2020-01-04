/**
 * Pointer cursor / event manager
 */

CURSOR={};

// present position: (x,y,pressure)
// The posistion is relative to the #canvas-window
CURSOR.point=[NaN,NaN,NaN];
CURSOR.isShown=false; // is the pointer visible
CURSOR.isDown=false; //is the pointer pressed on screen

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
	
	CURSOR.point=[ // new movement
		event.originalEvent.offsetX,
		event.originalEvent.offsetY,
		event.originalEvent.pressure
	];
	/**
	 * @TODO: updating while pen is not down seems fluent
	 */
	/*if(CURSOR.isDown){ // only update on down
		CANVAS.updateCursor(CURSOR.point);
	}*/
	CANVAS.updateCursor(CURSOR.point);

	$("#brush-cursor-round").attr({
		"cx":CURSOR.point[0],
		"cy":CURSOR.point[1],
		"r":BrushManager.activeBrush.size*ENV.window.scale/2
	});
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
	CANVAS.updateCursor(CURSOR.point);
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