BrushManager.initBrushAccessories=function($defTable){
	const $block=$("<td class='brush-selector-item'>");
	$block.text(Lang("color-to-opacity"));
	const $row=$("<tr>").append($block);
	EventDistributer.footbarHint($row,() => Lang("Replace white component with transparency."));
	//brush.$row=$row; // backward ref
	$row.click(event => {
		// do color ==> opacity program
		if(CANVAS.color2Opacity()){
			HISTORY.addHistory({ // add raw image data changed history
				type: "image-data",
				id: LAYERS.active.id,
				area: LAYERS.active.rawImageData.validArea // not changed before/after
			});
			STORAGE.FILES.saveContentChanges(LAYERS.active);
		}
	});
	$defTable.append($row);
};