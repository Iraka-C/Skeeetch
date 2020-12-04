FILES.initCropDragger=function(widthUpdateFunc,heightUpdateFunc){

	function cropDragHandler(){ // the handler for dragging when cropping
		// two orthogonal points
		const p=DRAG.paperP[0];
		const q=DRAG.paperP[2];
		FILES.tempPaperSize={
			width: Math.round(Math.abs(p[0]-q[0])),
			height: Math.round(Math.abs(p[1]-q[1])),
			left: Math.round(Math.min(p[0],q[0])),
			top: Math.round(Math.min(p[1],q[1])),
		}
		// update input boxes
		widthUpdateFunc();
		heightUpdateFunc();
	};

	FILES.isCropping=false; // flag for dragger occupying
	return function(isShow){ // dragger updater
		if(isShow){
			if(!FILES.isCropping){ // setup crop mode
				FILES.isCropping=true;
				DRAG.setMode("xy",cropDragHandler,"crop");
			}
			// update here
			const [w,h,l,t]=[
				FILES.tempPaperSize.width,
				FILES.tempPaperSize.height,
				FILES.tempPaperSize.left,
				FILES.tempPaperSize.top
			];
			DRAG.setNewPaperPoints([[l,t],[l,t+h],[l+w,t+h],[l+w,t]]);
		}
		else{ // hide dragger, detach handler
			FILES.isCropping=false;
			DRAG.setMode("none");
		}
	};
}