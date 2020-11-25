LAYERS.initScrollbar=function() {
	// @TODO: scroll to active layer when add/delete
	/**
	 * When dragging in the layer list, it does not automatically scroll
	 * Add two divs that controls scrolling up/down
	 */
	const $scroll=$("#layer-panel-scroll");
	const scroll=$scroll[0];
	$("#layer-panel-drag-up").on("dragover",event => { // scroll upwards
		const sT=scroll.scrollTop;
		if(sT>0) { // space at the top
			$scroll.scrollTop(sT-8);
		}
	});
	$("#layer-panel-drag-down").on("dragover",event => { // scroll downwards
		const sH=scroll.scrollHeight;
		const cH=scroll.clientHeight;
		const sT=scroll.scrollTop;
		if(sH>sT+cH) { // space at the bottom
			$scroll.scrollTop(sT+8);
		}
	});

	/**
	 * Side scrollbar
	 */
	const $scrollButton=$("#layer-panel-scrollbar");
	const scrollButton=$scrollButton[0];
	LAYERS._updateScrollBar.scrollbar=scroll;
	LAYERS._updateScrollBar.$scrollButton=$scrollButton;

	// scroll and disable scroll on contents
	// also stops thumb translating effect
	let scrollTimer=null;
	$scroll.on("scroll",event => { // set position
		LAYERS._updateScrollBar();
		if(scrollTimer) {
			clearTimeout(scrollTimer); // do it later
		}
		else { // no timer, start disable
			$("#layer-panel-inner").css("pointer-events","none");
		}
		scrollTimer=setTimeout(e => {
			scrollTimer=null;
			$("#layer-panel-inner").css("pointer-events","auto");
		},500); // allow on-layer-node scrolling after 500ms
	});


	$scroll.on("pointerenter",event => {
		LAYERS._updateScrollBar();
	});
	// Set dragging operation
	let isDown=false;
	$scrollButton.on("pointerdown",event => {
		const e=event.originalEvent;
		scrollButton.setPointerCapture(e.pointerId); // fix pointer to this element
		isDown=true;
	});
	$scrollButton.on("pointermove",event => {
		if(!isDown) return; // call callback when down
		// Do sth
		const scrollPos=event.pageY-$scroll.offset().top-8; // r=8
		const totalHeight=$scroll.height()-16; // 2r=16
		const pos=(scrollPos/totalHeight).clamp(0,1); // 0~1: new position

		const sH=scroll.scrollHeight;
		const cH=scroll.clientHeight;
		const newTop=(sH-cH)*pos;
		$scroll.scrollTop(newTop);
	});
	$scrollButton.on("pointerup pointercancel",event => {
		const e=event.originalEvent;
		scrollButton.releasePointerCapture(e.pointerId); // release pointer from this element
		isDown=false;
	});
}

LAYERS._updateScrollBar=function(isAnimate) {
	const scroll=LAYERS._updateScrollBar.scrollbar;
	const $scrollButton=LAYERS._updateScrollBar.$scrollButton;

	const sH=scroll.scrollHeight;
	const cH=scroll.clientHeight;
	const sT=scroll.scrollTop;
	const scrollRatio=Math.min(sT/(sH-cH),1); // why can it exceed 1.0?
	$scrollButton.css("display",Math.abs(sH-cH)<1E-3? "none":"block"); // show scrollbar when needed
	// @TODO: hard coded 16px slider size! change into height()
	if(isAnimate) {
		$scrollButton.animate({"top": (isNaN(scrollRatio)? 0:scrollRatio*(cH-16))+"px"},300);
	}
	else { // normal update
		$scrollButton.css("top",(isNaN(scrollRatio)? 0:scrollRatio*(cH-16))+"px");
	}
}

/**
 * Scroll to the position of a certain layer node / node ID
 */
LAYERS.scrollTo=function(node,isAnimate) {
	if(!node||!node.$ui)return; // not a layer
	const nTop=node.$ui.offset().top;
	const $scroll=$("#layer-panel-scroll");
	const $panel=$("#layer-panel-inner");
	const pTop=$panel.offset().top;

	const sH=$scroll.height();
	const sTop=nTop-pTop-sH*0.3; // scroll top
	// 0.3 for putting the node kind-of center

	if(isAnimate) {
		$scroll.animate({scrollTop: sTop},isNaN(isAnimate)? 300:isAnimate);
	}
	else {
		$scroll.scrollTop(sTop);
	}
}

// For Debugging!
LAYERS.toString=function() {
	return "\n"+LAYERS.layerTree._getTreeNodeString();
}

// ================= LAYER panels as a whole =================
LAYERS.shrinkUI=function() {
	const initWidth=$("#layer-panel").width();
	$("#layer-panel-style-collapsed").attr("rel","stylesheet");

	const mutate=event => { // after css rendered
		const nowWidth=$("#layer-panel").width(); // Test if the style's changed
		if(nowWidth==initWidth) { // continue waiting
			requestAnimationFrame(mutate);
			return;
		}

		$("#layer-panel-right-menu").text(">");

		// refresh palette window
		PALETTE.refreshUIParam();

		// refresh canvas window
		ENV.window.SIZE.width=$("#canvas-window").width();
		ENV.window.SIZE.height=$("#canvas-window").height();
		ENV.refreshTransform();

		LAYERS.updateAllThumbs();
		LAYERS.scrollTo(LAYERS.active,true);
	};

	requestAnimationFrame(mutate); // Kick!
}

// @TODO: change these into .class operation: no need to operate when new/del layer
// This is crucial when undo/redo in HISTORY
LAYERS.expandUI=function() {
	const initWidth=$("#layer-panel").width();
	$("#layer-panel-style-collapsed").attr("rel","alternate stylesheet");

	const mutate=event => { // after css rendered
		const nowWidth=$("#layer-panel").width(); // Test if the style's changed
		if(nowWidth==initWidth) { // continue waiting
			requestAnimationFrame(mutate);
			return;
		}

		$("#layer-panel-right-menu").text("<");

		// refresh palette window
		PALETTE.refreshUIParam();

		// refresh canvas window
		ENV.window.SIZE.width=$("#canvas-window").width();
		ENV.window.SIZE.height=$("#canvas-window").height();
		ENV.refreshTransform();

		LAYERS.updateAllThumbs();
		LAYERS.scrollTo(LAYERS.active,true);
	};

	requestAnimationFrame(mutate); // Kick!
}

// ================ Layers blend mode selector ================
class LayerBlendModeSelector {
	constructor() {
		let blendModeSelector=$("<div class='layer-blend-mode-selector'>");
		blendModeSelector.append($("<table>").append( // lblend mode table
			$("<tr>").append(
				$("<td colspan='6' id='layer-blend-mode-selector-title-block'>").append(
					$("<div class='layer-blend-mode-selector-title'>")
						.text("Normal"),
					$("<div>&nbsp;</div>")
				)
			),
			$("<tr>").append(
				$("<td>").append($("<img src='./resources/blend-mode/normal.svg'>")),
				$("<td>").append($("<img src='./resources/blend-mode/screen.svg'>")),
				$("<td>").append($("<img src='./resources/blend-mode/multiply.svg'>")),
				$("<td>").append($("<img src='./resources/blend-mode/overlay.svg'>")),
				$("<td>").append($("<img src='./resources/blend-mode/soft-light.svg'>")),
				$("<td>").append($("<img src='./resources/blend-mode/hard-light.svg'>"))
			),
			$("<tr>").append(
				$("<td>").append($("<img src='./resources/blend-mode/linear-dodge.svg'>")),
				$("<td>").append($("<img src='./resources/blend-mode/linear-burn.svg'>")),
				$("<td>").append($("<img src='./resources/blend-mode/linear-light.svg'>")),
				$("<td>").append($("<img src='./resources/blend-mode/color-dodge.svg'>")),
				$("<td>").append($("<img src='./resources/blend-mode/color-burn.svg'>")),
				$("<td>").append($("<img src='./resources/blend-mode/vivid-light.svg'>"))
			),
			$("<tr>").append(
				$("<td>").append($("<img src='./resources/blend-mode/lighten.svg'>")),
				$("<td>").append($("<img src='./resources/blend-mode/darken.svg'>")),
				$("<td>").append($("<img src='./resources/blend-mode/lighter-color.svg'>")),
				$("<td>").append($("<img src='./resources/blend-mode/darker-color.svg'>")),
				$("<td>").append($("<img src='./resources/blend-mode/pin-light.svg'>")),
				$("<td>").append($("<img src='./resources/blend-mode/hard-mix.svg'>"))
			),
			$("<tr>").append(
				$("<td>").append($("<img src='./resources/blend-mode/difference.svg'>")),
				$("<td>").append($("<img src='./resources/blend-mode/exclusion.svg'>")),
				$("<td>").append($("<img src='./resources/blend-mode/subtract.svg'>")),
				$("<td>").append($("<img src='./resources/blend-mode/divide.svg'>"))
			),
			$("<tr>").append(
				$("<td>").append($("<img src='./resources/blend-mode/hue.svg'>")),
				$("<td>").append($("<img src='./resources/blend-mode/saturation.svg'>")),
				$("<td>").append($("<img src='./resources/blend-mode/color.svg'>")),
				$("<td>").append($("<img src='./resources/blend-mode/luminosity.svg'>")),
				$("<td>").append(""),
				$("<td>").append($("<img src='./resources/blend-mode/mask.svg'>"))
			)
		));
		$("#layer-panel-container").append(blendModeSelector);

		this.$selector=blendModeSelector;
		this._initOnClickOperation();

		this.caller=null; // the node that calls for setting blend mode
	}

	_initOnClickOperation() {
		const $buttons=this.$selector.find("img").parent();
		const $blendNameTitle=this.$selector.find(".layer-blend-mode-selector-title");
		for(let i=0;i<$buttons.length;i++) {
			const $targetButton=$buttons.eq(i);
			const mode=LayerBlendModeSelector.blendModeIDToEnum(i);

			$targetButton.on("click",e => {
				if(!this.caller||this.caller.properties.locked) return;
				let prevClip=this.caller.properties.clipMask;
				let prevMode=this.caller.properties.blendMode;
				let nowClip=prevClip;
				if(mode==BasicRenderer.MASK) {
					nowClip=true;
				}
				else if(prevMode==BasicRenderer.MASK&&prevClip) {
					nowClip=false;
				}
				const prevStatus={blendMode: prevMode,clipMask: prevClip};
				const nowStatus={blendMode: mode,clipMask: nowClip};
				this.caller.setProperties(nowStatus); // change mode
				HISTORY.addHistory({ // add a history
					type: "node-property",
					id: this.caller.id,
					prevStatus: prevStatus,
					nowStatus: nowStatus
				});
				// set active button
				this.$buttons.removeClass("active-blend-mode");
				$targetButton.addClass("active-blend-mode");
			});
			$targetButton.on("pointerover",e => { // show name
				$blendNameTitle.text(
					BasicRenderer.blendModeEnumToDisplayedName(mode)
				);
			});
			$targetButton.on("pointerout",e => { // hide name, show now mode name
				if(!this.caller) return;
				$blendNameTitle.text(
					BasicRenderer.blendModeEnumToDisplayedName(
						this.caller.properties.blendMode
					)
				);
			});
		}
		this.$buttons=$buttons;
		this.$blendNameTitle=$blendNameTitle;
	}

	static blendModeEnumToFilename(mode) { // the order of blend buttons in the ui
		switch(mode) {
			default:
			case BasicRenderer.NORMAL: return "normal";
			case BasicRenderer.OVERLAY: return "overlay";
			case BasicRenderer.MULTIPLY: return "multiply";
			case BasicRenderer.SCREEN: return "screen";
			case BasicRenderer.DARKEN: return "darken";
			case BasicRenderer.LIGHTEN: return "lighten";
			case BasicRenderer.DARKER_COLOR: return "darker-color";
			case BasicRenderer.LIGHTER_COLOR: return "lighter-color";
			case BasicRenderer.LINEAR_BURN: return "linear-burn";
			case BasicRenderer.LINEAR_DODGE: return "linear-dodge";
			case BasicRenderer.COLOR_BURN: return "color-burn";
			case BasicRenderer.COLOR_DODGE: return "color-dodge";
			case BasicRenderer.SOFT_LIGHT: return "soft-light";
			case BasicRenderer.HARD_LIGHT: return "hard-light";
			case BasicRenderer.VIVID_LIGHT: return "vivid-light";
			case BasicRenderer.LINEAR_LIGHT: return "linear-light";
			case BasicRenderer.PIN_LIGHT: return "pin-light";
			case BasicRenderer.HARD_MIX: return "hard-mix";
			case BasicRenderer.DIFFERENCE: return "difference";
			case BasicRenderer.EXCLUSION: return "exclusion";
			case BasicRenderer.SUBTRACT: return "subtract";
			case BasicRenderer.DIVIDE: return "divide";
			case BasicRenderer.HUE: return "hue";
			case BasicRenderer.SATURATION: return "saturation";
			case BasicRenderer.COLOR: return "color";
			case BasicRenderer.LUMINOSITY: return "luminosity";
			case BasicRenderer.MASK: return "mask";
		}
	};

	static blendModeIDToEnum(id) { // the order of blend buttons in the ui
		return [
			BasicRenderer.NORMAL,BasicRenderer.SCREEN,BasicRenderer.MULTIPLY,
			BasicRenderer.OVERLAY,BasicRenderer.SOFT_LIGHT,BasicRenderer.HARD_LIGHT,
			BasicRenderer.LINEAR_DODGE,BasicRenderer.LINEAR_BURN,BasicRenderer.LINEAR_LIGHT,
			BasicRenderer.COLOR_DODGE,BasicRenderer.COLOR_BURN,BasicRenderer.VIVID_LIGHT,
			BasicRenderer.LIGHTEN,BasicRenderer.DARKEN,
			BasicRenderer.LIGHTER_COLOR,BasicRenderer.DARKER_COLOR,
			BasicRenderer.PIN_LIGHT,BasicRenderer.HARD_MIX,
			BasicRenderer.DIFFERENCE,BasicRenderer.EXCLUSION,
			BasicRenderer.SUBTRACT,BasicRenderer.DIVIDE,
			BasicRenderer.HUE,BasicRenderer.SATURATION,
			BasicRenderer.COLOR,BasicRenderer.LUMINOSITY,
			BasicRenderer.MASK
		][id]||BasicRenderer.NORMAL;
	};
	static blendModeEnumToID(mode) { // reverse list of blendModeIDToEnum
		switch(mode) {
			default:
			case BasicRenderer.NORMAL: return 0;
			case BasicRenderer.SCREEN: return 1;
			case BasicRenderer.MULTIPLY: return 2;
			case BasicRenderer.OVERLAY: return 3;
			case BasicRenderer.SOFT_LIGHT: return 4;
			case BasicRenderer.HARD_LIGHT: return 5;
			case BasicRenderer.LINEAR_DODGE: return 6;
			case BasicRenderer.LINEAR_BURN: return 7;
			case BasicRenderer.LINEAR_LIGHT: return 8;
			case BasicRenderer.COLOR_DODGE: return 9;
			case BasicRenderer.COLOR_BURN: return 10;
			case BasicRenderer.VIVID_LIGHT: return 11;
			case BasicRenderer.LIGHTEN: return 12;
			case BasicRenderer.DARKEN: return 13;
			case BasicRenderer.LIGHTER_COLOR: return 14;
			case BasicRenderer.DARKER_COLOR: return 15;
			case BasicRenderer.PIN_LIGHT: return 16;
			case BasicRenderer.HARD_MIX: return 17;
			case BasicRenderer.DIFFERENCE: return 18;
			case BasicRenderer.EXCLUSION: return 19;
			case BasicRenderer.SUBTRACT: return 20;
			case BasicRenderer.DIVIDE: return 21;
			case BasicRenderer.HUE: return 22;
			case BasicRenderer.SATURATION: return 23;
			case BasicRenderer.COLOR: return 24;
			case BasicRenderer.LUMINOSITY: return 25;
			case BasicRenderer.MASK: return 26;
		};
	};

	setCaller(contentNode) {
		this.caller=contentNode;
		const mode=this.caller.properties.blendMode;
		this.$blendNameTitle.text(BasicRenderer.blendModeEnumToDisplayedName(mode));
		this.$buttons.removeClass("active-blend-mode");
		const $targetButton=this.$buttons.eq(LayerBlendModeSelector.blendModeEnumToID(mode));
		$targetButton.addClass("active-blend-mode");
	}
	show(targetArea) { // px in the window
		const w=this.$selector.width();
		const h=this.$selector.height();
		const sW=window.innerWidth;
		const sH=window.innerHeight;
		let L=targetArea.left-3;
		let H=targetArea.top-3;
		if(L+w+3>=sW) L=sW-w-3;
		if(H+h+3>=sH) H=sH-h-3;

		this.$selector.css({
			"left": L,
			"top": H,
			"pointer-events": "all",
			"opacity": "1"
		});
		setTimeout(e => { // Use :hover to keep display
			this.$selector.css({
				"pointer-events": "",
				"opacity": ""
			});
		},500);
	}
}