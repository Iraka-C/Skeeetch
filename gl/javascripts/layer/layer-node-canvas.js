// ================ UI ==================
LAYERS.$newCanvasLayerUI=function(id) {
	let layerUI=$("<div class='layer-item layer-ui'>");
	layerUI.attr("data-layer-id",id); // set id tag

	// Opacity Label
	let opacityLabel=$("<div class='layer-opacity-label'>"); // @TODO: change to input
	let opacityInput=$("<input class='layer-opacity-input'>");
	opacityInput.attr({"value": "100%","type": "text","maxLength": "4","size": "4"});
	opacityLabel.append(opacityInput);

	// Layer buttons
	let buttons=$("<div class='layer-buttons'>");
	let lockButton=$("<div class='layer-lock-button'>").append($("<img>")); // layer lock

	// blend mode selector
	let blendModeButton=$("<div class='layer-blend-mode-button layer-button-to-hide'>").append($("<img>")); // layer blend mode

	// clip mask and source buttons
	let clipMaskButton=$("<div class='layer-clip-mask-button layer-button-to-hide'>").append($("<img>")); // layer clip mask
	let sourceButton=$("<div class='layer-source-button'>").append($("<img>")); // layer mask

	buttons.append($("<table>").append( // layer button table 2x2
		$("<tr>").append(
			$("<td>").append(blendModeButton),
			$("<td>").append(lockButton)
		),
		$("<tr>").append(
			$("<td>").append(clipMaskButton),
			$("<td>").append(sourceButton)
		)
	));

	// Opacity label hint in CanvasNode constructor
	// Blend label hint in initButtons
	EventDistributer.footbarHint(lockButton,() => Lang("Lock pixel / opacity"));
	EventDistributer.footbarHint(clipMaskButton,() => Lang("Set this layer as a clipping mask"));
	//EventDistributer.footbarHint(sourceButton,() => Lang("Activate the selection source"));

	// Layer name label
	let nameLabel=$("<input class='layer-name-label'>");
	nameLabel.attr({"value": "","type": "text","maxLength": "256","size": "18"}); // size will be overridden by css width
	EVENTS.disableInputSelection(nameLabel); // disable selection, prevent from dragging text

	// Layer thumb
	let maskUI=$("<div class='layer-ui-mask'>");
	let maskUI2=$("<div class='layer-ui-mask2'>");
	let cvUI=$("<div class='layer-ui-canvas-container'>");
	let cv=$("<canvas class='layer-ui-canvas'>");
	cv.attr({"width": 0,"height": 0});
	cvUI.append(cv);

	// show name when layers collapsed
	EventDistributer.footbarHint(maskUI,() => LAYERS.isUIExpanded? null:nameLabel.val());

	// Layer clip mask hint, the triangle icon on the bottom-right
	let clipHint=$("<img class='layer-clip-mask-hint' src='./resources/clip-mask-hint.svg'>");

	// prevent down event from influencing dragging
	nameLabel.on("pointerdown",event => event.stopPropagation());
	opacityLabel.on("pointerdown",event => event.stopPropagation());
	buttons.on("pointerdown",event => event.stopPropagation());

	layerUI.append(cvUI,maskUI2,maskUI,opacityLabel,nameLabel,clipHint,buttons);

	// prevent layerUI from dragging on pen: causes freezing in Firefox
	// causes dragged object stuck in Chrome
	layerUI.on("pointerdown",event => {
		if(event.originalEvent.pointerType=="pen") { // "drag" doesn't support pointer type
			event.stopPropagation(); // cancel the following "drag" event on pen
		}
	});
	return layerUI;
}

// ============= Node ===============
class CanvasNode extends ContentNode {
	constructor(id) {
		super(id);

		// store the last imageData, managed by LAYER & HISTORY
		this.lastRawImageData=null;
		this.isContentChanged=false;

		// Layer panel UI
		this.$ui=LAYERS.$newCanvasLayerUI(this.id); // set ui in layer list

		// thumb image canvas
		this.$thumb=this.$ui.children(".layer-ui-canvas-container").children(".layer-ui-canvas");

		this.name=Lang("New Layer");
		this._setName(this.name);
		this.$ui.on("pointerdown",event => { // set active on clicking
			LAYERS.setActive(this);
		});
		// Move thumb image
		const setThumbTransform=str => this.$thumb.css("transform",str);
		this.$ui.on("pointermove",event => { // move thumb image
			let offset=this.$ui.offset();
			let dx=event.pageX-offset.left,dy=event.pageY-offset.top;
			let w=this.$ui.width(),h=this.$ui.height();
			if(this.transformType=="X") { // perform X transform
				let tx=dx/w;
				setThumbTransform("translateX("+(this.transformAmount*tx)+"px)");
			}
			else { // perform Y transform
				let ty=dy/h;
				setThumbTransform("translateY("+(this.transformAmount*ty)+"px)");
			}
		});
		this.$ui.on("pointerout",event => { // reset thumb image position
			if(this.transformType=="X") { // perform X transform
				setThumbTransform("translateX("+(this.transformAmount/2)+"px)");
			}
			else { // perform Y transform
				setThumbTransform("translateY("+(this.transformAmount/2)+"px)");
			}
		});

		// init property operation
		this.initButtons();
		this.initInputs();
	}
	delete() { // delete buffer image data
		/** Don't know why this is connected with storage
		 * Maybe history contents @TODO: do this in HISTORY
		 * But better not to move this. STORAGE.FILES will be handled by self-check when start-up
		 */
		// if(ENV.displaySettings.isAutoSave){ // auto update
		// 	STORAGE.FILES.removeContent(null,this.id); // remove storage resources
		// }
		this.$ui.remove(); // remove all event handlers
		super.delete();
	}
	getName() {
		// get the displayed name of this layer
		return this.name;
	}
	_setName(name) {
		// set the displayed name of this layer
		this.$ui.children(".layer-name-label").val(name);
		this.name=name;
	}
	setActiveUI(isActive) {
		// Expected: set the UI effect of this node
		if(isActive) {
			this.$ui.addClass("layer-ui-active");
			this.$ui.children(".layer-ui-mask").addClass("layer-ui-mask-active");
		}
		else {
			this.$ui.removeClass("layer-ui-active");
			this.$ui.children(".layer-ui-mask").removeClass("layer-ui-mask-active");
		}
	}
	/**
	 * Update the thumb image with this.rawImageData
	 * sync
	 * @TODO: clip to viewport
	 */
	updateThumb() {
		let thumbCV=this.$thumb;
		let w=this.rawImageData.validArea.width,h=this.rawImageData.validArea.height;
		let uW=Math.round(this.$ui.width()),uH=Math.round(this.$ui.height());

		if(!(w&&h)) {
			thumbCV.attr({ // also clear the content
				width: 0,
				height: 0
			});
			return;
		}

		// position in canvas
		let kw=uW/w,kh=uH/h;
		if(kw<=kh) { // left/right overflow
			let nW=Math.round(w*kh); // new width
			thumbCV.attr({ // also clear the content
				width: nW,
				height: uH
			});
			this.transformType="X";
			this.transformAmount=uW-nW;
			thumbCV.css({
				"transform": "translateX("+((uW-nW)/2)+"px)"
			});
		}
		else { // top/bottom overflow
			let nH=Math.round(h*kw); // new height
			thumbCV.attr({ // also clear the content
				width: uW,
				height: nH
			});
			this.transformType="Y";
			this.transformAmount=uH-nH;
			thumbCV.css({
				"transform": "translateY("+((uH-nH)/2)+"px)"
			});
		}

		// put contents
		this._drawThumb();
	}

	_drawThumb() { // Use 2d context operation
		const thumbCV=this.$thumb[0];
		const ctx=thumbCV.getContext("2d");
		const w=thumbCV.width,h=thumbCV.height;
		if(!(w&&h)) { // thumb not shown
			return;
		}
		const imgData2d=ctx.createImageData(w,h);

		const pixels=CANVAS.renderer.getUint8ArrayFromImageData(
			this.rawImageData,this.rawImageData.validArea,[w,h]); // get data

		imgData2d.data.set(pixels); // copy pixel data
		ctx.putImageData(imgData2d,0,0);
	}
	// ================ ImageData management =================
	setRawImageDataInvalid() {
		this.isContentChanged=true; // mark here
		this.setImageDataInvalid(); // this.isRawImageDataValid shall always be true
	}
	// ================= button =================
	
	initButtons() {
		const $buttons=this.$ui.children(".layer-buttons");
		this.buttonUpdateFuncs={};
		// Lock button
		const $lockButton=$buttons.find(".layer-lock-button");
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
		const lockButtonHistoryCallback={
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
		const $clipButton=$buttons.find(".layer-clip-mask-button");
		const setClipMaskButtonStatus=v => {
			const $clipButtonImg=$clipButton.children("img");
			$clipButtonImg.attr("src","./resources/clip-mask.svg");
			switch(v) {
				case 0: // normal
					this.properties.clipMask=false;
					$clipButtonImg.css("opacity","0.2");
					this.$ui.children(".layer-clip-mask-hint").css("display","none");
					break;
				case 1: // clip mask
					this.properties.clipMask=true;
					$clipButtonImg.css("opacity","1");
					this.$ui.children(".layer-clip-mask-hint").css("display","block");
					break;
			}
		}
		const clipButtonHistoryCallback={
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
			setClipMaskButtonStatus(v); // try to change status
			if(this.parent) { // changed and attached
				const siblings=this.parent.children;
				const prevClipParent=siblings[this.clipMaskParentIndex]; // clip parent before changing
				this.parent.setClipMaskOrderInvalid(); // The parent's clip mask order array will change
				this.parent.constructClipMaskOrder(); // to get the new clip mask parent of this node
				const clipParent=siblings[this.clipMaskParentIndex]; // the clip mask parent of this node
				/**
				 * Here are two cases:
				 * 1. v is true (non clip ==> clip)
				 *    the clipParent's image data needs renewal
				 * 2. v is false (clip ==> non clip)
				 *    the clipParent==this, this node might be the parent of another layer, also needs renewal
				 */
				prevClipParent.setImageDataInvalid();
				clipParent.setImageDataInvalid();
				COMPOSITOR.updateLayerTreeStructure(); // recomposite
			}
		},clipButtonHistoryCallback);
		this.buttonUpdateFuncs.clipButton=() => fClip(this.properties.clipMask? 1:0);

		// blend mode button, history in LayerBlendModeSelector._initOnClickOperation()
		const $blendButton=$buttons.find(".layer-blend-mode-button");
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

		// source button
		const $sourceButton=$buttons.find(".layer-source-button");
		const setSourceButtonStatus=v => {
			const $sourceButtonImg=$sourceButton.children("img");
			switch(v) {
				case 0: // not a source
					$sourceButtonImg.attr("src","");
					$sourceButtonImg.css("opacity","0.2");
					break;
				case 1: // is a source
					$sourceButtonImg.attr("src","");
					$sourceButtonImg.css("opacity","1");
					break;
			}
		}
		const fSource=SettingManager.setSwitchInteraction($sourceButton,null,2,($el,v) => {
			// @TODO: add history here
			setSourceButtonStatus(v);
		});
		this.buttonUpdateFuncs.sourceButton=() => fSource();// @TODO
	}
	initInputs() {
		const $opacityLabel=this.$ui.children(".layer-opacity-label");
		const $opacityInput=$opacityLabel.children("input");
		const setOpacity=opacity => { // set opacity function
			if(this.properties.locked) return; // locked, doesn't change
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
		$opacityInput.on("pointerdown",event => {
			const oE=event.originalEvent;
			if((oE.buttons>>1)&1||(oE.buttons&1)&&(EVENTS.key.ctrl||EVENTS.key.shift)) { // right or left-with-ctrl/shift
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

		const $nameInput=this.$ui.children(".layer-name-label");
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
	// ======================= Property control =========================
	getProperties() {
		let prop=super.getProperties();
		return Object.assign(prop,{
			name: this.getName()
		});
	}
	setProperties(prop) {
		if(prop.name!==undefined) {
			this._setName(prop.name); // Change UI instantly!
		}
		super.setProperties(prop); // update button ui here
	}
	updatePropertyUI() { // update all UIs & the function of the UI (e.g. clip mask)
		const prop=this.properties;
		this.buttonUpdateFuncs.lockButton();
		this.buttonUpdateFuncs.clipButton();
		this.buttonUpdateFuncs.blendButton();
		//this.buttonUpdateFuncs.sourceButton();
		this.$ui.children(".layer-opacity-label").children("input").val(prop.visible? Math.round(prop.opacity*100)+"%":"----");
	}
	// =================== Export settings =====================
	getAgPSDCompatibleJSON() {
		let json=super.getAgPSDCompatibleJSON();
		const imgData=this.rawImageData;
		return Object.assign(json,{
			"canvas": CANVAS.renderer.getContext2DCanvasFromImageData(imgData) // left & top info are handled by json
		});
	}
	getStorageJSON() {
		const img=this.rawImageData; // @TODO: mask
		const vArea=img.validArea;
		return Object.assign(super.getStorageJSON(),{
			type: "CanvasNode",
			rawImageData: { // Dummy structure for loading
				type: "RAMBuf8", // <= Not Compatible!
				data: {}, // not yet, assign when loading
				id: img.id,
				tagColor: img.tagColor,
				bitDepth: 8,
				width: vArea.width,
				height: vArea.height,
				left: vArea.left,
				top: vArea.top,
				validArea: vArea // borrow values
			}
		});
	}
}
