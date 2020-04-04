// ================ UI ==================
LAYERS.$newLayerGroupUI=function(id) {
	let layerGroupUI=$("<div class='layer-item layer-group-ui'>");
	layerGroupUI.attr("data-layer-id",id);

	let groupTitle=$("<div class='group-title-panel'>");
	groupTitle.append($("<div class='group-title-expand-button group-expanded'>").text(">"));

	let nameLabel=$("<input class='group-name-label'>");
	nameLabel.attr({"value": "","type": "text","maxLength": "256","size": "10"});
	EVENTS.disableInputSelection(nameLabel);
	groupTitle.append(nameLabel);
	layerGroupUI.append(groupTitle);

	let groupButton=$("<div class='group-button-panel'>");
	// Opacity
	let opacityLabel=$("<div class='group-opacity-label'>");
	let opacityInput=$("<input class='group-opacity-input'>");
	opacityInput.attr({"value": "100%","type": "text","maxLength": "4","size": "4"});
	opacityLabel.append(opacityInput);
	// Others
	let lockButton=$("<div class='group-lock-button'>").append($("<img>")); // group lock
	let blendModeButton=$("<div class='group-blend-mode-button'>").append($("<img>")); // group blend mode
	let clipMaskButton=$("<div class='group-clip-mask-button'>").append($("<img>")); // group clip mask
	let maskButton=$("<div class='group-mask-button'>").append($("<img>")); // layer mask
	groupButton.append(opacityLabel,lockButton,blendModeButton,clipMaskButton,maskButton);
	layerGroupUI.append(groupButton);

	let layerContainer=$("<div class='layer-group-container'>"); // The container of children
	layerContainer.attr("data-layer-id",id); // Same id as UI
	LAYERS.set$ElementAsLayerContainer(layerContainer); // Enable drag into
	layerGroupUI.append(layerContainer);
	layerGroupUI.on("pointerdown",event => {
		if(event.originalEvent.pointerType=="pen") {
			event.stopPropagation(); // cancel the following "drag" event on pen
		}
	});
	return layerGroupUI;
}

// ============= Node ===============
class LayerGroupNode extends ContentNode {
	constructor() {
		super();
		this.$ui=LAYERS.$newLayerGroupUI(this.id); // set ui in layer list

		// Properties
		this.isExpanded=true; // is the container of this group expanded?
		
		this.setName(this.id/*Lang("New Group")*/); // For DEBUG
		this.$ui.on("pointerdown",event => { // click to activate
			if($.contains(this.$ui.children(".layer-group-container")[0],event.target)) {
				// The event is from one of my containings
				event.stopPropagation();
			}
			else {
				LAYERS.setActive(this);
				if(event.target==this.$ui.children(".group-title-panel").children("input")[0]) {
					// The event is from input selection
					event.stopPropagation();
				}
			}
		});

		// init property button operation
		this.initButtons();
	}
	setName(name) {
		// set the displayed name of this layer
		this.$ui.children(".group-title-panel").children(".group-name-label").val(name);
	}
	getName(){
		return this.$ui.children(".group-title-panel").children(".group-name-label").val();
	}
	setActiveUI(isActive) {
		// Expected: set the UI effect of this node
		if(isActive) {
			this.$ui.addClass("layer-group-ui-active");
		}
		else {
			this.$ui.removeClass("layer-group-ui-active");
		}
	}
	insertNode$UI($ui,pos) { // insert a new node ui into children at pos
		const ct=this.$ui.children(".layer-group-container");
		if(!pos) { // First position: pos===undefined or pos===0
			ct.prepend($ui);
		}
		else { // other positions
			const $children=ct.children();
			$children.eq(pos-1).after($ui);
		}
	}
	delete() {
		for(let v of this.children) {
			v.delete();
		}
		super.delete();
	}
	// ================= button =================
	initButtons(){
		const $buttons=this.$ui.children(".group-button-panel");
		this.buttonUpdateFuncs={};

		// Expand/Collapse button
		const titlePanel=this.$ui.children(".group-title-panel");
		const expandButton=titlePanel.children(".group-title-expand-button");
		const updateExpandUI=()=>{
			let $ct=this.$ui.children(".layer-group-container");
			if(this.isExpanded){
				// Won't have any effect if is already open
				expandButton.addClass("group-expanded");
				$ct.removeClass("layer-group-container-collapsed");
				$ct.slideDown(250,()=>{ // update scrollbar after toggle
					LAYERS._updateScrollBar(true);
				});
			}
			else{
				expandButton.removeClass("group-expanded");
				$ct.addClass("layer-group-container-collapsed");
				$ct.slideUp(250,()=>{ // update scrollbar after toggle
					LAYERS._updateScrollBar(true);
				});
			}
		}
		expandButton.on("click",e=>{
			this.isExpanded=!this.isExpanded;
			updateExpandUI();
		});
		this.buttonUpdateFuncs.expandButton=updateExpandUI;

		// Lock button
		const $lockButton=$buttons.find(".group-lock-button");
		const setLockButtonStatus=v => {
			const $lockButtonImg=$lockButton.children("img");
			switch(v) {
				case 0: // no lock
					this.properties.locked=false;
					this.properties.pixelOpacityLocked=false;
					$lockButtonImg.attr("src","./resources/unlock.svg");
					break;
				case 1: // opacity lock
					this.properties.locked=false;
					this.properties.pixelOpacityLocked=true;
					$lockButtonImg.attr("src","./resources/opacity-lock.svg");
					break;
				case 2: // full lock
					this.properties.locked=true;
					this.properties.pixelOpacityLocked=true;
					$lockButtonImg.attr("src","./resources/all-lock.svg");
					break;
			}
		}
		// Operating on this function is equivalent to the user's pressing the button
		const fLock=SettingManager.setSwitchInteraction($lockButton,null,3,($el,v) => {
			// @TODO: add history here
			setLockButtonStatus(v);
		});
		this.buttonUpdateFuncs.lockButton=() => fLock(
			this.properties.locked? 2:
				this.properties.pixelOpacityLocked? 1:0
		);

		// Clip mask button
		const $clipButton=$buttons.find(".group-clip-mask-button");
		const setClipMaskButtonStatus=v => {
			const $clipButtonImg=$clipButton.children("img");
			$clipButtonImg.attr("src","./resources/clip-mask.svg");
			switch(v) {
				case 0: // normal
					this.properties.clipMask=false;
					$clipButtonImg.css("opacity","0.25"); // color deeper than canvas code
					this.$ui.children(".layer-clip-mask-hint").css("display","none");
					break;
				case 1: // clip mask
					this.properties.clipMask=true;
					$clipButtonImg.css("opacity","1");
					this.$ui.children(".layer-clip-mask-hint").css("display","block");
					break;
			}
		}
		const fClip=SettingManager.setSwitchInteraction($clipButton,null,2,($el,v) => {
			// @TODO: add history here
			setClipMaskButtonStatus(v);
			if(this.parent) { // when attached
				const siblings=this.parent.children;
				const prevClipParent=siblings[this.clipMaskParentIndex]; // clip parent before changing
				this.parent.setClipMaskOrderInvalid(); // The parent's clip mask order array will change
				this.parent.constructClipMaskOrder(); // to get the new clip mask parent of this node
				const clipParent=siblings[this.clipMaskParentIndex]; // the clip mask parent of this node
				// The logic here is the same as the function in CanvasNode
				prevClipParent.setImageDataInvalid();
				clipParent.setImageDataInvalid();
				COMPOSITOR.updateLayerTreeStructure(); // recomposite
			}
		});
		this.buttonUpdateFuncs.clipButton=()=>fClip(this.properties.clipMask? 1:0);

		// blend mode button
		const $blendButton=$buttons.find(".group-blend-mode-button");
		const setBlendButtonStatus=v => {
			const $blendButtonImg=$blendButton.children("img");
			switch(v) {
				case 0: // normal
					this.properties.blendMode=BasicRenderer.NORMAL;
					$blendButtonImg.attr("src","./resources/blend-mode/normal.svg");
					break;
				case 1: // multiply
					this.properties.blendMode=BasicRenderer.MULTIPLY;
					$blendButtonImg.attr("src","./resources/blend-mode/multiply.svg");
					break;
				case 2: // screen
					this.properties.blendMode=BasicRenderer.SCREEN;
					$blendButtonImg.attr("src","./resources/blend-mode/screen.svg");
					break;
			}
		}
		const fBlend=SettingManager.setSwitchInteraction($blendButton,null,3,($el,v) => {
			// @TODO: add history here
			setBlendButtonStatus(v);
			this.setImageDataInvalid();
			COMPOSITOR.updateLayerTreeStructure(); // recomposite immediately
		});
		const blendModeToIdList=mode=>{
			switch(mode){
				default:
				case BasicRenderer.NORMAL: return 0;
				case BasicRenderer.MULTIPLY: return 1;
				case BasicRenderer.SCREEN: return 2;
			}
		};
		this.buttonUpdateFuncs.blendButton=()=>fBlend(blendModeToIdList(this.properties.blendMode));
	}
	// =========== Properties =============
	getProperties() {
		let prop=super.getProperties();
		return Object.assign(prop,{
			name: this.getName(),
			isExpanded: this.isExpanded
		});
	}
	setProperties(prop) {
		if(prop.name!==undefined){
			this.setName(prop.name); // Change UI instantly!
		}
		if(prop.isExpanded!==undefined){
			this.isExpanded=prop.isExpanded;
		}
		super.setProperties(prop); // update button ui here
	}
	updatePropertyUI(){ // update all UIs
		this.buttonUpdateFuncs.expandButton();
		this.buttonUpdateFuncs.lockButton();
		this.buttonUpdateFuncs.clipButton();
		this.buttonUpdateFuncs.blendButton();
	}
	// ============== Export Control ================
	getAgPSDCompatibleJSON(){
		let json=super.getAgPSDCompatibleJSON();

		let childrenJson=[];
		for(let v=this.children.length-1;v>=0;v--){ // reversed order
			// Add the JSON source from children
			childrenJson.push(this.children[v].getAgPSDCompatibleJSON());
		}

		return Object.assign(json,{
			"opened": this.isExpanded,
			"children": childrenJson
		});
	}
}