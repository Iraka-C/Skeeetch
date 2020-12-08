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
	let sourceButton=$("<div class='group-mask-button'>").append($("<img>")); // this layer as source
	groupButton.append(opacityLabel,lockButton,blendModeButton,clipMaskButton,sourceButton);
	layerGroupUI.append(groupButton);

	// Blend label hint in initButtons
	EventDistributer.footbarHint(lockButton,() => Lang("Lock pixel / opacity"));
	EventDistributer.footbarHint(clipMaskButton,() => Lang("Set this group as a clipping mask"));
	//EventDistributer.footbarHint(sourceButton,() => Lang("Activate the selection source"));

	// Layer clip mask hint
	let clipHint=$("<img class='group-clip-mask-hint' src='./resources/clip-mask-hint.svg'>");
	layerGroupUI.append(clipHint);

	let layerContainer=$("<div class='layer-group-container'>"); // The container of children
	layerContainer.attr("data-layer-id",id); // Same id as UI
	LAYERS.set$ElementAsLayerContainer(layerContainer); // Enable drag into
	layerGroupUI.append(layerContainer);
	layerGroupUI.on("pointerdown",event => {
		if(event.originalEvent.pointerType=="pen") {
			event.stopPropagation(); // cancel the following "drag" event on pen
		}
	});

	nameLabel.on("pointerdown",event => event.stopPropagation());
	opacityLabel.on("pointerdown",event => event.stopPropagation());
	groupButton.on("pointerdown",event => event.stopPropagation());

	return layerGroupUI;
}

// ============= Node ===============
class LayerGroupNode extends ContentNode {
	constructor(id) {
		super(id);
		this.$ui=LAYERS.$newLayerGroupUI(this.id); // set ui in layer list

		// Properties
		this.isExpanded=true; // is the container of this group expanded?

		this.name=Lang("New Group");
		this._setName(this.name); // For DEBUG

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
		this.initInputs();
	}
	getName() {
		// get the displayed name of this layer
		return this.name;
	}
	_setName(name) {
		// set the displayed name of this layer
		this.$ui.children(".group-title-panel").children(".group-name-label").val(name);
		this.name=name;
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
		this.$ui.remove(); // remove all event handlers
		super.delete();
	}
	discardNonLeafImageData(){ // preserve all leaves, discard intermediate image data
		this.assignNewRawImageData(0,0);
		this.assignNewImageData(0,0);
		this.setRawImageDataInvalid();
		for(const v of this.children){
			if(v instanceof LayerGroupNode){
				v.discardNonLeafImageData();
			}
		}
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
					this.updateThumb(); // dimensions renewed
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
			HISTORY.addHistory({ // add a history
				type: "node-property",
				id: this.id,
				prevStatus: {isExpanded: !this.isExpanded},
				nowStatus: {isExpanded: this.isExpanded}
			});
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
		const lockButtonHistoryCallback={ // callback function for clicking lock button
			prevStatus: null,
			before: () => {
				lockButtonHistoryCallback.prevStatus={
					locked: this.properties.locked,
					pixelOpacityLocked: this.properties.pixelOpacityLocked
				};
			},
			after: () => {
				HISTORY.addHistory({ // add a history
					type: "node-property",
					id: this.id,
					prevStatus: lockButtonHistoryCallback.prevStatus,
					nowStatus: {
						locked: this.properties.locked,
						pixelOpacityLocked: this.properties.pixelOpacityLocked
					}
				});
			}
		};
		// Operating on this function is equivalent to the user's pressing the button
		const fLock=SettingManager.setSwitchInteraction($lockButton,null,3,($el,v) => {
			setLockButtonStatus(v);
		},lockButtonHistoryCallback);
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
					this.$ui.children(".group-clip-mask-hint").css("display","none");
					break;
				case 1: // clip mask
					this.properties.clipMask=true;
					$clipButtonImg.css("opacity","1");
					this.$ui.children(".group-clip-mask-hint").css("display","block");
					break;
			}
		}
		const clipButtonHistoryCallback={ // callback function for clicking clip mask button
			before: null,
			after: () => {
				HISTORY.addHistory({ // add a history
					type: "node-property",
					id: this.id,
					prevStatus: {clipMask: !this.properties.clipMask},
					nowStatus: {clipMask: this.properties.clipMask}
				});
			}
		};
		const fClip=SettingManager.setSwitchInteraction($clipButton,null,2,($el,v) => {
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
		},clipButtonHistoryCallback);
		this.buttonUpdateFuncs.clipButton=()=>fClip(this.properties.clipMask? 1:0);

		// blend mode button
		const $blendButton=$buttons.find(".group-blend-mode-button");
		EventDistributer.footbarHint($blendButton,() => Lang("Switch blend mode")
			+": "+BasicRenderer.blendModeEnumToDisplayedName(this.properties.blendMode));
		$blendButton.on("click",e=>{
			if(this.properties.locked)return; // cannot change
			LAYERS.blendModeSelector.setCaller(this);
			const bOffset=$blendButton.offset();
			const bW=$blendButton.width();
			const bH=$blendButton.height();
			LAYERS.blendModeSelector.show({
				width: bW,
				height: bH,
				left: bOffset.left,
				top: bOffset.top
			});
		});
		const setBlendButtonStatus=mode => {
			this.properties.blendMode=mode;
			const $blendButtonImg=$blendButton.children("img");
			$blendButtonImg.attr("src","./resources/blend-mode/"
				+LayerBlendModeSelector.blendModeEnumToFilename(mode)+".svg");
		};
		
		this.buttonUpdateFuncs.blendButton=() => {
			setBlendButtonStatus(this.properties.blendMode);
			this.setImageDataInvalid();
			COMPOSITOR.updateLayerTreeStructure(); // recomposite immediately
		};
		this.buttonUpdateFuncs.blendButton(); // init

	}
	// Name and opacity inputs
	initInputs() {
		const $opacityLabel=this.$ui.children(".group-button-panel").children(".group-opacity-label");
		const $opacityInput=$opacityLabel.children("input");
		const setOpacity=opacity => { // set opacity function
			if(this.properties.locked)return; // locked, doen't change
			const prevOpacity=this.properties.opacity;
			this.properties.opacity=opacity;
			this.setImageDataInvalid(); // In fact this is a little more, only need to set parent/clip parent
			HISTORY.addHistory({ // add a history
				type: "node-property",
				id: this.id,
				prevStatus: {opacity: prevOpacity},
				nowStatus: {opacity: opacity}
			});
			CANVAS.requestRefresh(); // refresh screen afterwards, no need to change layerTree cache
		};
		const opacityString=() => { // show opacity input
			return this.properties.visible? Math.round(this.properties.opacity*100)+"%":"----";
		}
		SettingManager.setInputInstantNumberInteraction(
			$opacityInput,$opacityLabel,
			newVal => { // input update
				if(!this.properties.visible) return;
				newVal=parseFloat(newVal).clamp(0,100); // string to number
				if(isNaN(newVal)) { // not a number, return initial rotation
					return;
				}
				setOpacity(newVal/100);
			},
			(dw,oldVal) => { // scroll update
				if(!this.properties.visible) return;
				let newOpa=(this.properties.opacity+dw/20).clamp(0,1);
				setOpacity(newOpa);
			},
			(dx,oldVal) => { // drag update, @TODO: why area restricted?
				if(!this.properties.visible) return;
				oldVal=parseFloat(oldVal);
				let newVal=(oldVal+dx/2).clamp(0,100);
				setOpacity(newVal/100);
			},
			() => $opacityInput.val(opacityString())
		);

		let lastClickT=0; // check for double click
		let lastClickIsDoubleClick=false; // prevent triple click recognized as two double clicks
		$opacityInput.on("pointerdown",event => {
			const oE=event.originalEvent;
			// double click
			const nowClickT=Date.now();
			const isDoubleClickedFired=(oE.buttons&1)&&EventDistributer.isDoubleClicked(nowClickT-lastClickT);
			lastClickT=nowClickT;

			const isDoubleClicked=(isDoubleClickedFired&&!lastClickIsDoubleClick);
			lastClickIsDoubleClick=isDoubleClicked;

			if(isDoubleClicked||(oE.buttons>>1)&1||(oE.buttons&1)&&(EVENTS.key.ctrl||EVENTS.key.shift)) {
				// double or right or left-with-ctrl/shift
				const newVisibility=!this.properties.visible;
				this.properties.visible=newVisibility
				$opacityInput.val(opacityString());
				HISTORY.addHistory({ // add a history
					type: "node-property",
					id: this.id,
					prevStatus: {visible: !newVisibility},
					nowStatus: {visible: newVisibility}
				});
				this.setImageDataInvalid(); // In fact this is a little more: when this layer has clip layer children
				// @TODO: modify here if it is a performance bottleneck, and the place above
				COMPOSITOR.updateLayerTreeStructure();
			}
		});
		EventDistributer.footbarHint($opacityLabel,() => Lang(
			this.properties.visible? "layer-opacity-label-shown":"layer-opacity-label-hidden"));

		// ================ Name Input =================
		const $nameInput=this.$ui.children(".group-title-panel").children(".group-name-label");
		$nameInput.on("change",event => { // Input
			const prevName=this.getName();
			this.name=$nameInput.val();
			// Do some checks here
			HISTORY.addHistory({ // add a history
				type: "node-property",
				id: this.id,
				prevStatus: {name: prevName},
				nowStatus: {name: this.getName()}
			});
		});
		EventDistributer.footbarHint($nameInput,() => EVENTS.key.shift?this.id:"");
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
			this._setName(prop.name); // Change UI instantly!
		}
		if(prop.isExpanded!==undefined){
			this.isExpanded=prop.isExpanded;
		}
		super.setProperties(prop); // update button ui here
	}
	updatePropertyUI(){ // update all UIs
		const prop=this.properties;
		this.buttonUpdateFuncs.expandButton();
		this.buttonUpdateFuncs.lockButton();
		this.buttonUpdateFuncs.clipButton();
		this.buttonUpdateFuncs.blendButton();
		// @TODO: mask button
		this.$ui
		.children(".group-button-panel")
		.children(".group-opacity-label")
		.children("input")
		.val(prop.visible? Math.round(prop.opacity*100)+"%":"----");
	}
	updateThumb(){ // iterative
		if(!this.isExpanded)return; // no need to update invisible thumb
		for(const v of this.children){
			v.updateThumb();
		}
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
			/**
			 * **NOTE**
			 * modified ag-psd function addChildren(): group blend type keys
			 */
		});
	}

	getStorageJSON(){
		return Object.assign(super.getStorageJSON(),{
			isExpanded: this.isExpanded,
			type: "LayerGroupNode"
		}); // extra expanded info
	}
}