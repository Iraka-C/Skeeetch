// Operation history
// each item consists of three tags:
// LAYERS.history[k]
// 	.type: draw(on layer i); add(layer after layer i); del(layer i)
// 	.id: layer id
// 	.img: imagedata after operation k
LAYERS.history=[];
LAYERS.lastOperationIndex=-1;

LAYERS.getLayerIndex=function(layer){
	var index=-1;
	for(var l=layer;l;l=l.prev){ // count id in linked list
		index++;
	}
	return index;
};

LAYERS.getLayer=function(index){
	var layer=LAYERS.elementsHead;
	for(var i=0;i<index&&layer;i++){ // find the layer in linked list
		layer=layer.next;
	}
	return layer;
};

LAYERS.addHistory=function(targetLayer,imgData,typeStr){
	//var cv=targetLayer.layerCanvas.canvas[0];
	//var imgData=cv.getContext("2d").getImageData(0,0,cv.width,cv.height); // deep copy
	return; // for debug
	LAYERS.history.splice(
		LAYERS.lastOperationIndex+1,
		LAYERS.history.length-LAYERS.lastOperationIndex,
		{ // add a history item
			type:typeStr,
			id:LAYERS.getLayerIndex(targetLayer),
			img:imgData,
			name:targetLayer.layerIcon.nameLabel[0].value
		}
	);
	if(LAYERS.history.length>50){
		LAYERS.history.shift();
	}
	LAYERS.lastOperationIndex=LAYERS.history.length-1;


	//console.log("Record History");
	//console.log(LAYERS.history);
	//console.log(LAYERS.lastOperationIndex);
};

LAYERS.undo=function(){ // undo 1 step
	if(LAYERS.lastOperationIndex<0){ // no history left
		return;
	}
	var hist=LAYERS.history[LAYERS.lastOperationIndex];

	if(hist.type=="draw"){
		var layer=LAYERS.getLayer(hist.id);
		layer.layerCanvas.canvas[0].getContext("2d").putImageData(hist.img,0,0);
	}
	else if(hist.type=="add"){
		var layer=LAYERS.getLayer(hist.id);
		setActiveLayer(layer);
		deleteLayer(layer.next);
	}
	else if(hist.type=="del"){
		var layer=addEmptyLayerAfter(hist.id>0?LAYERS.getLayer(hist.id-1):undefined);
		layer.layerIcon.nameLabel[0].value=hist.name;
		setActiveLayer(layer);
		layer.layerCanvas.canvas[0].getContext("2d").putImageData(hist.img,0,0);
	}

	LAYERS.lastOperationIndex--;

	//console.log("Undo");
	//console.log(LAYERS.history);
	//console.log(LAYERS.lastOperationIndex);
};

/*LAYERS.redo=function(){ // redo 1 step
	if(LAYERS.lastOperationIndex>=LAYERS.history.length-1){ // no history after
		return;
	}
	LAYERS.lastOperationIndex++;
	var hist=LAYERS.history[LAYERS.lastOperationIndex];

	if(hist.type=="draw"){
		var layer=LAYERS.getLayer(hist.id);
		layer.layerCanvas.canvas[0].getContext("2d").putImageData(hist.img,0,0);
	}
	console.log("Redo");
	console.log(LAYERS.history);
	console.log(LAYERS.lastOperationIndex);

};*/

LAYERS.clear=function(){
	LAYERS.history=[];
	LAYERS.lastOperationIndex=-1;
};
