/**
 * performance monitor
 */
PERFORMANCE={};

PERFORMANCE.fpsCounter={
	fps:0,
	intvList:new Array(10), // average of 10 frames, less than 0.2s
	intvPt:0,
	intvSum:0
};
PERFORMANCE.debugger={
	isDrawingLayerBorder: false
}
PERFORMANCE.maxMem={ // maximum memory available in Bytes
	ram: 2048*1024*1024, // init 2G
	gpu: 2048*1024*1024 // init 2G
}

/**
 * init
 */
PERFORMANCE.idleTaskManager=null;
PERFORMANCE.init=function(){
	let counter=PERFORMANCE.fpsCounter;
	counter.fps=60;
	for(let i=0;i<counter.intvList.length;i++){
		counter.intvList[i]=16; // initial 60fps
		counter.intvSum+=16;
	}

	PERFORMANCE.idleTaskManager=new IdleTaskManager();
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

		if(item.maskedImageData!=item.rawImageData){
			if(item.rawImageData.type!="GLTexture"){
				imgDataRAMSize+=item.maskImageData.width*item.maskImageData.height*alphaBytes; // Only alpha
				imgDataRAMSize+=item.maskedImageData.width*item.maskedImageData.height*pixelBytes;
			}
		}
		if(item.imageData!=item.maskedImageData){
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
	if(CANVAS.renderer){
		imgDataGPUSize+=CANVAS.renderer.getGPUMemUsage();
	}
	gpuBytes+=imgDataGPUSize;
	//gpuBytes*=2.0; // A Mysterious param provides better estimation (?) Refer to task manager
	return gpuBytes/1024/1024; // in MB
}

PERFORMANCE.submitFpsStat=function(intv){ // intv in ms
	// @TODO: consider only consecutive frames
	const counter=PERFORMANCE.fpsCounter;
	const len=counter.intvList.length;
	const nowIntv=counter.intvList[counter.intvPt]||0;
	counter.intvSum+=intv-nowIntv;
	counter.fps=1000*len/counter.intvSum;
	// if fps drops lower than a threshold i.e. 30fps, then start warning
	
	// renew list
	counter.intvList[counter.intvPt]=intv;
	if(++counter.intvPt>=len){
		counter.intvPt=0;
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
		console.log(dT);
		
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