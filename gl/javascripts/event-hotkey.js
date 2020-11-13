EVENTS.initHotKeys=function() {
	// History Operations
	EventDistributer.key.addListener("ctrl+z",e => {HISTORY.undo();});
	EventDistributer.key.addListener("ctrl+shift+z",e => {HISTORY.redo();});
	EventDistributer.key.addListener("ctrl+y",e => {HISTORY.redo();});

	// Brush Operations
	EventDistributer.key.addListener("[",e => {BrushManager.changeActiveBrushSizeBy(-1);});
	EventDistributer.key.addListener("]",e => {BrushManager.changeActiveBrushSizeBy(+1);});

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

	// Save
	EventDistributer.key.addListener("ctrl+s",e => { // Save in browser
		FILES.savePaperAction();
	});
	EventDistributer.key.addListener("ctrl+shift+s",e => { // Save as psd
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
		const items=(event.clipboardData||event.originalEvent.clipboardData).items;
		// TODO: same as file, deal with multiple files
		for(const v in items){
			const item=items[v];
			if(item.kind=="file") {
				const file=item.getAsFile(); // get file object from data transfer object
				if(file.type&&file.type.match(/image*/)) { // an image file
					window.URL=window.URL||window.webkitURL;
					const img=new Image();
					img.src=window.URL.createObjectURL(file);
					img.filename="";
					img.onload=function(e) {
						FILES.loadAsImage(this);
					}
					break; // only deal with one
				}
			}
		}
	});

	$(window).on("copy",event=>{
		const imgData=LAYERS.active.rawImageData; // copy only this node
		// Must be a context2d canvas for Blob
		// copy only valid area
		const canvas=CANVAS.renderer.getContext2DCanvasFromImageData(imgData,imgData.validArea);
		canvas.toBlob(blob => { // Only Context2D can be safely changed into blob
			const item=new ClipboardItem({"image/png":blob});
			navigator.clipboard.write([item]);
		});
	});

	$(window).on("cut",event=>{
		const imgData=LAYERS.active.rawImageData;
		const canvas=CANVAS.renderer.getContext2DCanvasFromImageData(imgData,imgData.validArea);
		canvas.toBlob(blob => { // Only Context2D can be safely changed into blob
			const item=new ClipboardItem({"image/png":blob});
			navigator.clipboard.write([item]);
		});

		// at the mean time... clear this layer, if it has contents
		if(LAYERS.active instanceof CanvasNode){
			if(CANVAS.clearAll()){ // successfully cleared
				STORAGE.FILES.saveContentChanges(CANVAS.nowLayer);
			}
		}
	});
}