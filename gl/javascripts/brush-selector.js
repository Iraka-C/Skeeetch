BrushManager.initBrushSelector=function() {
	const $defTable=$("<table class='default-brush-table'>");
	for(const brush of BrushManager.brushes) {
		const $block=$("<td class='brush-selector-item'>").text(brush.name);
		const $row=$("<tr>").append($block);
		//brush.$row=$row; // backward ref
		$row.click(event => {
			BrushManager.setActiveBrush(brush);
		});

		$defTable.append($row);
	}
	$("#brush-selector-default").append($defTable);


	const $customTable=$("<table class='custom-brush-table'>");
	for(const brush of BrushManager.brushes) {
		const $block=$("<td class='brush-selector-custom-item'>");
		const $blockInput=$("<input class='custom-brush-name-label'>");
		$blockInput.attr({"value": "N"+brush.name,"type": "text","maxLength": "16"});
		$block.append($blockInput);

		const $brushtipCanvasBlock=$("<td>").append(
			$("<div class='brush-selector-canvas'>").append(
				$("<img src='./resources/blend-mode/normal.svg'>")
			)
		);
		const $row=$("<tr>").append($block,$brushtipCanvasBlock);
		brush.$row=$row; // backward ref
		$row.click(event => {
			BrushManager.setActiveBrush(brush);
		});

		$customTable.append($row);
	}
	$("#brush-selector-custom").append($customTable);

	// $("#brush-selector-menu").append(
	// 	$("<div>").append($defTable),
	// 	$("<div id='brush-selector-custom-wrapper'>").append( // for scrolling
	// 		$("<div id='brush-selector-custom-wrapper-scroll'>").append($customTable)
	// 	)
	// );

}