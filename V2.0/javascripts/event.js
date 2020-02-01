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
	 * // Browser action
	 */

	/**
	 * @TODO: touch event / multitouch support
	 */

	// disable pen long press => context menu
	$(window).on("contextmenu",e=>false);

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
		const oE=event.originalEvent;
		if((oE.buttons>>1)&1){ // 2^1==2, right button doesn't move cursor
			return;
		}

		CURSOR.showCursor(); // pen->mouse switching
		CURSOR.moveCursor(event);
	});
	$("#canvas-window").on("pointerout",()=>{
		// disable cursor
		CURSOR.hideCursor(); // pen away
	});

	// do sth to each menu panel
	const menuPanels=$("#masked-panel").find(".setting-panel");
	const eachMenuPanelFunc=function(callback){ // callback($el)
		menuPanels.each(function(){callback($(this));});
	}
	// DOWN / UP outside the window
	$(window).on("pointerdown",event=>{
		/**
			0 : No button or un-initialized
			1 : Primary button (usually the left button)
			2 : Secondary button (usually the right button)
			4 : Auxilary button (usually the mouse wheel button or middle button)
			8 : 4th button (typically the "Browser Back" button)
			16: 5th button (typically the "Browser Forward" button)
		 */
		const oE=event.originalEvent;
		if((oE.buttons>>1)&1){ // 2^1==2, right button
			const pix=CANVAS.pickColor(oE.offsetX,oE.offsetY);
			PALETTE.setRGB(pix.slice(0,3));
			PALETTE.drawPalette();
			PALETTE.setCursor();
			return;
		}
		CURSOR.moveCursor(event);
		CURSOR.down(event);
		eachMenuPanelFunc($el=>$el.css("pointer-events","none")); // do not enable menu operation
		CANVAS.setCanvasEnvironment(event); // init canvas here
	});
	$(window).on("pointerup",event=>{
		// no need to paint the last event because there's no pressure info (=0)
		if(event.target==$("#canvas-window")[0]){
			// on canvas
			CURSOR.moveCursor(event);
		}
		CURSOR.up(event);
		// if(event.originalEvent.pointerType=="touch"){ // on touch up, at the same time, out
		// 	CURSOR.hideCursor();
		// }
		CANVAS.strokeEnd();
		eachMenuPanelFunc($el=>$el.css("pointer-events","all")); // after stroke, enable menus
	});
	// When menus enabled, disable canvas operation
	// This also disables drawing on canvas when the cursor moves out of the menu part
	eachMenuPanelFunc($el=>$el.on("pointerdown",e=>e.stopPropagation()));

	// Scroll on canvas
	EventDistributer.wheel.addListener($("#canvas-layers-panel"),(dy,dx)=>{ // Scroll
		if(EVENTS.key.alt){ // Alt pressed, zoom
			let newS=SettingHandler.updateScale(dy,ENV.window.scale);
			ENV.scaleTo(newS);
			$("#scale-info-input").val(Math.round(newS*100));
		}
		else if(EVENTS.key.shift){ // Shift pressed, pan horizontally
			let newTx=ENV.window.trans.x-dy*10;
			let newTy=ENV.window.trans.y-dx*10;
			ENV.translateTo(newTx,newTy);
		}
		else{ // normal pan
			let newTx=ENV.window.trans.x-dx*10;
			let newTy=ENV.window.trans.y-dy*10;
			ENV.translateTo(newTx,newTy);
		}
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
		event.preventDefault(); // prevent browser menu
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