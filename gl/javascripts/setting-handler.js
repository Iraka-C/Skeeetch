/**
 * Handle the actions when settings changes
 */
"use strict";
const SettingHandler={};

SettingHandler.init=function(sysParams) {
	SettingHandler.initTitle();
	SettingHandler.initTransformHandler();
	const sys=SettingHandler.initSystemSetting(sysParams);
	SettingHandler.sysMenu=sys;
	sys.update();
}

/**
 * Init the file name input (title) actions and the page title
 */
SettingHandler.initTitle=function() {
	const $titleInput=$("#filename-input");
	$titleInput.on("change",event => { // Input
		const newName=$titleInput.val();
		$("title").text(newName);
		FILES.fileSelector.changeFileNameByFileID(ENV.fileID,newName); // set fileList and selector
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
			let newA=ENV.window.rot;
			if(EVENTS.key.shift){ // shift: round to 15 deg
				newA=Math.round(newA/5)*5-dw*5;
			}
			else{
				newA-=dw;
			}
			// mod to -180~180
			if(newA>180) newA-=360;
			if(newA<=-180) newA+=360;
			newA=Math.round(newA); // only int
			ENV.rotateTo(newA);
		},
		(dx,oldVal) => { // drag update
			let newA=((+oldVal)+dx)%360;// string to number
			if(EVENTS.key.shift){ // shift: round to 15 deg
				newA=Math.round(newA/15)*15;
			}
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
			let newS;
			if(EVENTS.key.shift){ // round to power 2
				const b2=Math.log2(ENV.window.scale);
				newS=Math.pow(2,Math.round(b2+dw)).clamp(0.125,8.0);
			}
			else{
				newS=SettingHandler.updateScale(dw,ENV.window.scale);
			}

			ENV.scaleTo(newS);
		},
		(dx,oldVal) => { // drag update
			let newS=+oldVal;
			if(EVENTS.key.shift){ // round to power 2
				const b2=Math.log2(newS/100);
				newS=Math.pow(2,Math.round(b2+dx/15)).clamp(0.125,8.0);
			}
			else{
				newS=SettingHandler.updateScale(dx/2,newS/100); // string to number
			}
			ENV.scaleTo(newS);
		},
		() => $scale.val(Math.round(ENV.window.scale*100))
	);

	// Reset all transform
	$("#reset-info").click(event => {
		ENV.setTransformToWindowSize();
	});
	EventDistributer.footbarHint($("#reset-info"),() => Lang("Reset paper position"));

	// set flip
	const $flipButton=$("#flip-info");
	$flipButton.click(event => {
		ENV.setFlip(!ENV.window.flip);
		$flipButton.html(ENV.window.flip? "&rlarr;":"&lrarr;");
		$flipButton.css("color",ENV.window.flip? "#0ff":"");
	});
	EventDistributer.footbarHint($flipButton,() => Lang("Flip display horizontally"));

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

	SettingHandler.$report=sys.addDiv();

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
		for(const k in LAYERS.layerHash) { // Redraw all layers
			const layer=LAYERS.layerHash[k];
			if(layer instanceof CanvasNode) {
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
		PERFORMANCE.animationFpsCounter.reset();
	},() => ENV.displaySettings.antiAlias? 0:1);
	sys.addSwitch(Lang("Transform Animation"),[Lang("On"),Lang("Off")],null,val => {
		switch(val) {
			case 1: ENV.setTransformAnimation(false); break;
			default: ENV.setTransformAnimation(true); break;
		}
		PERFORMANCE.animationFpsCounter.reset();
	},() => ENV.displaySettings.enableTransformAnimation? 0:1);
	// UI Orientation handled in other display preferences
	/*sys.addSwitch(Lang("UI Orientation"),[Lang("ui-left"),Lang("ui-right")],null,val => {
		switch(val) {
			case 1: ENV.setUIOrientation(false); break;
			default: ENV.setUIOrientation(true); break;
		}
	},() => ENV.displaySettings.uiOrientationLeft? 0:1);*/
	sys.addSwitch(Lang("UI Theme"),[Lang("ui-light"),Lang("ui-dark")],null,val => {
		switch(val) {
			case 1: ENV.setUITheme("dark"); break;
			default: ENV.setUITheme("light"); break;
		}
	},() => ENV.displaySettings.uiTheme=="dark"? 1:0);
	sys.addButton(Lang("toggle-fullscreen"),() => {
		if(document.fullscreenEnabled){ // For Chrome/Firefox/Edge
			if(!document.fullscreenElement) {
				document.documentElement.requestFullscreen();
			}
			else {
				if(document.exitFullscreen) {
					document.exitFullscreen();
				}
			}
		}
		else if(document.webkitFullscreenEnabled){ // For Safari
			if(!document.webkitFullscreenElement) {
				document.documentElement.webkitRequestFullscreen();
			}
			else {
				if(document.webkitExitFullscreen) {
					document.webkitExitFullscreen();
				}
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

	// ===================== System Information =======================
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
		PERFORMANCE.getDriveEstimation().then(val => {
			const usage=val/1024/1024;
			callback(usage.toFixed(usage>2000? 0:1));
		});
	});
	// ===================== System Limits =======================
	sys.addSectionTitle(Lang("sys-lim"));
	sys.addInstantNumberItem(Lang("sys-max-vram"),() => {
		const mVRAM=ENV.displaySettings.maxVRAM/1073741824; // 1024^3
		return mVRAM.toFixed(1);
	},"GB",
		newVal => { // set on input
			const newMem=newVal-0;
			if(newMem>=1&&newMem<=32) { // at least 1GB, at most 32GB
				ENV.displaySettings.maxVRAM=newMem*1073741824;
				vramLimitUpdateFunc(true);
			}
		},
		(dW,oldVal) => { // set on scroll, nothing
		},
		(dx,oldVal) => { // set on drag-x, nothing
		}
	);
	const vramLimitUpdateFunc=sys.addHint(Lang("vram-limit-hint"));
	vramLimitUpdateFunc(false); // invisible at start

	// fps limiter. It it impossible to measure rendering time in WebGL1.0 due to safety reasons
	// see https://www.vusec.net/projects/glitch/
	sys.addSwitch(Lang("sys-max-fps"),[Lang("sys-fps-auto"),Lang("sys-fps-unlimited"),"60","30","12"],Lang("fps"),val => {
		ENV.displaySettings.maxFPS=[0,65536,60,30,12][val];
	},() => {
		switch(ENV.displaySettings.maxFPS){
			case 12: return 4;
			case 30: return 3;
			case 60: return 2;
			case 0: return 0;
			default: return 1;
		}
	});

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
	sys.addSwitch(Lang("FPS Monitor"),[Lang("Off"),Lang("On"),Lang("EM Curve")],null,val => {
		if(val==1){ // on
			PERFORMANCE.FPSMonitor.init();
		}
		else{ // off
			PERFORMANCE.FPSMonitor.close();
		}

		if(val==2){ // on
			PERFORMANCE.fpsController.show();
		}
		else{ // off
			PERFORMANCE.fpsController.hide();
		}
	}); // Off at first

	// ================= Skeeetch info =================
	sys.addSectionTitle(Lang("About Skeeetch"));
	sys.addInfo(Lang("Version"),null,() => ENV.version);
	sys.addButton(Lang("skeeetch-page"),()=>{ // the page for help (readme)
		window.open(Lang("skeeetch-page-url"));
	});
	const $infoDiv=sys.addDiv();
	$infoDiv.css("font-size","80%");
	$infoDiv.html(Lang("about-skeeetch"));

	sys.setOpenButton($("#system-button"));
	return sys;
}