ENV.setUIOrientation=function(isLeft){
	ENV.displaySettings.uiOrientationLeft=isLeft;
	if(isLeft){ // Normal
		$("#top-menu-panel").css("flex-direction","row");
		$("#top-menu-right-panel").css("flex-direction","row");
		$("#top-menu-left-panel").css("flex-direction","row");
		$("#column-panel").css("flex-direction","row");
		$("#layer-panel-right-menu").css("transform","none");
		$("#layer-panel-scrollbar").css({
			"left":"auto",
			"right":"0em",
			"transform":"translateX(50%)",
		});
		// exchange menu open direction
		$("#right-menu-panels").css({
			"left":"auto",
			"right":"0em",
			"flex-direction":"row"
		});
		$("#left-menu-panels").css({
			"left":"0em",
			"right":"auto",
			"flex-direction":"row"
		});
		$("#right-menu-panels .setting-panel").children().addClass("menu-scroll-wrapper").removeClass("left-menu-scroll-wrapper");
		$("#left-menu-panels .setting-panel").children().addClass("left-menu-scroll-wrapper").removeClass("menu-scroll-wrapper");
		$("#brush-button").css("justify-content","flex-start");
	}
	else{ // Reversed
		$("#top-menu-panel").css("flex-direction","row-reverse");
		$("#top-menu-right-panel").css("flex-direction","row-reverse");
		$("#top-menu-left-panel").css("flex-direction","row-reverse");
		$("#column-panel").css("flex-direction","row-reverse");
		$("#layer-panel-right-menu").css("transform","scaleX(-1)");
		$("#layer-panel-scrollbar").css({
			"left":"0em",
			"right":"auto",
			"transform":"translateX(-50%)",
		});
		// exchange menu open direction
		$("#right-menu-panels").css({
			"left":"0em",
			"right":"auto",
			"flex-direction":"row-reverse"
		});
		$("#left-menu-panels").css({
			"left":"auto",
			"right":"0em",
			"flex-direction":"row-reverse"
		});
		$("#right-menu-panels .setting-panel").children().addClass("left-menu-scroll-wrapper").removeClass("menu-scroll-wrapper");
		$("#left-menu-panels .setting-panel").children().addClass("menu-scroll-wrapper").removeClass("left-menu-scroll-wrapper");
		$("#brush-button").css("justify-content","flex-end");
	}
}