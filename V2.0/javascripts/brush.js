/**
 * Manage brush params
 */
BrushManager={};
BrushManager.brushes=[
	{
		name:"Pencil",
		size:100, // diameter
		minSize:0, // the ratio from size in %
		isSizePressure:1, // 1: Enable, 0:Disable
		//density:1,
		//minDensity:0,
		//smoothness:2, // the smoothness of the trail: avoid trembling
		sharpness:1, // 0.0[0.2]: soft ~ 1.0: mid ~ +Inf[5]: sharp
		alpha:30 // in %
	},
	{
		name:"Brush",
		size:30,
		minSize:10,
		isSizePressure:1,
		//density:1,
		//minDensity:1,
		//smoothness:2,
		sharpness:1,
		//mixColor:0.3,
		alpha:40
	},
	{
		name:"Eraser",
		size:10,
		minSize:10,
		isSizePressure:0,
		//density:1,
		//minDensity:1,
		//smoothness:0,
		sharpness:1,
		alpha:100
	}
];



BrushManager.init=function(){
	BrushManager.setActiveBrush(0);
	let brushMenu=BrushManager.initBrushSettingMenu();
	BrushManager.initBrushButton(brushMenu);
}

BrushManager.limits={
	minSize: 1,
	maxSize: 300
};

BrushManager.initBrushSettingMenu=function(){
	let brushMenu=new SettingManager(
		$("#brush-menu-panel"),
		"Paint Brush" // title
	);
	brushMenu.addSectionTitle("Stroke Control");
	let brushSizeUpdateFunc=brushMenu.addInstantNumberItem("Brush Size",0,"px",
		newVal=>{ // set on input
			if(newVal){
				newVal=newVal.clamp(BrushManager.limits.minSize,BrushManager.limits.maxSize);
				BrushManager.activeBrush.minSize=
					BrushManager.activeBrush.minSize*newVal/BrushManager.activeBrush.size;
				BrushManager.activeBrush.size=newVal;
				minSizeUpdateFunc();
			}
		},
		(dW,oldVal)=>{ // set on scroll
			let newVal=(oldVal+dW).clamp(BrushManager.limits.minSize,BrushManager.limits.maxSize);
			BrushManager.activeBrush.minSize=
				BrushManager.activeBrush.minSize*newVal/BrushManager.activeBrush.size;
			BrushManager.activeBrush.size=newVal;
			minSizeUpdateFunc();
		}, // set
		(dx,oldVal)=>{ // set on drag-x
			let newVal=(oldVal+dx/4).clamp(BrushManager.limits.minSize,BrushManager.limits.maxSize);
			BrushManager.activeBrush.minSize=
				BrushManager.activeBrush.minSize*newVal/BrushManager.activeBrush.size;
			BrushManager.activeBrush.size=newVal;
			minSizeUpdateFunc();
		}, // set
		()=>Math.round(BrushManager.activeBrush.size)
	);
	/**
	 * @TODO: switch accepts initial value
	 */
	brushMenu.addSwitch("Pressure Controlled Size",["Disabled","Enabled"],null,id=>{
		BrushManager.activeBrush.isSizePressure=id;
		minSizeHintUpdateFunc(id==0?true:false);
	},1);
	let minSizeUpdateFunc=brushMenu.addInstantNumberItem("Min Size",0,"px",
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

	/*brushMenu.addInstantNumberItem("Megas",120,"MB",
		newVal=>newVal?Math.round(newVal.clamp(1,1000)):10, // set
		(dW,oldVal)=>Math.exp(Math.log(oldVal)+dW/10).clamp(1,1000).toFixed(1), // set
		(dx,oldVal)=>Math.exp(Math.log(oldVal)+dx/10).clamp(1,1000).toFixed(1) // set
	);
	brushMenu.addHint("* Change Me");
	brushMenu.addSwitch("Anti",["On","Off","Not Sure"],null,val=>{});
	brushMenu.addInfo("Mem","dB",()=>Math.round(Math.random()*100));
	brushMenu.addButton("Set",()=>console.log("Yes"));
	brushMenu.addButton("M agree <br>to the",()=>console.log("Yes"));
	brushMenu.addButton("M agree <br>to<br> the",()=>console.log("Yes"));*/
	brushMenu.update();
	return brushMenu;
}

BrushManager.setActiveBrush=function(v){
	BrushManager.activeBrushID=v;
	BrushManager.activeBrush=BrushManager.brushes[v];
}

BrushManager.initBrushButton=function(brushMenu){
	brushMenu.setOpenButton($("#brush-button"));
}