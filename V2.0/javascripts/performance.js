/**
 * performance monitor
 */
PERFORMANCE={};

PERFORMANCE.fpsCounter={
	fps:0,
	intvList:new Array(20),
	intvPt:0,
	intvSum:0
};

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
	
}

PERFORMANCE.getMemoryEstimation=function(){ // in MB
	let byte=0;
	const imageDataSize=ENV.paperSize.width*ENV.paperSize.height*4; // 4 channels, w*h pixels
	// LAYER memory
	let layerCnt=0;
	for(let id in LAYERS.layerHash){ // for all canvases
		const item=LAYERS.layerHash[id];
		if(item.type!="canvas"){ // not a canvas
			continue;
		}
		layerCnt++;
	}
	byte+=2*layerCnt*imageDataSize; // latest imgData + Canvas imgData
	if(CANVAS.settings.is16bit){
		byte+=imageDataSize*2; // 16bit data
	}

	// History
	let histCnt=1; // initial
	for(let i=0;i<HISTORY.list.length;i++){ // clear all history afterwards
		let item=HISTORY.list[i];
		if(item.info.type=="canvas-change"){
			histCnt++;
		}
	}
	byte+=histCnt*imageDataSize; // every history holds onr unique imageData
	return byte/1.04E6; // in MB
}

PERFORMANCE.submitFpsStat=function(intv){ // intv in ms
	let counter=PERFORMANCE.fpsCounter;
	let nowIntv=counter.intvList[counter.intvPt]||0;
	counter.intvSum+=intv-nowIntv;
	counter.fps=1000/(counter.intvSum/counter.intvList.length);
	
	// renew list
	counter.intvList[counter.intvPt]=intv;
	if(++counter.intvPt>=counter.intvList.length){
		counter.intvPt=0;
	}
}