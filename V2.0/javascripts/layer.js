/**
 * Layer manager
 */
LAYERS={};
LAYERS.layerHash={}; // layer id => layer object
LAYERS.active=null;

/**
 * generate a unique hash tag for every layer/group
 */
LAYERS.generateHash=function(){
	const PRIME=2147483647;
	let tag="";
	do{
		let randArr=new Uint32Array(1);
		window.crypto.getRandomValues(randArr);
		tag="i"+randArr[0]%PRIME;
	}while(LAYERS.layerHash.hasOwnProperty(tag));
	return tag;
}
// =================== Layer construction =======================
LAYERS.$newLayerUI=function(name,id){
	let layerUI=$("<div class='layer-item layer-ui'>");
	layerUI.attr("data-layer-id",id);

	let opacityLabel=$("<div class='layer-opacity-label'>").text("100%");
	let buttons=$("<div>").addClass("layer-buttons");
	let lockButton=$("<div>").html("&para;");
	let blendModeButton=$("<div>").html("&#9677;");
	let maskButton=$("<div>").html("&#8628;");
	buttons.append(lockButton,blendModeButton,maskButton);
	
	SettingHandler.addHint(opacityLabel,()=>"Change opacity. Click to hide this layer.");
	SettingHandler.addHint(lockButton,()=>"Lock pixel / opacity");
	SettingHandler.addHint(blendModeButton,()=>"Switch blend mode");
	SettingHandler.addHint(maskButton,()=>"Set this layer as a clipping mask");

	var nameLabel=$("<input class='layer-name-label'>");
	nameLabel.attr({
		"value":name,
		"type":"text",
		"maxLength":"256",
		"size":"16"
	});
	let maskUI=$("<div class='layer-ui-mask'>");
	let maskUI2=$("<div class='layer-ui-mask2'>");
	let cvUI=$("<div class='layer-ui-canvas-container'>");

	let cv=$("<canvas class='layer-ui-canvas'>");
	cv.attr({"width":1,"height":1});
	cvUI.append(cv);

	layerUI.append(cvUI,maskUI2,maskUI,opacityLabel,buttons,nameLabel);
	return layerUI;
}


LAYERS.$newLayerGroupUI=function(name,id){
	let layerGroupUI=$("<div class='layer-item layer-group-ui'>");
	layerGroupUI.attr("data-layer-id",id);

	let groupTitle=$("<div class='group-title-panel'>");
	groupTitle.append($("<div class='group-title-expand-button group-expanded'>").text(">"));

	let nameLabel=$("<input class='group-name-label'>");
	nameLabel.attr({
		"value":name,
		"type":"text",
		"maxLength":"256",
		"size":"10"
	});
	groupTitle.append(nameLabel);
	layerGroupUI.append(groupTitle);

	let groupButton=$("<div class='group-button-panel'>");
	let opacityButton=$("<div>").html("100%");
	let lockButton=$("<div>").html("&para;");
	let blendModeButton=$("<div>").html("&#9677;");
	let maskButton=$("<div>").html("&#8628;");
	let mergeButton=$("<div>").html("&#9641;");
	groupButton.append(opacityButton,lockButton,blendModeButton,maskButton,mergeButton);
	layerGroupUI.append(groupButton);

	let layerContainer=$("<div class='layer-group-container'>");
	layerContainer.attr("data-layer-id",id); // Same id as UI
	LAYERS.set$ElementAsLayerContainer(layerContainer);
	layerGroupUI.append(layerContainer);

	return layerGroupUI;
}

/**
 * Enable drag-and-sort on this element
 */
LAYERS.isDragging=false;
LAYERS.set$ElementAsLayerContainer=function($el){
	return new Sortable($el[0],{
		group:"layer-group",
		animation:200,
		fallbackOnBody:true,
		swapThreshold:0.2, // sensitivity. Better keep low
		onAdd:LAYERS.onOrderChanged, // group structure changed
		onUpdate:LAYERS.onOrderChanged, // group remains, order within group changed
		onStart:()=>{
			LAYERS.isDragging=true;
			$("#layer-panel-drag-up").css("display","block");
			$("#layer-panel-drag-down").css("display","block");
		},
		onEnd:()=>{
			LAYERS.isDragging=false;
			$("#layer-panel-drag-up").css("display","none");
			$("#layer-panel-drag-down").css("display","none");
		}
	});
}

LAYERS.onOrderChanged=function(event){
	// Before: Remove all other divs in the canvas container
	let newGroup=LAYERS.layerHash[event.to.getAttribute("data-layer-id")];
	let obj=LAYERS.layerHash[event.item.getAttribute("data-layer-id")];
	let $div=obj.$div.detach(); // get the DOM element $
	newGroup.insert$At($div,event.newIndex); // insert at new place
}

// ====================== class defs ========================

class Layer{
	/**
	 * @TODO: pointer-event on layer panel doesn't allow dragging
	 */
	constructor(name){
		name=name||"New Layer";
		this.id=LAYERS.generateHash();
		this.$ui=LAYERS.$newLayerUI(name,this.id);
		this.$ui.on("pointerdown",event=>{
			LAYERS.setActive(this);
			if(event.target==this.$ui.children("input")[0]){
				// The event is from input selection, prevent drag
				event.stopPropagation();
			}
		});
		this.$ui.on("pointermove",event=>{ // move thumb image
			let offset=this.$ui.offset();
			let dx=event.pageX-offset.left,dy=event.pageY-offset.top;
			let w=this.$ui.width(),h=this.$ui.height();
			if(this.transformType=="X"){ // perform X transform
				let tx=dx/w;
				this.$thumb.css({
					"transform":"translateX("+(this.transformAmount*tx)+"px)"
				});
			}
			else{ // perform Y transform
				let ty=dy/h;
				this.$thumb.css({
					"transform":"translateY("+(this.transformAmount*ty)+"px)"
				});
			}
		});
		this.$ui.on("pointerout",event=>{ // reset thumb image position
			if(this.transformType=="X"){ // perform X transform
				this.$thumb.css({
					"transform":"translateX("+(this.transformAmount/2)+"px)"
				});
			}
			else{ // perform Y transform
				this.$thumb.css({
					"transform":"translateY("+(this.transformAmount/2)+"px)"
				});
			}
		});

		let $cv=$("<canvas class='layer-canvas pixelated'>");
		$cv.attr({
			"width":ENV.paperSize.width,
			"height":ENV.paperSize.height,
			"data-layer-id":this.id
		});
		
		this.opacity=1;
		this.visible=true;
		this.$div=$cv;
		this.type="canvas";

		// only canvas has thumb image
		this.$thumb=this.$ui.children(".layer-ui-canvas-container").children(".layer-ui-canvas");
		// for thumb image transform
		this.transformType="X";
		this.transformAmount=0;

		LAYERS.layerHash[this.id]=this; // submit to id hash table
	}
	/**
	 * Add the layer/group object element before
	 */
	addBefore(obj){
		this.$ui.before(obj.$ui);
		this.$div.after(obj.$div);
	}
	/**
	 * Update the thumb image
	 * async
	 */
	updateThumb(){
		let cv=this.$div[0];
		let thumbCV=this.$thumb;
		let thumbCtx=thumbCV[0].getContext("2d");
		let w=cv.width,h=cv.height;
		let uW=this.$ui.width(),uH=this.$ui.height();
		
		// plave in canvas
		let kw=uW/w,kh=uH/h;
		if(kw<=kh){ // left/right overflow
			let nW=w*kh; // new width
			thumbCV.attr({ // also clear the content
				width:nW,
				height:uH
			});
			this.transformType="X";
			this.transformAmount=uW-nW;
			thumbCV.css({
				"transform":"translateX("+((uW-nW)/2)+"px)"
			});
			thumbCtx.drawImage(cv,0,0,nW,uH);
		}
		else{ // top/bottom overflow
			let nH=h*kw; // new height
			thumbCV.attr({ // also clear the content
				width:uW,
				height:nH
			});
			this.transformType="Y";
			this.transformAmount=uH-nH;
			thumbCV.css({
				"transform":"translateY("+((uH-nH)/2)+"px)"
			});
			thumbCtx.drawImage(cv,0,0,uW,nH);
		}
	}
}

class LayerGroup{
	constructor(name){
		name=name||"New Group";
		this.id=LAYERS.generateHash();
		this.$ui=LAYERS.$newLayerGroupUI(name,this.id);
		this.$ui.on("pointerdown",event=>{ // click to activate
			if($.contains(this.$ui.children(".layer-group-container")[0],event.target)){
				// The event is from one of my contains
				event.stopPropagation();
			}
			else{
				LAYERS.setActive(this);
				if(event.target==this.$ui.children(".group-title-panel").children("input")[0]){
					// The event is from input selection
					event.stopPropagation();
				}
			}
		});
		let $panel=this.$ui.children(".group-title-panel");
		let $button=$panel.children(".group-title-expand-button");
		$button.on("click",event=>{
			this.toggleExpandCollapse();
		});

		let $div=$("<div class='layer-container'>");
		$div.attr({
			"data-layer-id":this.id
		});
		this.opacity=1;
		this.visible=true;
		this.$div=$div;
		this.type="group";
		this.isExpanded=true;
		LAYERS.layerHash[this.id]=this;
	}
	/**
	 * insert the $ element to the i-th position of this group (as a result)
	 * in the canvas container
	 * i starts from 0
	 */
	insert$At($el,i){
		if(i==0){ // First position
			this.$div.append($el);
		}
		else{ // other positions
			let $children=this.$div.children();
			let cnt=$children.length;
			$children.eq(cnt-i).before($el);
		}
	}
	/**
	 * Add the layer/group object element before
	 */
	addBefore(obj){
		this.$ui.before(obj.$ui);
		this.$div.after(obj.$div);
	}
	/**
	 * Add the layer/group object element at the first position
	 */
	addInside(obj){
		this.$ui.children(".layer-group-container").prepend(obj.$ui);
		this.$div.append(obj.$div);
	}

	/**
	 * Expand this group
	 */
	toggleExpandCollapse(){
		let $panel=this.$ui.children(".group-title-panel");
		let $ct=this.$ui.children(".layer-group-container");
		let $button=$panel.children(".group-title-expand-button");
		if(this.isExpanded){ // opened, close it
			this.isExpanded=false;
			$button.removeClass("group-expanded");
			$ct.fadeOut(250);
		}
		else{ // closed, open it
			this.isExpanded=true;
			$button.addClass("group-expanded");
			$ct.fadeIn(250);
		}

	}
}



// ========================= Manipulation ===========================
/**
 * Init layer panels and functions
 */
LAYERS.init=function(){
	LAYERS.set$ElementAsLayerContainer($("#layer-panel-inner"));
	LAYERS.active=LAYERS.layerHash["root"]={ // Add the root node, set it to active
		id:"root",
		$ui:$("#layer-panel-scroll"),
		$div:$("#canvas-layers-container"),
		opacity:1,
		visible:true,
		type:"root",
		insert$At:($el,i)=>{ // insert element, same as LayerGroup
			let ct=$("#canvas-layers-container");
			if(i==0){ // First position
				ct.append($el);
			}
			else{ // other positions
				let $children=ct.children();
				let cnt=$children.length;
				$children.eq(cnt-i).before($el);
			}
		}
	};

	LAYERS.initFirstLayer();
	LAYERS.initLayerPanelButtons();
	LAYERS.initScrollbar();

	 // prevent dragging from starting a stroke on <html>
	$("#layer-panel").on("pointerdown",event=>{
		event.stopPropagation();
	});
}

/**
 * Add a first blank layer to the layer panel
 */
LAYERS.initFirstLayer=function(){
	let layer=new Layer();
	LAYERS.active.$ui.children(".layer-group-container").prepend(layer.$ui);
	LAYERS.active.$div.append(layer.$div);
	LAYERS.setActive(layer);
}

/**
 * Set a layer / group as the present active object
 * Also set the canvas target to this object
 */
LAYERS.setActive=function(obj){ // layer or group
	if(LAYERS.active==obj){ // already active
		return;
	}
	if(LAYERS.active){
		LAYERS._inactive();
	}
	if(obj.type=="canvas"){ // canvas layer
		obj.$ui.addClass("layer-ui-active");
		obj.$ui.children(".layer-ui-mask").addClass("layer-ui-mask-active");
		CANVAS.setTargetCanvas(obj.$div[0]); // set CANVAS draw target
	}
	else if(obj.type=="group"){ // group
		obj.$ui.addClass("layer-group-ui-active");
		// @TODO: Optimize when selecting the same canvas layer again
		CANVAS.setTargetCanvas(null); // disable canvas
	}
	LAYERS.active=obj;
}

// return the present active object and inactivate it
LAYERS._inactive=function(){
	if(!LAYERS.active){ // already active
		return;
	}
	if(LAYERS.active.type=="canvas"){ // canvas layer
		LAYERS.active.$ui.removeClass("layer-ui-active");
		LAYERS.active.$ui.children(".layer-ui-mask").removeClass("layer-ui-mask-active");
	}
	else if(LAYERS.active.type=="group"){ // group
		LAYERS.active.$ui.removeClass("layer-group-ui-active");
	}
	LAYERS.active=null;
}

// ======================= UI Settings =============================

LAYERS.initLayerPanelButtons=function(){
	$("#new-layer-button").on("click",event=>{ // new layer
		let layer=new Layer();
		// active type
		switch(LAYERS.active.type){
		case "canvas":
			LAYERS.active.addBefore(layer);
			break;
		case "group":
			if(LAYERS.active.isExpanded){ // opened, add inside
				LAYERS.active.addInside(layer);
			}
			else{ // closed, add before
				LAYERS.active.addBefore(layer);
			}
			break;
		}
		LAYERS.setActive(layer);
	});
	$("#new-group-button").on("click",event=>{ // new group
		let group=new LayerGroup();
		switch(LAYERS.active.type){
		case "canvas":
		case "group":LAYERS.active.addBefore(group);break;
		}
		LAYERS.setActive(group);
	});
	$("#delete-button").on("click",event=>{
		// Do not delete when only 1 child
		if(LAYERS._checkIfOnlyOneLayerLeft())return;

		let nowLayer=LAYERS.active;
		let newActive=null; // new active layer
		// check next
		let $next=nowLayer.$ui.next();
		if($next.length){
			newActive=LAYERS.layerHash[$next.attr("data-layer-id")];
		}
		else{ // check prev
			let $prev=nowLayer.$ui.prev();
			if($prev.length){
				newActive=LAYERS.layerHash[$prev.attr("data-layer-id")];
			}
			else{ // check father
				let $par=nowLayer.$ui.parent();
				if($par.length){
					newActive=LAYERS.layerHash[$par.attr("data-layer-id")];
				}
				// Should be no else here
			}
		}

		LAYERS._inactive();
		nowLayer.$ui.detach();
		nowLayer.$div.detach();

		// remove from hash.
		// not necessary when adding undo/redo: will be possibly re-used
		delete LAYERS.layerHash[nowLayer.id];

		LAYERS.setActive(newActive);

	});
}

LAYERS._checkIfOnlyOneLayerLeft=function(){
	let l1=$("#canvas-layers-container").children();
	if(l1.length==1){ // only one child: empty group or layer
		l1=l1.eq(0).children();
		if(l1.length==0){ // no child
			return true;
		}
	}
	return false;
};

LAYERS.initScrollbar=function(){
	/**
	 * When dragging in the layer list, it does not automatically scroll
	 * Add two divs that controls scrolling up/down
	 */
	
	let $scrollbar=$("#layer-panel-scroll");
	let scrollbar=$scrollbar[0];
	$("#layer-panel-drag-up").on("dragover",event=>{ // scroll upwards
		let sT=scrollbar.scrollTop;
		if(sT>0){ // space at the top
			$scrollbar.scrollTop(sT-8);
		}
	});
	$("#layer-panel-drag-down").on("dragover",event=>{ // scroll downwards
		let sH=scrollbar.scrollHeight;
		let cH=scrollbar.clientHeight;
		let sT=scrollbar.scrollTop;
		if(sH>sT+cH){ // space at the bottom
			$scrollbar.scrollTop(sT+8);
		}
	});
}