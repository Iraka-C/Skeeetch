CURSOR={};
// According to the left-top of canvas_window !
CURSOR.x=Number.NAN; // now movement
CURSOR.y=Number.NAN;
CURSOR.pressure=0;
CURSOR.x1=Number.NAN; // last movement
CURSOR.y1=Number.NAN;
CURSOR.pressure1=0;
CURSOR.isDown=false;

CURSOR.init=function(){
	CURSOR.refreshBrushLayerSize();
	$("#brush_cursor_round").attr("stroke",PALETTE.getColorString());
};

CURSOR.refreshBrushLayerSize=function(){
	$("#brush_cursor_layer").attr({
		"width":ENV.window.SIZE.width,
		"height":ENV.window.SIZE.height
	});
};

CURSOR.showCursor=function(event){
	CURSOR.moveCursor(event);
	$("#brush_cursor_layer").css("display","block");
};
CURSOR.moveCursor=function(event){
	CURSOR.x1=CURSOR.x; // last movement
	CURSOR.y1=CURSOR.y;
	CURSOR.pressure1=CURSOR.pressure;

	CURSOR.x=event.originalEvent.layerX; // new movement
	CURSOR.y=event.originalEvent.layerY;
	CURSOR.pressure=event.originalEvent.pressure;
	
	CANVAS.updateCursor(CURSOR.x,CURSOR.y,CURSOR.pressure);

	$("#brush_cursor_round").attr({
		"cx":CURSOR.x,
		"cy":CURSOR.y,
		"r":ENV.nowPen.size*ENV.window.scale/2
	});
};
CURSOR.hideCursor=function(){
	$("#brush_cursor_layer").css("display","none");
	CURSOR.x=Number.NAN; // now movement
	CURSOR.y=Number.NAN;
	CURSOR.pressure=0;
	CURSOR.x1=Number.NAN; // last movement
	CURSOR.y1=Number.NAN;
	CURSOR.pressure1=0;
	CANVAS.updateCursor(Number.NAN,Number.NAN,0);
};

CURSOR.pointerDown=()=>{
	//console.log("DOWN");
	CURSOR.isDown=true;
};
CURSOR.pointerUp=()=>{
	//console.log("UP");
	CURSOR.isDown=false;
};
