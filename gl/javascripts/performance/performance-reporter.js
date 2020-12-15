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
		if(!SettingHandler.sysMenu.isExpanded()){ // to be closed, shrink all report blocks
			$container.find(".report-expanded").removeClass("report-expanded"); // expand buttons
			$container.find(".report-block-container").slideUp(250); // containers
		}
		
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
	if(!block.items||!block.items.length){
		// nothing to report
		return;
	}
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
					const historyItem=LAYERS.expandToLayer(node);
					if(historyItem&&historyItem.length){
						HISTORY.addHistory({ // combine history steps
							type: "bundle",
							children: historyItem
						});
					}
					LAYERS.scrollTo(node,true).then(()=>{
						LAYERS.setActive(node);
					})
				}
				else{
					// some external links
					// based on LANG!
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
			$block.slideUp(300,e=>{
				$ui.slideUp(150,e=>{
					$block.remove();
				});
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
	$rc.prepend($block); // new first
	$ui.css("display","block");
	$block.fadeIn(200);
	$hint.addClass("system-button-hint-shown");

	// small animation
	$hint.css({"color":"#dd7700"});
	setTimeout(e=>{
		$hint.css({"color":""});
	},800);
}