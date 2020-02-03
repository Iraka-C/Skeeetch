/**
 * Manage brush params
 */
BrushManager={};
BrushManager.brushes=[
	{
		name:Lang("pencil"),
		size:20, // diameter
		minSize:0.0, // 0~1 (0~100%) of size
		isSizePressure:1, // 1: Enable, 0:Disable

		//smoothness:2, // the smoothness of the trail: avoid trembling
		alpha:1.0, // opacity 0~1 (0~100%)
		minAlpha:1.0, // 0~1 (0~100%) of alpha
		isAlphaPressure:0,
		edgeHardness:1.0, // for how much part of the radius near edge is smoothed (0:gauss~1:binary)
		blendMode:0 // 0: normal, -1: eraser, see RENDER/RENDER16
	},
	{
		name:Lang("brush"),
		size:80,
		minSize:0.5,
		isSizePressure:1,
		//smoothness:2,
		//mixColor:0.3,
		alpha:0.85,
		minAlpha:0,
		isAlphaPressure:1,
		edgeHardness:0.3,
		blendMode:0
	},
	{
		name:Lang("eraser"),
		size:50,
		minSize:1.0,
		isSizePressure:0,
		//smoothness:0,
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
	maxSize: 300 // in px
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
		Lang("Brush Size"),()=>Math.round(BrushManager.activeBrush.size),Lang("px"),
		newVal=>{ // set on input
			if(newVal){
				newVal=newVal.clamp(BrushManager.limits.minSize,BrushManager.limits.maxSize);
				BrushManager.activeBrush.size=newVal;
				BrushManager.minSizeUpdateFunc();
				BrushManager.brushButtonUpdateFunc();
			}
		},
		(dW,oldVal)=>{ // set on scroll
			let newVal=(BrushManager.activeBrush.size+dW).clamp(BrushManager.limits.minSize,BrushManager.limits.maxSize);
			BrushManager.activeBrush.size=newVal;
			BrushManager.minSizeUpdateFunc();
			BrushManager.brushButtonUpdateFunc();
		}, // set
		(dx,oldVal)=>{ // set on drag-x
			let newVal=(oldVal+dx/2).clamp(BrushManager.limits.minSize,BrushManager.limits.maxSize);
			BrushManager.activeBrush.size=newVal;
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
				newVal=newVal.clamp(BrushManager.limits.minSize,BrushManager.activeBrush.size);
				BrushManager.activeBrush.minSize=newVal/BrushManager.activeBrush.size;
			}
		},
		(dW,oldVal)=>{ // set on scroll
			let newVal=(BrushManager.activeBrush.minSize+dW/20).clamp(0,1);
			BrushManager.activeBrush.minSize=newVal;
		}, // set
		(dx,oldVal)=>{ // set on drag-x
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
				newVal=newVal.clamp(0,1);
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
			let newVal=(0.01*oldVal+dx/200).clamp(0,1);
			BrushManager.activeBrush.alpha=newVal;
			BrushManager.minAlphaUpdateFunc();
		} // set
	);
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
				newVal=(0.01*newVal/BrushManager.activeBrush.alpha).clamp(0,1);
				BrushManager.activeBrush.minAlpha=newVal;
			}
		},
		(dW,oldVal)=>{ // set on scroll
			let newVal=(BrushManager.activeBrush.minAlpha+dW/20).clamp(0,1);
			BrushManager.activeBrush.minAlpha=newVal;
		}, // set
		(dx,oldVal)=>{ // set on drag-x
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
		} // set
	);
}

BrushManager.initPenSetting=function(brushMenu){
	brushMenu.addSectionTitle("Stylus");
	BrushManager.sensitivityUpdateFunc=brushMenu.addInstantNumberItem(
		Lang("stylus-pressure-sensitivity"),()=>BrushManager.general.sensitivity.toFixed(1),"",
		newVal=>{ // set on input
			if(newVal){
				newVal=newVal.clamp(0,2);
				BrushManager.general.sensitivity=newVal;
			}
		},
		(dW,oldVal)=>{ // set on scroll
			let newVal=(BrushManager.general.sensitivity+dW/10).clamp(0,2);
			BrushManager.general.sensitivity=newVal;
		}, // set
		(dx,oldVal)=>{ // set on drag-x
			let newVal=(oldVal+dx/100).clamp(0,2);
			BrushManager.general.sensitivity=newVal;
		} // set
	);
	BrushManager.sensitivityUpdateFunc=brushMenu.addInstantNumberItem(
		Lang("stroke-smoothness"),()=>CANVAS.settings.smoothness,"",
		newVal=>{ // set on input
			if(newVal){
				newVal=newVal.clamp(-5,10);
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
			let newVal=Math.round(oldVal+dx/30).clamp(-5,10);
			CANVAS.settings.smoothness=newVal;
			CANVAS.updateSpeed();
		} // set
	);
	brushMenu.addSwitch(Lang("Stroke-Down Rectification"),[Lang("Disabled"),Lang("Enabled")],null,id=>{
		CANVAS.settings.strokeRectification=id?true:false;
	},()=>CANVAS.settings.strokeRectification+0);
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
			let newVal=(BrushManager.activeBrush.size+dW).clamp(BrushManager.limits.minSize,BrushManager.limits.maxSize);
			BrushManager.activeBrush.size=newVal;
			BrushManager.brushSizeUpdateFunc();
			BrushManager.minSizeUpdateFunc();
		},
		(dx,oldVal)=>{ // set on drag-x
			let newVal=(oldVal+dx/2).clamp(BrushManager.limits.minSize,BrushManager.limits.maxSize);
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
		EventDistributer.setClick(block,event=>{
			BrushManager.setActiveBrush(brush);
		});
		menu.append(block);
	}
}