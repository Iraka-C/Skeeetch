/**
 * Manage brush params
 */
BrushManager={};
BrushManager.brushes=[
	{
		name:"Pencil",
		size:20, // diameter
		minSize:1, // diameter
		isSizePressure:1, // 1: Enable, 0:Disable

		//smoothness:2, // the smoothness of the trail: avoid trembling
		alpha:100, // in %
		minAlpha:50,
		isAlphaPressure:1,
		edgeHardness:0.9 // for how much part of the radius near edge is smoothed (0:gauss~1:binary)
	},
	{
		name:"Brush",
		size:50,
		minSize:10,
		isSizePressure:1,
		//smoothness:2,
		//mixColor:0.3,
		alpha:40,
		minAlpha:0,
		isAlphaPressure:1,
		edgeHardness:0.4
	},
	{
		name:"Eraser",
		size:10,
		minSize:10,
		isSizePressure:0,
		//smoothness:0,
		alpha:100,
		minAlpha:100,
		isAlphaPressure:0,
		edgeHardness:0.9
	}
];

BrushManager.general={
	sensitivity:1.0, // 0.0 ~ 2.0: 1=normal 0: dull, 2: sharp
	_sPower:1.0 // 5^(sensitivity-1)
};

BrushManager.limits={
	minSize: 1,
	maxSize: 300,
	sBase: 5 // sensitivity adjustment base value
};

// ===================== functions ======================

BrushManager.init=function(){
	BrushManager.setActiveBrush(0);
	let brushMenu=BrushManager.initBrushSettingMenu();
	BrushManager.initMenuSizeSection(brushMenu);
	BrushManager.initMenuOpacitySection(brushMenu);
	BrushManager.initBrushButton(brushMenu);
	BrushManager.initPenSetting(brushMenu);
	brushMenu.update();
}

BrushManager.initBrushSettingMenu=function(){
	return new SettingManager(
		$("#brush-menu-panel"),
		"Paint Brush" // title
	);
};

BrushManager.initMenuSizeSection=function(brushMenu){
	brushMenu.addSectionTitle("Size Control");
	BrushManager.brushSizeUpdateFunc=brushMenu.addInstantNumberItem("Brush Size",0,"px",
		newVal=>{ // set on input
			if(newVal){
				newVal=newVal.clamp(BrushManager.limits.minSize,BrushManager.limits.maxSize);
				BrushManager.activeBrush.minSize*=newVal/BrushManager.activeBrush.size;
				BrushManager.activeBrush.size=newVal;
				BrushManager.minSizeUpdateFunc();
				BrushManager.brushButtonUpdateFunc();
			}
		},
		(dW,oldVal)=>{ // set on scroll
			let newVal=(oldVal+dW).clamp(BrushManager.limits.minSize,BrushManager.limits.maxSize);
			BrushManager.activeBrush.minSize*=newVal/BrushManager.activeBrush.size;
			BrushManager.activeBrush.size=newVal;
			BrushManager.minSizeUpdateFunc();
			BrushManager.brushButtonUpdateFunc();
		}, // set
		(dx,oldVal)=>{ // set on drag-x
			let newVal=(oldVal+dx/4).clamp(BrushManager.limits.minSize,BrushManager.limits.maxSize);
			BrushManager.activeBrush.minSize*=newVal/BrushManager.activeBrush.size;
			BrushManager.activeBrush.size=newVal;
			BrushManager.minSizeUpdateFunc();
			BrushManager.brushButtonUpdateFunc();
		}, // set
		()=>Math.round(BrushManager.activeBrush.size)
	);
	brushMenu.addSwitch("Pressure Controlled Size",["Disabled","Enabled"],null,id=>{
		BrushManager.activeBrush.isSizePressure=id;
		minSizeHintUpdateFunc(id==0?true:false);
	},1);
	BrushManager.minSizeUpdateFunc=brushMenu.addInstantNumberItem("Min Size",0,"px",
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
	let minSizeHintUpdateFunc=brushMenu.addHint("* Invalid when pressure is disabled");
	minSizeHintUpdateFunc(false);
}

BrushManager.initMenuOpacitySection=function(brushMenu){
	brushMenu.addSectionTitle("Opacity Control");
	BrushManager.brushAlphaUpdateFunc=brushMenu.addInstantNumberItem("Opacity",100,"%",
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
	brushMenu.addSwitch("Pressure Controlled Opacity",["Disabled","Enabled"],null,id=>{
		BrushManager.activeBrush.isAlphaPressure=id;
		minAlphaHintUpdateFunc(id==0?true:false);
	},1);
	BrushManager.minAlphaUpdateFunc=brushMenu.addInstantNumberItem("Min Opacity",0,"%",
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
	let minAlphaHintUpdateFunc=brushMenu.addHint("* Invalid when pressure is disabled");
	minAlphaHintUpdateFunc(false);
	BrushManager.edgeHardnessUpdateFunc=brushMenu.addInstantNumberItem("Hard Edge",0,"",
		newVal=>{ // set on input
			if(newVal){
				newVal=newVal.clamp(0,1);
				BrushManager.activeBrush.edgeHardness=newVal;
			}
		},
		(dW,oldVal)=>{ // set on scroll
			let newVal=(oldVal+dW/10).clamp(0,1);
			BrushManager.activeBrush.edgeHardness=newVal;
		}, // set
		(dx,oldVal)=>{ // set on drag-x
			let newVal=(oldVal+dx/100).clamp(0,1);
			BrushManager.activeBrush.edgeHardness=newVal;
		}, // set
		()=>BrushManager.activeBrush.edgeHardness.toFixed(1)
	);
}

BrushManager.initPenSetting=function(brushMenu){
	brushMenu.addSectionTitle("Stylus");
	BrushManager.minAlphaUpdateFunc=brushMenu.addInstantNumberItem("Sensitivity",0,"",
		newVal=>{ // set on input
			if(newVal){
				newVal=newVal.clamp(0,2);
				BrushManager.general.sensitivity=newVal;
				BrushManager.general._sPower=Math.pow(BrushManager.limits.sBase,newVal-1);
			}
		},
		(dW,oldVal)=>{ // set on scroll
			let newVal=(oldVal+dW/10).clamp(0,2);
			BrushManager.general.sensitivity=newVal;
			BrushManager.general._sPower=Math.pow(BrushManager.limits.sBase,newVal-1);
		}, // set
		(dx,oldVal)=>{ // set on drag-x
			let newVal=(oldVal+dx/100).clamp(0,2);
			BrushManager.general.sensitivity=newVal;
			BrushManager.general._sPower=Math.pow(BrushManager.limits.sBase,newVal-1);
		}, // set
		()=>BrushManager.general.sensitivity.toFixed(1)
	);
}

BrushManager.setActiveBrush=function(v){
	BrushManager.activeBrushID=v;
	BrushManager.activeBrush=BrushManager.brushes[v];
}

BrushManager.initBrushButton=function(brushMenu){
	brushMenu.setOpenButton($("#brush-button"));
	$("#brush-size").val(Math.round(BrushManager.activeBrush.size));
	SettingManager.setInputInstantNumberInteraction(
		$("#brush-size"),$("#brush-button"),
		newVal=>{ // set on input
			if(newVal){
				newVal=newVal.clamp(BrushManager.limits.minSize,BrushManager.limits.maxSize);
				BrushManager.activeBrush.minSize*=newVal/BrushManager.activeBrush.size;
				BrushManager.activeBrush.size=newVal;
				BrushManager.brushSizeUpdateFunc();
				BrushManager.minSizeUpdateFunc();
			}
		},
		(dW,oldVal)=>{ // set on scroll
			let newVal=(oldVal+dW).clamp(BrushManager.limits.minSize,BrushManager.limits.maxSize);
			BrushManager.activeBrush.minSize*=newVal/BrushManager.activeBrush.size;
			BrushManager.activeBrush.size=newVal;
			BrushManager.brushSizeUpdateFunc();
			BrushManager.minSizeUpdateFunc();
		}, // set
		(dx,oldVal)=>{ // set on drag-x
			let newVal=(oldVal+dx/4).clamp(BrushManager.limits.minSize,BrushManager.limits.maxSize);
			BrushManager.activeBrush.minSize*=newVal/BrushManager.activeBrush.size;
			BrushManager.activeBrush.size=newVal;
			BrushManager.brushSizeUpdateFunc();
			BrushManager.minSizeUpdateFunc();
		}, // set
		()=>$("#brush-size").val(Math.round(BrushManager.activeBrush.size))
	);
	BrushManager.brushButtonUpdateFunc=function(){
		$("#brush-size").val(Math.round(BrushManager.activeBrush.size));
	};
}