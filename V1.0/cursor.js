CURSOR={};
// According to the left-top of canvas_window !
CURSOR.x=Number.NAN; // now movement
CURSOR.y=Number.NAN;
CURSOR.pressure=0;
CURSOR.isDown=false;

CURSOR.init=function(){
	CURSOR.refreshBrushLayerSize();
	CURSOR.setColor();
};

CURSOR.setColor=function(){
	$("#brush_cursor_round").attr("stroke",PALETTE.getColorString());
}

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

	CURSOR.x=event.originalEvent.offsetX; // new movement
	CURSOR.y=event.originalEvent.offsetY;
	CURSOR.pressure=event.originalEvent.pressure;

	CANVAS.updateCursor(CURSOR.x,CURSOR.y,CURSOR.pressure);

	$("#brush_cursor_round").attr({
		"cx":CURSOR.x,
		"cy":CURSOR.y,
		"r":ENV.nowPen.size*ENV.window.scale/2
	});
};

CURSOR.disfuncCursor=function(){
	CURSOR.x=Number.NAN; // now movement
	CURSOR.y=Number.NAN;
	CURSOR.pressure=0;
	CANVAS.updateCursor(Number.NAN,Number.NAN,0);
};

CURSOR.hideCursor=function(){
	$("#brush_cursor_layer").css("display","none");
	CURSOR.disfuncCursor();
};

CURSOR.pointerDown=()=>{
	//console.log("DOWN");
	CURSOR.isDown=true;
};
CURSOR.pointerUp=()=>{
	//console.log("UP");
	CURSOR.isDown=false;
};
