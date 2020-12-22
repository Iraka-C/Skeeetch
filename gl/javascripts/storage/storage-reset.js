/**
 * The tools used for resetting system
 */
"use strict";

STORAGE.reset=function(isReset,isClear){
	const param=(isReset?"reset=1&":"")+(isClear?"clear=1":"");
	const url=window.location.origin+window.location.pathname+"?"+param;
	window.location.href=url; // jump to new param
}