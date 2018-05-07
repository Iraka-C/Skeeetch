EVENTS={};

EVENTS.isShiftDown=false;
EVENTS.isCtrlDown=false;
EVENTS.isAltDown=false;

EVENTS.init=function(){
	$("html").on("contextmenu",()=>false);
	$(window).on("resize",()=>{
		ENV.window.SIZE.width=$("#canvas_window").width();
		ENV.window.SIZE.height=$("#canvas_window").height();
		ENV.refreshTransform();
		CURSOR.refreshBrushLayerSize();
	});

	$("html").on("keydown",EVENTS.onKeyDown);
	$("html").on("keyup",EVENTS.onKeyUp);

	$("#canvas_window").on("pointerover",CURSOR.showCursor);
	$("#canvas_window").on("pointermove",event=>{
		CURSOR.moveCursor(event);
		if(CURSOR.isDown){
			if(EVENTS.isShiftDown){ // pan
				ENV.translateDrag();
			}
			else{ // draw
				CANVAS.drawLine();
			}
		}
	});
	$("#canvas_window").on("pointerout",CURSOR.hideCursor);

	// DOWN / UP outside the window
	$("html").on("pointerdown",event=>{
		CANVAS.setCanvasEnvironment(event);
		CURSOR.pointerDown();
	});
	$("html").on("pointerup",event=>{
		CURSOR.moveCursor(event);
		if(!EVENTS.isShiftDown){ // end of the line
			CANVAS.drawLine();
		}
		CURSOR.pointerUp(event);
	});

	/*var events=[
		"pointerover","pointerdown","pointermove",
		"MSPointerOver","MSPointerDown","MSPointerMov",
		"pointerup","pointerout","pointercancel",
		"MSPointerUp","MSPointerOut","MSPointerCancel"
	];*/

	$("#scale_info").on("wheel",ENV.scaleScroll);
	$("#rotate_info").on("wheel",ENV.rotateScroll);

	$("#brush_type").on("click",ENV.shiftBrush);
	$("#brush_size").on("wheel",BRUSHES.changeNowBrushSize);

	$("#palette_menus").on("wheel",PALETTE.changeBrightnessEvent);
};

EVENTS.onKeyDown=function(event){
	if(event.shiftKey==1&&EVENTS.isShiftDown==false){
		// Shift Pressed
		EVENTS.isShiftDown=true;
	}
	if(event.ctrlKey==1&&EVENTS.isCtrlDown==false){
		// Ctrl Pressed
		EVENTS.isCtrlDown=true;
	}
	if(event.altKey==1&&EVENTS.isAltDown==false){
		// Alt Pressed
		EVENTS.isAltDown=true;
	}
};

EVENTS.onKeyUp=function(event){
	if(event.shiftKey==0&&EVENTS.isShiftDown==true){
		// Shift Left
		EVENTS.isShiftDown=false;
	}
	if(event.ctrlKey==0&&EVENTS.isCtrlDown==true){
		// Ctrl Left
		EVENTS.isCtrlDown=false;
	}
	if(event.altKey==0&&EVENTS.isAltDown==true){
		// Alt Left
		EVENTS.isAltDown=false;
	}
};
