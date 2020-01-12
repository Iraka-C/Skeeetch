/**
 * Manage brush params
 */
BrushManager={};
BrushManager.brushes=[
	{
		name:Lang("pencil"),
		size:20, // diameter
		minSize:1, // diameter
		isSizePressure:1, // 1: Enable, 0:Disable

		//smoothness:2, // the smoothness of the trail: avoid trembling
		alpha:100, // in %
		minAlpha:50,
		isAlphaPressure:1,
		edgeHardness:0.9, // for how much part of the radius near edge is smoothed (0:gauss~1:binary)
		blendMode:0 // 0: normal, -1: eraser, see RENDER/RENDER16
	},
	{
		name:Lang("brush"),
		size:80,
		minSize:40,
		isSizePressure:1,
		//smoothness:2,
		//mixColor:0.3,
		alpha:85,
		minAlpha:0,
		isAlphaPressure:1,
		edgeHardness:0.3,
		blendMode:0
	},
	{
		name:Lang("eraser"),
		size:50,
		minSize:10,
		isSizePressure:0,
		//smoothness:0,
		alpha:100,
		minAlpha:100,
		isAlphaPressure:0,
		edgeHardness:0.9,
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
	minSize: 1,
	maxSize: 300
//	sBase: 5, // sensitivity adjustment base value
};

// ===================== functions ======================

BrushManager.init=function(){
	BrushManager.setActiveBrush(0);
	let brushMenu=BrushManager.initBrushSettingMenu();
	BrushManager.initMenuSizeSection(brushMenu);
	BrushManager.initMenuOpacitySection(brushMenu);
	BrushManager.initPenSetting(brushMenu);
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

BrushManager.initMenuSizeSection=function(brushMenu){
	brushMenu.addSectionTitle(Lang("Size Control"));
	BrushManager.brushSizeUpdateFunc=brushMenu.addInstantNumberItem(
		Lang("Brush Size"),0,Lang("px"),
		newVal=>{ // set on input
			if(newVal){
				newVal=newVal.clamp(BrushManager.limits.minSize,BrushManager.limits.maxSize);
				BrushManager.activeBrush.minSize=Math.max(BrushManager.activeBrush.minSize*newVal/BrushManager.activeBrush.size,1);
				// @TODO: better idea? set origin point at (1,1)
				BrushManager.activeBrush.size=newVal;
				BrushManager.minSizeUpdateFunc();
				BrushManager.brushButtonUpdateFunc();
			}
		},
		(dW,oldVal)=>{ // set on scroll
			let newVal=(oldVal+dW).clamp(BrushManager.limits.minSize,BrushManager.limits.maxSize);
			BrushManager.activeBrush.minSize=Math.max(BrushManager.activeBrush.minSize*newVal/BrushManager.activeBrush.size,1);
			BrushManager.activeBrush.size=newVal;
			BrushManager.minSizeUpdateFunc();
			BrushManager.brushButtonUpdateFunc();
		}, // set
		(dx,oldVal)=>{ // set on drag-x
			let newVal=(oldVal+dx/4).clamp(BrushManager.limits.minSize,BrushManager.limits.maxSize);
			BrushManager.activeBrush.minSize=Math.max(BrushManager.activeBrush.minSize*newVal/BrushManager.activeBrush.size,1);
			BrushManager.activeBrush.size=newVal;
			BrushManager.minSizeUpdateFunc();
			BrushManager.brushButtonUpdateFunc();
		}, // set
		()=>Math.round(BrushManager.activeBrush.size)
	);
	brushMenu.addSwitch(Lang("Pressure Controlled Size"),[Lang("Disabled"),Lang("Enabled")],null,id=>{
		BrushManager.activeBrush.isSizePressure=id;
		minSizeHintUpdateFunc(id==0?true:false);
	},()=>BrushManager.activeBrush.isSizePressure);
	BrushManager.minSizeUpdateFunc=brushMenu.addInstantNumberItem(
		Lang("Min Size"),0,Lang("px"),
		newVal=>{ // set on input
			if(newVal){
				newVal=newVal.clamp(BrushManager.limits.minSize,BrushManager.activeBrush.size);
				BrushManager.activeBrush.minSize=newVal;
			}
		},
		(dW,oldVal)=>{ // set on scroll
			let newVal=(oldVal+dW).clamp(BrushManager.limits.minSize,BrushManager.activeBrush.size);
			BrushManager.activeBrush.minSize=newVal;
		}, // set
		(dx,oldVal)=>{ // set on drag-x
			let newVal=(oldVal+dx/4).clamp(BrushManager.limits.minSize,BrushManager.activeBrush.size);
			BrushManager.activeBrush.minSize=newVal;
		}, // set
		()=>Math.round(BrushManager.activeBrush.minSize)
	);
	let minSizeHintUpdateFunc=brushMenu.addHint(Lang("brush-pressure-hint-1"));
	minSizeHintUpdateFunc(false);
}
/**
 * @TODO: min opacity can be NaN
 */
BrushManager.initMenuOpacitySection=function(brushMenu){
	brushMenu.addSectionTitle(Lang("Opacity Control"));
	BrushManager.brushAlphaUpdateFunc=brushMenu.addInstantNumberItem(Lang("Opacity"),100,"%",
		newVal=>{ // set on input
			if(newVal){
				newVal=newVal.clamp(0,100);
				BrushManager.activeBrush.minAlpha*=newVal/BrushManager.activeBrush.alpha;
				BrushManager.activeBrush.alpha=newVal;
				BrushManager.minAlphaUpdateFunc();
			}
		},
		(dW,oldVal)=>{ // set on scroll
			let newVal=(oldVal+dW).clamp(0,100);
			BrushManager.activeBrush.minAlpha*=newVal/BrushManager.activeBrush.alpha;
			BrushManager.activeBrush.alpha=newVal;
			BrushManager.minAlphaUpdateFunc();
		}, // set
		(dx,oldVal)=>{ // set on drag-x
			let newVal=(oldVal+dx/4).clamp(0,100);
			BrushManager.activeBrush.minAlpha*=newVal/BrushManager.activeBrush.alpha;
			BrushManager.activeBrush.alpha=newVal;
			BrushManager.minAlphaUpdateFunc();
		}, // set
		()=>Math.round(BrushManager.activeBrush.alpha)
	);
	brushMenu.addSwitch(Lang("Pressure Controlled Opacity"),[Lang("Disabled"),Lang("Enabled")],null,id=>{
		BrushManager.activeBrush.isAlphaPressure=id;
		minAlphaHintUpdateFunc(id==0?true:false);
	},()=>BrushManager.activeBrush.isAlphaPressure);
	BrushManager.minAlphaUpdateFunc=brushMenu.addInstantNumberItem(Lang("Min Opacity"),0,"%",
		newVal=>{ // set on input
			if(newVal){
				newVal=newVal.clamp(0,BrushManager.activeBrush.alpha);
				BrushManager.activeBrush.minAlpha=newVal;
			}
		},
		(dW,oldVal)=>{ // set on scroll
			let newVal=(oldVal+dW).clamp(0,BrushManager.activeBrush.alpha);
			BrushManager.activeBrush.minAlpha=newVal;
		}, // set
		(dx,oldVal)=>{ // set on drag-x
			let newVal=(oldVal+dx/4).clamp(0,BrushManager.activeBrush.alpha);
			BrushManager.activeBrush.minAlpha=newVal;
		}, // set
		()=>Math.round(BrushManager.activeBrush.minAlpha)
	);
	let minAlphaHintUpdateFunc=brushMenu.addHint(Lang("brush-pressure-hint-1"));
	minAlphaHintUpdateFunc(false);
	BrushManager.edgeHardnessUpdateFunc=brushMenu.addInstantNumberItem("Hard Edge",0,"",
		newVal=>{ // set on input
			if(newVal){
				newVal=newVal.clamp(0,1);
				BrushManager.activeBrush.edgeHardness=newVal;
			}
		},
		(dW,oldVal)=>{ // set on scroll
			let newVal=(oldVal+dW/20).clamp(0,1);
			BrushManager.activeBrush.edgeHardness=newVal;
		}, // set
		(dx,oldVal)=>{ // set on drag-x
			let newVal=(oldVal+dx/100).clamp(0,1);
			BrushManager.activeBrush.edgeHardness=newVal;
		}, // set
		()=>BrushManager.activeBrush.edgeHardness.toFixed(2)
	);
}

BrushManager.initPenSetting=function(brushMenu){
	brushMenu.addSectionTitle("Stylus");
	BrushManager.sensitivityUpdateFunc=brushMenu.addInstantNumberItem("Sensitivity",0,"",
		newVal=>{ // set on input
			if(newVal){
				newVal=newVal.clamp(0,2);
				BrushManager.general.sensitivity=newVal;
				//BrushManager.general._sPower=Math.pow(BrushManager.limits.sBase,newVal-1);
			}
		},
		(dW,oldVal)=>{ // set on scroll
			let newVal=(oldVal+dW/10).clamp(0,2);
			BrushManager.general.sensitivity=newVal;
			//BrushManager.general._sPower=Math.pow(BrushManager.limits.sBase,newVal-1);
		}, // set
		(dx,oldVal)=>{ // set on drag-x
			let newVal=(oldVal+dx/100).clamp(0,2);
			BrushManager.general.sensitivity=newVal;
			//BrushManager.general._sPower=Math.pow(BrushManager.limits.sBase,newVal-1);
		}, // set
		()=>BrushManager.general.sensitivity.toFixed(1)
	);
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
	//$("#brush-size").val(Math.round(BrushManager.activeBrush.size));
	if(BrushManager.brushMenu){ // if associated with menu
		BrushManager.brushMenu.update(); // size updated here
	}
}

BrushManager.initBrushButton=function(brushMenu){
	brushMenu.setOpenButton($("#brush-button"));
	BrushManager.brushButtonUpdateFunc=function(){
		$("#brush-size").val(Math.round(BrushManager.activeBrush.size));
	};
	SettingManager.setInputInstantNumberInteraction(
		// @TODO: disabled input color
		$("#brush-size"),$("#brush-button"),null, // no input
		(dW,oldVal)=>{ // set on scroll
			let newVal=(oldVal+dW).clamp(BrushManager.limits.minSize,BrushManager.limits.maxSize);
			BrushManager.activeBrush.minSize*=newVal/BrushManager.activeBrush.size;
			BrushManager.activeBrush.size=newVal;
			BrushManager.brushSizeUpdateFunc();
			BrushManager.minSizeUpdateFunc();
		},
		(dx,oldVal)=>{ // set on drag-x
			let newVal=(oldVal+dx/4).clamp(BrushManager.limits.minSize,BrushManager.limits.maxSize);
			BrushManager.activeBrush.minSize*=newVal/BrushManager.activeBrush.size;
			BrushManager.activeBrush.size=newVal;
			BrushManager.brushSizeUpdateFunc();
			BrushManager.minSizeUpdateFunc();
		},
		BrushManager.brushButtonUpdateFunc
	);
	BrushManager.brushButtonUpdateFunc();
}

BrushManager.initBrushSelector=function(){
	let menu=$("#brush-selector-menu");
	for(let brush of BrushManager.brushes){
		let block=$("<div class='brush-selector-item'>").text(brush.name);
		block.on("click",event=>{
			BrushManager.setActiveBrush(brush);
		});
		menu.append(block);
	}
	// TODO: change size val on changing brush
}