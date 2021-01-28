"use strict";

ENV.setUIOrientation=function(isLeft) {
	ENV.displaySettings.uiOrientationLeft=isLeft;
	if(isLeft) { // Normal
		$("#top-menu-panel").css("flex-direction","row");
		$("#top-menu-right-panel").css("flex-direction","row");
		$("#top-menu-left-center-panel").css("flex-direction","row");
		$("#top-menu-left-panel").css("flex-direction","row");
		$("#column-panel").css("flex-direction","row");
		$("#layer-panel-right-menu").css("transform","none");
		$("#layer-panel-scrollbar").css({
			"left": "auto",
			"right": "0em",
			"transform": "translateX(50%)",
		});
		// exchange menu open direction
		$("#right-menu-panels").css({
			"left": "auto",
			"right": "0em",
			"flex-direction": "row"
		});
		$("#left-menu-panels").css({
			"left": "0em",
			"right": "auto",
			"flex-direction": "row"
		});
		$("#right-menu-panels .setting-panel").children().addClass("menu-scroll-wrapper").removeClass("left-menu-scroll-wrapper");
		$("#left-menu-panels .setting-panel").children().addClass("left-menu-scroll-wrapper").removeClass("menu-scroll-wrapper");
		$("#brush-button").css("justify-content","flex-start");

		FILES.fileManager.setSwipeDirection("right");
		SettingHandler.sysMenu.setSwipeDirection("right");
		BrushManager.brushMenu.setSwipeDirection("left");
	}
	else { // Reversed
		$("#top-menu-panel").css("flex-direction","row-reverse");
		$("#top-menu-right-panel").css("flex-direction","row-reverse");
		$("#top-menu-left-center-panel").css("flex-direction","row-reverse");
		$("#top-menu-left-panel").css("flex-direction","row-reverse");
		$("#column-panel").css("flex-direction","row-reverse");
		$("#layer-panel-right-menu").css("transform","scaleX(-1)");
		$("#layer-panel-scrollbar").css({
			"left": "0em",
			"right": "auto",
			"transform": "translateX(-50%)",
		});
		// exchange menu open direction
		$("#right-menu-panels").css({
			"left": "0em",
			"right": "auto",
			"flex-direction": "row-reverse"
		});
		$("#left-menu-panels").css({
			"left": "auto",
			"right": "0em",
			"flex-direction": "row-reverse"
		});
		$("#right-menu-panels .setting-panel").children().addClass("left-menu-scroll-wrapper").removeClass("menu-scroll-wrapper");
		$("#left-menu-panels .setting-panel").children().addClass("menu-scroll-wrapper").removeClass("left-menu-scroll-wrapper");
		$("#brush-button").css("justify-content","flex-end");

		FILES.fileManager.setSwipeDirection("left");
		SettingHandler.sysMenu.setSwipeDirection("left");
		BrushManager.brushMenu.setSwipeDirection("right");
	}
	PALETTE.refreshUIParam(); // refresh palette position
}

ENV.setUITheme=function(theme) {
	switch(theme) {
		case "dark":
			ENV.displaySettings.uiTheme="dark";
			$("#css-theme").attr("href","./styles/color-theme-dark.css");
			break;
		case "light": // default as light theme
		default:
			ENV.displaySettings.uiTheme="light";
			$("#css-theme").attr("href","./styles/color-theme-light.css");
	}
}

ENV.setUIFont=function(fontStr){
	ENV.displaySettings.uiFont=fontStr;
	switch(fontStr){
		case "sans-serif":
			$(":root").css("--default-font-family", "var(--sans-serif-font-family)");
			break;
		case "monospace":
		default:
			$(":root").css("--default-font-family", "var(--monospace-font-family)");
	}
	PALETTE.refreshUIParam(); // position may change
}

// ================== Other settings dialog ==================

ENV.showPrefDialog=function(){
	const $title=DialogBoxItem.textBox({text: Lang("other-display-pref")});
	const dialog=new DialogBoxItem([$title],[{
		text: Lang("system-font"),
		callback: e=>{
			ENV.showFontDialog();
		}
	},{
		text: Lang("UI Orientation"),
		callback: e=>{
			ENV.showUIOrientationDialog();
		}
	},{ // nothing
		text: Lang("Cancel")
	}]);
	DIALOGBOX.show(dialog);
}

ENV.showFontDialog=function(){
	const $title=DialogBoxItem.textBox({text: Lang("system-font")});
	const dialog=new DialogBoxItem([$title],[{
		text: Lang("system-font-ss"),
		callback: e=>{
			ENV.setUIFont("sans-serif");
		}
	},{
		text: Lang("system-font-mono"),
		callback: e=>{
			ENV.setUIFont("monospace");
		}
	}]);
	DIALOGBOX.show(dialog);
}

ENV.showUIOrientationDialog=function(){
	const $title=DialogBoxItem.textBox({text: Lang("UI Orientation")});
	const dialog=new DialogBoxItem([$title],[{
		text: Lang("ui-left"),
		callback: e=>{
			ENV.setUIOrientation(true);
		}
	},{
		text: Lang("ui-right"),
		callback: e=>{
			ENV.setUIOrientation(false);
		}
	}]);
	DIALOGBOX.show(dialog);
}

// ================== Other UIs ======================
ENV.onMultipleTabs=function(){
	$("#mask-item").html(Lang("multiple-tabs-hint"));
	// $("#body-mask-panel").click(e=>{
	// 	window.close();
	// });
}

ENV.showUIs=function(){
	$("#body-mask-panel").css("display","none");
	$("#ui-panel").css("visibility","visible");
}