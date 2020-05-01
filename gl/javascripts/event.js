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
	 * @TODO: touch event / multitouch support
	 */

	// disable pen long press => context menu
	//$(window).on("contextmenu",e=>false);

	// let isWindowBlurred=false;
	// $(window).on("blur focus",e=>{
	// 	isWindowBlurred=(e.type=="blur"); // or "focus"
	// 	/**
	// 	 * @TODO:
	// 	 * set the page title
	// 	 * also: set title when renaming the page
	// 	 * save imagedata on blur is a good idea.
	// 	 */
		
	// 	const htmlEtt=ENV.escapeHTML($("#filename-input").val());
	// 	if(isWindowBlurred){
	// 		$("title").html("&bull;&nbsp;"+htmlEtt);
	// 	}
	// 	else{
	// 		$("title").html(htmlEtt);
	// 	}
	// });
	$(window).on("beforeunload",e=>{
		// see STORAGE.SETTING.saveAllSettings
		STORAGE.saveOnExit();
		if(STORAGE.FILES.isUnsaved()){ // there are unsaved items
			// show promp window
			e.preventDefault();
			return "";
		}
	});

	const $canvasWindow=$("#canvas-window");
	/**
	 * Window resize handler
	 */
	$(window).on("resize",event=>{
		ENV.window.SIZE.width=$canvasWindow.width();
		ENV.window.SIZE.height=$canvasWindow.height();
		ENV.refreshTransform();
		$("#brush-cursor-layer").attr({
			width:ENV.window.SIZE.width,
			height:ENV.window.SIZE.height
		});
	});

	// Tidy the logic here: better if only use over/move/out. Do not use down/up
	$canvasWindow.on("pointerover",event=>{
		if(!CURSOR.isDown&&event.originalEvent.buttons&0x3){ // left/right
			CANVAS.setCanvasEnvironment();
			CURSOR.down(event); // also considered as down
			eachMenuPanelFunc($el=>$el.css("pointer-events","none"));
		}
		
		CURSOR.setIsShown(true);
		CURSOR.updateAction(event); // provide an action
	});
	$canvasWindow.on("pointermove",event=>{
		CURSOR.setIsShown(true); // pen->mouse switching
		CURSOR.updateAction(event); // still registering right button: change to movecursor?
		CURSOR.moveCursor(event); // may be stroke or pan
	});
	$canvasWindow.on("pointerout",event=>{
		CURSOR.setIsShown(false); // pen away, disable cursor
		if(!CURSOR.isDown){ // not down and away: may be trying to close the window!
			setTimeout(e=>{ // try to save at once
				// Try to save the contents
				STORAGE.FILES.requestSaveContentChanges();
			},0);
		}
	});

	// do sth to each menu panel
	const menuPanels=$("#menu-panel").find(".setting-panel");
	menuPanels.push($("#bottom-info-panel")[0]); // also add footnotes into
	const eachMenuPanelFunc=callback=>{ // callback($el)
		menuPanels.each(function(){
			callback($(this));
		});
	}
	// DOWN / UP outside the window
	$canvasWindow.on("pointerdown",event=>{
		/**
			0 : No button or un-initialized
			1 : Primary button (usually the left button)
			2 : Secondary button (usually the right button)
			4 : Auxilary button (usually the mouse wheel button or middle button)
			8 : 4th button (typically the "Browser Back" button)
			16: 5th button (typically the "Browser Forward" button)
		 */
		CANVAS.setCanvasEnvironment(); // init canvas here
		CURSOR.down(event);
		CURSOR.updateAction(event); // doesn't change the action
		CURSOR.moveCursor(event);
		eachMenuPanelFunc($el=>$el.css("pointer-events","none")); // do not enable menu operation
	});
	$(window).on("pointerup",event=>{
		if(event.target==$canvasWindow[0]){
			// on canvas
			CURSOR.moveCursor(event);
		}
		CURSOR.up(event);
		// if(event.originalEvent.pointerType=="touch"){ // on touch up, at the same time, out
		// 	CURSOR.hideCursor();
		// }
		CANVAS.strokeEnd();
		CURSOR.updateAction(event);
		eachMenuPanelFunc($el=>$el.css("pointer-events","all")); // after stroke, enable menus
	});
	// When menus enabled, disable canvas operation
	// This also disables drawing on canvas when the cursor moves out of the menu part
	eachMenuPanelFunc($el=>$el.on("pointerdown",e=>e.stopPropagation()));

	// Scroll on canvas
	EventDistributer.wheel.addListener($("#canvas-layers-panel"),(dy,dx)=>{ // Scroll
		if(EVENTS.key.alt||EVENTS.key.ctrl){ // normal pan
			let newTx=ENV.window.trans.x-dx*10;
			let newTy=ENV.window.trans.y-dy*10;
			ENV.translateTo(newTx,newTy);
		}
		else if(EVENTS.key.shift){ // Shift pressed, pan horizontally
			let newTx=ENV.window.trans.x-dy*10;
			let newTy=ENV.window.trans.y-dx*10;
			ENV.translateTo(newTx,newTy);
		}
		else{ // no key: zoom
			// Alt menu cannot be prevented in Firefox
			// zooming center is the cursor
			let newS=SettingHandler.updateScale(dy,ENV.window.scale); // 0.1~8.0 clamped
			const cursorX=CURSOR.p0[0];
			const cursorY=CURSOR.p0[1];
			const W2=ENV.window.SIZE.width/2;
			const H2=ENV.window.SIZE.height/2;
			const dX=ENV.window.trans.x+W2-cursorX;
			const dY=ENV.window.trans.y+H2-cursorY;
			const k=newS/ENV.window.scale;
			const newX=cursorX+dX*k-ENV.window.SIZE.width/2;
			const newY=cursorY+dY*k-ENV.window.SIZE.height/2;
			ENV.transformTo(newX,newY,ENV.window.rot,newS);
			$("#scale-info-input").val(Math.round(newS*100));

		}
	});

	$(window).on("keydown",EVENTS.keyDown);
	$(window).on("keyup",EVENTS.keyUp);
	EVENTS.initHotKeys();
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
		// change cursor on panning whole canvas
		CURSOR.updateAction();
	}
	if(ctrl&&!EVENTS.key.ctrl){
		EVENTS.key.ctrl=true;
		functionKeyChanged=true;
		// change cursor on panning layer
		CURSOR.updateAction();
	}
	if(alt&&!EVENTS.key.alt){
		EVENTS.key.alt=true;
		functionKeyChanged=true;
		// change cursor on picking color
		CURSOR.updateAction();
		$("#palette-selector").css("cursor","crosshair");
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
		CURSOR.updateAction();
	}
	if(!ctrl&&EVENTS.key.ctrl){
		EVENTS.key.ctrl=false;
		functionKeyChanged=true;
		CURSOR.updateAction();
	}
	if(!alt&&EVENTS.key.alt){
		EVENTS.key.alt=false;
		functionKeyChanged=true;
		CURSOR.updateAction();
		$("#palette-selector").css("cursor","default");
		event.preventDefault(); // prevent browser menu
	}

	if(functionKeyChanged){ // shift|ctrl|alt leave
		EventDistributer.footbarHint.update();
	}
}

// disable the selections in <input>
EVENTS.disableInputSelection=function($input){
	let ci=$input[0];
	ci.addEventListener("select",event=>{
		ci.selectionStart=ci.selectionEnd;
	},false);
}