/**
 * A report UI for issues found during running
 * the UI is SettingHandler.$report
 */

PERFORMANCE.REPORTER={

};

PERFORMANCE.REPORTER.init=function(){
	const $ui=SettingHandler.$report;

	const $title=$("<div id='reporter-title'>");
	const $container=$("<div id='reporter-container'>");

	$title.text(Lang("Task Report"));
	$ui.append($title,$container);
	$ui.addClass("reporter-outer");
	$("#system-button").click(e=>{
		const $hint=$("#system-button-hint");
		$hint.removeClass("system-button-hint-shown");
	});
	$ui.css("display","none");
}

/**
 * block is {
 *   title: string of title,
 *   items:[
 *      {
 *         content: text/html string
 *         target: nodeID related/html link
 *      },
 *      ...
 *   ]
 * }
 */
PERFORMANCE.REPORTER.report=function(block){
	const $ui=SettingHandler.$report;
	const $hint=$("#system-button-hint");

	// construct the title of a report block
	const $titlePanel=$("<div class='report-block-title-panel'>");
	const $titleE=$("<div class='report-block-title-expand report-expanded'>").text(">");
	const $title=$("<div class='report-block-title-text'>").text(block.title);
	const $titleB=$("<div class='report-block-title-button'>").html("&times;");
	$titlePanel.append($titleE,$title,$titleB);

	// construct items in the clock
	const $blockC=$("<div class='report-block-container'>");
	for(const item of block.items){
		const $item=$("<div class='report-block-item'>");
		$item.html(item.content);
		$item.click(e=>{
			if(item.target){
				const node=LAYERS.layerHash[item.target];
				if(node){ // this is a node in layer tree
					LAYERS.scrollTo(node,true).then(()=>{
						LAYERS.setActive(node);
					})
				}
				else{
					// some external links
				}
			}
		});
		$blockC.append($item);
	}

	const $block=$("<div class='report-block'>");
	$block.append($titlePanel,$blockC);

	// fill in content block
	const $rc=$("#reporter-container");
	$titleB.click(e=>{
		const cnt=$rc.children().length;
		if(cnt>1){ // only remove this block
			$block.slideUp(300,e=>{
				$block.remove();
			});
		}
		else{ // hide all
			$ui.slideUp(300,e=>{
				$block.remove();
			});
		}
		$hint.removeClass("system-button-hint-shown");
		e.stopPropagation(); // disable click to expand/shrink
	});
	$titlePanel.click(e=>{
		if($titleE.hasClass("report-expanded")){
			$titleE.removeClass("report-expanded");
			$blockC.slideUp(250);
		}
		else{
			$titleE.addClass("report-expanded");
			$blockC.slideDown(250);
		}
		$hint.removeClass("system-button-hint-shown");
	});

	// show this block in the report
	$rc.append($block);
	$ui.css("display","block");
	$block.fadeIn(200);
	$hint.addClass("system-button-hint-shown");
}