/**
 * performance monitor
 */
PERFORMANCE={};

PERFORMANCE.fpsCounter={
	fps:0,
	intvList:new Array(60),
	intvPt:0,
	intvSum:0
};
PERFORMANCE.debugger={
	isDrawingLayerBorder: false
}

/**
 * init
 */
PERFORMANCE.init=function(){
	let counter=PERFORMANCE.fpsCounter;
	counter.fps=60;
	for(let i=0;i<counter.intvList.length;i++){
		counter.intvList[i]=16; // initial 60fps
		counter.intvSum+=16;
	}

	PERFORMANCE.idleTaskManager=new IdleTaskManager();
}

PERFORMANCE.getMemoryEstimation=function(){ // in MB
	let byte=0;
	// LAYER memory
	let imgDataSize=0;
	const pixelBytes=32; // RGBA Float
	const alphaBytes=4;
	for(let id in LAYERS.layerHash){ // for all canvases
		// @TODO: split into GPU mem or RAM
		const item=LAYERS.layerHash[id];
		imgDataSize+=item.rawImageData.width*item.rawImageData.height*pixelBytes;
		if(item.maskedImageData!=item.rawImageData){
			imgDataSize+=item.maskedImageData.width*item.maskedImageData.height*alphaBytes; // Only alpha
			imgDataSize+=item.maskedImageData.width*item.maskedImageData.height*pixelBytes;
		}
		if(item.imageData!=item.maskedImageData){
			imgDataSize+=item.imageData.width*item.imageData.height*pixelBytes;
		}
	}
	byte+=CANVAS.renderer.getGPUMemUsage();
	byte+=imgDataSize; // latest imgData + Canvas imgData

	// History
	/*let histCnt=1; // initial
	for(let i=0;i<HISTORY.list.length;i++){ // clear all history afterwards
		let item=HISTORY.list[i];
		if(item.info.type=="canvas-change"){
			histCnt++;
		}
	}
	byte+=histCnt*imageDataSize; // every history holds onr unique imageData*/
	return byte/1.04E6; // in MB
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
	startIdle(){ // count as idle after 1s
		if(this.isReadyToIdle){ // already in countdown
			return;
		}
		this.isReadyToIdle=true;

		if(this.timer){ // already prepared to perform a task
			return;
		}
		this.timer=setTimeout(event=>{
			this._onIdle();
		},200); // Start idle in 200ms. Do not start immediately to guarantee smooth pen strokes
	}
	startBusy(){
		this.isIdle=false;
		this.isReadyToIdle=false;
		if(this.timer){ // a task pending
			clearTimeout(this.timer); // do it later
			this.timer=0;
		}
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