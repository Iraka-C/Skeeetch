LAYERS={};
LAYERS.elementsHead=undefined; // linked list
LAYERS.activeLayer=undefined;
LAYERS.globalID=1;

// ================ classes ================
LayerIcon=function(fatherLayer){
	this.father=fatherLayer;

	var icon=$("<div/>").addClass("layer-icon");

	var opacityLabel=$("<div/>").text("100%").addClass("layer-opacity-label");

	var buttons=$("<div/>").addClass("layer-buttons");
	var opacityLockButton=$("<div/>").html("&equiv;");
	var settingButton=$("<div/>").html("&para;");
	buttons.append(opacityLockButton).append(settingButton);

	var layerName="Layer "+(LAYERS.globalID++);
	var nameLabel=$("<input/>").addClass("layer-name-label");
	nameLabel.attr({
		"value":layerName,
		"type":"text",
		"maxLength":24,
		"size":12
	});

	icon.append(opacityLabel).append(buttons).append(nameLabel);
	this.icon=icon;
	this.opacityLockButton=opacityLockButton;
	this.settingButton=settingButton;
	this.opacityLabel=opacityLabel;
	this.nameLabel=nameLabel;
}

LayerCanvas=function(fatherLayer){
	this.father=fatherLayer;

	var cv=$("<canvas/>").addClass("layer-canvas").addClass("pixelated");
	cv.attr({"width":ENV.paperSize.width,"height":ENV.paperSize.height});
	this.canvas=cv;
	this.opacity=100;
	this.visible=true;
}

Layer=function(){ // Constructor
	this.layerIcon=new LayerIcon(this);
	this.layerIcon.icon.click(()=>setActiveLayer(this));

	this.opacityLocked=false;
	this.layerIcon.opacityLockButton.click(()=>{
		this.opacityLocked=!this.opacityLocked;
		this.layerIcon.opacityLockButton.html(this.opacityLocked?"&ne;":"&equiv;");
	});

	this.layerCanvas=new LayerCanvas(this);

	// change opacity
	EVENTS.wheelEventDistributor.addListener(this.layerIcon.opacityLabel,event=>{
		var e=event.originalEvent;
		LAYERS.changeOpacity(e,this);
		e.stopPropagation();
		return false;
	});
	this.layerIcon.opacityLabel.on("click",event=>{
		var cvl=this.layerCanvas;
		cvl.visible=!cvl.visible;
		this.layerIcon.opacityLabel.html(cvl.visible?cvl.opacity+"%":"----");
		cvl.canvas.css("visibility",cvl.visible?"visible":"hidden");
	});
}

LAYERS.changeOpacity=function(e,layer){
	if(layer.layerCanvas.visible==false)return;
	var nowOp=layer.layerCanvas.opacity;
	if(e.wheelDelta>0&&nowOp<100)nowOp++;
	if(e.wheelDelta<0&&nowOp>0)nowOp--;

	layer.layerCanvas.canvas.css("opacity",nowOp/100);
	layer.layerCanvas.opacity=nowOp;
	layer.layerIcon.opacityLabel.html(nowOp+"%");
}
// ================ functions ================

LAYERS.init=function(){
	var firstLayer=new Layer();
	// lock layer
	firstLayer.opacityLocked=true;
	firstLayer.layerIcon.opacityLockButton.html("&ne;");
	PIXEL.fillCanvas(firstLayer.layerCanvas.canvas[0],{r:255,g:255,b:255,a:1},true);

	$("#layers").append(firstLayer.layerIcon.icon);
	$("#canvas_container").append(firstLayer.layerCanvas.canvas);
	LAYERS.elementsHead=firstLayer;
	firstLayer.next=undefined;
	firstLayer.prev=undefined;
	setActiveLayer(firstLayer);

	// handle them by yourself
	$("#layer_new_button").click(addNewEmptyLayer);
	$("#layer_delete_button").click(deleteActiveLayer);
	$("#layer_delete_button").addClass("layer-button-disabled");

	// clear layer
	$("#layer_clear_button").click(()=>{
		var cv=LAYERS.activeLayer.layerCanvas.canvas[0];
		LAYERS.addHistory(LAYERS.activeLayer,cv.getContext("2d").getImageData(0,0,cv.width,cv.height),"draw");
		if(!LAYERS.activeLayer.opacityLocked){
			cv.width=cv.width;
		}
		else{
			PIXEL.fillCanvas(cv,{r:255,g:255,b:255,a:1},false);
		}
	});
};

function setActiveLayer(layer){
	if(LAYERS.activeLayer){
		LAYERS.activeLayer.layerIcon.icon.removeClass("layer-active");
	}
	LAYERS.activeLayer=layer;
	layer.layerIcon.icon.addClass("layer-active");
}

function addEmptyLayerAfter(targetLayer){
	// function returns the newly added layer
	var layer=new Layer();
	if(!targetLayer){ // add at front
		$("#layers").append(layer.layerIcon.icon);
		$("#canvas_container").prepend(layer.layerCanvas.canvas);
		layer.next=LAYERS.elementsHead;
		LAYERS.elementsHead.prev=layer;
		layer.prev=undefined;
		LAYERS.elementsHead=layer;
	}
	else{
		targetLayer.layerIcon.icon.before(layer.layerIcon.icon);
		targetLayer.layerCanvas.canvas.after(layer.layerCanvas.canvas);

		// Construct linked list
		layer.next=targetLayer.next;
		layer.prev=targetLayer;
		if(targetLayer.next){
			targetLayer.next.prev=layer;
		}
		targetLayer.next=layer;
	}

	return layer;
}

function addNewEmptyLayer(){
	// Append a layer above the now active layer
	LAYERS.addHistory(LAYERS.activeLayer,undefined,"add");
	var nowActiveLayer=LAYERS.activeLayer;
	var layer=addEmptyLayerAfter(nowActiveLayer);
	setActiveLayer(layer);
	$("#layer_delete_button").removeClass("layer-button-disabled");
	EVENTS.refreshSettingPanel();
}

function addNewImageLayer(img){
	addNewEmptyLayer();
	var nowActiveLayer=LAYERS.activeLayer;
	if(img.filename){
		nowActiveLayer.layerIcon.nameLabel[0].value=img.filename;
	}

	var cv=nowActiveLayer.layerCanvas.canvas[0];
	var w=img.width;
	var h=img.height;
	var tw=cv.width;
	var th=cv.height;
	if(w>tw||h>th){
		var rx=tw/w,ry=th/h;
		var r=Math.min(rx,ry);
		w*=r;h*=r;
	}
	cv.getContext("2d").drawImage(img,0,0,w,h);
	window.URL.revokeObjectURL(img.src);
}

function deleteLayer(layer){
	if(!layer.prev){ // layer is the element head
		LAYERS.elementsHead=layer.next;
	}

	// delete this layer from LAYERS.elements and DOM
	layer.layerIcon.icon.remove();
	layer.layerCanvas.canvas.remove();
	if(layer.next){
		layer.next.prev=layer.prev;
	}
	if(layer.prev){
		layer.prev.next=layer.next;
	}
}

function deleteActiveLayer(){
	LAYERS.addHistory(
		LAYERS.activeLayer,
		LAYERS.activeLayer.layerCanvas.canvas[0].getContext("2d").getImageData(0,0,ENV.paperSize.width,ENV.paperSize.height),
		"del"
	);
	var layerCnt=$("#layers").children().length;
	if(layerCnt<=1){
		return;
	}
	else if(layerCnt==2){ // can't delete the next layer
		$("#layer_delete_button").addClass("layer-button-disabled");
	}

	// >1 layers, must be next or prev
	var nowActiveLayer=LAYERS.activeLayer;
	var newActiveLayer=nowActiveLayer.prev;
	if(!newActiveLayer){ // nowActiveLayer is the element head
		newActiveLayer=nowActiveLayer.next;
	}

	// delete this layer from LAYERS.elements and DOM
	deleteLayer(nowActiveLayer);

	// redirect to the new layer
	setActiveLayer(newActiveLayer);
	EVENTS.refreshSettingPanel();
}
