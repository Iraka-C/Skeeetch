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
		CURSOR.showCursor();
	});
	$("#canvas-window").on("pointermove",event=>{
		CURSOR.showCursor(); // pen->mouse switching
		CURSOR.moveCursor(event);
	});
	$("#canvas-window").on("pointerout",()=>{
		// continue record drawing, so commented out
		//CURSOR.isDown=false;
		//CANVAS.updateCursor([NaN,NaN,0]);
		// disable cursor
		CURSOR.hideCursor(); // pen away
	});

	// DOWN / UP outside the window
	$("html").on("pointerdown",event=>{
		CURSOR.down(event);
		CANVAS.setCanvasEnvironment(event); // init canvas here
	});
	$("html").on("pointerup",event=>{
		// no need to paint the last event because there's no pressure info (=0)
		if(event.target==$("#canvas-window")[0]){
			// on canvas
			CURSOR.moveCursor(event);
		}
		CURSOR.up(event);
	});
}