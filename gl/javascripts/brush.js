/**
 * Manage brush params
 */
BrushManager={};
BrushManager.brushes=[
	{
		name:"pencil",
		size:100, // diameter in sizeList[size]
		minSize:0.0, // 0~1 (0~100%) of size
		isSizePressure:1, // 1: Enable, 0:Disable
		alpha:1.0, // opacity 0~1 (0~100%)
		minAlpha:1.0, // 0~1 (0~100%) of alpha
		isAlphaPressure:0,
		edgeHardness:1.0, // for how much part of the radius near edge is smoothed (0:gauss~1:binary)
		blendMode:0, // 0: normal, -1: erase
		brushtip: { // brush shape // This is the initial status
			type: "round",
			imageData: null
		}
	},
	{
		name:"spray gun",
		size:100,
		minSize:0.4,
		isSizePressure:1,
		alpha:0.8,
		minAlpha:0,
		isAlphaPressure:1,
		edgeHardness:0,
		blendMode:0
		// scatter, jitter, etc

	},
	{
		name:"paint brush",
		size:80,
		minSize:0.4,
		isSizePressure:1,
		alpha:1,
		minAlpha:0,
		isAlphaPressure:0,
		edgeHardness:0.5,
		blendMode:1, // 1: with color adding
		// paint brush specialized
		moisture: 1,
		extension: 0.9 // how much color to pick from sampler

	},
	{
		name:"smudge brush",
		size:80,
		minSize:1,
		isSizePressure:0,
		alpha:0, // no color at first
		minAlpha:0,
		isAlphaPressure:1,
		edgeHardness:0.5,
		blendMode:2, // 2: with smudging
		extension: 0.8 // how much color to pick from sampler
	},
	{
		name:"eraser",
		size:50,
		minSize:1.0,
		isSizePressure:0,
		alpha:1,
		minAlpha:1.0,
		isAlphaPressure:0,
		edgeHardness:1.0,
		blendMode:-1
	}
];

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

BrushManager.init=function(){
	for(const brush of BrushManager.brushes){
		brush.name=Lang(brush.name);
	}
	// @TODO: add load customized brushes from settings
	BrushManager.setActiveBrush(0);
	let brushMenu=BrushManager.initBrushSettingMenu();
	BrushManager.initMenuSizeSection(brushMenu);
	BrushManager.initMenuOpacitySection(brushMenu);
	BrushManager.initStylusSetting(brushMenu);
	BrushManager.initBrushButton(brushMenu);
	BrushManager.initBrushSelector();
	brushMenu.update();
	BrushManager.brushMenu=brushMenu; // record this
}

BrushManager.initBrushSettingMenu=function(){
	return new SettingManager(
		$("#brush-menu-panel"),
		Lang("Paint Brush") // title
	);
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
	if(typeof(v)=="number"){
		BrushManager.activeBrush=BrushManager.brushes[v];
	}
	else{ // object
		BrushManager.activeBrush=v;
	}
	// Update display
	$("#brush-name").text(BrushManager.activeBrush.name);
	$("#brush-size").val(Math.round(BrushManager.activeBrush.size));
	if(BrushManager.brushMenu){ // if associated with menu
		BrushManager.brushMenu.update(); // menu items and values updated here
	}
}