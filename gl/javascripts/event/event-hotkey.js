EVENTS.initHotKeys=function() {
	// History Operations
	EventDistributer.key.addListener("ctrl+KeyZ",e => {HISTORY.undo();});
	EventDistributer.key.addListener("ctrl+shift+KeyZ",e => {HISTORY.redo();});
	EventDistributer.key.addListener("ctrl+KeyY",e => {HISTORY.redo();});
	
	//EventDistributer.key.addListener("shift+any",e => {console.log(e.originalEvent.code);});

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
		setTimeout(FILES.saveAsPSD,500); // for show info animation
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