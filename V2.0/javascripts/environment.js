/*
	Written By Iraka
	Environment handlers for Sketch platform
*/

ENV={}; // Environment

//===================== Settings =====================

ENV.paperSize={width:0,height:0,diag:0}; // diag == sqrt(x^2+y^2)
ENV.window={
	SIZE:{width:0,height:0}, // window size, unit: window pixel *** NOW READ ONLY! ***
	trans:{x:0,y:0}, // translate from the window center. unit: window pixel (y)v >(x)cooedinate
	rot:0.0, // 0 degree CW
	flip:false, // not flipped
	scale:1.0, // not zoomed
	_transAnimation:{ // translation control animation
		time:1, // total time in s
		target:[0,0,0,1], // end point
		start:[0,0,0,1], // start point
		now:[0,0,0,1], // present status
		process:1, // the processed animation part, 0~1
		isAnimationFired:false, // is animation running
		lastTime:0 // last animation time, for stats
	}
};

ENV.displaySettings={
	antiAlias:true,
	enableTransformAnimation:true
};


// ========================= Functions ============================
ENV.init=function(){ // When the page is loaded
	ENV.window.SIZE.width=$("#canvas-window").width();
	ENV.window.SIZE.height=$("#canvas-window").height();
	ENV.setPaperSize(window.screen.width,window.screen.height); // no layer yet

	LANG.init(); // set all doms after load?
	EVENTS.init();
	EventDistributer.init();
	PALETTE.init();
	LAYERS.init();
	SettingHandler.init();
	BrushManager.init();
	CURSOR.init();
	HISTORY.init();
	FILES.init();
	PERFORMANCE.init();

	EVENTS.disableInputSelection($("#filename-input"));

	/**
	 * Debug part
	 */
	//testPsd_DEBUG();
	//initSettingSample_DEBUG();

	// ENV.shiftAntiAlias();
	// $("#canvas_container").css("display","block");
};

// ====================== Settings ========================
/**
 * upload css transform from ENV.window settings
 */
ENV.refreshTransform=function(){
	ENV.fireTransformAnimation([
		ENV.window.trans.x,
		ENV.window.trans.y,
		ENV.window.rot,
		ENV.window.scale
	]);
	CURSOR.updateXYR();
};

/**
 * Set the scale to ratio (default 1.0)
 */
ENV.scaleTo=function(ratio){
	let s=ENV.window.scale;
	ENV.window.scale=ratio;
	let tr=ratio/s;
	ENV.window.trans.x*=tr;
	ENV.window.trans.y*=tr;
	ENV.refreshTransform();
};

/**
 * Set the rotation to angle (degree CW)
 */
ENV.rotateTo=function(angle){ // degree
	let r=ENV.window.rot;
	ENV.window.rot=angle;
	let tx=ENV.window.trans.x;
	let ty=ENV.window.trans.y;

	let dr=(angle-r)/180*Math.PI;
	let Cr=Math.cos(dr);
	let Sr=Math.sin(dr);
	ENV.window.trans.x=Cr*tx-Sr*ty;
	ENV.window.trans.y=Sr*tx+Cr*ty;
	ENV.refreshTransform();
};

/**
 * set the translation from the screen center to (x,y) pixels
 */
ENV.translateTo=function(x,y){ // pixelated
	let borderSize=ENV.paperSize.diag*ENV.window.scale;
	if(Math.abs(x)>borderSize||Math.abs(y)>borderSize){
		/**
		 * @TODO: better clamp for paper inside window
		 */
		x=x.clamp(-borderSize,borderSize);
		y=y.clamp(-borderSize,borderSize);
	}
	ENV.window.trans.x=x;
	ENV.window.trans.y=y;
	ENV.refreshTransform();
}

/**
 * Set (x,y) translation, a rotation, r scaling in one function
 */
ENV.transformTo=function(x,y,r,s){ // four values, with hint
	//console.log("x = "+x+" y = "+y+" a = "+a);
	s=s.clamp(0.1,8.0);
	ENV.window.rot=r;
	ENV.window.scale=s;
	x*=s;
	y*=s;

	let borderSize=ENV.paperSize.diag*s;
	if(Math.abs(x)>borderSize||Math.abs(y)>borderSize){
		//console.log("Reach Border");
		x.clamp(-borderSize,borderSize);
		y.clamp(-borderSize,borderSize);
	}
	ENV.window.trans.x=x;
	ENV.window.trans.y=y;

	ENV.refreshTransform();

	$("#scale_info").html(Math.round(s*100)+"%");
	$("#rotate_info").html(Math.round(r)+"&deg;");
}

/**
 * set the current canvas sizes to w*h pixels
 * Will remove all histories!
 * @TODO: limit size into 4096^2
 */
ENV.setPaperSize=function(w,h){
	let isAnim=ENV.displaySettings.enableTransformAnimation;
	ENV.displaySettings.enableTransformAnimation=false; // disable animation when changing size
	if(!(w&&h)){ 
		// w or h invalid or =0
		return;
	}
	HISTORY.clearAllHistory(); // remove histories
	ENV.paperSize={width:w,height:h,diag:Math.sqrt(w*w+h*h)};
	$("#canvas-container").css({
		"width":w+"px",
		"height":h+"px"
	});

	// Resize all layers and containers recursively
	for(let id in LAYERS.layerHash){ // for all canvases
		const item=LAYERS.layerHash[id];
		if(item.type!="canvas"){ // not a canvas
			continue;
		}
		let cv=item.$div[0];
		let tmpRenderer=CANVAS.getNewRenderer(cv,{disableBuffer:true});
		let layerData=tmpRenderer.getImageData(); // image data
		// do some zooming/interpolation work here...
		// Notice: gl
		cv.width=ENV.paperSize.width;
		cv.height=ENV.paperSize.height;
		tmpRenderer.putImageData(layerData);
		item.updateThumb(); // update thumb image in layer panel
	}

	let k1=ENV.window.SIZE.width/w;
	let k2=ENV.window.SIZE.height/h;
	let k=(Math.min(k1,k2)*0.8).clamp(0.1,8.0);
	ENV.transformTo(0,0,0,k);
	$("#scale-info-input").val(Math.round(k*100));
	ENV.displaySettings.enableTransformAnimation=isAnim; // recover animation setting
	if(LAYERS.active&&LAYERS.active.type=="canvas"){ // if there is an active CV, refresh it
		CANVAS.setTargetLayer(LAYERS.active);
	}
};
// ====================== Tools functions ==========================
/**
 * (x,y) is the coordinate under canvas window
 * transform it to the coordinate of paper
 * return [x,y] in paper
 */

ENV.toPaperXY=function(x,y){
	var xp=x-ENV.window.SIZE.width/2-ENV.window.trans.x;
	var yp=y-ENV.window.SIZE.height/2-ENV.window.trans.y;

	var rot=ENV.window.rot/180*Math.PI;
	var rotS=Math.sin(rot);
	var rotC=Math.cos(rot);
	var xr=rotC*xp+rotS*yp;
	var yr=rotC*yp-rotS*xp;

	var scale=ENV.window.scale;
	var flip=ENV.window.flip?-1:1;
	var xc=xr*flip/scale+ENV.paperSize.width/2;
	var yc=yr/scale+ENV.paperSize.height/2;

	return [xc,yc];
};

/**
 * get transform matrix [a,b,c,d,e,f] from pArr = [x,y,r,s]
 * translate (x,y) rotate r scale s
 */
ENV.getTransformMatrix=function(pArr){
	let cpw=ENV.window.SIZE.width;
	let cph=ENV.window.SIZE.height;

	let transCX=-ENV.paperSize.width/2;
	let transCY=-ENV.paperSize.height/2;

	let rot=pArr[2]/180*Math.PI;
	let rotS=Math.sin(rot);
	let rotC=Math.cos(rot);
	let scale=pArr[3];
	let flip=ENV.window.flip?-1:1;

	let transWX=cpw/2+pArr[0];
	let transWY=cph/2+pArr[1];

	let c=-scale*rotS;
	let d=scale*rotC;
	let a=d*flip;
	let b=-c*flip;

	let e=transCX+transWX;
	let f=transCY+transWY;
	return [a,b,c,d,e,f];
}

/**
 * Update transform animation control
 */
ENV.fireTransformAnimation=function(pArr){
	let anim=ENV.window._transAnimation;

	if(!ENV.displaySettings.enableTransformAnimation){ // no animation
		let mat=ENV.getTransformMatrix(pArr)
		let matrixStr="matrix("+mat[0]+","+mat[1]+","+mat[2]+","+mat[3]+","+mat[4]+","+mat[5]+")";
		anim.target=pArr;
		anim.start=pArr;
		anim.now=pArr;
		anim.process=1;
		$("#canvas-container").css({ // set style
			"transform":matrixStr, // transform
			"box-shadow":"0px 0px "+(4/anim.now[3])+"em #808080" // shadow size
		});
		return;
	}
	anim.target=pArr;
	/*if(EVENTS.key.shift){ // is dragging, direct move
		anim.now[0]=pArr[0];
		anim.now[1]=pArr[1];
	}*/
	anim.start=anim.now;
	anim.process=0;
	if(!anim.isAnimationFired){ // no animation at present
		anim.isAnimationFired=true;
		requestAnimationFrame(ENV._transformAnimation);
	}
}
ENV._transformAnimation=function(){
	let anim=ENV.window._transAnimation;
	let p=anim.process; // deal with animation effect
	if(p<1-1E-6){ // continue animation, double check for unintentional fire
		let nowTime=Date.now();
		if(anim.lastTime>0){ // there's last animation
			PERFORMANCE.submitFpsStat(nowTime-anim.lastTime);
		}
		anim.lastTime=nowTime;

		let tP=anim.target;
		let sP=anim.start; 
		// if shift pressed, run animation 10x faster to reduce latency on dragging
		let nextFps=PERFORMANCE.fpsCounter.fps/(EVENTS.key.shift?10:1);
		let step=1/(anim.time*nextFps);
		p+=step;
		if(p>1)p=1; // end
		anim.process=p;
		// interpolate by p
		let q=1-p;
		q*=q; // (1-p)^2
		q=1-q*q; // 4th order 1-(1-p)^4

		let newP=pArrInterpolate(sP,tP,q);
		anim.now=newP;
		let newM=ENV.getTransformMatrix(newP);
		let matrixStr="matrix("+newM[0]+","+newM[1]+","+newM[2]+","+newM[3]+","+newM[4]+","+newM[5]+")";
		$("#canvas-container").css({
			"transform":matrixStr, // transform
			"box-shadow":"0px 0px "+(4/anim.now[3])+"em #808080" // shadow size
		});

		//console.log(matrixStr);
		
		if(p<1-1E-6){ // request new frame
			requestAnimationFrame(ENV._transformAnimation);
		}
		else{
			anim.lastTime=0; // cancel timer
			anim.isAnimationFired=false; // cancel animation
		}
	}
}

// linear interpolation by k: (1-k)p1+kp2, special notice on angle and scale
function pArrInterpolate(p1,p2,k){
	let x=(p2[0]-p1[0])*k+p1[0];
	let y=(p2[1]-p1[1])*k+p1[1];

	// angle interpolation around a circle
	let d1=p1[2],d2=p2[2];
	let dD=(d2-d1)%360;
	if(dD<0)dD+=360;
	if(dD>180){ // CCW
		dD-=360; // -180<dD<0
	}
	let r=d1+dD*k;

	// scale interpolation using log scale
	let sL1=Math.log(p1[3]);
	let sL2=Math.log(p2[3]);
	let s=Math.exp((sL2-sL1)*k+sL1);

	return [x,y,r,s];
}

// ===================== Other setting functions ==========================
ENV.setAntiAliasing=function(isAntiAlias){
	ENV.displaySettings.antiAlias=isAntiAlias;
	// change the setting of each layer
	if(isAntiAlias){
		$("#canvas-container").find("canvas").removeClass("pixelated");
	}
	else{
		$("#canvas-container").find("canvas").addClass("pixelated");
	}
}

/**
 * change the animation when transforming the canvas
 */
ENV.setTransformAnimation=function(isAnimate){
	ENV.displaySettings.enableTransformAnimation=isAnimate;
}
// ====================== For Debugging ==========================
/**
 * These functions are intended for debuggggggging purposes.
 * Do not use them in working context
 */
function initSettingSample_DEBUG(){
	/**
	 * Setting Manager sample
	 * */
	let brush=new SettingManager($("#brush-menu-panel"),"Paint Brush");
	brush.addSectionTitle("Thickness");
	brush.addInstantNumberItem("size",10,"px",
		newVal=>newVal?Math.round(newVal.clamp(1,100)):10, // set
		(dW,oldVal)=>Math.round(new Number(oldVal+dW).clamp(1,100)), // set
		(dx,oldVal)=>Math.round(new Number(oldVal+dx/10).clamp(1,100)) // set
	);
	brush.addInstantNumberItem("Megas",120,"MB",
		newVal=>newVal?Math.round(newVal.clamp(1,1000)):10, // set
		(dW,oldVal)=>Math.exp(Math.log(oldVal)+dW/10).clamp(1,1000).toFixed(1), // set
		(dx,oldVal)=>Math.exp(Math.log(oldVal)+dx/10).clamp(1,1000).toFixed(1) // set
	);
	brush.addHint("* Change Me");
	brush.addSwitch("Anti",["On","Off","Not Sure"],null,val=>{});
	brush.addInfo("Mem","dB",()=>Math.round(Math.random()*100));
	brush.addButton("Set",()=>console.log("Yes"));
	brush.addButton("M agree <br>to the",()=>console.log("Yes"));
	brush.addButton("M agree <br>to<br> the",()=>console.log("Yes"));
	brush.update();
}

// ============ load text test ===============
/**
 * load a text file
 * only works on web server
 */
function loadTextFile(url,callback){
	var request=new XMLHttpRequest();
	request.open("GET",url,true);
	request.addEventListener("load",function(){
		callback(request.responseText);
	});
	request.send();
}