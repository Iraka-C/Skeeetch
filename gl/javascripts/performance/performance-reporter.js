/**
 * A report UI for issues found during running
 * the UI is SettingHandler.$report
 */
"use strict";
PERFORMANCE.REPORTER={};

PERFORMANCE.REPORTER.init=function(){
	const $ui=SettingHandler.$report;

	const $title=$("<div id='reporter-title'>");
	const $container=$("<div id='reporter-container'>");

	$title.text(Lang("Task Report"));
	$ui.append($title,$container);
	$ui.addClass("reporter-outer");
	$ui.css("display","none");

	// add setting menu button action
	const hideHint=isToCloseMenu=>{
		const $hint=$("#system-button-hint");
		$hint.removeClass("system-button-hint-shown");
		if(isToCloseMenu){ // to be closed, shrink all report blocks
			$container.find(".report-expanded").removeClass("report-expanded"); // expand buttons
			$container.find(".report-block-container").slideUp(250); // containers
		}
	};
	SettingHandler.sysMenu.onMenuOpen(()=>hideHint(false));
	SettingHandler.sysMenu.onMenuClose(()=>hideHint(true));
}

/**
 * block is {
 *   title: string of title,
 *   items:[
 *      {
 *         content: text/html string,
 *         target: nodeID related/html link,
 *         isNewPage: is to open the link in new page (only when target is link)
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
				else if(item.target.length){ // item.target is an external link

					window.open(item.target);

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
				$ui.css("opacity","0"); // opacity animation
				$ui.slideUp(200,e=>{
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
	$rc.prepend($block); // newer first
	$ui.css("opacity","1"); // opacity animation
	$ui.css("display","block");
	$block.fadeIn(200);
	$hint.addClass("system-button-hint-shown");

	// small animation
	$hint.css({"color":"#dd7700"});
	if(PERFORMANCE.REPORTER.hintTimeoutHandler){ // already started
		clearTimeout(PERFORMANCE.REPORTER.hintTimeoutHandler);
		PERFORMANCE.REPORTER.hintTimeoutHandler=null;
	}
	PERFORMANCE.REPORTER.hintTimeoutHandler=setTimeout(e=>{
		$hint.css({"color":""});
	},1000);
}