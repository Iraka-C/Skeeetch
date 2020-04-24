
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
		Lang("Hard Edge"),()=>BrushManager.activeBrush.edgeHardness.toFixed(2),"",
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

BrushManager.initStylusSetting=function(brushMenu){
	brushMenu.addSectionTitle(Lang("Stylus Control"));
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