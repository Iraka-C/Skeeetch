/**
 * performance monitor
 */
PERFORMANCE={};

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