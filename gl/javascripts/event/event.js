/**
 * Handle all settings on whole body & canvas area
 */

EVENTS={};

EVENTS.key={
	ctrl: false,
	shift: false,
	alt: false,
	space: false
};

EVENTS.isCursorInHysteresis=false; // hysteresis sign for canvas drawing

EVENTS.init=function() {
	/**
	 * @TODO: touch event / multitouch support
	 */

	// also disable pen long press => context menu
	if(!LOGGING){
		$(window).on("contextmenu",e => false);
	}

	// ============ Auto File saving related ==============
	let isNotSavedOnExit=false;
	$(window).on("blur",e => {
		//console.log(isUnloadTriggered);

		if(ENV.displaySettings.isAutoSave) {
			EventDistributer.footbarHint.showInfo("Saving contents ...");
			STORAGE.FILES.requestSaveContentChanges();
			isNotSavedOnExit=false;
		}
		// This is also triggered when clicking "yes, unload" !
		// else if(isUnloadTriggered){ // return after an unload attempt
		// 	EventDistributer.footbarHint.showInfo("Saving all contents ...");
		// 	STORAGE.FILES.saveLayerTree();
		// 	STORAGE.FILES.saveAllContents();
		// 	isUnloadTriggered=false;
		// }
	});
	$(window).on("beforeunload",e => {
		//isUnloadTriggered=true;
		// see STORAGE.SETTING.saveAllSettings
		STORAGE.saveOnExit();
		const isUnsavedExist=STORAGE.FILES.isUnsaved();
		if(ENV.taskCounter.isWorking()||isUnsavedExist) { // there are works to do
			if(isUnsavedExist){ // there are unsaved (and modified) files
				isNotSavedOnExit=true;
			}
			// show promp window
			e.preventDefault();
			return "";
		}
	});
	$("#canvas-area-panel").on("pointerleave",event => {
		// const offset=$("#canvas-area-panel").offset();
		// const w=$("#canvas-area-panel").width();
		// const h=$("#canvas-area-panel").height();
		// let dX=offset.left+w-event.originalEvent.clientX;
		// let dY=offset.top+h-event.originalEvent.clientY;
		// console.log("Pointer left at "+dX+" "+dY);

		if(!CURSOR.isDown&&event.originalEvent.relatedTarget) { // moving to other blocks
			STORAGE.FILES.requestSaveContentChanges();
		}
	});
	// ============= Cursor related ==============
	const $canvasWindow=$("#canvas-window");
	/**
	 * Window resize handler
	 */
	$(window).on("resize",event => {
		ENV.window.SIZE.width=$canvasWindow.width();
		ENV.window.SIZE.height=$canvasWindow.height();
		ENV.refreshTransform();
		PALETTE.refreshUIParam(); // for palette selector
	});

	// Tidy the logic here: better if only use over/move/out. Do not use down/up
	$canvasWindow.on("pointerover",event => {
		if(!CURSOR.isDown&&event.originalEvent.buttons&0x3) { // left/right
			CANVAS.setCanvasEnvironment();
			CURSOR.down(event); // also considered as down
			eachMenuPanelFunc($el => $el.css("pointer-events","none"));
		}

		CURSOR.setIsShown(true);
		CURSOR.updateAction(event); // provide an action
	});
	
	let cntAfterUp=0; // Hysteresis of pointer up
	let isStrokeEnded=true;
	function endStroke(){ // end a down-move-up sequence
		EVENTS.isCursorInHysteresis=false; // cancel hysteresis count
		isStrokeEnded=true;
		cntAfterUp=0;
		CANVAS.strokeEnd();
		eachMenuPanelFunc($el => $el.css("pointer-events","all")); // after stroke, enable menus
	}

	$canvasWindow.on("pointermove",event => {
		CURSOR.setIsShown(true); // pen->mouse switching
		CURSOR.updateAction(event); // still registering right button: change to movecursor?
		CURSOR.moveCursor(event); // may be stroke or pan

		if(EVENTS.isCursorInHysteresis){ // add a count
			cntAfterUp++;
			if(cntAfterUp==3){
				// hysteresis ends, 3 is a good value for pen radius attenuation.
				//console.log("End hyst");
				endStroke(); // end after hysteresis
			}
		}
	});
	$canvasWindow.on("pointerout",event => {
		CURSOR.setIsShown(false); // pen away, disable cursor
		EVENTS.isCursorInHysteresis=false; // cancel the count
		cntAfterUp=0;
	});

	// do sth to each menu panel
	const menuPanels=$("#menu-panel").find(".setting-panel");
	menuPanels.push($("#bottom-info-panel")[0]); // also add footnotes into
	const eachMenuPanelFunc=callback => { // callback($el)
		menuPanels.each(function() {
			callback($(this));
		});
	}
	// DOWN / UP outside the window
	$canvasWindow.on("pointerdown",event => {
		/**
			0 : No button or un-initialized
			1 : Primary button (usually the left button)
			2 : Secondary button (usually the right button)
			4 : Auxilary button (usually the mouse wheel button or middle button)
			8 : 4th button (typically the "Browser Back" button)
			16: 5th button (typically the "Browser Forward" button)
		 */
		if(event.originalEvent.buttons&0x8){ // 4th button
			HISTORY.undo(); // perform as undo
			return;
		}
		if(event.originalEvent.buttons&0x10){ // 5th button
			HISTORY.redo(); // perform as redo
			return;
		}

		if(cntAfterUp==0){ // not in hysteresis state, init canvas
			CANVAS.setCanvasEnvironment(); // init canvas here
			eachMenuPanelFunc($el => $el.css("pointer-events","none")); // do not enable menu operation
		}
		isStrokeEnded=false; // one down-move-up sequence not ended
		CURSOR.down(event);
		CURSOR.updateAction(event); // doesn't change the action
		CURSOR.moveCursor(event);
		EVENTS.isCursorInHysteresis=false;
		cntAfterUp=0; // reset count
	});
	$(window).on("pointerup",event => {
		if(event.originalEvent.which==1){
			// Although event.originalEvent.which is not recommended
			// is it always 1 when left clicked
			if(event.target==$canvasWindow[0]) { // left pointer up on canvas
				EVENTS.isCursorInHysteresis=true; // start count moves after up
				//CURSOR.moveCursor(event);
			}
			else{ // outside canvas, end this stroke
				if(!isStrokeEnded){ // stroking
					//console.log("End outside canvas");
					endStroke();
				}
			}
		}
		
		CURSOR.up(event);
		// if(event.originalEvent.pointerType=="touch"){ // on touch up, at the same time, out
		// 	CURSOR.hideCursor();
		// }

		//CANVAS.strokeEnd(); // handled by hysteresis
		CURSOR.updateAction(event);

	});
	// When menus enabled, disable canvas operation
	// block all event only to this menu level
	// This also disables drawing on canvas when the cursor moves out of the menu part
	eachMenuPanelFunc($el => $el.on("pointerdown",e => e.stopPropagation()));

	// Scroll on canvas
	EventDistributer.wheel.addListener($("#canvas-layers-panel"),(dy,dx) => { // Scroll
		if(EVENTS.key.alt||EVENTS.key.ctrl) { // normal pan
			let newTx=ENV.window.trans.x-dx*10;
			let newTy=ENV.window.trans.y-dy*10;
			ENV.translateTo(newTx,newTy);
		}
		else if(EVENTS.key.shift) { // Shift pressed, pan horizontally
			let newTx=ENV.window.trans.x-dy*10;
			let newTy=ENV.window.trans.y-dx*10;
			ENV.translateTo(newTx,newTy);
		}
		else { // no key: zoom
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
EVENTS.keyDown=function(event) {
	let shift=event.shiftKey==1;
	let ctrl=event.ctrlKey==1;
	let alt=event.altKey==1;
	let functionKeyChanged=false;

	if(shift&&!EVENTS.key.shift) { // long pressing a key may fire several events
		EVENTS.key.shift=true;
		functionKeyChanged=true;
		// change cursor on panning whole canvas
		CURSOR.updateAction();
	}
	if(ctrl&&!EVENTS.key.ctrl) {
		EVENTS.key.ctrl=true;
		functionKeyChanged=true;
		// change cursor on panning layer
		CURSOR.updateAction();
	}
	if(alt&&!EVENTS.key.alt) {
		EVENTS.key.alt=true;
		functionKeyChanged=true;
		// change cursor on picking color
		CURSOR.updateAction();
		$("#palette-selector").css("cursor","crosshair");
		event.preventDefault(); // prevent browser menu
	}

	if(event.originalEvent.key==" "&&!EVENTS.key.space){ // space
		EVENTS.key.space=true;
	}

	if(functionKeyChanged) { // shift|ctrl|alt pressed
		// more actions related to key changed?
		EventDistributer.footbarHint.update();
	}
}

// keyboard up handler
EVENTS.keyUp=function(event) {
	let shift=event.shiftKey==1;
	let ctrl=event.ctrlKey==1;
	let alt=event.altKey==1;
	let functionKeyChanged=false;

	if(!shift&&EVENTS.key.shift) { // long pressing a key may fire several events
		EVENTS.key.shift=false;
		functionKeyChanged=true;
		CURSOR.updateAction();
	}
	if(!ctrl&&EVENTS.key.ctrl) {
		EVENTS.key.ctrl=false;
		functionKeyChanged=true;
		CURSOR.updateAction();
	}
	if(!alt&&EVENTS.key.alt) {
		EVENTS.key.alt=false;
		functionKeyChanged=true;
		CURSOR.updateAction();
		$("#palette-selector").css("cursor","default");
		event.preventDefault(); // prevent browser menu
	}

	if(event.originalEvent.key==" "&&EVENTS.key.space){ // space
		EVENTS.key.space=false;
	}

	if(functionKeyChanged) { // shift|ctrl|alt leave
		EventDistributer.footbarHint.update();
	}
}

// disable the selections in <input>
EVENTS.disableInputSelection=function($input) {
	let ci=$input[0];
	ci.addEventListener("select",event => {
		ci.selectionStart=ci.selectionEnd;
	},false);
}