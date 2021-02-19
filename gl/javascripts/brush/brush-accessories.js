"use strict";
BrushManager.initBrushAccessories=function($defTable){
	
	const $icon=$("<td id='brush-expand-button' class='brush-selector-icon'>");
	$icon.append($("<div>").text(">"));

	// const $blockTitle=$("<div id='block-accessories-title'>");
	// $blockTitle.append($expandButton,$title);


	const $block=$("<td id='brush-accessories-block' class='brush-selector-item brush-notrans'>");
	const $blockTitle=$("<div id='block-accessories-title'>");
	$blockTitle.text(Lang("button-tools"));
	const $blockContainer=$("<div id='block-accessories-container'>");

	$block.append($blockTitle,$blockContainer);
	//$block.text(Lang("color-to-opacity"));
	const $row=$("<tr>").append($icon,$block);
	$row.css("vertical-align","top");

	$defTable.append($row);

	//brush.$row=$row; // backward ref
	let isExpanded=false;

	const updateExpanded=()=>{
		if(isExpanded){
			$icon.addClass("brush-expanded");
			$blockContainer.slideDown(250);
		}
		else{
			$icon.removeClass("brush-expanded");
			$blockContainer.slideUp(250);
		}
	};
	$icon.click(event => {
		isExpanded=!isExpanded;
		updateExpanded();
	});
	$blockTitle.click(event => {
		isExpanded=!isExpanded;
		updateExpanded();
	});
	$("#brush-selector-menu").on("pointerleave",e=>{ // when leaving, close the container
		isExpanded=false;
		updateExpanded();
	});

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