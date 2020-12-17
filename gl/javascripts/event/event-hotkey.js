EVENTS.initHotKeys=function() {
	// History Operations
	EventDistributer.key.addListener("ctrl+KeyZ",e => {HISTORY.undo();});
	EventDistributer.key.addListener("ctrl+shift+KeyZ",e => {HISTORY.redo();});
	EventDistributer.key.addListener("ctrl+KeyY",e => {HISTORY.redo();});

	// Brush Operations
	EventDistributer.key.addListener("BracketLeft",e => {BrushManager.changeActiveBrushSizeBy(-1);});
	EventDistributer.key.addListener("BracketRight",e => {BrushManager.changeActiveBrushSizeBy(+1);});

	// paper transform operation, for wacom boards
	EventDistributer.key.addListener("alt+f13",e => {
		let newA=(ENV.window.rot+5)%360;
		if(newA<0) newA+=360; // 0 to 360
		if(newA>180) newA-=360; // -180 to 180
		ENV.rotateTo(newA);
		$("#rotate-info-input").val(Math.round(ENV.window.rot));
	});
	EventDistributer.key.addListener("alt+f14",e => {
		let newA=(ENV.window.rot-5)%360;
		if(newA<0) newA+=360; // 0 to 360
		if(newA>180) newA-=360; // -180 to 180
		ENV.rotateTo(newA);
		$("#rotate-info-input").val(Math.round(ENV.window.rot));
	});
	EventDistributer.key.addListener("home",ENV.setTransformToWindowSize); // reset paper position

	// Save
	EventDistributer.key.addListener("ctrl+KeyS",e => { // Save in browser
		FILES.savePaperAction();
	});
	EventDistributer.key.addListener("ctrl+shift+KeyS",e => { // Save as psd
		EventDistributer.footbarHint.showInfo("Rendering ...");
		ENV.taskCounter.startTask(1); // start PSD task
		setTimeout(e=>{
			FILES.saveAsPSD().then(isSuccess=>{
				ENV.taskCounter.finishTask(1); // finish PSD task
			})
		},500); // for animation
	});

	// Layers
	EventDistributer.key.addListener("tab",e=>{LAYERS.setNextActive();});
	EventDistributer.key.addListener("shift+tab",e=>{LAYERS.setPrevActive();});
	EventDistributer.key.addListener("pagedown",e=>{LAYERS.setNextActive();});
	EventDistributer.key.addListener("pageup",e=>{LAYERS.setPrevActive();});

	EventDistributer.key.addListener("delete",e=>{ // clear
		// canvas layer and not locked
		if(!(LAYERS.active instanceof LayerGroupNode)&&!LAYERS.active.isLocked()){
			LAYERS.clearCurrentLayer();
		}
	});

	// New paper. No way to override ctrl+N
	// Mysterious BUG: using this hot key will cause multiple new layers being created
	// EventDistributer.key.addListener("ctrl+;",e => { // new paper
	// 	FILES.newPaperAction();
	// 	if(FILES.fileManager.isExpanded()){ // if is expanded
	// 		// close it
	// 		FILES.fileManager.toggleExpand();
	// 	}
	// },true);
	// ============================ Ctrl+X/C/V ================================
	$(window).on("paste",event=>{
		CLIPBOARD.paste(
			(event.clipboardData||event.originalEvent.clipboardData).items,
			EVENTS.key.space
		);
	});

	$(window).on("copy",event=>{
		const activeNode=LAYERS.active;
		const prop=activeNode.getProperties();
		CLIPBOARD.copy(activeNode.rawImageData,prop); // copy only this node
	});
	$(window).on("cut",event=>{ // Ctrl+X or Shift+Delete
		const activeNode=LAYERS.active;
		const prop=activeNode.getProperties();
		const isSuccessful=CLIPBOARD.copy(activeNode.rawImageData,prop);
		if(isSuccessful){ // successfully copied
			// at the mean time... clear this layer, if it has contents
			if(LAYERS.active instanceof CanvasNode){
				if(LAYERS.active.isOpacityLocked()){ // locked, do not clear
					return;
				}
				const validArea={...activeNode.rawImageData.validArea};
				if(CANVAS.clearAll()){ // successfully cleared
					HISTORY.addHistory({ // add raw image data changed history
						type:"image-data",
						id:activeNode.id,
						area:validArea // whole image
					});
					STORAGE.FILES.saveContentChanges(activeNode);
				}
			}
		}
	});
}

EVENTS.initBrushHotKeys=function(){ // after BrushManager initializd
	const brushHotKeyMap=new Map(); // brush-hotkey -> brush-id(String)/brush-proto(Number)

	function removeHotKey(brush){
		if(!brush)return;
		brushHotKeyMap.delete(brush.hotKey);
		brush.hotKey=null;
	}

	function setHotKey(brush,key){
		if(brush.hotKey){ // remove first
			removeHotKey(brush);
		}
		brushHotKeyMap.set(key,brush.id||brush.proto);
		brush.hotKey=key;
	}

	for(const brush of BrushManager.brushes){ // default brushes
		if(brush.hotKey){
			brushHotKeyMap.set(brush.hotKey,brush.proto);
		}
	}
	for(const brush of BrushManager.customBrushes){ // custom brushes
		if(brush.hotKey){
			brushHotKeyMap.set(brush.hotKey,brush.id);
		}
	}

	// Create Brush hotkey handlers
	EventDistributer.key.addListener("shift+any",e=>{ // set
		const code=e.originalEvent.code.toLowerCase();
		const brushToSet=BrushManager.activeBrush;
		const key=code.charAt(code.length==4?3:5); // keyX or digitX
		if(brushHotKeyMap.has(key)){ // already possessed
			// remove first
			const brushID=brushHotKeyMap.get(key);
			const brush=(typeof(brushID)=="string"?
				BrushManager.brushHash.get(brushID): // custom id
				BrushManager.brushes[brushID] // proto
			);
			if(!brush)brushHotKeyMap.delete(key); // deleted
			if(brush==brushToSet)return; // same brush
			removeHotKey(brush);
		}
		// set new hot key
		setHotKey(brushToSet,key);
		EventDistributer.footbarHint.showInfo(Lang("hot-key-set")(key.toUpperCase(),brushToSet.name));
	},false); // do not prevent default on input

	EventDistributer.key.addListener("shift+slash",e=>{ // Shift+/ to unbind
		removeHotKey(BrushManager.activeBrush);
		EventDistributer.footbarHint.showInfo(Lang("hot-key-cancel")(BrushManager.activeBrush.name));
	},false);

	EventDistributer.key.addListener("any",e=>{ // fire
		const code=e.originalEvent.code.toLowerCase();
		const key=code.charAt(code.length==4?3:5); // keyX or digitX

		const brushID=brushHotKeyMap.get(key);
		if(brushID===undefined)return; // no brush
		const brush=(typeof(brushID)=="string"?
			BrushManager.brushHash.get(brushID): // custom id
			BrushManager.brushes[brushID] // proto
		);
		if(!brush){ // brush deleted
			brushHotKeyMap.delete(key);
			return;
		}
		BrushManager.setActiveBrush(brush);
	},false); // do not prevent default on input
}