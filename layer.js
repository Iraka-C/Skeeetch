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

	var cv=$("<canvas/>").addClass("layer-canvas");
	cv.attr({"width":ENV.paperSize.width,"height":ENV.paperSize.height});
	this.canvas=cv;
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
}

// ================ functions ================

LAYERS.init=function(){
	var firstLayer=new Layer();
	$("#layers").append(firstLayer.layerIcon.icon);
	$("#canvas_container").append(firstLayer.layerCanvas.canvas);
	LAYERS.elementsHead=firstLayer;
	firstLayer.next=undefined;
	firstLayer.prev=undefined;
	setActiveLayer(firstLayer);

	$("#layer_new_button").click(addNewEmptyLayer);
	$("#layer_delete_button").click(deleteActiveLayer);
	$("#layer_delete_button").addClass("layer-button-disabled");
};

function setActiveLayer(layer){
	if(LAYERS.activeLayer){
		LAYERS.activeLayer.layerIcon.icon.removeClass("layer-active");
	}
	LAYERS.activeLayer=layer;
	layer.layerIcon.icon.addClass("layer-active");
}

function addNewEmptyLayer(){
	// Append a layer above the now active layer
	var layer=new Layer();
	var nowActiveLayer=LAYERS.activeLayer;
	nowActiveLayer.layerIcon.icon.before(layer.layerIcon.icon);
	nowActiveLayer.layerCanvas.canvas.after(layer.layerCanvas.canvas);

	// Construct linked list
	layer.next=nowActiveLayer.next;
	layer.prev=nowActiveLayer;
	if(nowActiveLayer.next){
		nowActiveLayer.next.prev=layer;
	}
	nowActiveLayer.next=layer;

	setActiveLayer(layer);
	$("#layer_delete_button").removeClass("layer-button-disabled");
}

function deleteActiveLayer(){
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
		LAYERS.elementsHead=newActiveLayer;
	}

	// delete this layer from LAYERS.elements and DOM
	nowActiveLayer.layerIcon.icon.remove();
	nowActiveLayer.layerCanvas.canvas.remove();
	if(nowActiveLayer.next){
		nowActiveLayer.next.prev=nowActiveLayer.prev;
	}
	if(nowActiveLayer.prev){
		nowActiveLayer.prev.next=nowActiveLayer.next;
	}

	// redirect to the new layer
	setActiveLayer(newActiveLayer);
}
