/**
 * Handle the actions when settings changes
 */

SettingHandler={};

SettingHandler.init=function(sysParams) {
	SettingHandler.initTitle();
	SettingHandler.initTransformHandler();
	let sys=SettingHandler.initSystemSetting(sysParams);
	sys.update();
}

/**
 * Init the file name input (title) actions and the page title
 */
SettingHandler.initTitle=function() {
	const $titleInput=$("#filename-input");
	$titleInput.on("change",event => { // Input
		$("title").text($titleInput.val());
	});
}


// init the transform handlers on the right-bottom
SettingHandler.initTransformHandler=function() {
	// rotate input
	const $rotate=$("#rotate-info-input");
	EVENTS.disableInputSelection($rotate);
	SettingManager.setInputInstantNumberInteraction(
		$rotate,$("#rotate-info"),
		newVal => { // input update
			newVal-=0; // string to number
			if(isNaN(newVal)) { // not a number, return initial rotation
				return;
			}
			let newA=newVal%360;
			if(newA<0) newA+=360; // 0 to 360
			if(newA>180) newA-=360; // -180 to 180
			ENV.rotateTo(newA);
		},
		(dw,oldVal) => { // scroll update
			let newA=ENV.window.rot+dw;
			// mod to -180~180
			if(newA>180) newA-=360;
			if(newA<=-180) newA+=360;
			newA=Math.round(newA); // only int
			ENV.rotateTo(newA);
		},
		(dx,oldVal) => { // drag update
			let newA=(oldVal-0)+dx; // string to number
			// mod to -180~180
			if(newA>180) newA-=360;
			if(newA<=-180) newA+=360;
			newA=Math.round(newA); // only int
			ENV.rotateTo(newA);
		},
		() => $rotate.val(Math.round(ENV.window.rot))
	);

	// scaling input
	// The ENV accept 0.1~8 while functions return 10%~800%
	// Scale factor: 10% to 800%
	// Scale modify factor in changeScaleOnScroll()
	const $scale=$("#scale-info-input");
	EVENTS.disableInputSelection($scale);
	SettingManager.setInputInstantNumberInteraction(
		$scale,$("#scale-info"),
		newVal => { // input update
			newVal-=0; // string to number
			if(isNaN(newVal)) { // not a number, return initial rotation
				return;
			}
			let newS=newVal.clamp(10,800);
			ENV.scaleTo(newS/100);
		},
		(dw,oldVal) => { // scroll update
			let newS=SettingHandler.updateScale(dw,ENV.window.scale);
			ENV.scaleTo(newS);
		},
		(dx,oldVal) => { // drag update
			let newS=SettingHandler.updateScale(dx/2,(oldVal-0)/100); // string to number
			ENV.scaleTo(newS);
		},
		() => $scale.val(Math.round(ENV.window.scale*100))
	);

	// Reset all transform
	const $flipButton=$("#flip-info");
	$("#reset-info").click(event => {
		const k1=ENV.window.SIZE.width/ENV.paperSize.width;
		const k2=ENV.window.SIZE.height/ENV.paperSize.height;
		const k=(Math.min(k1,k2)*0.8).clamp(0.1,8.0);
		ENV.setFlip(false);
		ENV.transformTo(0,0,0,k);
		$scale.val(Math.round(k*100));
		$rotate.val("0");
		$flipButton.html("&lrarr;");
		$flipButton.css("color","");
	});
	EventDistributer.footbarHint($("#reset-info"),() => Lang("Reset paper position"));

	// set flip
	$flipButton.click(event => {
		ENV.setFlip(!ENV.window.flip);
		$flipButton.html(ENV.window.flip? "&rlarr;":"&lrarr;");
		$flipButton.css("color",ENV.window.flip? "#0ff":"");
	});
	EventDistributer.footbarHint($flipButton,() => Lang("Flip paper horizontally"));

	// Undo/Redo
	$("#undo-info").click(event => {
		HISTORY.undo();
	});
	$("#redo-info").click(event => {
		HISTORY.redo();
	});
	EventDistributer.footbarHint($("#undo-info"),() => Lang("Undo one step"));
	EventDistributer.footbarHint($("#redo-info"),() => Lang("Redo one step"));
}

// Decide the new scaling factor when adding one step
SettingHandler.updateScale=function(dS,oldVal) {
	const scaleFactor=0.05;
	const newS=Math.exp(Math.log(oldVal)+scaleFactor*dS);
	return newS.clamp(0.1,8.0); // mod to 0.1~8.0
}

// ====================== system settings =========================
SettingHandler.initSystemSetting=function(sysParams) {

	let sys=new SettingManager($("#settings-menu-panel"),Lang("System"));
	sys.addSectionTitle(Lang("Renderer"));

	CANVAS.rendererBitDepth=sysParams.preference.channelBitDepth||CANVAS.rendererBitDepth;
	sys.addSwitch(Lang("Bit Depth"),["32","16","8"],Lang("bit"),val => { // require restart
		CANVAS.rendererBitDepth=[32,16,8][val];
		minSizeHintUpdateFunc(true);
	},() => CANVAS.rendererBitDepth==32? 0:CANVAS.rendererBitDepth==16? 1:2);
	let minSizeHintUpdateFunc=sys.addHint(Lang("render-bitdepth-hint"));
	minSizeHintUpdateFunc(false); // invisible at start
	
	sys.addSwitch(Lang("Opacity Blend"),[Lang("Intensity"),Lang("Neutral Color")],null,val => {
		switch(val) {
			case 1: ENV.displaySettings.blendWithNeutralColor=true; break;
			default: ENV.displaySettings.blendWithNeutralColor=false; break;
		}
		for(const k in LAYERS.layerHash){ // Redraw all layers
			const layer=LAYERS.layerHash[k];
			if(layer instanceof CanvasNode){
				layer.setImageDataInvalid();
			}
		}
		CANVAS.requestRefresh(); // recomposite layers with new blend mode
	},() => ENV.displaySettings.blendWithNeutralColor? 1:0);

	// Workspace/paper setting
	sys.addSectionTitle(Lang("Display"));
	sys.addSwitch(Lang("Anti-Aliasing"),[Lang("On"),Lang("Off")],null,val => {
		switch(val) {
			case 1: ENV.setAntiAliasing(false); break;
			default: ENV.setAntiAliasing(true); break;
		}
	},() => ENV.displaySettings.antiAlias? 0:1);
	sys.addSwitch(Lang("Transform Animation"),[Lang("On"),Lang("Off")],null,val => {
		switch(val) {
			case 1: ENV.setTransformAnimation(false); break;
			default: ENV.setTransformAnimation(true); break;
		}
	},() => ENV.displaySettings.enableTransformAnimation? 0:1);
	sys.addSwitch(Lang("UI Orientation"),[Lang("ui-left"),Lang("ui-right")],null,val => {
		switch(val) {
			case 1: ENV.setUIOrientation(false); break;
			default: ENV.setUIOrientation(true); break;
		}
	},() => ENV.displaySettings.uiOrientationLeft? 0:1);
	sys.addButton(Lang("toggle-fullscreen"),() => {
		if(!document.fullscreenElement) {
			document.documentElement.requestFullscreen();
		}
		else {
			if(document.exitFullscreen) {
				document.exitFullscreen();
			}
		}
		sys.toggleExpand();
	});

	// ======================= Palette Settings ==========================
	sys.addSectionTitle(Lang("palette-title"));
	sys.addSwitch(Lang("Color Selector"),[Lang("H-SV"),Lang("V-HS")],null,val => {
		PALETTE.changeColorSelector(val);
	},() => PALETTE.colorSelector? PALETTE.colorSelector.typeID:null);
	sys.addSwitch(Lang("Color Information"),[Lang("CIS-none"),Lang("Web Safe Color"),Lang("Web Named Color"),Lang("Pantone Color"),Lang("Named Color")],null,val => {
		PALETTE.changeColorInfoManager(val);
	},() => PALETTE.colorSelector? PALETTE.colorSelector.getColorInfoManager().typeID:null);

	// ======================== Debugging Settings ===========================
	sys.addSectionTitle(Lang("Developers"));
	sys.addSwitch(Lang("Draw Layer Border"),[Lang("Off"),Lang("On")],null,val => {
		switch(val) {
			case 1: PERFORMANCE.debugger.isDrawingLayerBorder=true; break;
			default: PERFORMANCE.debugger.isDrawingLayerBorder=false; break;
		}
		for(const k in LAYERS.layerHash) { // Redraw all layers
			const layer=LAYERS.layerHash[k];
			if(layer instanceof CanvasNode) {
				layer.setImageDataInvalid();
			}
		}
		CANVAS.requestRefresh(); // draw/erase the layer borders
	}); // Off at first

	sys.setOpenButton($("#system-button"));

	sys.addSectionTitle(Lang("sys-info"));
	sys.addInfo(Lang("sys-mem"),"MB",() => {
		const mem=PERFORMANCE.getRAMEstimation();
		return mem.toFixed(mem>2000? 0:1);
	});
	sys.addInfo(Lang("sys-gpumem"),"MB",() => {
		const mem=PERFORMANCE.getGPUMemEstimation();
		return mem.toFixed(mem>2000? 0:1);
	});
	sys.addInfo(Lang("sys-disk"),"MB",callback => {
		if(navigator.storage) {
			navigator.storage.estimate().then(est => {
				const usage=est.usage/1024/1024;
				//const quota=est.quota/1024/1024;
				//console.log("Total "+quota.toFixed(quota>2000?0:1)+" MB");
				callback(usage.toFixed(usage>2000? 0:1));
			});
		}
	});

	// ================= Skeeetch info =================
	sys.addSectionTitle(Lang("About Skeeetch"));
	sys.addInfo(Lang("Version"),null,()=>ENV.version);
	const $infoDiv=sys.addDiv();
	const aTag="a target='_blank' rel='noopener noreferrer'";
	$infoDiv.css("font-size","80%");
	$infoDiv.html(`
		This web app is designed and programmed by
		<${aTag} href='https://github.com/Iraka-C/Skeeetch'>Iraka-C</a>.<br>
		Distributed under <${aTag} href='https://github.com/Iraka-C/Skeeetch/blob/master/LICENSE.md'>Apache License 2.0</a>.
	`);

	return sys;
}