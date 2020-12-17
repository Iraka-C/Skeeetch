BrushManager.initBrushAccessories=function($defTable){
	const $expandButton=$("<div id='brush-expand-button'>").text(">");
	const $title=$("<div id='brush-expand-title'>").text(Lang("button-tools"));

	const $blockTitle=$("<div id='block-accessories-title'>");
	$blockTitle.append($expandButton,$title);

	const $blockContainer=$("<div id='block-accessories-container'>");

	const $block=$("<td id='brush-accessories-block' class='brush-selector-item brush-notrans'>");
	$block.append($blockTitle,$blockContainer);
	//$block.text(Lang("color-to-opacity"));
	const $row=$("<tr>").append($block);

	//brush.$row=$row; // backward ref
	let isExpanded=false;
	const updateExpanded=()=>{
		if(isExpanded){
			$expandButton.addClass("brush-expanded");
			$blockContainer.slideDown(250);
		}
		else{
			$expandButton.removeClass("brush-expanded");
			$blockContainer.slideUp(250);
		}
	};
	$blockTitle.click(event => {
		isExpanded=!isExpanded;
		updateExpanded();
	});
	$("#brush-selector-menu").on("pointerleave",e=>{ // when leaving, close the container
		isExpanded=false;
		updateExpanded();
	});
	
	$defTable.append($row);

	// init accessories

	const $c2oButton=BrushManager.addAccessoryToContainer($blockContainer,Lang("color-to-opacity"));
	$c2oButton.click(e=>{
		if(CANVAS.color2Opacity()){
			HISTORY.addHistory({ // add raw image data changed history
				type: "image-data",
				id: LAYERS.active.id,
				area: LAYERS.active.rawImageData.validArea // not changed before/after
			});
			STORAGE.FILES.saveContentChanges(LAYERS.active);
		}
	});
	EventDistributer.footbarHint($c2oButton,() => Lang("Replace white component with transparency."));

	// BrushManager.addAccessoryToContainer($blockContainer,"denug").click(e=>{
	// 	console.log("YEEEE");
	// });
};

BrushManager.addAccessoryToContainer=function($container,text){
	const $button=$("<div class='brush-accessories-button'>").text(text);
	$container.append($button);
	return $button;
};