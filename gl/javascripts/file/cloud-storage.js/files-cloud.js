"use strict";
FILES.CLOUD={};

/**
 * Written by Iraka on 20210210
 * the cloud storage manager for Skeeetch
 */

FILES.CLOUD.init=function(fileManager){
	const $cloudDiv=fileManager.addDiv();
	$cloudDiv.attr("id","cloud-container");

	FILES.CLOUD.$title=$cloudDiv;
	FILES.CLOUD.$container=$cloudDiv;
	FILES.CLOUD.fileManager=fileManager;
	FILES.CLOUD.initUI();
}

FILES.CLOUD.initUI=function(){

}