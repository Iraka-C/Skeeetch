EVENTS.initHotKeys=function(){
	// History Operations
	EventDistributer.key.addListener("ctrl+z",e=>{HISTORY.undo();});
	EventDistributer.key.addListener("ctrl+shift+z",e=>{HISTORY.redo();});
	EventDistributer.key.addListener("ctrl+y",e=>{HISTORY.redo();});

	// Brush Operations
	EventDistributer.key.addListener("[",e=>{BrushManager.changeActiveBrushSizeBy(-1);});
	EventDistributer.key.addListener("]",e=>{BrushManager.changeActiveBrushSizeBy(+1);});

	// paper transform operation, for wacom boards
	EventDistributer.key.addListener("alt+f13",e=>{
		let newA=(ENV.window.rot+5)%360;
		if(newA<0)newA+=360; // 0 to 360
		if(newA>180)newA-=360; // -180 to 180
		ENV.rotateTo(newA);
		$("#rotate-info-input").val(Math.round(ENV.window.rot));
	});
	EventDistributer.key.addListener("alt+f14",e=>{
		let newA=(ENV.window.rot-5)%360;
		if(newA<0)newA+=360; // 0 to 360
		if(newA>180)newA-=360; // -180 to 180
		ENV.rotateTo(newA);
		$("#rotate-info-input").val(Math.round(ENV.window.rot));
	});

	// Save
	EventDistributer.key.addListener("ctrl+s",e=>{ // Save in browser
		EventDistributer.footbarHint.showInfo("Saving all contents ...");
		const layerTreeStr=STORAGE.FILES.saveLayerTree();
		STORAGE.FILES.saveLayerTreeInDatabase(layerTreeStr); // update structure in database
		STORAGE.FILES.saveAllContents(); // update contents in database
		STORAGE.FILES.updateCurrentThumb(); // update thumb in database
	});
	EventDistributer.key.addListener("ctrl+shift+s",e=>{ // Save as psd
		EventDistributer.footbarHint.showInfo("Rendering ...");
		ENV.taskCounter.startTask(1); // start PSD task
		setTimeout(FILES.saveAsPSD,1000);
	});
}