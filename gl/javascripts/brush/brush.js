/**
 * Manage brush params
 */
"use strict";
const BrushManager={};
BrushManager.brushes=[
	{
		proto:0, // a prototype id indicating the type of brush, also the order in brushes
		// Of course you can assign proto with for loop. Write it here for clearance.
		name:"pencil",
		size:20, // diameter in sizeList[size]
		minSize:0.0, // 0~1 (0~100%) of size
		isSizePressure:1, // 1: Enable, 0:Disable
		alpha:1.0, // opacity 0~1 (0~100%)
		minAlpha:0.0, // 0~1 (0~100%) of alpha
		isAlphaPressure:0,
		edgeHardness:1.0, // for how much part of the radius near edge is smoothed (0:gauss~1:binary)
		blendMode:0, // 0: normal, -1: erase
		isEroding: 0, // auto eroding brushtip by pressure. 0: disabled, 1: opacity, 2: shape

		brushtip: null, // null: round tip, GLTexture: customized
		// following valid when customized brushtip
		brushtipRot: 0, // degree of brushtip pattern rotation.
		isRotWithStroke: 0, // is to rotate the brushtip along the stroke direction

		isScatter: 0,
		// following valid when scattering
		scatRad: 1, // random translation range, unit as basic size (size pressure controlled)
		randScale: 0.5, // random scaling, unit as basic size
		randRot: 0.5, // random rotation, unit as 1 full circle
		randOpa: 0.5, // random opacity, unit same as minAlpha
		interval: 0.02, // auto when round & no scatter
		hotKey: null
	},
	{
		proto:1,
		name:"paint brush",
		size:80,
		minSize:0.25,
		isSizePressure:1,
		alpha:0.3,
		minAlpha:0,
		isAlphaPressure:1,
		edgeHardness:1.0,
		blendMode:1, // 1: with color adding
		// paint brush specialized
		extension: 0.8, // how much color to pick from sampler
		isScatter: 0,
		interval: 0.02, // auto when round & no scatter
		hotKey: null
	},
	{
		proto:2,
		name:"smudge brush",
		size:80,
		minSize:1,
		isSizePressure:0,
		alpha:0, // no color at first
		minAlpha:0,
		isAlphaPressure:1,
		edgeHardness:0.5,
		blendMode:2, // 2: with smudging
		extension: 0.8, // how much color to pick from sampler

		brushtip: null, // null: round tip, GLTexture: customized
		// following valid when customized brushtip
		brushtipRot: 0, // degree of brushtip pattern rotation.
		isRotWithStroke: 0, // is to rotate the brushtip along the stroke direction
		// doesn't allow scatter
		isScatter: -1, // -1 for not allowed
		// fixed density
		hotKey: null
	},
	{
		proto:3,
		name:"eraser",
		size:50,
		minSize:1.0,
		isSizePressure:0,
		alpha:1.0,
		minAlpha:0.0,
		isAlphaPressure:0,
		edgeHardness:1.0,
		blendMode:-1,
		isScatter: 0,
		interval: 0.02, // auto when round & no scatter
		hotKey: null
	}
];
/**
 * Customized brushes
 * BrushManager.customBrushes[i] has property brush.isCustom == true
 */
BrushManager.customBrushes=[];

BrushManager.brushHash=new Map(); // hash code for customized brush
BrushManager.generateHash=function(){
	let tag="";
	do {
		tag=ENV.hash("b");
	} while(BrushManager.brushHash.has(tag));
	return tag;
}

BrushManager.general={
	sensitivity:1.0, // 0.0 ~ 2.0: 1=normal 0: dull, 2: sharp
	//_sPower:1.0, // 5^(sensitivity-1)
	quality:20 // one pixel rendered by how many circles along the stroke
	//_invQuality:1/20 // 1/quality
};

BrushManager.limits={
	minSize: 1, // in px
	maxSize: 500 // in px
};
BrushManager.sizeList=[
	1,2,3,4,5,6,7,8,9,10,
	12,14,16,18,20,
	25,30,35,40,45,50,55,60,65,70,75,80,
	90,100,110,120,130,140,150,160,
	180,200,
	225,250,275,300,325,350,
	400,450,500
];

// ===================== functions ======================

BrushManager.init=function(sysSettingParams){
	let brushSettings=null;
	if(!sysSettingParams.windowParams.query.reset){
		brushSettings=STORAGE.SETTING.getBrushes();
	}
	if(brushSettings){ // get default brush setting
		if(brushSettings.default){ // assign value to make sure new setting compatible
			for(let i=0;i<brushSettings.default.length;i++){
				const brush=BrushManager.brushes[i];
				const name=brush.name; // get initial name
				Object.assign(brush,brushSettings.default[i]);
				if(!brush.isCustom){ // a primitive brush
					brush.name=Lang(name); // use translated name rather than saved name
				}
			}
		}
		BrushManager.initBrushSelector(brushSettings.custom);
		const activeBrush=brushSettings.active;
		if(activeBrush){
			if(activeBrush.isCustom){ // set custom active
				const brush=BrushManager.brushHash.get(activeBrush.id);
				if(brush){
					BrushManager.setActiveBrush(brush);
				}
				else{ // not found
					BrushManager.setActiveBrush(BrushManager.brushes[0]);
				}
			}
			else{ // set fixed active
				BrushManager.setActiveBrush(BrushManager.brushes[activeBrush.id]);
			}
		}
		else{ // set default active
			BrushManager.setActiveBrush(BrushManager.brushes[0]);
		}
		
	}
	else{ // translate brushes
		for(const brush of BrushManager.brushes){ // translate initial brush names
			brush.name=Lang(brush.name);
		}
		BrushManager.initBrushSelector();
		BrushManager.setActiveBrush(BrushManager.brushes[0]); // set default active
	}
	EVENTS.initBrushHotKeys(); // init hot keys for brushes

	// init brush setting menus
	const brushMenu=BrushManager.initBrushSettingMenu();
	BrushManager.initBrushButton(brushMenu);
	BrushManager.initMenuSizeSection(brushMenu);
	BrushManager.initMenuOpacitySection(brushMenu);
	BrushManager.initScatterSetting(brushMenu);
	BrushManager.initStylusSetting(brushMenu);
	brushMenu.update();
	BrushManager.brushMenu=brushMenu; // record this
}

BrushManager.initBrushSettingMenu=function(){
	const menu=new SettingManager(
		$("#brush-menu-panel"),
		Lang("Paint Brush") // title
	);
	const menuWrapper=$("#brush-menu-panel").children();
	menuWrapper.removeClass("menu-scroll-wrapper");
	menuWrapper.addClass("left-menu-scroll-wrapper");
	return menu;
};

// ====================== Brush Size =======================
BrushManager._findBrushSizeId=function(size){
	size=size.clamp(BrushManager.limits.minSize,BrushManager.limits.maxSize);
	let minDiff=Infinity;
	let minDiffId=0;
	let sList=BrushManager.sizeList;
	for(let id=0;id<sList.length;id++){
		let nowDiff=Math.abs(size-sList[id]);
		if(nowDiff<minDiff){
			minDiff=nowDiff;
			minDiffId=id;
		}
	}
	return minDiffId;
}

// dS should be +1(larger)/-1(smaller)
BrushManager.changeActiveBrushSizeBy=function(dS){
	const oldId=BrushManager._findBrushSizeId(BrushManager.activeBrush.size);
	const newId=Math.round(oldId+dS).clamp(0,BrushManager.sizeList.length-1);
	BrushManager.activeBrush.size=BrushManager.sizeList[newId];
	BrushManager.minSizeUpdateFunc();
	BrushManager.brushButtonUpdateFunc();
	CURSOR.updateXYR(); // update brush cursor
}

BrushManager.setActiveBrush=function(v){
	// deactivate all
	$("#brush-selector-menu").find(".brush-selector-tr-selected").removeClass("brush-selector-tr-selected");

	// if(typeof(v)=="number"){
	// 	BrushManager.activeBrush=BrushManager.brushes[v];
	// }
	// else{ // object
	BrushManager.activeBrush=v;
	
	v.$row.addClass("brush-selector-tr-selected");
	// }
	// Update display
	$("#brush-name").text(v.name);
	$("#brush-size").val(Math.round(v.size));
	if(BrushManager.brushMenu){ // if associated with menu
		BrushManager.brushMenu.update(); // menu items and values updated here
	}
	CURSOR.updateXYR(); // update cursor display
}