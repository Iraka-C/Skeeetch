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
	let buttons=$("<div class='layer-buttons'>");
	let lockButton=$("<img class='layer-lock-button'>");
	let blendModeButton=$("<img class='layer-blend-mode-button'>");
	let maskButton=$("<img class='layer-mask-button'>");
	buttons.append(lockButton,blendModeButton,maskButton);
	
	EventDistributer.footbarHint(opacityLabel,()=>Lang("layer-opacity-label"));
	EventDistributer.footbarHint(lockButton,()=>Lang("Lock pixel / opacity"));
	EventDistributer.footbarHint(blendModeButton,()=>Lang("Switch blend mode"));
	EventDistributer.footbarHint(maskButton,()=>Lang("Set this layer as a clipping mask"));

	let nameLabel=$("<input class='layer-name-label'>");
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

	// prevent down event from influencing dragging
	nameLabel.on("pointerdown",event=>event.stopPropagation());
	buttons.on("pointerdown",event=>event.stopPropagation());
	buttons.children().attr("draggable","false");

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
	const oldGroupId=event.from.getAttribute("data-layer-id");
	const newGroupId=event.to.getAttribute("data-layer-id");
	const itemId=event.item.getAttribute("data-layer-id");
	const oldIndex=event.oldIndex;
	const newIndex=event.newIndex;

	let newGroup=LAYERS.layerHash[newGroupId];
	let obj=LAYERS.layerHash[itemId];
	let $div=obj.$div.detach(); // get the DOM element $
	newGroup.insert$At($div,newIndex); // insert at new place

	HISTORY.addHistory({ // add a history item
		type:"move-layer-item",
		id:itemId,
		from:oldGroupId,
		to:newGroupId,
		oldIndex:oldIndex,
		newIndex:newIndex
	});
}

// ====================== class defs ========================

class Layer{
	/**
	 * @TODO: pointer-event on layer panel doesn't allow dragging
	 */
	constructor(name){
		name=name||Lang("New Layer");
		this.id=LAYERS.generateHash();
		this.$ui=LAYERS.$newLayerUI(name,this.id);
		this.$ui.on("pointerdown",event=>{ // set active on clicking
			LAYERS.setActive(this);
		});

		// Move thumb image
		const setThumbTransform=str=>this.$thumb.css("transform",str);
		this.$ui.on("pointermove",event=>{ // move thumb image
			let offset=this.$ui.offset();
			let dx=event.pageX-offset.left,dy=event.pageY-offset.top;
			let w=this.$ui.width(),h=this.$ui.height();
			if(this.transformType=="X"){ // perform X transform
				let tx=dx/w;
				setThumbTransform("translateX("+(this.transformAmount*tx)+"px)");
			}
			else{ // perform Y transform
				let ty=dy/h;
				setThumbTransform("translateY("+(this.transformAmount*ty)+"px)");
			}
		});
		this.$ui.on("pointerout",event=>{ // reset thumb image position
			if(this.transformType=="X"){ // perform X transform
				setThumbTransform("translateX("+(this.transformAmount/2)+"px)");
			}
			else{ // perform Y transform
				setThumbTransform("translateY("+(this.transformAmount/2)+"px)");
			}
		});

		// Opacity label
		const $opacityLabel=this.$ui.children(".layer-opacity-label");
		const toOpacityString=()=>this.visible?
			(this.opacity+"%").padEnd(4,"#").replace(/#/g,"&nbsp;"):
			"----";
		SettingManager.setInputInstantNumberInteraction( // @TODO: Add to history
			$opacityLabel,
			null,
			null,
			(dW,oldVal)=>{ // set on scroll
				if(!this.visible)return; // only change on visible
				let newVal=(this.opacity+dW).clamp(0,100);
				this.opacity=newVal;
				$cv.css("opacity",newVal/100);
			},
			null, // conflict with drag
			()=>$opacityLabel.html(toOpacityString())
		);
		$opacityLabel.on("click",()=>{ // @TODO: do not draw when invisible
			this.visible=!this.visible;
			$cv.css("visibility",this.visible?"visible":"hidden");
			$opacityLabel.html(toOpacityString());
		});
		

		let $cv=$("<canvas class='layer-canvas pixelated'>");
		$cv.attr({
			"width":ENV.paperSize.width,
			"height":ENV.paperSize.height,
			"data-layer-id":this.id
		});
		
		this.opacity=100; // percentage
		this.visible=true; // is this layer not hidden?
		this.isLocked=false; // is this layer locked?
		this.isOpacityLocked=false; // is the layer opacity locked?
		this.$div=$cv;
		this.type="canvas";

		// only canvas has thumb image
		this.$thumb=this.$ui.children(".layer-ui-canvas-container").children(".layer-ui-canvas");
		// for thumb image transform
		this.transformType="X";
		this.transformAmount=0;
		// the latest image data in this layer: for history recording,
		let cv=$cv[0];
		// @TODO: for debug set this to null
		this.latestImageData=RENDER.getImageData(cv);
		// @TODO: will this affect WebGL content?
		// According to https://html.spec.whatwg.org/multipage/canvas.html#concept-canvas-context-mode yes it will
		// if resize (width=width), the context WON'T set to null again
		this.prevStatus=this._getButtonStatus(); // present button status

		this._initButtons();

		LAYERS.layerHash[this.id]=this; // submit to id hash table
	}
	/**
	 * Add the layer/group object element before
	 */
	addBefore(obj){
		this.$ui.before(obj.$ui);
		this.$div.after(obj.$div);
		HISTORY.addHistory({ // add a create new layer history item
			type:"move-layer-item",
			subType:"new",
			id:obj.id,
			from:null,
			to:obj.$ui.parent()[0].getAttribute("data-layer-id"),
			oldIndex:null,
			newIndex:obj.$ui.index()
		});
	}
	/**
	 * Update the latest imgData
	 * record history
	 * async
	 */
	updateLatestImageData(imgData){
		// update history @TODO: do not update history when no change is applied to the canvas
		let currentStatus=this._getButtonStatus();
		HISTORY.addHistory({
			type: "canvas-change",
			id: this.id,
			data: imgData,
			prevData: this.latestImageData,
			status: currentStatus,
			prevStatus: this.prevStatus
		});
		this.latestImageData=imgData;
		this.prevStatus=currentStatus;
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
	/**
	 * update all without recording history
	 * including buttons status (lock, blend, clip, etc.)
	 */
	updateSettings(imgData,status){
		this.latestImageData=imgData; // record image data
		CANVAS.setTargetLayer(this,imgData); // update RENDERER image data
		this._setButtonStatus(status); // set button status
		this.updateThumb();
	}

	// ================= init UI ==================
	/**
	 * Set the locking status of current layer
	 * 0: no lock, 1: opacity lock, 2: full lock
	 */
	

	// for all buttons
	_initButtons(){
		// Lock buttton
		const $buttons=this.$ui.children(".layer-buttons");
		const lockButton=$buttons.children(".layer-lock-button");
		const setLockButtonStatus=v=>{
			switch(v){
			case 0: // no lock
				this.isLocked=false;
				this.isOpacityLocked=false;
				lockButton.attr("src","./resources/unlock.svg");
				break;
			case 1: // opacity lock
				this.isLocked=false;
				this.isOpacityLocked=true;
				lockButton.attr("src","./resources/opacity-lock.svg");
				break;
			case 2: // full lock
				this.isLocked=true;
				this.isOpacityLocked=true;
				lockButton.attr("src","./resources/all-lock.svg");
				break;
			}
		}
		this._lockButtonUpdateFunc=SettingManager.setSwitchInteraction(lockButton,null,3,($el,v)=>{
			setLockButtonStatus(v);
		});
	}
	_getButtonStatus(){
		return {
			lock: this.isLocked?2:this.isOpacityLocked?1:0
		};
	}
	_setButtonStatus(param){
		if(param.lock!==undefined)this._lockButtonUpdateFunc(param.lock);
	}
}

class LayerGroup{
	constructor(name){
		name=name||Lang("New Group");
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
		LAYERS.layerHash[this.id]=this;
	}
	/**
	 * insert the $ui element to the i-th position of this group (as a result)
	 * in the layer panel
	 * i starts from 0
	 */
	insert$UIAt($ui,i){
		let ct=this.$ui.children(".layer-group-container");
		if(i==0){ // First position
			ct.prepend($ui);
		}
		else{ // other positions
			let $children=ct.children();
			$children.eq(i-1).after($ui);
		}
	}
	/**
	 * insert the $ element to the i-th position of this group (as a result)
	 * in the canvas container (reversed order)
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
		HISTORY.addHistory({ // add a create new layer history item
			type:"move-layer-item",
			subType:"new",
			id:obj.id,
			from:null,
			to:obj.$ui.parent()[0].getAttribute("data-layer-id"),
			oldIndex:null,
			newIndex:obj.$ui.index()
		});
	}
	/**
	 * Add the layer/group object element at the first ([0]) position
	 */
	addInside(obj){
		this.$ui.children(".layer-group-container").prepend(obj.$ui);
		this.$div.append(obj.$div);
		HISTORY.addHistory({ // add a create new layer history item
			type:"move-layer-item",
			subType:"new",
			id:obj.id,
			from:null,
			to:this.id,
			oldIndex:null,
			newIndex:0
		});
	}

	/**
	 * Expand this group
	 */
	toggleExpandCollapse(){
		let $panel=this.$ui.children(".group-title-panel");
		let $ct=this.$ui.children(".layer-group-container");
		let $button=$panel.children(".group-title-expand-button");
		$button.toggleClass("group-expanded");
		$ct.fadeToggle(250);
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
		insert$UIAt($ui,i){ // insert ui, same as LayerGroup
			let ct=$("#layer-panel-inner");
			if(i==0){ // First position
				ct.prepend($ui);
			}
			else{ // other positions
				let $children=ct.children();
				$children.eq(i-1).after($ui);
			}
		},
		insert$At:($el,i)=>{ // insert canvas panel element, same as LayerGroup
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
	layer.$ui.children(".layer-name-label").val(Lang("Background"));
	LAYERS.active.$ui.children(".layer-group-container").prepend(layer.$ui);
	LAYERS.active.$div.append(layer.$div);
	LAYERS.setActive(layer);
	RENDER.fillColor([255,255,255,255]);
	layer.latestImageData=RENDER.getImageData(); // get filled image data
	layer._setButtonStatus({
		lock:1
	}); // lock background opacity
}

/**
 * Set a layer / group as the present active object
 * Also set the canvas target to this object
 */
LAYERS.setActive=function(obj){ // layer or group or id
	if(typeof(obj)=="string"){ // id
		obj=LAYERS.layerHash[obj];
	}
	if(LAYERS.active==obj){ // already active
		return;
	}
	if(LAYERS.active){
		LAYERS._inactive();
	}
	if(obj.type=="canvas"){ // canvas layer
		obj.$ui.addClass("layer-ui-active");
		obj.$ui.children(".layer-ui-mask").addClass("layer-ui-mask-active");
		let cv=obj.$div[0];
		obj.latestImageData=cv.getContext("2d").getImageData(0,0,cv.width,cv.height); // record image data
		// @TODO: what if gl
		CANVAS.setTargetLayer(obj,obj.latestImageData); // set CANVAS draw target
	}
	else if(obj.type=="group"){ // group
		obj.$ui.addClass("layer-group-ui-active");
		// @TODO: Optimize when selecting the same canvas layer again
		CANVAS.setTargetLayer(null); // disable canvas
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
	// New Layer Button
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
	EventDistributer.footbarHint($("#new-layer-button"),()=>Lang("Add a new layer"));

	$("#new-group-button").on("click",event=>{ // new group
		let group=new LayerGroup();
		switch(LAYERS.active.type){
		case "canvas":
		case "group":LAYERS.active.addBefore(group);break;
		}
		LAYERS.setActive(group);
	});
	EventDistributer.footbarHint($("#new-group-button"),()=>Lang("Add a new layer group"));

	$("#delete-button").on("click",event=>{
		// Do not delete when only 1 child
		if(LAYERS._checkIfOnlyOneLayerLeft(LAYERS.active.id))return;
		LAYERS.deleteItem(LAYERS.active);
	});
	EventDistributer.footbarHint($("#delete-button"),()=>Lang("Delete current layer / group"));

	$("#clear-button").on("click",event=>{
		CANVAS.clearAll();
	});
	EventDistributer.footbarHint($("#clear-button"),()=>Lang("Clear current layer"));
}

LAYERS.deleteItem=function(obj){
	let nowLayer=obj;
	// check next
	let $newActive=nowLayer.$ui.next();
	if(!$newActive.length){ // check prev
		$newActive=nowLayer.$ui.prev();
	}
	if(!$newActive.length){ // check parent
		$newActive=nowLayer.$ui.parent();
	}
	// new active layer
	let newActive=LAYERS.layerHash[$newActive.attr("data-layer-id")];

	HISTORY.addHistory({ // add a delete layer history item, before detach
		type:"move-layer-item",
		subType:"delete",
		id:obj.id,
		from:obj.$ui.parent().attr("data-layer-id"),
		to:null,
		oldIndex:obj.$ui.index(),
		newIndex:null
	});

	LAYERS._inactive();
	nowLayer.$ui.detach();
	nowLayer.$div.detach();

	// remove from hash: in HISTORY.addHistory when this layer won't be retrieved

	LAYERS.setActive(newActive);
}

LAYERS._checkIfOnlyOneLayerLeft=function(toDeleteId){
	let l1=$("#canvas-layers-container").children();
	if(l1.length==1){ // only one child: empty group or layer
		l1=l1.eq(0);
		if(l1.attr("data-layer-id")==toDeleteId){ // no child after deleting this
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