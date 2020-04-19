EVENTS.initHotKeys=function(){
	// History Operations
	EventDistributer.key.addListener("ctrl+z",e=>{HISTORY.undo();});
	EventDistributer.key.addListener("ctrl+shift+z",e=>{HISTORY.redo();});
	EventDistributer.key.addListener("ctrl+y",e=>{HISTORY.redo();});

	// Brush Operations
	EventDistributer.key.addListener("[",e=>{BrushManager.changeActiveBrushSizeBy(-1);});
	EventDistributer.key.addListener("]",e=>{BrushManager.changeActiveBrushSizeBy(+1);});

	// paper transform operation
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
}