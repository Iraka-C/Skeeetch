"use strict";
FILES.CLOUD={
	storage: null
};

/**
 * Written by Iraka on 20210210
 * the cloud storage manager for Skeeetch
 */

FILES.CLOUD.init=function(fileManager){
	const $container=fileManager.addDiv();
	$container.attr("id","cloud-container");
	$container.css("display","none");

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
	const iconUrl="./resources/cloud/user.png";
	// let $img=$(new Image());
	// $img.on("load",()=>{ // check if iconUrl available
	// 	console.log("BG loaded");
	// 	$img.remove();
	// });
	// $img.on("error",()=>{ // check if iconUrl available
	// 	console.log("BG failed");
	// 	$img.remove();
	// });
	// $img.attr("src",iconUrl); // kick, after this, remove

	$icon.css("background-image","url('"+iconUrl+"')");
	$icon.append($("<div id='cloud-icon-border'>"));
	$iconDiv.append($icon);
	
	// ===================== Info ======================
	const $infoPanel=$("<div id='cloud-info-panel'>");
	const $usrnDiv=$("<div id='cloud-info-username'>");
	$usrnDiv.text("----");

	const $quotaDiv=$("<div id='cloud-info-quota'>");
	const $quotaRect=$("<div id='cloud-info-quota-rect'>");
	const $quotaText=$("<div id='cloud-info-quota-text'>");
	$quotaText.text("quota");
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

FILES.CLOUD.setQuotaUI=function(used,total){ // in bytes
	used/=1024*1024; // MB
	total/=1024*1024; // MB

	const bytesToStr=bytes=>{
		return bytes>=900?
			(bytes/1024).toFixed(1)+"G":
			bytes>=100?
				Math.round(bytes)+"M":
				bytes.toFixed(1)+"M";
	};
	const usedStr=bytesToStr(used);
	const totalStr=bytesToStr(total);
	const displayStr=usedStr+"/"+totalStr;
	$("#cloud-info-quota-text").text(displayStr);

	const perc=used/total;
	$("#cloud-info-quota-rect").css("width",perc*100+"%");
}

// ======================= Service related ===========================

FILES.CLOUD.startCloudService=function(){
	const $title=DialogBoxItem.textBox({text: Lang("cloud-service-select-page")});
	const dialog=new DialogBoxItem([$title],[{
		text: Lang("cloud-onedrive"), // OneDrive service
		callback: e=>{
			$("#cloud-icon").css("background-image","url('./resources/cloud/onedrive.svg')");
			FILES.CLOUD.initCloudStorage(new OneDriveService());
		}
	},{ // nothing
		text: Lang("Cancel")
	}]);
	DIALOGBOX.show(dialog);
}

/**
 * cloudService: a CloudServiceWrapper representing a service
 * options: login infos
 */
FILES.CLOUD.initCloudStorage=function(cloudService,options){
	const storage=new CloudStorage(cloudService);
	FILES.CLOUD.storage=storage;

	const $container=FILES.CLOUD.$container;

	storage.init(/*...*/).then(data=>{ // login data
		$container.css("display","block");
		$("#cloud-info-username").text(data.name); // setup username

		data.avatarPromise.then(url=>{ // get avatar
			$("#cloud-icon").css("background-image","url('"+url+"')");
			// @TODO: revoke url after use?
		}).catch(err=>{
			console.log("No avatar received");
		});

		$("#cloud-button").children("img").attr("src","./resources/cloud/cloud-slash.svg");
		storage.getStorageQuota().then(quota=>{ // after logging in, get quota
			// only provided remain (except used and recycled)
			FILES.CLOUD.setQuotaUI(quota.total-quota.remain,quota.total);
		}).catch(err=>{ // quota error here
			console.log("Quota failed",err);
		});
	})
	.catch(err=>{ // login error here
		console.warn("Login Failed",err);
		// and do nothing when failed
		FILES.CLOUD.storage=null;
	});
}