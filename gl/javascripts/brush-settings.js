
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
		brushMenu.update();
	},()=>BrushManager.activeBrush.isSizePressure);
	BrushManager.minSizeUpdateFunc=brushMenu.addInstantNumberItem( // here, the minSize is in px
		Lang("Min Size"),
		()=>BrushManager.activeBrush.isSizePressure?Math.round(BrushManager.activeBrush.size*BrushManager.activeBrush.minSize):NaN,
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
}

BrushManager.initMenuOpacitySection=function(brushMenu){
	brushMenu.addSectionTitle(Lang("Opacity Control"));
	brushMenu.addInstantNumberItem(
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
	brushMenu.addInstantNumberItem(
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
		brushMenu.update();
	},()=>BrushManager.activeBrush.isAlphaPressure);
	BrushManager.minAlphaUpdateFunc=brushMenu.addInstantNumberItem(
		// here, minAlpha is shown in direct percentage, not alpha*minAlpha
		Lang("Min Opacity"),
		()=>BrushManager.activeBrush.isAlphaPressure?Math.round(BrushManager.activeBrush.alpha*BrushManager.activeBrush.minAlpha*100):NaN,
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

	brushMenu.addInstantNumberItem(
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
	brushMenu.addSwitch(Lang("Pressure Controlled Eroding"),[Lang("Disabled"),Lang("Enabled")],null,id=>{
		BrushManager.activeBrush.isEroding=id;
	},()=>BrushManager.activeBrush.brushtip?BrushManager.activeBrush.isEroding:NaN);
}

BrushManager.initScatterSetting=function(brushMenu){
	brushMenu.addSectionTitle(Lang("Pattern Control"));
	brushMenu.addInstantNumberItem(
		Lang("Brushtip Rotation"),
		()=>BrushManager.activeBrush.brushtip?
			Math.round(BrushManager.activeBrush.brushtipRot):
			NaN,
		"&deg;",
		newVal=>{ // set on input
			if(newVal){
				newVal=(newVal-0)%360;
				if(newVal<0) newVal+=360; // 0 to 360
				if(newVal>180) newVal-=360; // -180 to 180
				BrushManager.activeBrush.brushtipRot=newVal;
			}
		},
		(dW,oldVal)=>{ // set on scroll
			oldVal-=0;
			let newVal=(oldVal+dW)%360;
			if(newVal<0) newVal+=360; // 0 to 360
			if(newVal>180) newVal-=360; // -180 to 180
			BrushManager.activeBrush.brushtipRot=newVal;
		},
		(dx,oldVal)=>{ // set on drag-x
			oldVal-=0;
			let newVal=(oldVal+dx)%360;
			if(newVal<0) newVal+=360; // 0 to 360
			if(newVal>180) newVal-=360; // -180 to 180
			BrushManager.activeBrush.brushtipRot=newVal;
		}
	);
	brushMenu.addSwitch(Lang("Rotate With Stroke"),[Lang("Disabled"),Lang("Enabled")],null,id=>{
		BrushManager.activeBrush.isRotWithStroke=id;
	},()=>BrushManager.activeBrush.brushtip?BrushManager.activeBrush.isRotWithStroke:NaN);
	// ================= Scattering control =================
	brushMenu.addSwitch(Lang("Scattering"),[Lang("Disabled"),Lang("Enabled")],null,id=>{
		BrushManager.activeBrush.isScatter=id;
		// update many values here
		brushMenu.update();
	},()=>{
		if(BrushManager.activeBrush.isScatter==-1){ // scattering not allowed
			return NaN; // disable selection
		}
		return BrushManager.activeBrush.isScatter;
	});
	// should belong to scatter, but still available when customizing brush: opacity control
	brushMenu.addInstantNumberItem(
		Lang("Brushtip Density"),
		()=>BrushManager.activeBrush.brushtip||BrushManager.activeBrush.isScatter>0? // allow customized interval
			Math.round(BrushManager.activeBrush.density):NaN,
		"%",
		newVal=>{ // set on input
			if(newVal){
				newVal=(newVal-0).clamp(1,100);
				BrushManager.activeBrush.density=newVal;
			}
		},
		(dW,oldVal)=>{ // set on scroll
			let newVal=(BrushManager.activeBrush.density+dW).clamp(1,100);
			BrushManager.activeBrush.density=newVal;
		},
		(dx,oldVal)=>{ // set on drag-x
			let newVal=((oldVal-0)+dx/2).clamp(1,100);
			BrushManager.activeBrush.interval=newVal;
		}
	);
	brushMenu.addInstantNumberItem(
		Lang("Scattering Radius"),
		()=>BrushManager.activeBrush.isScatter>0?
			isNaN(BrushManager.activeBrush.scatRad)?NaN:
			BrushManager.activeBrush.scatRad.toFixed(2):
			NaN,
		"x",
		newVal=>{ // set on input
			if(newVal){
				newVal=(newVal-0).clamp(0,1);
				BrushManager.activeBrush.scatRad=newVal;
			}
		},
		(dW,oldVal)=>{ // set on scroll
			oldVal-=0;
			let newVal=(oldVal+dW/20).clamp(0,1);
			BrushManager.activeBrush.scatRad=newVal;
		},
		(dx,oldVal)=>{ // set on drag-x
			oldVal-=0;
			let newVal=(oldVal+dx/100).clamp(0,1);
			BrushManager.activeBrush.scatRad=newVal;
		}
	);
	brushMenu.addInstantNumberItem(
		Lang("Random Size"),
		()=>BrushManager.activeBrush.isScatter>0?
			isNaN(BrushManager.activeBrush.randScale)?NaN:
			BrushManager.activeBrush.randScale.toFixed(2):
			NaN,
		"x",
		newVal=>{ // set on input
			if(newVal){
				newVal=(newVal-0).clamp(0,1);
				BrushManager.activeBrush.randScale=newVal;
			}
		},
		(dW,oldVal)=>{ // set on scroll
			oldVal-=0;
			let newVal=(oldVal+dW/20).clamp(0,1);
			BrushManager.activeBrush.randScale=newVal;
		},
		(dx,oldVal)=>{ // set on drag-x
			oldVal-=0;
			let newVal=(oldVal+dx/100).clamp(0,1);
			BrushManager.activeBrush.randScale=newVal;
		}
	);
	brushMenu.addInstantNumberItem(
		Lang("Random Rotation"),
		()=>BrushManager.activeBrush.isScatter>0? // scatter is enabled
			isNaN(BrushManager.activeBrush.randRot)?NaN: // brush allows random rotation
			BrushManager.activeBrush.brushtip? // customized brushtip
			BrushManager.activeBrush.randRot.toFixed(2):NaN:
			NaN,
		Lang("circ"),
		newVal=>{ // set on input
			if(newVal){
				newVal=(newVal-0).clamp(0,1);
				BrushManager.activeBrush.randRot=newVal;
			}
		},
		(dW,oldVal)=>{ // set on scroll
			oldVal-=0;
			let newVal=(oldVal+dW/20).clamp(0,1);
			BrushManager.activeBrush.randRot=newVal;
		},
		(dx,oldVal)=>{ // set on drag-x
			oldVal-=0;
			let newVal=(oldVal+dx/100).clamp(0,1);
			BrushManager.activeBrush.randRot=newVal;
		}
	);
	brushMenu.addInstantNumberItem(
		Lang("Random Opacity"),
		()=>BrushManager.activeBrush.isScatter>0?
			isNaN(BrushManager.activeBrush.randOpa)?NaN:
			Math.round(BrushManager.activeBrush.randOpa*100):
			NaN,
		"%",
		newVal=>{ // set on input
			if(newVal){
				newVal=(newVal/100).clamp(0,1);
				BrushManager.activeBrush.randOpa=newVal;
			}
		},
		(dW,oldVal)=>{ // set on scroll
			oldVal-=0;
			let newVal=(BrushManager.activeBrush.randOpa+dW/100).clamp(0,1);
			BrushManager.activeBrush.randOpa=newVal;
		},
		(dx,oldVal)=>{ // set on drag-x
			oldVal=isNaN(oldVal)?0:oldVal-0; // numbered string also applies to isNaN
			let newVal=(oldVal/100+dx/200).clamp(0,1);
			BrushManager.activeBrush.randOpa=newVal;
		}
	);
}

BrushManager.initStylusSetting=function(brushMenu){
	brushMenu.addSectionTitle(Lang("Stylus Control"));
	brushMenu.addInstantNumberItem(
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
	brushMenu.addInstantNumberItem(
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