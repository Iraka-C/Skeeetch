/**
 * This is the helper library for
 * updating/saving thumbnail images in database
 */

// Thumb is short for thumbnail images.
"use strict";

STORAGE.FILES.initThumbStore=function(){
	STORAGE.FILES.thumbStore=localforage.createInstance({name: "thumbs"});
}

/**
 * Put a source to the thumb
 * return the painted canvas
 * imgSrc can be:
 *    // <canvas> element with a context2d content
 *    renderer imagedata
 *    Object like RAMBuf8 type imageData (see brush storage)
 */
STORAGE.FILES.updateThumb=function(fileID,imgSrc,isToSaveInDatabase){
	if(!imgSrc){ // no source data (might be reading failed)
		return; // add extra hint?
	}
	isToSaveInDatabase=isToSaveInDatabase||false; // default not save in database
	const $ui=FILES.fileSelector.$uiList[fileID];
	if(!$ui){ // ui do not exist
		return;
	}
	const $cv=$ui.children(".file-ui-canvas-container").children("canvas");
	const w=imgSrc.width,h=imgSrc.height;
	if(!(w&&h)) { // no image data content, also clear the content of cv
		$cv.attr({width: 0,height: 0});
		return;
	}

	// calculate position of thumb canvas in container
	const uW=Math.round($ui.width()),uH=Math.round($ui.height());
	let kw=uW/w,kh=uH/h;
	let cvW=0,cvH=0;
	if(kw<=kh) { // left/right overflow
		let nW=Math.round(w*kh); // new width
		cvW=nW,cvH=uH;
		$cv.attr({
			width: nW,
			height: uH,
			"data-transform-type": "X",
			"data-transform-amount":uW-nW
		});
		$cv.css({
			"transform": "translateX("+((uW-nW)/2)+"px)"
		});
	}
	else { // top/bottom overflow
		let nH=Math.round(h*kw); // new height
		cvW=uW,cvH=nH;
		$cv.attr({
			width: uW,
			height: nH,
			"data-transform-type": "Y",
			"data-transform-amount":uH-nH
		});
		$cv.css({
			"transform": "translateY("+((uH-nH)/2)+"px)"
		});
	}

	// Changing imgSrc into a canvas
	// TODO: make the logic of this part clearer
	
	if(imgSrc.type=="GLTexture"||imgSrc.type=="GLRAMBuf"){ // convert into ctx2d canvas first
		const pixels=CANVAS.renderer.getUint8ArrayFromImageData(imgSrc,null,[cvW,cvH]); // get data
		const canvas=document.createElement("canvas");
		canvas.width=cvW;
		canvas.height=cvH;
		const ctx2d=canvas.getContext("2d");
		const imgData2D=ctx2d.createImageData(cvW,cvH);
		imgData2D.data.set(pixels);
		ctx2d.putImageData(imgData2D,0,0);
		imgSrc=canvas; // change reference to canvas
	}
	else if(imgSrc.type=="RAMBuf8"){
		// !!! For notices of using this method, see GLRenderer.loadToImageData
		const canvas=document.createElement("canvas");
		canvas.width=w;
		canvas.height=h;
		const ctx2d=canvas.getContext("2d");
		const imgData2D=ctx2d.createImageData(w,h);
		imgData2D.data.set(imgSrc.data); // copy the contents of imgSrc into canvas
		ctx2d.putImageData(imgData2D,0,0);
		imgSrc=canvas; // change reference to canvas
	}
	else if(imgSrc instanceof ImageData){
		// !!! For notices of using this method, see GLRenderer.loadToImageData
		const canvas=document.createElement("canvas");
		canvas.width=w;
		canvas.height=h;
		const ctx2d=canvas.getContext("2d");
		ctx2d.putImageData(imgSrc,0,0);
		imgSrc=canvas; // change reference to canvas
	}
	else if(imgSrc instanceof HTMLImageElement){ // <img> type
		const canvas=document.createElement("canvas");
		canvas.width=w;
		canvas.height=h;
		const ctx2d=canvas.getContext("2d");
		ctx2d.drawImage(imgSrc,0,0); // put img on to ctx2d
		imgSrc=canvas; // change reference to canvas
	}

	// imgSrc is always a canvas now
	// draw contents
	
	const cv=$cv[0];
	const ctx=cv.getContext("2d");
	ctx.drawImage(imgSrc,0,0,cvW,cvH);
	if(isToSaveInDatabase){ // save cv in database
		STORAGE.FILES.saveThumbToDatabase(fileID,cv);
	}
}

/**
 * Update the thumb image of currently opened file in file selector UI
 * Also update thumb database
 */
STORAGE.FILES.updateCurrentThumb=function(){
	// put the tree root (canvas content) into the ENV.fileID thumb
	STORAGE.FILES.updateThumb(ENV.fileID,LAYERS.layerTree.imageData,true);
}

// ======================== Read From ========================

STORAGE.FILES.getThumbImageData=function(fileID){
	return STORAGE.FILES.thumbStore.getItem(fileID).then(imgSrc => {
		if(!imgSrc)throw new Error("No thumb in db");
		// fetched, type=="RAMBuf8"
		imgSrc.data=Compressor.decode(imgSrc.data); // decode
		return imgSrc;
	});
}

STORAGE.FILES.updateThumbFromDatabase=function(fileID){
	return STORAGE.FILES.getThumbImageData(fileID).then(imgSrc=>{
		STORAGE.FILES.updateThumb(fileID,imgSrc);
	}).catch(err=>{
		// no thumb, do nothing
	});
}

/**
 * Update all the file thumbs in the selector
 * EXCEPT the opened one (ENV.fileID)
 */
STORAGE.FILES.loadAllFileThumbs=function(){
	// for all files, except ENV.fileID
	for(const fileID in STORAGE.FILES.filesStore.fileList) {
		if(fileID!=ENV.fileID){ // not opened
			ENV.taskCounter.startTask(); // start load thumb task
			STORAGE.FILES.updateThumbFromDatabase(fileID).finally(()=>{
				ENV.taskCounter.finishTask(); // finish load thumb task
			});
		}
	}
	// Clear unused thumb images
	STORAGE.FILES.clearUnusedThumb();
}

// ======================== Write to =========================

STORAGE.FILES.saveThumbToDatabase=function(fileID,imgSrc){
	LOGGING&&console.log("Saving thumb for "+fileID);
	
	if(imgSrc.nodeName=="CANVAS"){ // Context2D type canvas
		const ctx=imgSrc.getContext("2d");
		imgSrc=ctx.getImageData(0,0,imgSrc.width,imgSrc.height); // change reference
	}

	const data=Compressor.encode(imgSrc.data); // although small, still encode first!
	return STORAGE.FILES.thumbStore.setItem(fileID,{
		type: "RAMBuf8",
		width: imgSrc.width,
		height: imgSrc.height,
		data: data
	});
}

// ======================== Deletion/Clear =========================

STORAGE.FILES.deleteThumbFromDatabase=function(fileID){
	return STORAGE.FILES.thumbStore.removeItem(fileID);
}

STORAGE.FILES.clearUnusedThumb=function() {
	return STORAGE.FILES.thumbStore.keys().then(keys => {
		for(const id of keys) { // for all fileIDs in thumb database
			if(!STORAGE.FILES.filesStore.fileList.hasOwnProperty(id)) { // unused, delete
				ENV.taskCounter.startTask(); // start remove thumb task
				STORAGE.FILES.thumbStore.removeItem(id).finally(() => {
					console.log("Remove unused thumb "+id);
					
					ENV.taskCounter.finishTask(); // end remove thumb task
				});
			}
		}
	}).catch(function(err) { // get key promise error
		console.log(err);
	});
}