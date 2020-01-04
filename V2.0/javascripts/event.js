/**
 * Handle all settings on whole body & canvas area
 */

EVENTS={};

EVENTS.init=function(){
	/**
	 * @TODO: stylus won't drag on layer panel
	 */
	
	/**
	 * @TODO: Bug! after stylus draw the canvas won't zoom on scroll
	 */
	//$("html").on("contextmenu",()=>false);

	/**
	 * Window resize handler
	 */
	$(window).on("resize",event=>{
		ENV.window.SIZE.width=$("#canvas-window").width();
		ENV.window.SIZE.height=$("#canvas-window").height();
		ENV.refreshTransform();
		//CURSOR.refreshBrushLayerSize();
	});

	$("#canvas-window").on("pointerover",event=>{
		//CURSOR.showCursor(event);
	});
	$("#canvas-window").on("pointermove",event=>{
		CURSOR.moveCursor(event);
		if(CURSOR.isDown){
			CANVAS.stroke();
		}
	});
	$("#canvas-window").on("pointerout",()=>{
		// continue record drawing, so commented out
		//CURSOR.isDown=false;
		//CANVAS.updateCursor([NaN,NaN,0]);
		// disable cursor
	});

	// DOWN / UP outside the window
	$("html").on("pointerdown",event=>{
		CURSOR.isDown=true;
		CANVAS.setCanvasEnvironment(event);
	});
	$("html").on("pointerup",event=>{ // @TODO: check up and move at the same point?
		if(event.target==$("#canvas-window")[0]){ // on canvas
			CURSOR.moveCursor(event);
			CANVAS.stroke();
		}
		CURSOR.isDown=false;
		CANVAS.updateCursor([NaN,NaN,0]);
	});
}