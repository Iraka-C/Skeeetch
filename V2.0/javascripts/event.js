/**
 * Handle all settings on whole body & canvas area
 */

EVENTS={};

EVENTS.key={
	ctrl:false,
	shift:false,
	alt:false
};

EVENTS.init=function(){
	/**
	 * @TODO: stylus won't drag on layer panel
	 */
	
	/**
	 * @TODO: Bug! after stylus draw the canvas won't zoom on scroll
	 */

	/**
	 * @TODO: touch event / multitouch support
	 */


	//$("html").on("contextmenu",e=>false);

	/**
	 * Window resize handler
	 */
	$(window).on("resize",event=>{
		ENV.window.SIZE.width=$("#canvas-window").width();
		ENV.window.SIZE.height=$("#canvas-window").height();
		ENV.refreshTransform();
		//CURSOR.refreshBrushLayerSize();
		$("#brush-cursor-layer").attr({
			width:ENV.window.SIZE.width,
			height:ENV.window.SIZE.height
		});
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
	$(window).on("pointerdown",event=>{
		CURSOR.down(event);
		$("#brush-menu-panel").css("pointer-events","none"); // do not enable menu operation
		$("#settings-menu-panel").css("pointer-events","none");
		CANVAS.setCanvasEnvironment(event); // init canvas here
	});
	$(window).on("pointerup",event=>{
		// no need to paint the last event because there's no pressure info (=0)
		if(event.target==$("#canvas-window")[0]){
			// on canvas
			CURSOR.moveCursor(event);
		}
		CURSOR.up(event);
		CANVAS.strokeEnd();
		$("#brush-menu-panel").css("pointer-events","all"); // after stroke, enable menus
		$("#settings-menu-panel").css("pointer-events","all");
	});
	// When menus enabled, disable canvas operation
	// This also disables drawing on canvas when the cursor moves out of the menu part
	$("#brush-menu-panel").on("pointerdown",event=>event.stopPropagation());
	$("#settings-menu-panel").on("pointerdown",event=>event.stopPropagation());

	// Scroll on canvas
	EventDistributer.wheel.addListener($("#canvas-layers-panel"),(dy,dx)=>{ // Scroll
		let newTx=ENV.window.trans.x-dx*10;
		let newTy=ENV.window.trans.y-dy*10;
		ENV.translateTo(newTx,newTy);
	});

	$(window).on("keydown",EVENTS.keyDown);
	$(window).on("keyup",EVENTS.keyUp);
}

// keyboard down handler
EVENTS.keyDown=function(event){
	let shift=event.shiftKey==1;
	let ctrl=event.ctrlKey==1;
	let alt=event.altKey==1;
	let functionKeyChanged=false;

	if(shift&&!EVENTS.key.shift){ // long pressing a key may fire several events
		EVENTS.key.shift=true;
		functionKeyChanged=true;
		// change cursor
		$("#canvas-area-panel").css("cursor","move");
		$("#brush-cursor").css("display","none");
	}
	if(ctrl&&!EVENTS.key.ctrl){
		EVENTS.key.ctrl=true;
		functionKeyChanged=true;
	}
	if(alt&&!EVENTS.key.alt){
		EVENTS.key.alt=true;
		functionKeyChanged=true;
	}

	if(functionKeyChanged){ // shift|ctrl|alt pressed
		// more actions related to key changed?
		EventDistributer.footbarHint.update();
	}
}

// keyboard up handler
EVENTS.keyUp=function(event){
	let shift=event.shiftKey==1;
	let ctrl=event.ctrlKey==1;
	let alt=event.altKey==1;
	let functionKeyChanged=false;

	if(!shift&&EVENTS.key.shift){ // long pressing a key may fire several events
		EVENTS.key.shift=false;
		functionKeyChanged=true;
		// change cursor
		$("#canvas-area-panel").css("cursor","none");
		$("#brush-cursor").css("display","block");
	}
	if(!ctrl&&EVENTS.key.ctrl){
		EVENTS.key.ctrl=false;
		functionKeyChanged=true;
	}
	if(!alt&&EVENTS.key.alt){
		EVENTS.key.alt=false;
		functionKeyChanged=true;
	}

	if(functionKeyChanged){ // shift|ctrl|alt leave
		EventDistributer.footbarHint.update();
	}
}