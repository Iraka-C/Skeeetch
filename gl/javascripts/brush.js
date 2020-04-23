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
		extension: 1 // how much color to pick from sampler
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

// ========================== Brush Menu ===========================
BrushManager.initMenuSizeSection=function(brushMenu){
	brushMenu.addSectionTitle(Lang("Size Control"));
	BrushManager.brushSizeUpdateFunc=brushMenu.addInstantNumberItem(
		Lang("Brush Size"),()=>Math.round(BrushManager.activeBrush.size),Lang("px"),
		newVal=>{ // set on input
			if(newVal){ // String -> Number
				newVal=(newVal-0).clamp(BrushManager.limits.minSize,BrushManager.limits.maxSize);
				BrushManager.activeBrush.size=newVal;
				BrushManager.minSizeUpdateFunc();
				BrushManager.brushButtonUpdateFunc();
			}
		},
		(dW,oldVal)=>{ // set on scroll
			BrushManager.changeActiveBrushSizeBy(dW);
		}, // set
		(dx,oldVal)=>{ // set on drag-x
			let originId=BrushManager._findBrushSizeId(oldVal-0);
			let newId=Math.round(originId+dx/5).clamp(0,BrushManager.sizeList.length-1);
			BrushManager.activeBrush.size=BrushManager.sizeList[newId];
			BrushManager.minSizeUpdateFunc();
			BrushManager.brushButtonUpdateFunc();
		} // set
	);
	brushMenu.addSwitch(Lang("Pressure Controlled Size"),[Lang("Disabled"),Lang("Enabled")],null,id=>{
		BrushManager.activeBrush.isSizePressure=id;
		minSizeHintUpdateFunc(id==0?true:false);
	},()=>BrushManager.activeBrush.isSizePressure);
	BrushManager.minSizeUpdateFunc=brushMenu.addInstantNumberItem( // here, the minSize is in px
		Lang("Min Size"),
		()=>Math.round(BrushManager.activeBrush.size*BrushManager.activeBrush.minSize),
		Lang("px"),
		newVal=>{ // set on input
			if(newVal){
				newVal=(newVal-0).clamp(BrushManager.limits.minSize,BrushManager.activeBrush.size);
				BrushManager.activeBrush.minSize=newVal/BrushManager.activeBrush.size;
			}
		},
		(dW,oldVal)=>{ // set on scroll
			let newVal=(BrushManager.activeBrush.minSize+dW/20).clamp(0,1);
			BrushManager.activeBrush.minSize=newVal;
		}, // set
		(dx,oldVal)=>{ // set on drag-x
			oldVal-=0;
			let newVal=(oldVal/BrushManager.activeBrush.size+dx/200).clamp(0,1);
			BrushManager.activeBrush.minSize=newVal;
		} // set
	);
	let minSizeHintUpdateFunc=brushMenu.addHint(Lang("brush-pressure-hint-1"));
	minSizeHintUpdateFunc(false); // @TODO: at start it will never show
}

BrushManager.initMenuOpacitySection=function(brushMenu){
	brushMenu.addSectionTitle(Lang("Opacity Control"));
	BrushManager.brushAlphaUpdateFunc=brushMenu.addInstantNumberItem(
		Lang("Opacity"),()=>Math.round(BrushManager.activeBrush.alpha*100),"%",
		newVal=>{ // set on input
			if(newVal){
				newVal=((newVal-0)*0.01).clamp(0,1);
				BrushManager.activeBrush.alpha=newVal;
				BrushManager.minAlphaUpdateFunc();
			}
		},
		(dW,oldVal)=>{ // set on scroll
			let newVal=(BrushManager.activeBrush.alpha+dW/20).clamp(0,1);
			BrushManager.activeBrush.alpha=newVal;
			BrushManager.minAlphaUpdateFunc();
		}, // set
		(dx,oldVal)=>{ // set on drag-x
			oldVal-=0;
			let newVal=(0.01*oldVal+dx/200).clamp(0,1);
			BrushManager.activeBrush.alpha=newVal;
			BrushManager.minAlphaUpdateFunc();
		} // set
	);
	// Moisture, Extension: for smudging / color sampling
	BrushManager.brushExtensionUpdateFunc=brushMenu.addInstantNumberItem(
		Lang("Extension"),()=>Math.round(BrushManager.activeBrush.extension*100),"%",
		newVal=>{ // set on input
			if(newVal){
				newVal=((newVal-0)*0.01).clamp(0,1);
				BrushManager.activeBrush.extension=newVal;
			}
		},
		(dW,oldVal)=>{ // set on scroll
			let newVal=(BrushManager.activeBrush.extension+dW/20).clamp(0,1);
			BrushManager.activeBrush.extension=newVal;
		}, // set
		(dx,oldVal)=>{ // set on drag-x
			oldVal-=0;
			let newVal=(0.01*oldVal+dx/200).clamp(0,1);
			BrushManager.activeBrush.extension=newVal;
		} // set
	);

	// ============================= Pressure ===================================

	brushMenu.addSwitch(Lang("Pressure Controlled Opacity"),[Lang("Disabled"),Lang("Enabled")],null,id=>{
		BrushManager.activeBrush.isAlphaPressure=id;
		minAlphaHintUpdateFunc(id==0?true:false);
	},()=>BrushManager.activeBrush.isAlphaPressure);
	BrushManager.minAlphaUpdateFunc=brushMenu.addInstantNumberItem(
		// here, minAlpha is shown in direct percentage, not alpha*minAlpha
		Lang("Min Opacity"),
		()=>Math.round(BrushManager.activeBrush.alpha*BrushManager.activeBrush.minAlpha*100),
		"%",
		newVal=>{ // set on input
			if(newVal){
				newVal-=0;
				newVal=(0.01*newVal/BrushManager.activeBrush.alpha).clamp(0,1);
				BrushManager.activeBrush.minAlpha=newVal;
			}
		},
		(dW,oldVal)=>{ // set on scroll
			let newVal=(BrushManager.activeBrush.minAlpha+dW/20).clamp(0,1);
			BrushManager.activeBrush.minAlpha=newVal;
		}, // set
		(dx,oldVal)=>{ // set on drag-x
			oldVal-=0;
			let newVal=(0.01*oldVal/BrushManager.activeBrush.alpha+dx/200).clamp(0,1);
			BrushManager.activeBrush.minAlpha=newVal;
		} // set
	);
	let minAlphaHintUpdateFunc=brushMenu.addHint(Lang("brush-pressure-hint-1"));
	minAlphaHintUpdateFunc(false);
	BrushManager.edgeHardnessUpdateFunc=brushMenu.addInstantNumberItem(
		"Hard Edge",()=>BrushManager.activeBrush.edgeHardness.toFixed(2),"",
		newVal=>{ // set on input
			if(newVal){
				newVal=(newVal-0).clamp(0,1);
				BrushManager.activeBrush.edgeHardness=newVal;
			}
		},
		(dW,oldVal)=>{ // set on scroll
			oldVal-=0;
			let newVal=(oldVal+dW/20).clamp(0,1);
			BrushManager.activeBrush.edgeHardness=newVal;
		}, // set
		(dx,oldVal)=>{ // set on drag-x
			oldVal-=0;
			let newVal=(oldVal+dx/100).clamp(0,1);
			BrushManager.activeBrush.edgeHardness=newVal;
		} // set
	);
}

BrushManager.initPenSetting=function(brushMenu){
	brushMenu.addSectionTitle("Stylus Control");
	BrushManager.sensitivityUpdateFunc=brushMenu.addInstantNumberItem(
		Lang("stylus-pressure-sensitivity"),()=>BrushManager.general.sensitivity.toFixed(1),"",
		newVal=>{ // set on input
			if(newVal){
				newVal=(newVal-0).clamp(0,2);
				BrushManager.general.sensitivity=newVal;
			}
		},
		(dW,oldVal)=>{ // set on scroll
			let newVal=(BrushManager.general.sensitivity+dW/10).clamp(0,2);
			BrushManager.general.sensitivity=newVal;
		}, // set
		(dx,oldVal)=>{ // set on drag-x
			oldVal-=0;
			let newVal=(oldVal+dx/100).clamp(0,2);
			BrushManager.general.sensitivity=newVal;
		} // set
	);
	BrushManager.sensitivityUpdateFunc=brushMenu.addInstantNumberItem(
		Lang("stroke-smoothness"),()=>CANVAS.settings.smoothness,"",
		newVal=>{ // set on input
			if(newVal){
				newVal=(newVal-0).clamp(-5,10);
				CANVAS.settings.smoothness=newVal;
				CANVAS.updateSpeed();
			}
		},
		(dW,oldVal)=>{ // set on scroll
			let newVal=(CANVAS.settings.smoothness+dW).clamp(-5,10);
			CANVAS.settings.smoothness=newVal;
			CANVAS.updateSpeed();
		}, // set
		(dx,oldVal)=>{ // set on drag-x
			oldVal-=0;
			let newVal=Math.round(oldVal+dx/30).clamp(-5,10);
			CANVAS.settings.smoothness=newVal;
			CANVAS.updateSpeed();
		} // set
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
	$("#brush-size").val(Math.round(BrushManager.activeBrush.size));
	if(BrushManager.brushMenu){ // if associated with menu
		BrushManager.brushMenu.update(); // menu items and values updated here
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
			let oldId=BrushManager._findBrushSizeId(BrushManager.activeBrush.size);
			let newId=Math.round(oldId+dW).clamp(0,BrushManager.sizeList.length-1);
			BrushManager.activeBrush.size=BrushManager.sizeList[newId];
			BrushManager.minSizeUpdateFunc();
			BrushManager.brushSizeUpdateFunc();
			BrushManager.brushButtonUpdateFunc();
		}, // set
		(dx,oldVal)=>{ // set on drag-x
			let originId=BrushManager._findBrushSizeId(oldVal-0);
			let newId=Math.round(originId+dx/5).clamp(0,BrushManager.sizeList.length-1);
			BrushManager.activeBrush.size=BrushManager.sizeList[newId];
			BrushManager.minSizeUpdateFunc();
			BrushManager.brushSizeUpdateFunc();
			BrushManager.brushButtonUpdateFunc();
		},
		BrushManager.brushButtonUpdateFunc
	);
	BrushManager.brushButtonUpdateFunc();
}

BrushManager.initBrushSelector=function(){
	let menu=$("#brush-selector-menu");
	for(let brush of BrushManager.brushes){
		let block=$("<div class='brush-selector-item'>").text(brush.name);
		EventDistributer.setClick(block,event=>{
			BrushManager.setActiveBrush(brush);
		});
		menu.append(block);
	}
}