/*
	Written By Iraka
	Environment handlers for Sketch platform
*/
"use strict";

const ENV={}; // Environment
ENV.version="20210219";

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
	uiFont: "monospace", // font used in all UI
	isAutoSave: true, // Auto save files when modified in browser
	maxFPS: 0, // 12, 30, 60, 65536(no limit), 0(auto)
	maxVRAM: 4*1024*1024*1024 // 4GB VRAM init
};
ENV.maxPaperSize=5600; // needn't save. Larger value cannot be represented by mediump in GLSL100

// File ID related properties
ENV.fileID=""; // present working file ID

// ========================= Functions ============================
ENV.init=function() { // When the page is loaded
	const isLastSafe=ENV.checkSafeExit();
	let isMultipleTabs=false; // state: is there multiple tabs opened?
	new Promise(resolve=>{
		sysend.on("SYN",()=>{
			// also set favicon to highlight
			$("#icon").attr("href","./resources/favicon-hint.png");
			sysend.broadcast("ACK"); // respond to SYN
		});
		sysend.on("ACK",()=>{ // on receiving ACK, multiple tabs, reject
			isMultipleTabs=true;
			resolve(); // earlier than setTimeout
		});
		
		if(!isLastSafe){ // either other tabs/pages' open or last page crashed
			$("#mask-item").text("Verifying ...");
			sysend.broadcast("SYN"); // send a request asking if there is a live page
			setTimeout(resolve,1000); // no response: last page is crashed. start init
		}
		else{ // last safe: directly start
			resolve();
		}
	})
	.then(()=>new Promise(STORAGE.init)) // resolve with sysSettingParams
	.then(sysSettingParams => { // after loading all settings, init language/browser environment
		ENV.browserInfo=ENV.detectBrowser();
		LANG.init(sysSettingParams); // set all doms after load?
		if(isMultipleTabs){
			throw new Error(); // for catch
		}
		ENV.showUIs(); // show each UI blocks, in env-ui.js

		// init display settings
		Object.assign(ENV.displaySettings,sysSettingParams.preference.displaySettings);
		return document.location.protocol=="file:"?
		sysSettingParams: // if is local file
		PERFORMANCE.UTILS.sendReport({ // if is online
			// send start-up report
			gl: ENV.detectGL(),
			agent: ENV.browserInfo.agent,
			source: sysSettingParams.windowParams,
			cloud: FILES.CLOUD.loginInfo?FILES.CLOUD.loginInfo.serviceName:"",
			cnt: ENV.startCnt
		})
		.catch(err=>{}) // if error during report, do nothing
		.then(()=>sysSettingParams); // resolve with sysSettingParams
	})
	.then(sysSettingParams => { // Start init UI
		ENV.fileID=sysSettingParams.nowFileID; // get file ID
		SettingHandler.init(sysSettingParams); // load all setting handlers for the following initializations
		
		ENV.displaySettings.maxFPS=ENV.displaySettings.maxFPS||0; // init as soon as possible
		ENV.setAntiAliasing(ENV.displaySettings.antiAlias); // set canvas css param
		ENV.taskCounter.init();

		// init event handlers
		EVENTS.init();
		EventDistributer.init();
		PALETTE.init(sysSettingParams);
		CURSOR.init(sysSettingParams.preference.stylusSettings);
		// init performance monitor and reporter
		// must after SettingHandler.init because it creates window inside
		PERFORMANCE.init(ENV.displaySettings.maxVRAM);
		// init storage managers
		const lastLayerTreeJSON=STORAGE.FILES.getLayerTree();
		STORAGE.FILES.initLayerStorage(ENV.fileID); // load the layer database, file title already set BEFORE (ENV.setFileTitle)
		STORAGE.FILES.saveLayerTreeInDatabase(lastLayerTreeJSON); // update layer tree in database
		FILES.init(); // must after layer set to init ui

		// init layers
		ENV.window.SIZE.width=$("#canvas-window").width();
		ENV.window.SIZE.height=$("#canvas-window").height();
		let loadPaperPromise; // promise of loading a paper
		if(lastLayerTreeJSON&&isLastSafe){ // there is a saved file structure in local storage
			LOGGING&&console.log("Reading File...",lastLayerTreeJSON);
			ENV.setPaperSize(...lastLayerTreeJSON.paperSize);
			ENV.setFileTitle(lastLayerTreeJSON.title);
			LAYERS.init(); // must after setPaperSize
			loadPaperPromise=STORAGE.FILES.loadLayerTree(lastLayerTreeJSON); // load all layers
		}
		else{ // no layer yet, init CANVAS
			ENV.setPaperSize(window.screen.width,window.screen.height);
			LAYERS.init();
			if(!isLastSafe){ // store that in storage
				/**
				 * Here, maybe the page will refresh BEFORE we can store the last layerTree to storage
				 * This is up to the browser. We can do nothing.
				 */
				FILES.newPaperAction(); // create a NEW paper
				loadPaperPromise=Promise.resolve();
			}
			else{
				loadPaperPromise=LAYERS.initFirstLayer(); // load all layers
			}
		}
		loadPaperPromise.catch(err=>{ // loading paper failed
			// do sth
		}).finally(()=>{ // all loaded
			setTimeout(()=>{
				ENV.reportSafelyLoaded();
			},1000); // make sure it is safe after 1s
		});

		// init accessories
		BrushManager.init(sysSettingParams); // must after EVENTS to enable hotkeys
		HISTORY.init();
		DIALOGBOX.init();
		DRAG.init();
		//GUIDELINE.init();

		ENV.setUIOrientation(ENV.displaySettings.uiOrientationLeft); // set UI orientation at init, after settings
		ENV.setUITheme(ENV.displaySettings.uiTheme); // set color theme
		ENV.setUIFont(ENV.displaySettings.uiFont); // set system font
		ENV.debug();

		// prevent pen-dragging in Firefox causing window freezing
		EVENTS.disableInputSelection($("#filename-input"));

		// Load all thumbs from 
		// clean up the unremoved database store
		// maybe because of failed deletion
		STORAGE.FILES.loadAllFileThumbs();

		// check if there is a param at last
		ENV.checkResetParams(sysSettingParams);
		ENV.checkVersion(sysSettingParams);
	})
	.catch(()=>{ // Multiple tabs
		ENV.onMultipleTabs(); // in env-ui.js
	});
};

ENV.detectBrowser=function(){
	const u=window.navigator.userAgent;
	const app=window.navigator.appVersion;
	return{
		agent:   u,
		macOS:   app.indexOf('Mac') > -1,                             // MacOS system
		win:     app.indexOf('Win') > -1,                             // Windows system
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

ENV.detectGL=function(){
	const gl=document.createElement("canvas").getContext("webgl"); // gl 1.0
	if(!gl)return null; // no webgl
	const debugInfo=gl.getExtension("WEBGL_debug_renderer_info");
	if(!debugInfo)return null; // no vendor
	return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL); // renderer
}

// returns a promise resolved with boolean: is safely exited last time
ENV.checkSafeExit=function(){
	// Note that there may be several runs!
	let isRunning=localStorage.getItem("is-run");
	let isSafeExited=isRunning?isRunning=="false":true;
	localStorage.setItem("is-run","true");


	/**
	 * start-report is: {
	 *    rnd: N,
	 *    failedList: [N1, N2, N3, ...]
	 * }
	 */
	let startReport=localStorage.getItem("start-report");
	if(!startReport){
		startReport={
			rnd: 0,
			failedList: []
		};
	}
	else{
		startReport=JSON.parse(startReport);
	}
	// record new status
	startReport.rnd++;
	if(!isSafeExited){
		startReport.failedList.push(startReport.rnd);
	}
	localStorage.setItem("start-report",JSON.stringify(startReport));
	console.log("start ",startReport);
	ENV.startCnt=startReport.rnd;
	return isSafeExited;
}

ENV.getStartReport=function(){
	const startReportJSON=localStorage.getItem("start-report");
	if(startReportJSON){
		return JSON.parse(startReportJSON);
	}
	else{
		return {
			rnd: 0,
			failedList: []
		};
	}
}
ENV.reportSafelyLoaded=function(){
	console.log("report!");
	const startReport=ENV.getStartReport();

	// record new status
	if(startReport.failedList.length){
		PERFORMANCE.reportUnsafeExit();
		startReport.failedList=[];
		localStorage.setItem("start-report",JSON.stringify(startReport));
	}
}

ENV.checkResetParams=function(sysSettingParams){
	const query=sysSettingParams.windowParams.query;
	PERFORMANCE.reportResetClear(query["reset"],query["clear"]);
}

ENV.checkVersion=function(sysSettingParams){
	if(!sysSettingParams.version){ // Welcome!
		const query=sysSettingParams.windowParams.query;
		if(!query["reset"]&&!query["clear"]){ // not returned from clear
			// expand menu
			PERFORMANCE.idleTaskManager.addTask(e=>{
				if(!SettingHandler.sysMenu.isExpanded()){ // open task report
					SettingHandler.sysMenu.toggleExpand();
				}
				PERFORMANCE.reportWelcome();
			});
		}
	}
	else if(sysSettingParams.version<ENV.version){ // update
		console.log("update "+sysSettingParams.version+" to "+ENV.version);
		PERFORMANCE.idleTaskManager.addTask(e=>{
			if(!SettingHandler.sysMenu.isExpanded()){ // open task report
				SettingHandler.sysMenu.toggleExpand();
			}
			PERFORMANCE.reportVersionUpdate();
		});
	}
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
		const lowFPS=PERFORMANCE.animationFpsCounter.getLowFPS();
		// TODO: move isWorking check to report
		if(lowFPS<24&&!PERFORMANCE.animationFpsCounter.isAnimLowFPSHint&&!ENV.taskCounter.isWorking()){
			// only stat when not working
			PERFORMANCE.animationFpsCounter.isAnimLowFPSHint=true;
			const animFPSReport={
				title: Lang("anim-lowfps-report"),
				items: [{
					content: Lang("anim-lowfps-info1")+lowFPS.toFixed(1)+Lang("fps"),
					target: null
				}]
			};
			if(ENV.displaySettings.enableTransformAnimation){
				animFPSReport.items.push({
					content: Lang("anim-lowfps-info2")
				});
				if(ENV.displaySettings.antiAlias){
					animFPSReport.items.push({
						content: Lang("anim-lowfps-info3")
					});
				}
			}
			PERFORMANCE.REPORTER.report(animFPSReport);
		}
	});
	if(ENV.displaySettings.antiAlias){ // update canvas anti-aliasing
		const tmpAARadius=ENV.getAARadius();
		if(tmpAARadius!=CANVAS.lastAARad){
			CANVAS.requestRefresh();
		}
	}
	
	CURSOR.updateXYR();
};
ENV.getAARadius=function(){
	return ENV.displaySettings.antiAlias?0.7*Math.max(1/ENV.window.scale-1,0):0;
}

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
 * Set the rotation to angle (degree CW), and scale to ratio (default 1.0)
 * center: window center
 */
ENV.rotateScaleTo=function(angle,ratio) {
	let r=ENV.window.rot;
	ENV.window.rot=angle;
	let tx=ENV.window.trans.x;
	let ty=ENV.window.trans.y;

	let s=ENV.window.scale;
	ENV.window.scale=ratio;
	let tr=ratio/s;

	let dr=(angle-r)/180*Math.PI;
	let Cr=Math.cos(dr);
	let Sr=Math.sin(dr);
	ENV.window.trans.x=(Cr*tx-Sr*ty)*tr;
	ENV.window.trans.y=(Sr*tx+Cr*ty)*tr;

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

ENV.getTimeString=function(time){
	const date=new Date(time);
	/*const year=date.getFullYear();
	const month=date.getMonth();
	const day=date.getDate();

	const hour=date.getHours();
	const minute=date.getMinutes();
	const second=date.getSeconds();
	return `${year}-${month}-${day} ${hour}:${minute}:${second}`;*/
	const dateOption={
		dateStyle:"medium"
	};
	const timeOption={
		timeStyle:"medium",
		hourCycle:"h23"
	};
	const strDate=date.toLocaleString(LANG.nowLang,dateOption);
	const strTime=date.toLocaleString(LANG.nowLang,timeOption);
	return strDate+", "+strTime;
}