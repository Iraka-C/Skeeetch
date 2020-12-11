/**
 * performance monitor
 */
PERFORMANCE={
	debugger:{ // debugger settings
		isDrawingLayerBorder: false
	},
	maxMem:{ // maximum memory available in Bytes
		// Will be overwritten by sysSettingParams
		ram: 4*1024*1024*1024, // init 4G for history (vram manager doesn't care about this limit)
		gpu: 8*1024*1024*1024 // init 8G (my card)
	},
	idleTaskManager: null,
	strokeFpsCounter: {fps:30}, // starts slow
	animationFpsCounter: {fps:30}
};

class FPSCounter{
	constructor(){
		const N=10;
		Object.assign(this,{
			fps: 60, // init
			intvList: new Array(N).fill(16), // init 16ms
			intvSum: 16*N, // sum of intervals
			intvPt: 0 // now head item in intvList
		});
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
	}
}

/**
 * init
 */
PERFORMANCE.init=function(maxVRAMSetting){
	/**
	 * PERFORMANCE.strokeFpsCounter is just a debugging object
	 * At present, no method is provided to get WebGL1.0 render time
	 */
	PERFORMANCE.strokeFpsCounter=new FPSCounter(); // not useful at this moment
	PERFORMANCE.animationFpsCounter=new FPSCounter();
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