LAYERS.initScrollbar=function(){
	/**
	 * When dragging in the layer list, it does not automatically scroll
	 * Add two divs that controls scrolling up/down
	 */
	const $scroll=$("#layer-panel-scroll");
	const scroll=$scroll[0];
	$("#layer-panel-drag-up").on("dragover",event=>{ // scroll upwards
		const sT=scroll.scrollTop;
		if(sT>0){ // space at the top
			$scroll.scrollTop(sT-8);
		}
	});
	$("#layer-panel-drag-down").on("dragover",event=>{ // scroll downwards
		const sH=scroll.scrollHeight;
		const cH=scroll.clientHeight;
		const sT=scroll.scrollTop;
		if(sH>sT+cH){ // space at the bottom
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
	$scroll.on("scroll",event=>{ // set position
		LAYERS._updateScrollBar();
	});
	$scroll.on("pointerenter",event=>{
		LAYERS._updateScrollBar();
	});
	// Set dragging operation
	let isDown=false;
	$scrollButton.on("pointerdown",event=>{
		const e=event.originalEvent;
		scrollButton.setPointerCapture(e.pointerId); // fix pointer to this element
		isDown=true;
	});
	$scrollButton.on("pointermove",event=>{
		if(!isDown)return; // call callback when down
		// Do sth
		const scrollPos=event.pageY-$scroll.offset().top-8; // r=8
		const totalHeight=$scroll.height()-16; // 2r=16
		const pos=(scrollPos/totalHeight).clamp(0,1); // 0~1: new position

		const sH=scroll.scrollHeight;
		const cH=scroll.clientHeight;
		const newTop=(sH-cH)*pos;
		$scroll.scrollTop(newTop);
	});
	$scrollButton.on("pointerup pointercancel",event=>{
		const e=event.originalEvent;
		scrollButton.releasePointerCapture(e.pointerId); // release pointer from this element
		isDown=false;
	});
}

LAYERS._updateScrollBar=function(){
	const scroll=LAYERS._updateScrollBar.scrollbar;
	const $scrollButton=LAYERS._updateScrollBar.$scrollButton;

	const sH=scroll.scrollHeight;
	const cH=scroll.clientHeight;
	const sT=scroll.scrollTop;
	const scrollRatio=Math.min(sT/(sH-cH),1); // why can it exceed 1.0?
	$scrollButton.css("display",Math.abs(sH-cH)<1E-3?"none":"block"); // show scrollbar when needed
	$scrollButton.css("top",(isNaN(scrollRatio)?0:scrollRatio*(cH-16))+"px");
}