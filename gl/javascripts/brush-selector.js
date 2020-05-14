BrushManager.initBrushSelector=function(customBrushes) {
	// Default brush table
	const $defTable=$("<table class='default-brush-table'>");
	for(let i=0;i<BrushManager.brushes.length;i++) {
		const brush=BrushManager.brushes[i];
		brush.proto=i; // prototype

		const $block=$("<td class='brush-selector-item'>").text(brush.name);
		const $row=$("<tr>").append($block);
		brush.$row=$row; // backward ref
		$row.click(event => {
			BrushManager.setActiveBrush(brush);
		});
		$defTable.append($row);
	}
	$("#brush-selector-default").append($defTable);

	if(customBrushes){ // customBrushes only contain RAMBuf8 now
		BrushManager.customBrushes=customBrushes;
	}

	// customized brush table
	const $customTable=$("<table class='custom-brush-table'>");
	$("#brush-selector-custom").append($customTable);
	for(const brush of BrushManager.customBrushes) {
		BrushManager.addCustomizedBrush(brush); // also add brush hash
		STORAGE.FILES.getBrushtip(brush.id).then(data=>{
			if(!data)return;
			let bImg=CANVAS.renderer.loadBrushtipImageData(brush.brushtip,data);
			brush.brushtip=bImg; // discard RAMBuf
			BrushManager.updateBrushtipThumb(brush,data);
		});
	}
	STORAGE.FILES.clearUnusedBrushtip();
	BrushManager.initCustomizedBrushPanel();
}

/**
 * Append a brush block to selector
 */
BrushManager.addCustomizedBrush=function(brush){
	// add clickable block
	const $block=$("<td class='brush-selector-custom-item'>");
	const $blockInput=$("<input class='custom-brush-name-label'>");
	$blockInput.attr({"value":brush.name,"type": "text","maxLength": "256"});
	$blockInput.on("change",event => { // change name
		brush.name=$blockInput.val();
	});
	EVENTS.disableInputSelection($blockInput);
	$block.append($blockInput);

	// add brushtip canvas
	const $cv=$("<canvas>");
	$cv.attr({"width": 0,"height": 0});
	const $brushtipCanvasBlock=$("<td>").append(
		$("<div class='brush-selector-canvas-container'>").append($cv)
	); // @TODO: update canvas

	// add a row in selector
	const $row=$("<tr>").append($block,$brushtipCanvasBlock);
	brush.$row=$row; // backward ref
	$row.click(() => {
		BrushManager.setActiveBrush(brush);
	});
	$("#brush-selector-custom").children().append($row);

	// add hash
	BrushManager.brushHash.set(brush.id,brush);
	EventDistributer.footbarHint($row,() => brush.id); // for debugging
}

BrushManager.updateBrushtipThumb=function(brush,data){ // Update canvas in selector
	const bImg=brush.brushtip;
	const cv=brush.$row.find(".brush-selector-canvas-container").children()[0];
	if(!bImg){ // clear contents
		cv.width=cv.height=0;
		return;
	}
	cv.width=bImg.width; // in fact it's a square
	cv.height=bImg.height;
	const ctx=cv.getContext("2d");
	const imgData2d=ctx.createImageData(bImg.width,bImg.height);

	// get image contents if not provided
	const pixels=data||CANVAS.renderer.getUint8ArrayFromImageData(bImg);
	for(let i=0;i<pixels.length;i+=4){ // set as white color @TODO: in renderer
		pixels[i]=255;
		pixels[i+1]=255;
		pixels[i+2]=255;
	}
	imgData2d.data.set(pixels); // copy pixel data
	ctx.putImageData(imgData2d,0,0);

	return pixels;
	// const dcv=$("#debug-canvas")[0];
	// dcv.width=bImg.width; // in fact it's a square
	// dcv.height=bImg.height;
	
	// const dctx=dcv.getContext("2d");
	// const dimgData2d=dctx.createImageData(bImg.width,bImg.height);
	
	// BrushManager.getErosionMap(bImg.width,bImg.height,pixels);
	// dimgData2d.data.set(pixels); // copy pixel data
	// dctx.putImageData(dimgData2d,0,0);
}

// ===================== Panel init ======================
BrushManager.initCustomizedBrushPanel=function(){
	EventDistributer.footbarHint($("#brush-selector-new"),() => Lang("Add new brush based on current brush"));
	EventDistributer.footbarHint($("#brush-selector-delete"),() => Lang("Delete current brush"));
	EventDistributer.footbarHint($("#brush-selector-set"),() => Lang("Set contents of current layer as brushtip"));
	EventDistributer.footbarHint($("#brush-selector-clear"),() => Lang("Reset brushtip"));

	function addNewBrush(isToCopyBrushtip){
		const brush=BrushManager.activeBrush;
		const newBrush=Object.assign({},brush);
		newBrush.id=BrushManager.generateHash(); // offer new hash
		newBrush.name=(Lang("new-brush-prefix")+newBrush.name).slice(-16); // always 16 length
		newBrush.isCustom=true; // custom flag
		BrushManager.customBrushes.push(newBrush); // add to list
		BrushManager.addCustomizedBrush(newBrush); // add to selector
		if(isToCopyBrushtip&&brush.brushtip){
			newBrush.brushtip=CANVAS.renderer.copyBrushtipImageData(brush.brushtip);
		}
		return newBrush;
	}

	$("#brush-selector-new").click(e=>{
		const newBrush=addNewBrush(true);
		if(newBrush.brushtip){ // update thumb and save brushtip
			let rawData=BrushManager.updateBrushtipThumb(newBrush);
			STORAGE.FILES.saveBrushtip(newBrush.id,rawData);
		}
		BrushManager.setActiveBrush(newBrush); // @TODO: scroll to active
		// updated in setActive
	});
	$("#brush-selector-delete").click(e=>{
		const brush=BrushManager.activeBrush;
		if(!brush.isCustom){ // cannot delete primitive brush
			return;
		}
		if(brush.brushtip){ // delete existing brushtip
			CANVAS.renderer.deleteImageData(brush.brushtip);
			STORAGE.FILES.deleteBrushtip(brush.id);
		}

		const list=BrushManager.customBrushes;
		for(let i=0;i<list.length;i++){ // find new active brush
			if(brush==list[i]){
				// set new active brush
				if(i>0){ // has a brush before
					BrushManager.setActiveBrush(list[i-1]);
				}
				else if(list.length>1){ // i==0, has a brush after
					BrushManager.setActiveBrush(list[1]);
				}
				else{ // no custom brush, set the prototype of present brush as new active
					BrushManager.setActiveBrush(BrushManager.brushes[brush.proto]);
				}

				// delete from brush list
				list.splice(i,1);
				break;
			}
		}
		brush.$row.remove(); // remove from selector
		BrushManager.brushHash.delete(brush.id);
		// update in setActive
	});
	$("#brush-selector-set").click(e=>{
		// get brushtip image data
		const nowImg=LAYERS.active.maskedImageData;
		const bImg=CANVAS.renderer.getBrushtipImageData(nowImg);
		if(!bImg){ // no pixel
			EventDistributer.footbarHint.showInfo("ERROR: No solid pixel found to set as brushtip");
			return;
		}

		let brush=BrushManager.activeBrush;
		if(!brush.isCustom){ // primitive brush, add new one
			brush=addNewBrush(false); // do not copy
		}

		// clear last brushtip (if there is one)
		if(brush.brushtip){ // already customized, change it
			CANVAS.renderer.deleteImageData(brush.brushtip);
		}
		brush.brushtip=bImg;
		let rawData=BrushManager.updateBrushtipThumb(brush);
		STORAGE.FILES.saveBrushtip(brush.id,rawData);
		
		BrushManager.setActiveBrush(brush); // update menu & selector (if new brush created)
	});
	$("#brush-selector-clear").click(e=>{
		const brush=BrushManager.activeBrush;
		if(!brush.isCustom){ // cannot clear primitive brush or empty brushtip
			return;
		}

		// clear last brushtip (if there is one)
		if(brush.brushtip){ // already customized, delete it
			CANVAS.renderer.deleteImageData(brush.brushtip);
			brush.brushtip=null;
			BrushManager.updateBrushtipThumb(brush);
			STORAGE.FILES.deleteBrushtip(brush.id);
		}
		
		BrushManager.brushMenu.update(); // update related items
	});
}

BrushManager.getErosionMap=function(w,h,pixels){ // O(n^2)
	const erMap=new Array(h);
	for(let j=0;j<h;j++){
		erMap[j]=new Float32Array(w);
		for(let i=0;i<w;i++){
			let id=(j*w+i)*4;
			erMap[j][i]=pixels[id+3]/255;
		}
	}

	const erDis=new Array(h);
	for(let j=0;j<h;j++){
		erDis[j]=new Float32Array(w);
		for(let i=0;i<w;i++){
			erDis[j][i]=1E6;
		}
	}

	for(let y=0;y<h;y++){
		for(let x=0;x<w;x++){
			// operating on pixel (x,y) of erDis
			const Axy=erMap[y][x];
			for(let dy=-3;dy<=3;dy++){
				for(let dx=-3;dx<=3;dx++){
					const [i,j]=[x+dx,y+dy];
					//if(i<0||i>=w||j<0||j>=h)continue;
					// operating on pixel (i,j) of erMap
					const Aij=(i<0||i>=w||j<0||j>=h)?0:erMap[j][i];
					const dis=Math.hypot(dx,dy);
					if(dis<=3&&Aij<0.05){ // a good estimation at the edge
						const C=((dis+1)/Math.max(Axy-Aij,1E-4)-1)*Axy*Axy;
						if(C<erDis[y][x]){
							erDis[y][x]=C;
						}
					}
				}
			}
		}
	}

	for(let t=0;t<4;t++){ // turns
		// extend
		for(let ty=0;ty<h;ty++){
			for(let tx=0;tx<w;tx++){
				let x=!(t%2)?tx:w-1-tx;
				let y=t%4<2?ty:h-1-ty;
				// operating on pixel (x,y) of erDis
				for(let dy=-3;dy<=3;dy++){
					for(let dx=-3;dx<=3;dx++){
						const [i,j]=[x+dx,y+dy];
						if(i<0||i>=w||j<0||j>=h)continue;
						const dis=Math.hypot(dx,dy);
						if(dis>3)continue;
						// operating on pixel (i,j) of erMap
						// use erDis directly accelerates the convergence
						const tDis=erDis[j][i]+dis*erMap[y][x];
						if(tDis<erDis[y][x]){
							erDis[y][x]=tDis;
						}
					}
				}
			}
		}
	}

	let maxPix=0;
	for(let j=0;j<h;j++){
		for(let i=0;i<w;i++){
			if(erDis[j][i]>maxPix){
				maxPix=erDis[j][i];
			}
		}
	}

	const minW=Math.min(w,h);
	if(maxPix<minW){
		const k=255.99/maxPix;
		for(let j=0;j<h;j++){
			for(let i=0;i<w;i++){
				let id=(j*w+i)*4;
				const t=erDis[j][i]*k;
				pixels[id]=t%16<8?0:255;
				pixels[id+3]=t;//t>64?255:0;
			}
		}
	}
	else{
		const k=255.99/minW;
		for(let j=0;j<h;j++){
			for(let i=0;i<w;i++){
				let id=(j*w+i)*4;
				const t=(erDis[j][i]).clamp(0,minW)*k;
				pixels[id]=t%16<8?0:255;
				pixels[id+3]=t;//t>127?255:0;
			}
		}
	}
}