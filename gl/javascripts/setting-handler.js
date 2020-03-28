/**
 * Handle the actions when settings changes
 */

SettingHandler={};
SettingHandler.tempPaperSize={
	width:0,
	height:0
};

SettingHandler.init=function(){
	SettingHandler.initTransformHandler();
	let sys=SettingHandler.initSystemSetting();
	sys.update();
}


/**
 * @TODO: fix this function
 */
// init the transform handlers on the right-bottom
SettingHandler.initTransformHandler=function(){
	// rotate input
	const $rotate=$("#rotate-info-input");
	EVENTS.disableInputSelection($rotate);
	SettingManager.setInputInstantNumberInteraction(
		$rotate,$("#rotate-info"),
		newVal=>{ // input update
			newVal-=0; // string to number
			if(isNaN(newVal)){ // not a number, return initial rotation
				return;
			}
			let newA=newVal%360;
			if(newA<0)newA+=360; // 0 to 360
			if(newA>180)newA-=360; // -180 to 180
			ENV.rotateTo(newA);
		},
		(dw,oldVal)=>{ // scroll update
			let newA=ENV.window.rot+dw;
			// mod to -180~180
			if(newA>180)newA-=360;
			if(newA<=-180)newA+=360;
			newA=Math.round(newA); // only int
			ENV.rotateTo(newA);
		},
		(dx,oldVal)=>{ // drag update
			let newA=(oldVal-0)+dx; // string to number
			// mod to -180~180
			if(newA>180)newA-=360;
			if(newA<=-180)newA+=360;
			newA=Math.round(newA); // only int
			ENV.rotateTo(newA);
		},
		()=>$rotate.val(Math.round(ENV.window.rot))
	);

	// scaling input
	// The ENV accept 0.1~8 while functions return 10%~800%
	// Scale factor: 10% to 800%
	// Scale modify factor in changeScaleOnScroll()
	const $scale=$("#scale-info-input");
	EVENTS.disableInputSelection($scale);
	SettingManager.setInputInstantNumberInteraction(
		$scale,$("#scale-info"),
		newVal=>{ // input update
			newVal-=0; // string to number
			if(isNaN(newVal)){ // not a number, return initial rotation
				return;
			}
			let newS=newVal.clamp(10,800);
			ENV.scaleTo(newS/100);
		},
		(dw,oldVal)=>{ // scroll update
			let newS=SettingHandler.updateScale(dw,ENV.window.scale);
			ENV.scaleTo(newS);
		},
		(dx,oldVal)=>{ // drag update
			let newS=SettingHandler.updateScale(dx/2,(oldVal-0)/100); // string to number
			ENV.scaleTo(newS);
		},
		()=>$scale.val(Math.round(ENV.window.scale*100))
	);
	
	// Reset all transform
	$("#reset-info").click(event=>{
		let k1=ENV.window.SIZE.width/ENV.paperSize.width;
		let k2=ENV.window.SIZE.height/ENV.paperSize.height;
		let k=(Math.min(k1,k2)*0.8).clamp(0.1,8.0);
		ENV.transformTo(0,0,0,k);
		$scale.val(Math.round(k*100));
		$rotate.val("0");
	});
	EventDistributer.footbarHint($("#reset-info"),()=>Lang("Reset paper position"));
}

// Decide the new scaling factor when adding one step
SettingHandler.updateScale=function(dS,oldVal){
	const scaleFactor=0.05;
	let newS=Math.exp(Math.log(oldVal)+scaleFactor*dS);
	return newS.clamp(0.1,8.0); // mod to 0.1~8.0
}

// ====================== system settings =========================
SettingHandler.initSystemSetting=function(){
	let sys=new SettingManager($("#settings-menu-panel"),Lang("System"));
	sys.addSectionTitle(Lang("Renderer"));
	sys.addSwitch(Lang("Render Method"),["16","8"],Lang("bit"),val=>{
		CANVAS.settings.method=val+2;
		CANVAS.setTargetCanvas(CANVAS.nowCanvas);
	});

	// Workspace/paper setting
	sys.addSectionTitle(Lang("workspace-title"));
	sys.addInstantNumberItem(
		Lang("Paper Width"),()=>SettingHandler.tempPaperSize.width,Lang("px"),
		newVal=>{ // set on input
			newVal-=0;
			if(newVal){
				newVal=newVal.clamp(16,4096);
				SettingHandler.tempPaperSize.width=newVal;
			}
		},
		(dW,oldVal)=>{ // set on scroll
			let newVal=(SettingHandler.tempPaperSize.width+dW*20).clamp(16,4096);
			SettingHandler.tempPaperSize.width=newVal;
		},
		(dx,oldVal)=>{ // set on drag-x
			let newVal=Math.round((oldVal-0)+dx).clamp(16,4096);
			SettingHandler.tempPaperSize.width=newVal;
		}
	);
	sys.addInstantNumberItem(
		Lang("Paper Height"),()=>SettingHandler.tempPaperSize.height,Lang("px"),
		newVal=>{ // set on input
			newVal-=0;
			if(newVal){
				newVal=newVal.clamp(16,4096);
				SettingHandler.tempPaperSize.height=newVal;
			}
		},
		(dW,oldVal)=>{ // set on scroll
			let newVal=(SettingHandler.tempPaperSize.height+dW*20).clamp(16,4096);
			SettingHandler.tempPaperSize.height=newVal;
		},
		(dx,oldVal)=>{ // set on drag-x

			let newVal=Math.round((oldVal-0)+dx).clamp(16,4096);
			SettingHandler.tempPaperSize.height=newVal;
		}
	);
	EventDistributer.setClick($("#system-button"),event=>{ // refresh when open
		SettingHandler.tempPaperSize.width=ENV.paperSize.width;
		SettingHandler.tempPaperSize.height=ENV.paperSize.height;
	});
	sys.addHint(Lang("workspace-hint-1"));
	sys.addButton(Lang("Change Paper Size"),()=>{
		if(SettingHandler.tempPaperSize.width!=ENV.paperSize.width
		||SettingHandler.tempPaperSize.height!=ENV.paperSize.height){ // size changed
			ENV.setPaperSize(SettingHandler.tempPaperSize.width,SettingHandler.tempPaperSize.height);
		}
		sys.toggleExpand();
	});
	sys.addSwitch(Lang("Anti-Aliasing"),[Lang("On"),Lang("Off")],null,val=>{
		switch(val){
		case 1: ENV.setAntiAliasing(false);break;
		default: ENV.setAntiAliasing(true);break;
		}
	});


	sys.addSectionTitle(Lang("Display"));
	//sys.addHint(Lang("display-hint-1"));
	sys.addSwitch(Lang("Transform Animation"),[Lang("On"),Lang("Off")],null,val=>{
		switch(val){
		case 1: ENV.setTransformAnimation(false);break;
		default: ENV.setTransformAnimation(true);break;
		}
	});
	sys.addButton(Lang("toggle-fullscreen"),()=>{
		if(!document.fullscreenElement){
			document.documentElement.requestFullscreen();
		}
		else{
			if(document.exitFullscreen){
				document.exitFullscreen();
			}
		}
		sys.toggleExpand();
	});

	sys.addSectionTitle(Lang("Developers"));
	sys.addSwitch(Lang("Draw Layer Border"),[Lang("Off"),Lang("On")],null,val=>{
		switch(val){
		case 1: PERFORMANCE.debugger.isDrawingLayerBorder=true;break;
		default: PERFORMANCE.debugger.isDrawingLayerBorder=false;break;
		}
		for(const k in LAYERS.layerHash){ // Redraw all layers
			const layer=LAYERS.layerHash[k];
			if(layer instanceof CanvasNode){
				layer.setImageDataInvalid();
			}
		}
		CANVAS.requestRefresh(); // draw/erase the layer borders
	}); // Off at first

	sys.setOpenButton($("#system-button"));

	sys.addSectionTitle(Lang("sys-info"));
	sys.addInfo(Lang("sys-mem"),"MB",()=>{
		const mem=PERFORMANCE.getMemoryEstimation();
		return mem.toFixed(mem>2000?0:1);
	});

	return sys;
}