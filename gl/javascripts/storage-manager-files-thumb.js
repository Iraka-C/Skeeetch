/**
 * Put a source to the thumb
 * return the painted canvas
 * imgSrc can be:
 *    // <canvas> element with a context2d content
 *    renderer imagedata
 *    Object like RAMBuf8 type imageData (see brush storage)
 */
STORAGE.FILES.updateThumb=function(fileID,imgSrc){
	const $ui=FILES.fileSelector.$uiList[fileID];
	const $cv=$ui.children(".file-ui-canvas-container").children("canvas");
	const w=imgSrc.width,h=imgSrc.height;
	if(!(w&&h)) { // no image data content, also clear the content of cv
		$cv.attr({width: 0,height: 0});
		return;
	}

	if(imgSrc.type=="GLTexture"){ // convert into ctx2d canvas first
		// In this way, the good thing is browser performs downscaling anti-aliasing automatically
		imgSrc=CANVAS.renderer.getContext2DCanvasFromImageData(imgSrc);
		// Of course you can use another downscaling method like your own shader
		// It's the efficiency & effect
		// Well, it seems the effect is not good as well. @TODO: Use your own code.
	}
	else if(imgSrc.type=="RAMBuf8"){ // For notices of using this method, see GLRenderer.loadToImageData
		const canvas=document.createElement("canvas");
		canvas.width=w;
		canvas.height=h;
		const ctx2d=canvas.getContext("2d");
		const imgData2D=ctx2d.createImageData(w,h);
		imgData2D.data.set(imgSrc.data); // copy the contents of imgSrc into canvas
		ctx2d.putImageData(imgData2D,0,0);
		imgSrc=canvas; // change reference to canvas
	}

	// imgSrc is always a canvas now
	const uW=Math.round($ui.width()),uH=Math.round($ui.height());
	// position in container
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

	// draw contents
	console.log("Drawing",imgSrc,"in",cvW,cvH);
	
	const ctx=$cv[0].getContext("2d");
	ctx.drawImage(imgSrc,0,0,cvW,cvH);
}

/**
 * Update the thumb image of currently opened file in file selector UI
 */
STORAGE.FILES.updateCurrentThumb=function(){

}