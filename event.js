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
				ENV.translateDrag(event);
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
		ENV.dragInit={x:event.originalEvent.offsetX,y:event.originalEvent.offsetY};
		ENV.dragTransInit={x:ENV.window.trans.x,y:ENV.window.trans.y};
		CURSOR.pointerDown();
	});
	$("html").on("pointerup",event=>{
		if(event.target==$("#canvas_window")[0]){ // on canvas
			CURSOR.moveCursor(event);
			if(!EVENTS.isShiftDown){ // end of the line
				CANVAS.drawLine();
			}
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
	$("#canvas_window").on("wheel",ENV.scaleScroll);
	$("#rotate_info").on("wheel",ENV.rotateScroll);

	// reset
	$("#scale_info").on("click",()=>{
		$("#scale_info").html("100%");
		ENV.scaleTo(1);
	});
	$("#rotate_info").on("click",()=>{
		$("#rotate_info").html("0&deg;");
		ENV.rotateTo(0);
	});

	$("#brush_type").on("click",ENV.shiftBrush);
	$("#brush_size").on("wheel",BRUSHES.changeNowBrushSize);

	$("#palette_menus").on("wheel",PALETTE.changeBrightnessEvent);
	$("#palette_menus").on("click",()=>{
		var pp=$("#palette_panel");
		pp.css("height",pp.height()?"0px":PALETTE.panelHeight+"px");
	});
};

EVENTS.onKeyDown=function(event){
	if(event.shiftKey==1&&EVENTS.isShiftDown==false){
		// Shift Pressed
		EVENTS.isShiftDown=true;
		// Special: Translation DRAG
		ENV.dragInit={x:CURSOR.x,y:CURSOR.y};
		ENV.dragTransInit={x:ENV.window.trans.x,y:ENV.window.trans.y};
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
