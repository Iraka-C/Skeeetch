BrushManager.initBrushSelector=function() {
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



	// customized brush table
	const $customTable=$("<table class='custom-brush-table'>");
	$("#brush-selector-custom").append($customTable);
	// for(const brush of BrushManager.brushes) {
	// 	BrushManager.addCustomizedBrush(brush);
	// }
	BrushManager.initCustomizedBrush();
}

BrushManager.customBrushes=[];
BrushManager.addCustomizedBrush=function(brush){
	// add clickable block
	const $block=$("<td class='brush-selector-custom-item'>");
	const $blockInput=$("<input class='custom-brush-name-label'>");
	$blockInput.attr({"value":brush.name,"type": "text","maxLength": "16"});
	$blockInput.on("change",event => { // change name
		brush.name=$blockInput.val();
	});
	$block.append($blockInput);

	// add brushtip canvas
	const $cv=$("<canvas>");
	$cv.attr({"width": 0,"height": 0});
	const $brushtipCanvasBlock=$("<td>").append(
		$("<div class='brush-selector-canvas-container'>").append($cv)
	);

	// add a row in selector
	const $row=$("<tr>").append($block,$brushtipCanvasBlock);
	brush.$row=$row; // backward ref
	$row.click(() => {
		BrushManager.setActiveBrush(brush);
	});
	$("#brush-selector-custom").children().append($row);
}
BrushManager.initCustomizedBrush=function(){
	$("#brush-selector-new").click(e=>{
		const brush=BrushManager.activeBrush;
		const newBrush=Object.assign({},brush);
		newBrush.name=(Lang("new-brush-prefix")+newBrush.name).slice(-16); // always 16 length
		newBrush.isCustom=true; // custom flag
		BrushManager.customBrushes.push(newBrush); // add to list
		BrushManager.addCustomizedBrush(newBrush); // add to selector
		BrushManager.setActiveBrush(newBrush); // @TODO: scroll to active
	});
	$("#brush-selector-delete").click(e=>{
		const brush=BrushManager.activeBrush;
		if(!brush.isCustom){ // cannot delete primitive brush
			return;
		}
		if(brush.brushtip){ // delete existing brushtip // @TODO delete saved brush
			CANVAS.renderer.deleteImageData(brush.brushtip);
		}

		const list=BrushManager.customBrushes;
		for(let i=0;i<list.length;i++){
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
	});
	$("#brush-selector-set").click(e=>{
		const brush=BrushManager.activeBrush;
		if(!brush.isCustom){ // cannot set primitive brush
			return;
		}

		// get brushtip image data
		const nowImg=LAYERS.active.maskedImageData;
		const bImg=CANVAS.renderer.getBrushtipImageData(nowImg);
		if(!bImg){ // no pixel
			return;
		}

		// clear last brushtip (if there is one)
		if(brush.brushtip){ // already customized, change it
			CANVAS.renderer.deleteImageData(brush.brushtip);
		}
		brush.brushtip=bImg;

		// Update selector canvas
		const cv=brush.$row.find(".brush-selector-canvas-container").children()[0];
		cv.width=bImg.width; // in fact it's a square
		cv.height=bImg.height;
		const ctx=cv.getContext("2d");
		const imgData2d=ctx.createImageData(bImg.width,bImg.height);

		// get image contents
		const pixels=CANVAS.renderer.getUint8ArrayFromImageData(bImg,null,[bImg.width,bImg.height]);
		for(let i=0;i<pixels.length;i+=4){ // set as white color
			pixels[i]=255;
			pixels[i+1]=255;
			pixels[i+2]=255;
		}
		imgData2d.data.set(pixels); // copy pixel data
		ctx.putImageData(imgData2d,0,0);
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
			
			const cv=brush.$row.find(".brush-selector-canvas-container").children()[0];
			cv.width=0; // clear
			cv.height=0;
		}
	});
}