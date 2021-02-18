"use strict";
FILES.CLOUD={};

/**
 * Written by Iraka on 20210210
 * the cloud storage manager for Skeeetch
 */

FILES.CLOUD.init=function(fileManager){
	const $container=fileManager.addDiv();
	$container.attr("id","cloud-container");

	FILES.CLOUD.$container=$container;
	FILES.CLOUD.fileManager=fileManager;
	FILES.CLOUD.initUI();
}

FILES.CLOUD.initUI=function(){
	const $container=FILES.CLOUD.$container;

	const $cloudDiv=$("<div id='cloud-div'>");

	// ==================== icons ===================
	const $iconDiv=$("<div id='cloud-icon-div'>"); // for centering the icon
	const $icon=$("<div id='cloud-icon'>");
	const iconUrl="./resources/cloud/1.jpg";
	let $img=$(new Image());
	$img.on("load",()=>{ // check if iconUrl available
		console.log("BG loaded");
		$img.remove();
	});
	$img.on("error",()=>{ // check if iconUrl available
		console.log("BG failed");
		$img.remove();
	});
	$img.attr("src",iconUrl); // kick, after this, remove

	$icon.css("background-image","url('"+iconUrl+"')");
	$icon.append($("<div id='cloud-icon-border'>"));
	$iconDiv.append($icon);
	
	// ===================== Info ======================
	const $infoPanel=$("<div id='cloud-info-panel'>");
	const $usrnDiv=$("<div id='cloud-info-username'>");
	$usrnDiv.text("Null");

	const $quotaDiv=$("<div id='cloud-info-quota'>");
	const $quotaRect=$("<div id='cloud-info-quota-rect'>");
	const $quotaText=$("<div id='cloud-info-quota-text'>");
	$quotaText.text("640M / 15G");
	$quotaDiv.append($quotaRect,$quotaText);

	$infoPanel.append($usrnDiv,$quotaDiv);

	// ======================= buttons =========================
	const $buttonPanel=$("<div id='cloud-button-panel'>");
	const $syncButton=$("<div id='cloud-button-sync' class='cloud-click'>");
	$syncButton.append($("<img src='./resources/cloud/arrow-repeat.svg'>"));
	$buttonPanel.append($syncButton);

	$cloudDiv.append($iconDiv,$infoPanel,$buttonPanel);
	$container.append($cloudDiv);
}

FILES.CLOUD.initEnableCloudButton=function($repoTitle){
	const $buttonImg=$("<img src='./resources/cloud/cloud-plus.svg'>");
	const $button=$("<div id='cloud-button' class='cloud-click'>").append($buttonImg);
	$repoTitle.append($button);

	$button.click(FILES.CLOUD.startCloudService);
}

FILES.CLOUD.startCloudService=function(){
	const $title=DialogBoxItem.textBox({text: Lang("cloud-service-select-page")});
	const dialog=new DialogBoxItem([$title],[{
		text: Lang("cloud-onedrive"),
		callback: e=>{
			ENV.showFontDialog();
		}
	},{ // nothing
		text: Lang("Cancel")
	}]);
	DIALOGBOX.show(dialog);
}