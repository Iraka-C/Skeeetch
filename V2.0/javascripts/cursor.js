/**
 * Pointer cursor / event manager
 */

CURSOR={};

// present position: (x,y,pressure)
// The posistion is relative to the #canvas-window
CURSOR.point=[NaN,NaN,NaN];
CURSOR.isDown=false; //is the pointer pressed on screen

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

	// $("#brush_cursor_round").attr({
	// 	"cx":CURSOR.x,
	// 	"cy":CURSOR.y,
	// 	"r":ENV.nowPen.size*ENV.window.scale/2
	// });
};

/**
 * Disable cursor data
 */
CURSOR.disableCursor=function(){
	CURSOR.point=[NaN,NaN,NaN];
	CANVAS.updateCursor(CURSOR.point);
};

CURSOR.hideCursor=function(){
	//$("#brush_cursor_layer").css("display","none");
	CURSOR.disableCursor();
};