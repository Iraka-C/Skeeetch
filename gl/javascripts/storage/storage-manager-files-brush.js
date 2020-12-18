/**
 * Save/Load brushtip images
 * All done by IDB/main thread
 * As the task is relatively light, no need to start task counter
 */
"use strict";

STORAGE.FILES.saveBrushtip=function(brushID,brushtip) {
	/**
	 * A brushtip image is at most 500*500px RGBA 8bit, which is about 1MB
	 * surely be stored in one chunk
	 */
	let rawData;
	if(ArrayBuffer.isView(brushtip)){ // already buffer
		rawData=brushtip;
	}
	else{ // get buffer from brushtip
		rawData=CANVAS.renderer.getUint8ArrayFromImageData(brushtip);
	}
	const data=Compressor.encode(rawData); // although small, still encode first!
	STORAGE.FILES.brushtipStore.setItem(brushID,data);
}

/**
 * returns promise
 */
STORAGE.FILES.getBrushtip=function(brushID) {
	return STORAGE.FILES.brushtipStore.getItem(brushID).then(
		// if not found, return null directly
		data => data? Compressor.decode(data):null);

}

STORAGE.FILES.deleteBrushtip=function(brushID) {
	STORAGE.FILES.brushtipStore.removeItem(brushID);
}

/**
 * clear all that isn't in BrushManager.brushHash
 */
STORAGE.FILES.clearUnusedBrushtip=function() {
	STORAGE.FILES.brushtipStore.keys().then(keys => {
		for(const v of keys) { // for all keys keys
			if(!BrushManager.brushHash.has(v)) { // unused, delete
				ENV.taskCounter.startTask(); // start remove chunk task
				STORAGE.FILES.brushtipStore.removeItem(v).finally(() => {
					ENV.taskCounter.finishTask(); // end remove chunk task
				});
			}
		}
	}).catch(function(err) { // get key promise error
		console.log(err);
	});
}