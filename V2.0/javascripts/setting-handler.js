/**
 * Handle the actions when settings changes
 */

SettingHandler={};

SettingHandler.init=function(){
	SettingHandler.initTransformHandler();
	SettingHandler.initSystemSetting();
}


/**
 * @TODO: fix this function
 */
// init the transform handlers on the right-bottom
SettingHandler.initTransformHandler=function(){
	// rotate input
	SettingManager.setInputInstantNumberInteraction(
		$("#rotate-info-input"),$("#rotate-info"),
		newVal=>{ // input update
			if(isNaN(newVal)){ // not a number, return initial rotation
				return;
			}
			let newA=newVal%360;
			if(newA<0)newA+=360; // 0 to 360
			if(newA>180)newA-=360; // -180 to 180
			ENV.rotateTo(newA);
		},
		(dw,oldVal)=>{ // scroll update
			let newA=ENV.window.rot+dw;
			// mod to -180~180
			if(newA>180)newA-=360;
			if(newA<=-180)newA+=360;
			newA=Math.round(newA); // only int
			ENV.rotateTo(newA);
		},
		(dx,oldVal)=>{ // drag update
			let newA=oldVal+dx;
			// mod to -180~180
			if(newA>180)newA-=360;
			if(newA<=-180)newA+=360;
			newA=Math.round(newA); // only int
			ENV.rotateTo(newA);
		},
		()=>$("#rotate-info-input").val(Math.round(ENV.window.rot))
	);

	// scaling input
	// The ENV accept 0.1~8 while functions return 10%~800%
	// Scale factor: 10% to 800%
	// Scale modify factor in changeScaleOnScroll()
	SettingManager.setInputInstantNumberInteraction(
		$("#scale-info-input"),$("#scale-info"),
		newVal=>{ // input update
			if(isNaN(newVal)){ // not a number, return initial rotation
				return;
			}
			let newS=newVal.clamp(10,800);
			ENV.scaleTo(newS/100);
		},
		(dw,oldVal)=>{ // scroll update
			let newS=SettingHandler.updateScale(dw,ENV.window.scale);
			ENV.scaleTo(newS);
		},
		(dx,oldVal)=>{ // drag update
			let newS=SettingHandler.updateScale(dx/2,oldVal/100);
			ENV.scaleTo(newS);
		},
		()=>$("#scale-info-input").val(Math.round(ENV.window.scale*100))
	);
	
	// Reset all transform
	$("#reset-info").click(event=>{
		let k1=ENV.window.SIZE.width/ENV.paperSize.width;
		let k2=ENV.window.SIZE.height/ENV.paperSize.height;
		let k=Math.min(k1,k2).clamp(0.2,4.0)*0.8;
		ENV.transformTo(0,0,0,k);
		$("#scale-info-input").val(Math.round(k*100));
		$("#rotate-info-input").val("0");
	});

	// Scroll on canvas
	EventDistributer.wheel.addListener($("#canvas-layers-panel"),dw=>{ // Scroll
		let newS=SettingHandler.updateScale(dw,ENV.window.scale);
		ENV.scaleTo(newS);
		$("#scale-info-input").val(Math.round(newS*100));
	});
}

// Decide the new scaling factor when adding one step
SettingHandler.updateScale=function(dS,oldVal){
	const scaleFactor=0.05;
	let newS=Math.exp(Math.log(oldVal)+scaleFactor*dS);
	return newS.clamp(0.1,8.0); // mod to 0.1~8.0
}

// ====================== Layer settings =========================
// Show a hint from infoFunc() when mouse over $el
SettingHandler.addHint=function($el,infoFunc){
	$el.on("pointerover",event=>{
		$("#front-info-box").html(infoFunc());
		$("#front-info-panel").css("opacity","1");
	});
	$el.on("pointerout",event=>{
		$("#front-info-panel").css("opacity","0");
	});
}

// ====================== system settings =========================
SettingHandler.initSystemSetting=function(){
	let sys=new SettingManager($("#settings-menu-panel"),"System");
	sys.addSectionTitle("Render");
	sys.addSwitch("Renderer Bit Depth",["16","8"],"bit",val=>{
		switch(val){
		case 1: CANVAS.setRender16(false);break;
		default: CANVAS.setRender16(true);break;
		}
	});

	sys.addSectionTitle("Display");
	sys.addHint("These settings does not affect drawing result.");
	sys.addSwitch("Anti-Aliasing",["On","Off"],null,val=>{
		switch(val){
		case 1: ENV.setAntiAliasing(false);break;
		default: ENV.setAntiAliasing(true);break;
		}
	});
	sys.addSwitch("Transform Animation",["On","Off"],null,val=>{
		switch(val){
		case 1: ENV.setTransformAnimation(false);break;
		default: ENV.setTransformAnimation(true);break;
		}
	});
	sys.setOpenButton($("#system-button"));
}