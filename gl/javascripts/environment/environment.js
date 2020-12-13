/*
	Written By Iraka
	Environment handlers for Sketch platform
*/

ENV={}; // Environment
ENV.version="20201210";

//===================== Settings =====================

ENV.paperSize={width: 0,height: 0,diag: 0}; // diag == sqrt(x^2+y^2)
ENV.window={
	SIZE: {width: 0,height: 0}, // window size, unit: window pixel *** NOW READ ONLY! ***
	/**
	 * Transform of the paper canvas center related to the canvas window center
	 * all in window pixels (origin: canvas window center, x: left, y: down)
	 * order: trans -> rot CW(paper center) -> scale(paper center)
	 */
	trans: {x: 0,y: 0}, // paper center translate from the window center. unit: window pixel (y)v >(x)coordinate
	rot: 0.0, // 0 degree CW
	flip: false, // not flipped
	scale: 1.0, // not zoomed
	_transAnimation: { // translation control animation
		time: 1, // total time in s
		target: [0,0,0,1], // end point, [x,y,r,s]
		start: [0,0,0,1], // start point
		now: [0,0,0,1], // present status
		process: 1, // the processed animation part, 0~1
		isAnimationFired: false, // is animation running
		lastTime: 0 // last animation time, for stats
	}
};

ENV.displaySettings={ // These settings will be saved in localStorage
	antiAlias: true,
	enableTransformAnimation: true, // smooth animation when moving paper
	blendWithNeutralColor: true, // blend layers with neutral color filling under certain blend modes
	uiOrientationLeft: true, // UI flows from left->right: true
	uiTheme: "light", // UI is the "light"/"dark" theme
	isAutoSave: true, // Auto save files when modified in browser
	maxFps: Infinity, // 12, 30, 60, Infinity
	maxVRAM: 4*1024*1024*1024 // 4GB VRAM init
};
ENV.maxPaperSize=5600; // needn't save. Larger value cannot be represented by mediump in GLSL100

// File ID related properties
ENV.fileID=""; // present working file ID

// ========================= Functions ============================
ENV.init=function() { // When the page is loaded
	STORAGE.init(sysSettingParams => { // after loading all settings
		// Init language / browser environment
		ENV.fileID=sysSettingParams.nowFileID; // get file ID
		ENV.browserInfo=ENV.detectBrowser();

		LANG.init(sysSettingParams); // set all doms after load?
		SettingHandler.init(sysSettingParams); // load all setting handlers for the following initializations
		
		Object.assign(ENV.displaySettings,sysSettingParams.preference.displaySettings); // init display settings
		ENV.displaySettings.maxFps=ENV.displaySettings.maxFps||Infinity; // default value that cannot be saved
		ENV.setAntiAliasing(ENV.displaySettings.antiAlias); // set canvas css param
		ENV.taskCounter.init();

		// init event handlers
		EVENTS.init();
		EventDistributer.init();
		PALETTE.init(sysSettingParams);
		CURSOR.init();

		// init storage managers
		PERFORMANCE.init(ENV.displaySettings.maxVRAM);
		const lastLayerTreeJSON=STORAGE.FILES.getLayerTree();
		STORAGE.FILES.initLayerStorage(ENV.fileID); // load the layer database, file title already set BEFORE (ENV.setFileTitle)
		STORAGE.FILES.saveLayerTreeInDatabase(lastLayerTreeJSON); // update layer tree in database

		// init layers
		ENV.window.SIZE.width=$("#canvas-window").width();
		ENV.window.SIZE.height=$("#canvas-window").height();
		if(lastLayerTreeJSON){ // there is a saved file structure in local storage
			LOGGING&&console.log("Reading File...",lastLayerTreeJSON);
			ENV.setPaperSize(...lastLayerTreeJSON.paperSize);
			ENV.setFileTitle(lastLayerTreeJSON.title);
		}
		else{ // no layer yet, init CANVAS
			ENV.setPaperSize(window.screen.width,window.screen.height);
		}
		LAYERS.init(lastLayerTreeJSON); // load all layers

		// init accessories
		BrushManager.init(sysSettingParams);
		HISTORY.init();
		FILES.init();
		DIALOGBOX.init();
		DRAG.init();
		//GUIDELINE.init();

		ENV.setUIOrientation(ENV.displaySettings.uiOrientationLeft); // set UI orientation at init, after settings
		ENV.setUITheme(ENV.displaySettings.uiTheme); // set color theme
		//ENV.debug();

		// prevent pen-dragging in Firefox causing window freezing
		EVENTS.disableInputSelection($("#filename-input"));

		// Load all thumbs from 
		// clean up the unremoved database store
		// maybe because of failed deletion
		STORAGE.FILES.loadAllFileThumbs();
	});
};

ENV.detectBrowser=function(){
	const u=window.navigator.userAgent;
	const platform=window.navigator.platform;
	const app=window.navigator.appVersion;
	return{
		macOS:   app.indexOf('Mac') > -1,                             // MacOS system
		trident: u.indexOf('Trident') > -1,                           // IE core
		presto:  u.indexOf('Presto') > -1,                            // opera core
		webKit:  u.indexOf('AppleWebKit') > -1,                       // apple/google core
		gecko:   u.indexOf('Gecko') > -1 && u.indexOf('KHTML') == -1, // firefox core
		mobile:  !!u.match(/AppleWebKit.*Mobile.*/),                  // mobile device
		ios:     !!u.match(/\(i[^;]+;( U;)? CPU.+Mac OS X/),          // ios device
		android: u.indexOf('Android') > -1 || u.indexOf('Adr') > -1,  // android device
		iPhone:  u.indexOf('iPhone') > -1 ,                           // iPhone or QQHD browser
		iPad:    u.indexOf('iPad') > -1,                              // iPad
		webApp:  u.indexOf('Safari') == -1,                           // web app
		weixin:  u.indexOf('MicroMessenger') > -1,                    // msg (WeChat)
		qq:      u.match(/\sQQ/i) == " qq"                            // qq
	};
}

// ====================== Settings ========================
/**
 * upload css transform from ENV.window settings
 */
ENV.refreshTransform=function() {
	ENV.fireTransformAnimation([
		ENV.window.trans.x,
		ENV.window.trans.y,
		ENV.window.rot,
		ENV.window.scale
	]).then(()=>{ // after animation: setup drag points
		// If this promise is discarded before resolved
		// this will never be reached.
		if(DRAG.setNewPaperPoints&&DRAG.mode!="none"){ // update dragger layer
			DRAG.updateUI();
		}
	});
	if(ENV.displaySettings.antiAlias){ // update canvas anti-aliasing
		CANVAS.requestRefresh();
	}
	
	CURSOR.updateXYR();
};

/**
 * Set is the paper flipped
 */
ENV.setFlip=function(isFlip) {
	ENV.window.flip=isFlip;
	ENV.refreshTransform();
}

/**
 * Set the scale to ratio (default 1.0)
 * center at the window center
 */
ENV.scaleTo=function(ratio) {
	let s=ENV.window.scale;
	ENV.window.scale=ratio;
	let tr=ratio/s;
	ENV.window.trans.x*=tr;
	ENV.window.trans.y*=tr;
	ENV.refreshTransform();
};

/**
 * Set the rotation to angle (degree CW)
 * rotation center: window
 */
ENV.rotateTo=function(angle) { // degree
	let r=ENV.window.rot;
	ENV.window.rot=angle;
	let tx=ENV.window.trans.x;
	let ty=ENV.window.trans.y;

	let dr=(angle-r)/180*Math.PI;
	let Cr=Math.cos(dr);
	let Sr=Math.sin(dr);
	ENV.window.trans.x=Cr*tx-Sr*ty;
	ENV.window.trans.y=Sr*tx+Cr*ty;
	ENV.refreshTransform();
};

/**
 * set the translation from the screen center to (x,y) pixels
 */
ENV.translateTo=function(x,y) { // pixelated
	let borderSize=ENV.paperSize.diag*ENV.window.scale;
	if(Math.abs(x)>borderSize||Math.abs(y)>borderSize) {
		/**
		 * @TODO: better clamp for paper inside window
		 */
		x=x.clamp(-borderSize,borderSize);
		y=y.clamp(-borderSize,borderSize);
	}
	ENV.window.trans.x=x;
	ENV.window.trans.y=y;
	ENV.refreshTransform();
}

/**
 * Set (x,y) translation, a rotation, r scaling in one function
 */
ENV.transformTo=function(x,y,r,s) { // four values, with hint
	//LOGGING&&console.log("x = "+x+" y = "+y+" a = "+a);
	s=s.clamp(0.1,8.0);
	ENV.window.rot=r;
	ENV.window.scale=s;

	let borderSize=ENV.paperSize.diag*s;
	if(Math.abs(x)>borderSize||Math.abs(y)>borderSize) {
		//LOGGING&&console.log("Reach Border");
		x.clamp(-borderSize,borderSize);
		y.clamp(-borderSize,borderSize);
	}
	ENV.window.trans.x=x;
	ENV.window.trans.y=y;

	ENV.refreshTransform();

	// $("#scale_info").html(Math.round(s*100)+"%");
	// $("#rotate_info").html(Math.round(r)+"&deg;");
}

ENV.setTransformToWindowSize=function(){
	const k1=ENV.window.SIZE.width/ENV.paperSize.width;
	const k2=ENV.window.SIZE.height/ENV.paperSize.height;
	const k=(Math.min(k1,k2)*0.8).clamp(0.1,8.0);
	ENV.setFlip(false);
	ENV.transformTo(0,0,0,k);
	$("#scale-info-input").val(Math.round(k*100));
	$("#rotate-info-input").val("0");
	$("#flip-info").html("&lrarr;");
	$("#flip-info").css("color","");
}

/**
 * set the current canvas sizes to w*h pixels
 * Will remove all histories!
 * Won't do any file savings or history handling!
 */
ENV.setPaperSize=function(w,h,isPreservingContents) {
	isPreservingContents=isPreservingContents||false; // do not reserve by default
	if(!(w&&h)) { // w or h invalid or is 0
		return;
	}
	// Anyway, clear dragging layer first
	FILES.isCropping=false;
	STORAGE.FILES.isNowActiveLayerSaved=true; // you already created a new paper. talk about these later.
	DRAG.setDragHandler(null);

	let isAnim=ENV.displaySettings.enableTransformAnimation; // store animation
	ENV.displaySettings.enableTransformAnimation=false; // disable animation when changing size
	if(!isPreservingContents){
		HISTORY.clearAllHistory(); // remove histories //@TODO: preserve history
	}
	ENV.paperSize={width: w,height: h,diag: Math.sqrt(w*w+h*h)};
	$("#canvas-container").css({"width": w+"px","height": h+"px"}); // set canvas view size
	$("#main-canvas").attr({"width": w,"height": h}); // set canvas pixel size
	$("#overlay-canvas").attr({"width": w,"height": h}); // set canvas pixel size
	CANVAS.init(); // re-initialize CANVAS (and create new renderer, viewport)

	if(isPreservingContents){ // save all contents
		for(const k in LAYERS.layerHash) {
			const layer=LAYERS.layerHash[k];
			if(layer instanceof CanvasNode) {
				// Do not change raw data
				layer.assignNewImageData(0,0);
				layer.setImageDataInvalid();
			}
			else {
				layer.assignNewRawImageData(0,0);
				layer.assignNewImageData(0,0);
			}
		}
		
		CANVAS.requestRefresh(); // No need to recomposite layer structure
		LAYERS.updateAllThumbs();
		const aL=LAYERS.active; // if there is an active layer, refresh it
		if(aL instanceof CanvasNode) {
			CANVAS.setTargetLayer(aL);
		}
	}
	else{ // delete all
		LAYERS.active=null; // disable layer operation and canvas
		CANVAS.setTargetLayer(null);
		if(LAYERS.layerTree){ // layer tree constructed
			for(const v of LAYERS.layerTree.children){
				// delete these layers and resources
				// and children
				// and file storage
				v.delete();
			}
			LAYERS.layerTree.children=[];
			LAYERS.layerTree.assignNewRawImageData(0,0); // root does not have imageData
		}
		$("#layer-panel-inner").empty();
	}

	// update transform
	ENV.setTransformToWindowSize();

	ENV.displaySettings.enableTransformAnimation=isAnim; // restore animation setting
	$("#main-canvas-background").css("background-size",Math.sqrt(Math.max(w,h))*2+"px"); // set transparent block size
};
// ====================== Tools functions ==========================
/**
 * (x,y) is the coordinate under canvas window
 * transform it to the coordinate of paper
 * return [xc,yc] in paper
 */

ENV.toPaperXY=function(x,y,animArr) {
	animArr=animArr||[
		ENV.window.trans.x,
		ENV.window.trans.y,
		ENV.window.rot,
		ENV.window.scale
	];
	const xp=x-ENV.window.SIZE.width/2-animArr[0];
	const yp=y-ENV.window.SIZE.height/2-animArr[1];

	const rot=animArr[2]/180*Math.PI;
	const rotS=Math.sin(rot);
	const rotC=Math.cos(rot);
	const xr=rotC*xp+rotS*yp;
	const yr=rotC*yp-rotS*xp;

	const scale=animArr[3];
	const flip=ENV.window.flip? -1:1;
	const xc=xr*flip/scale+ENV.paperSize.width/2;
	const yc=yr/scale+ENV.paperSize.height/2;

	return [xc,yc];
};

/**
 * (xc,yc) is the coordinate under paper
 * transform it to the coordinate of canvas window
 * return [x,y] in canvas window
 * 
 * The reverse function of ENV.toPaperXY
 */

ENV.toWindowXY=function(xc,yc,animArr) {
	animArr=animArr||[
		ENV.window.trans.x,
		ENV.window.trans.y,
		ENV.window.rot,
		ENV.window.scale
	];
	const scale=animArr[3];
	const flip=ENV.window.flip? -1:1;
	const xr=(xc-ENV.paperSize.width/2)*flip*scale;
	const yr=(yc-ENV.paperSize.height/2)*scale;

	const rot=-animArr[2]/180*Math.PI;
	const rotS=Math.sin(rot);
	const rotC=Math.cos(rot);
	const xp=rotC*xr+rotS*yr;
	const yp=rotC*yr-rotS*xr;

	const x=xp+ENV.window.SIZE.width/2+animArr[0];
	const y=yp+ENV.window.SIZE.height/2+animArr[1];

	return [x,y];
};

// ===================== Other setting functions ==========================
ENV.setAntiAliasing=function(isAntiAlias) {
	ENV.displaySettings.antiAlias=isAntiAlias;
	// change the setting of each layer
	if(isAntiAlias) {
		$("#canvas-container").find("canvas").removeClass("pixelated");
	}
	else {
		$("#canvas-container").find("canvas").addClass("pixelated");
	}
	CANVAS.requestRefresh(); // update canvas anti-alias renderings
}

/**
 * change the animation when transforming the canvas
 */
ENV.setTransformAnimation=function(isAnimate) {
	ENV.displaySettings.enableTransformAnimation=isAnimate;
}

ENV.setFileTitle=function(title) {
	$("#filename-input").val(title);
	/**
	 * onChange event of $("#filename-input") is handled at
	 * SettingHandler.initTitle()
	 */
}

ENV.getFileTitle=function() {
	return $("#filename-input").val();
}

ENV.setAutoSave=function(isAutoSave){
	ENV.displaySettings.isAutoSave=isAutoSave;
	if(isAutoSave){ // save contents
		STORAGE.FILES.saveLayerTree();
		STORAGE.FILES.saveAllContents();
	}
	else{
		// Do nothing, preserve and give warnings on not-saved
	}
}
// ====================== For Debugging ==========================
/**
 * These functions are intended for debuggggggging purposes.
 * Do not use them in working context
 */

// ============ helper functions ===============
/**
 * load a text file
 * only works on web server
 */
ENV.loadTextFile=function(url,callback) {
	let request=new XMLHttpRequest();
	request.open("GET",url,true);
	request.addEventListener("load",function() {
		callback(request.responseText);
	});
	request.send();
}

ENV.escapeHTML=str => str.replace(/[&<>'"]/g,tag => ({"&": "&amp;","<": "&lt;",">": "&gt;","'": "&#39;",'"': "&#34;"}[tag]||tag));

ENV.hash=function(prefix,limit){
	const PRIME=limit||2147483647;
	const randArr=new Uint32Array(1);
	window.crypto.getRandomValues(randArr);
	const hash=randArr[0]%PRIME;
	return typeof(prefix)=="string"?prefix+hash:hash;
}

ENV.getSHA256Promise=function(item){ // item is a File or Blob, returns a promise
	return new Promise((resolve,reject)=>{
		const reader=new FileReader();
		reader.readAsArrayBuffer(item);
		reader.onload=function(){
			crypto.subtle.digest("SHA-256",this.result).then(v=>{
				resolve(new Uint8Array(v)); // v is an ArrayBuffer
			}).catch(err=>{
				reject(err);
			});
		};
	});
}