/**
 * performance monitor
 */
"use strict";
const PERFORMANCE={
	debugger:{ // debugger settings
		isDrawingLayerBorder: false
	},
	maxMem:{ // maximum memory available in Bytes
		// Will be overwritten by sysSettingParams
		ram: 4*1024*1024*1024, // init 4G for history (vram manager doesn't care about this limit)
		gpu: 8*1024*1024*1024 // init 8G (my card)
	},
	idleTaskManager: null,
	strokeFpsCounter: null,
	animationFpsCounter: null
};

class FPSCounter{
	constructor(fpsCallback){
		this.reset();
		this.fpsCallback=fpsCallback;
	}
	submit(intv){ // interval in ms
		intv=intv.clamp(1,1000); // 1~1000fps
		
		const list=this.intvList;
		const len=list.length;
		const nowIntv=list[this.intvPt];
		this.intvSum+=intv-nowIntv;
		this.fps=1000*len/this.intvSum;
	
		// update list
		list[this.intvPt++]=intv;
		if(this.intvPt>=len){ // reset to head
			this.intvPt=0;
		}

		let isLowInsert=false;
		for(let i=0;i<this.lowList.length;i++){
			if(this.fps<this.lowList[i]){ // to insert
				this.lowList.splice(i,0,this.fps);
				if(i<5){ // insert
					this.lowList.pop(); // discard a highest value
				}
				else{ // above median
					this.lowList.shift(); // discard a lowest value
				}
				isLowInsert=true;
				break;
			}
		}
		if(isLowInsert){ // new low fps value acquired
			this.noLowInsertCount=0;
		}
		else{
			this.noLowInsertCount++;
			if(this.noLowInsertCount>10){ // one round
				this.lowList.shift();
				this.lowList.push(this.fps); // add the latest value
			}
		}

		if(this.fpsCallback){
			this.fpsCallback(this.fps);
		}
	}
	reset(){
		const N=10;
		Object.assign(this,{
			fps: 60, // init
			intvList: new Array(N).fill(16), // init 16ms
			intvSum: 16*N, // sum of intervals
			intvPt: 0, // now head item in intvList
			lowList: new Array(N).fill(60), // init 60fps
			noLowInsertCount: 0 // how many times no low fps inserted
		});
		this.isAnimLowFPSHint=false;
	}
	getLowFPS(){
		return this.lowList[5]; // median
	}
}

/**
 * init
 */
PERFORMANCE.init=function(maxVRAMSetting){
	/**
	 * PERFORMANCE.strokeFpsCounter uses pointer event timestamp to decide stroke fps
	 */
	PERFORMANCE.strokeFpsCounter=new FPSCounter(fps=>{
		PERFORMANCE.FPSMonitor.update(null,fps);
	});
	PERFORMANCE.animationFpsCounter=new FPSCounter(fps=>{
		PERFORMANCE.FPSMonitor.update(fps,null);
	});
	PERFORMANCE.idleTaskManager=new IdleTaskManager();
	if(maxVRAMSetting){
		PERFORMANCE.maxMem.gpu=maxVRAMSetting; // saved info
	}
	if(navigator.deviceMemory){
		// the value could only be 0.25, 0.5, 1, 2, 4, 8
		// at most 4GB
		PERFORMANCE.maxMem.ram=navigator.deviceMemory/2*1024*1024*1024; // able to conserve half for history
	}
	else{
		PERFORMANCE.maxMem.ram=PERFORMANCE.maxMem.gpu/2; // half-vram equivalent ram for history
	}
	PERFORMANCE.REPORTER.init();
	PERFORMANCE.FPSMonitor.init();
	PERFORMANCE.checkWorkerSupport(); // after reporter init
	PERFORMANCE.checkBitdepthSupport();
}

PERFORMANCE.getRAMEstimation=function(){ // in MB
	// Do not believe in window.performance.memory
	let ramBytes=0;
	// LAYER memory
	let imgDataRAMSize=0;
	const pixelBytes=CANVAS.rendererBitDepth/8*4; // RGBA
	const alphaBytes=4; // Float
	for(let id in LAYERS.layerHash){ // for all canvases
		// @TODO: split into GPU mem or RAM
		const item=LAYERS.layerHash[id];
		if(item.rawImageData.type!="GLTexture"){
			imgDataRAMSize+=item.rawImageData.width*item.rawImageData.height*pixelBytes;
		}
		if(item.imageData!=item.rawImageData){
			if(item.rawImageData.type!="GLTexture"){
				imgDataRAMSize+=item.imageData.width*item.imageData.height*pixelBytes;
			}
		}
	}
	if(CANVAS.renderer){
		imgDataRAMSize+=CANVAS.renderer.getRAMUsage();
	}
	ramBytes+=imgDataRAMSize;

	// History
	let histRAMSize=HISTORY.nowRAMUsage;

	ramBytes+=histRAMSize;
	//ramBytes*=2.0; // A Mysterious param provides better estimation (?) Refer to task manager
	return ramBytes/1024/1024; // in MB
}

PERFORMANCE.getGPUMemEstimation=function(){
	let gpuBytes=0;
	// LAYER memory
	let imgDataGPUSize=0;
	// const pixelBytes=CANVAS.rendererBitDepth/8*4; // RGBA Float(4bytes)
	// const alphaBytes=4; // Float
	// for(let id in LAYERS.layerHash){ // for all canvases
	// 	// @TODO: split into GPU mem or RAM
	// 	const item=LAYERS.layerHash[id];
	// 	if(item.rawImageData.type=="GLTexture"){
	// 		imgDataGPUSize+=item.rawImageData.width*item.rawImageData.height*pixelBytes;
	// 	}
	// 	if(item.maskedImageData!=item.rawImageData){
	// 		if(item.rawImageData.type=="GLTexture"){
	// 			imgDataGPUSize+=item.maskImageData.width*item.maskImageData.height*alphaBytes; // Only alpha
	// 			imgDataGPUSize+=item.maskedImageData.width*item.maskedImageData.height*pixelBytes;
	// 		}
	// 	}
	// 	if(item.imageData!=item.maskedImageData){
	// 		if(item.rawImageData.type=="GLTexture"){
	// 			imgDataGPUSize+=item.imageData.width*item.imageData.height*pixelBytes;
	// 		}
	// 	}
	// }
	if(CANVAS.renderer){ // Directly as the VRAM manager
		imgDataGPUSize+=CANVAS.renderer.getGPUMemUsage();
	}
	gpuBytes+=imgDataGPUSize;
	//gpuBytes*=2.0; // A Mysterious param provides better estimation (?) Refer to task manager
	return gpuBytes/1024/1024; // in MB
}

// PERFORMANCE.submitFpsStat=function(intv){ // intv in ms
// 	PERFORMANCE.fpsCounter.submit(intv);
// }

/**
 * This is an async function! returns a Promise
 */
PERFORMANCE.getDriveEstimation=function(){
	if(navigator.storage){
		return navigator.storage.estimate().then(est=>est.usage);
	}
	else{ // just an approximation to img, not including brushes and thumbs
		return MyForage.getDriveUsage("img");
	}
}

PERFORMANCE.checkWorkerSupport=function(){
	if(!window.Worker||document.location.protocol=="file:"){ // no worker
		const loadReport={
			title: Lang("check-worker-report"),
			items: [{
				content: Lang("check-worker-info"),
				target: null
			}]
		};
		PERFORMANCE.REPORTER.report(loadReport);
	}
}

PERFORMANCE.checkBitdepthSupport=function(){
	if(
		ENV.browserInfo.macOS
		&&ENV.browserInfo.gecko
		&&CANVAS.rendererBitDepth==16
	){ // does not support read from 16bit
		const loadReport={
			title: Lang("check-bitrate-macos16-report"),
			items: [{
				content: Lang("check-bitrate-macos16-info"),
				target: null
			}]
		};
		PERFORMANCE.REPORTER.report(loadReport);
	}
}

PERFORMANCE.reportUnsafeExit=function(){
	const loadReport={
		title: Lang("unsafe-exit-report"),
		items: []
	};
	loadReport.items.push({
		content: Lang("unsafe-exit-hint"),
		target: null
	});
	PERFORMANCE.REPORTER.report(loadReport);
}

// send a report on webgl context lost
PERFORMANCE.webglContextLost=function(){
	if(!PERFORMANCE.webglContextLost.isLost){ // not reported yet
		PERFORMANCE.webglContextLost.isLost=true;
		const loadReport={
			title: Lang("glcontextlost-report"),
			items: []
		};
		loadReport.items.push({
			content: Lang("glcontextlost-hint1"),
			target: null
		});
		loadReport.items.push({
			content: Lang("glcontextlost-hint2")+(ENV.displaySettings.maxVRAM/1073741824).toFixed(1)+"GB",
			target: null
		});
		if(CANVAS.renderer.bitDepth>8){
			loadReport.items.push({
				content: Lang("gl-lowvram-hint3")+CANVAS.renderer.bitDepth/2+Lang("bit"),
				target: null
			});
		}
		loadReport.items.push({
			content: Lang("glcontextlost-hint4")+ENV.paperSize.width+"×"+ENV.paperSize.height,
			target: null
		});
		loadReport.items.push({
			content: Lang("glcontextlost-hint5"),
			target: "" // refresh
		});
		PERFORMANCE.REPORTER.report(loadReport);
	}
}
PERFORMANCE.webglContextLost.isLost=false;

PERFORMANCE.reportLowVRAM=function(){
	if(!PERFORMANCE.reportLowVRAM.reported){
		PERFORMANCE.reportLowVRAM.reported=true;
		const loadReport={
			title: Lang("gl-lowvram-report"),
			items: []
		};
		loadReport.items.push({
			content: Lang("gl-lowvram-hint1"),
			target: null
		});
		loadReport.items.push({
			content: Lang("gl-lowvram-hint2")+(ENV.displaySettings.maxVRAM/1073741824).toFixed(1)+"GB",
			target: null
		});
		if(CANVAS.renderer.bitDepth>8){
			loadReport.items.push({
				content: Lang("gl-lowvram-hint3")+CANVAS.renderer.bitDepth/2+Lang("bit"),
				target: null
			});
		}
		PERFORMANCE.REPORTER.report(loadReport);
	}
}
PERFORMANCE.reportLowVRAM.reported=false;

PERFORMANCE.reportResetClear=function(isReset,isClear){
	const loadReport={
		title: Lang("reset-clear-report"),
		items: []
	};
	if(isReset){
		loadReport.items.push({
			content: Lang("reset-report-hint"),
			target: null
		});
	}
	if(isClear){
		loadReport.items.push({
			content: Lang("clear-report-hint"),
			target: null
		});
	}
	if(isReset||isClear){
		loadReport.items.push({
			content: Lang("reset-clear-hint"),
			target: "" // refresh
		});
		PERFORMANCE.idleTaskManager.addTask(e=>{ // prompt the user to refresh page
			if(!SettingHandler.sysMenu.isExpanded()){ // open task report
				SettingHandler.sysMenu.toggleExpand();
				PERFORMANCE.REPORTER.report(loadReport);
			}
		});
	}
}

PERFORMANCE.reportWelcome=function(){
	const welcomeReport={
		title: Lang("welcome-report"),
		items: []
	};
	welcomeReport.items.push({
		content: Lang("welcome-hint-1"),
		target: null
	});
	welcomeReport.items.push({
		content: Lang("welcome-hint-2"),
		target: Lang("welcome-link")
	});
	welcomeReport.items.push({
		content: Lang("welcome-hint-3"),
		target: null
	});
	PERFORMANCE.REPORTER.report(welcomeReport);
}

PERFORMANCE.reportVersionUpdate=function(){
	const versionReport={
		title: Lang("version-report"),
		items: []
	};
	versionReport.items.push({
		content: Lang("version-hint-1")+ENV.version,
		target: null
	});
	versionReport.items.push({
		content: Lang("version-hint-2"),
		target: Lang("version-link")+ENV.version+".md"
	});
	PERFORMANCE.REPORTER.report(versionReport);
}
// ================= Idle Task Manager ===================
class IdleTaskManager{
	constructor(){
		this.taskList=[];
		this.isIdle=true; // initially idle
		this.isReadyToIdle=false; // in busy->idle countdown
		this.timer=0;
	}
	startIdle(){ // count as idle after a certain period
		if(this.isReadyToIdle){ // already in countdown
			return;
		}
		this.isReadyToIdle=true;

		if(this.timer){ // already prepared to perform a task
			return;
		}
		this.timer=setTimeout(event=>{
			//console.log("Start Idle");
			this._onIdle();
		},250); // Start idle in 250ms. Do not start immediately to guarantee smooth pen strokes
	}
	startBusy(){
		this.isIdle=false;
		this.isReadyToIdle=false;
		if(this.timer){ // a task pending
			clearTimeout(this.timer); // do it later
			this.timer=0;
		}
		//console.log("Start Busy");
	}
	_onIdle(){ // start task
		this.isIdle=true;
		this.isReadyToIdle=false;
		this.timer=0; // time reached

		if(!this.taskList.length){ // no task
			return;
		}
		const task=this.taskList.shift();
		const startT=Date.now();
		try{
			task(); // operate this task
		}catch(err){
			console.log(err);
			// task might not be a function
		}
		const dT=Date.now()-startT; // time consuming
		//console.log(dT);
		
		if(dT>33){ // less than 30fps
			// show task name or content for anonymous
			console.warn("Heavy load ("+dT+"ms) in background: ",task.name||task);
		}

		if(this.taskList.length){ // still task left
			this.timer=setTimeout(event=>{ // operate next task on idle
				this._onIdle();
			},dT<=16?0:dT*(dT/20).clamp(1,5)); // at most 20% busy for system rendering (pointer events etc.)
		}
	}
	addTask(callback){ // execute callback when idle
		// Try to keep every task below 16ms! (60fps)
		this.taskList.push(callback);
		if(this.isIdle){ // can execute immediately
			this.timer=setTimeout(event=>{ // operate next task on idle
				this._onIdle();
			},0); // 20% busy
		}
	}
}