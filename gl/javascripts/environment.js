/*
	Written By Iraka
	Environment handlers for Sketch platform
*/

ENV={}; // Environment
ENV.version="20200501";

//===================== Settings =====================

ENV.paperSize={width: 0,height: 0,diag: 0}; // diag == sqrt(x^2+y^2)
ENV.window={
	SIZE: {width: 0,height: 0}, // window size, unit: window pixel *** NOW READ ONLY! ***
	/**
	 * Transform of the paper canvas related to the canvas window
	 * all in window pixels
	 * order: trans -> rot CW(paper center) -> scale(paper center)
	 */
	trans: {x: 0,y: 0}, // paper center translate from the window center. unit: window pixel (y)v >(x)coordinate
	rot: 0.0, // 0 degree CW
	flip: false, // not flipped
	scale: 1.0, // not zoomed
	_transAnimation: { // translation control animation
		time: 1, // total time in s
		target: [0,0,0,1], // end point
		start: [0,0,0,1], // start point
		now: [0,0,0,1], // present status
		process: 1, // the processed animation part, 0~1
		isAnimationFired: false, // is animation running
		lastTime: 0 // last animation time, for stats
	}
};

ENV.displaySettings={
	antiAlias: true,
	enableTransformAnimation: true,
	maxPaperSize: 6400
};


// ========================= Functions ============================
ENV.init=function() { // When the page is loaded
	STORAGE.init(sysSettingParams => { // after loading all settings
		LANG.init(sysSettingParams); // set all doms after load?
		SettingHandler.init(sysSettingParams); // load all setting handlers for the following initializations

		Object.assign(ENV.displaySettings,sysSettingParams.preference.displaySettings); // init display settings
		ENV.setAntiAliasing(ENV.displaySettings.antiAlias); // set canvas css param

		const lastLayerTreeJSON=STORAGE.FILES.getLayerTree();
		ENV.window.SIZE.width=$("#canvas-window").width();
		ENV.window.SIZE.height=$("#canvas-window").height();
		if(lastLayerTreeJSON){
			console.log("Reading File...",lastLayerTreeJSON);
			ENV.setPaperSize(...lastLayerTreeJSON.paperSize);
			ENV.setFileTitle(lastLayerTreeJSON.title);
		}
		else{ // no layer yet, init CANVAS
			ENV.setPaperSize(window.screen.width,window.screen.height);
		}

		EVENTS.init();
		EventDistributer.init();
		PALETTE.init(sysSettingParams);

		CURSOR.init();
		PERFORMANCE.init();
		LAYERS.init(lastLayerTreeJSON);

		BrushManager.init();
		HISTORY.init();
		FILES.init();

		// prevent pen-dragging in Firefox causing window freezing
		EVENTS.disableInputSelection($("#filename-input"));
	});
};

// ====================== Settings ========================
/**
 * upload css transform from ENV.window settings
 */
ENV.refreshTransform=function() {
	ENV.fireTransformAnimation([
		ENV.window.trans.x,
		ENV.window.trans.y,
		ENV.window.rot,
		ENV.window.scale
	]);
	CURSOR.updateXYR();
};

/**
 * Set is the paper flipped
 */
ENV.setFlip=function(isFlip) {
	ENV.window.flip=isFlip;
	ENV.refreshTransform();
}

/**
 * Set the scale to ratio (default 1.0)
 * center at the window center
 */
ENV.scaleTo=function(ratio) {
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
ENV.rotateTo=function(angle) { // degree
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
ENV.translateTo=function(x,y) { // pixelated
	let borderSize=ENV.paperSize.diag*ENV.window.scale;
	if(Math.abs(x)>borderSize||Math.abs(y)>borderSize) {
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
ENV.transformTo=function(x,y,r,s) { // four values, with hint
	//console.log("x = "+x+" y = "+y+" a = "+a);
	s=s.clamp(0.1,8.0);
	ENV.window.rot=r;
	ENV.window.scale=s;

	let borderSize=ENV.paperSize.diag*s;
	if(Math.abs(x)>borderSize||Math.abs(y)>borderSize) {
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
 * @TODO: There's GPU memory leak!
 * @TODO: Doesn't seem like memory leak, more like a memory allocation policy
 */
ENV.setPaperSize=function(w,h,isPreservingContents) {
	isPreservingContents=isPreservingContents||false; // do not reserve by default
	if(!(w&&h)) { // w or h invalid or is 0
		return;
	}
	let isAnim=ENV.displaySettings.enableTransformAnimation; // store animation
	ENV.displaySettings.enableTransformAnimation=false; // disable animation when changing size
	HISTORY.clearAllHistory(); // remove histories
	ENV.paperSize={width: w,height: h,diag: Math.sqrt(w*w+h*h)};
	$("#canvas-container").css({"width": w+"px","height": h+"px"}); // set canvas view size
	$("#main-canvas").attr({"width": w,"height": h}); // set canvas pixel size
	$("#overlay-canvas").attr({"width": w,"height": h}); // set canvas pixel size
	CANVAS.init(); // re-initialize CANVAS (and create new renderer, viewport)

	if(isPreservingContents){ // save all contents
		for(const k in LAYERS.layerHash) { // @TODO: copy image data, mask image data
			const layer=LAYERS.layerHash[k];
			if(layer instanceof CanvasNode) {
				const rImg=layer.rawImageData;
				const tArea=GLProgram.borderIntersection(rImg.validArea,CANVAS.renderer.viewport); // target area
				layer.assignNewRawImageData(tArea.width,tArea.height,tArea.left,tArea.top,true);
				layer.assignNewMaskedImageData(0,0);
				layer.assignNewImageData(0,0);
				layer.setRawImageDataInvalid();
				STORAGE.FILES.saveContentChanges(layer);
			}
			else {
				layer.assignNewRawImageData(0,0);
				layer.assignNewMaskedImageData(0,0);
				layer.assignNewImageData(0,0);
			}
		}
		
		CANVAS.requestRefresh(); // No need to recomposite layer structure
		LAYERS.updateAllThumbs();
		const aL=LAYERS.active; // if there is an active layer, refresh it
		if(aL instanceof CanvasNode) {
			CANVAS.setTargetLayer(aL);
		}
	}
	else{ // delete all
		LAYERS.active=null; // disable layer operation and canvas
		CANVAS.setTargetLayer(null);
		if(LAYERS.layerTree){ // layer tree constructed
			for(const v of LAYERS.layerTree.children){
				// delete these layers and resources
				// and children
				// and file storage
				v.delete();
			}
			LAYERS.layerTree.children=[];
			LAYERS.layerTree.assignNewRawImageData(0,0); // root does not have masked or imageData
		}
		$("#layer-panel-inner").empty();
	}

	// update transform
	let k1=ENV.window.SIZE.width/w;
	let k2=ENV.window.SIZE.height/h;
	let k=(Math.min(k1,k2)*0.8).clamp(0.1,8.0);
	ENV.transformTo(0,0,0,k);
	$("#scale-info-input").val(Math.round(k*100));

	ENV.displaySettings.enableTransformAnimation=isAnim; // restore animation setting
	$("#canvas-container").css("background-size",Math.sqrt(Math.max(w,h))*2+"px"); // set transparent block size
};
// ====================== Tools functions ==========================
/**
 * (x,y) is the coordinate under canvas window
 * transform it to the coordinate of paper
 * return [x,y] in paper
 */

ENV.toPaperXY=function(x,y) {
	var xp=x-ENV.window.SIZE.width/2-ENV.window.trans.x;
	var yp=y-ENV.window.SIZE.height/2-ENV.window.trans.y;

	var rot=ENV.window.rot/180*Math.PI;
	var rotS=Math.sin(rot);
	var rotC=Math.cos(rot);
	var xr=rotC*xp+rotS*yp;
	var yr=rotC*yp-rotS*xp;

	var scale=ENV.window.scale;
	var flip=ENV.window.flip? -1:1;
	var xc=xr*flip/scale+ENV.paperSize.width/2;
	var yc=yr/scale+ENV.paperSize.height/2;

	return [xc,yc];
};

/**
 * get transform matrix [a,b,c,d,e,f] from pArr = [x,y,r,s]
 * translate (x,y) rotate r scale s
 */
ENV.getTransformMatrix=function(pArr) {
	let cpw=ENV.window.SIZE.width;
	let cph=ENV.window.SIZE.height;

	let transCX=-ENV.paperSize.width/2;
	let transCY=-ENV.paperSize.height/2;

	let rot=pArr[2]/180*Math.PI;
	let rotS=Math.sin(rot);
	let rotC=Math.cos(rot);
	let scale=pArr[3];
	let flip=ENV.window.flip? -1:1;

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
ENV.fireTransformAnimation=function(pArr) {
	let anim=ENV.window._transAnimation;

	if(!ENV.displaySettings.enableTransformAnimation) { // no animation
		let mat=ENV.getTransformMatrix(pArr)
		let matrixStr="matrix("+mat[0]+","+mat[1]+","+mat[2]+","+mat[3]+","+mat[4]+","+mat[5]+")";
		anim.target=pArr;
		anim.start=pArr;
		anim.now=pArr;
		anim.process=1;
		$("#canvas-container").css({ // set style
			"transform": matrixStr, // transform
			"box-shadow": "0px 0px "+(4/anim.now[3])+"em #808080" // shadow size
		});
		CANVAS.requestRefresh(); // update canvas anti-aliasing
		return;
	}
	anim.target=pArr;
	anim.start=anim.now;
	anim.process=0;
	if(!anim.isAnimationFired) { // no animation at present
		anim.isAnimationFired=true;
		requestAnimationFrame(ENV._transformAnimation);
	}
}
ENV._transformAnimation=function() {
	let anim=ENV.window._transAnimation;
	let p=anim.process; // deal with animation effect
	if(p<1-1E-6) { // continue animation, double check for unintentional fire
		let nowTime=Date.now();
		if(anim.lastTime>0) { // there's last animation
			PERFORMANCE.submitFpsStat(nowTime-anim.lastTime);
		}
		anim.lastTime=nowTime;

		let tP=anim.target;
		let sP=anim.start;
		// if shift pressed, run animation 10x faster to reduce latency on dragging
		let targetFPS=PERFORMANCE.fpsCounter.fps.clamp(30,300);
		let nextFps=targetFPS/(CURSOR.nowActivity=="pan-paper"&&CURSOR.isDown? 10:1);
		let step=1/(anim.time*nextFps);
		p+=step;
		if(p>1) p=1; // end
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
			"transform": matrixStr, // transform
			"box-shadow": "0px 0px "+(4/anim.now[3])+"em #808080" // shadow size
		});
		CANVAS.requestRefresh(); // update canvas anti-aliasing

		//console.log(matrixStr);

		if(p<1-1E-6) { // request new frame
			requestAnimationFrame(ENV._transformAnimation);
		}
		else {
			anim.lastTime=0; // cancel timer
			anim.isAnimationFired=false; // cancel animation
		}
	}
}

// linear interpolation by k: (1-k)p1+kp2, special notice on angle and scale
function pArrInterpolate(p1,p2,k) {
	let x=(p2[0]-p1[0])*k+p1[0];
	let y=(p2[1]-p1[1])*k+p1[1];

	// angle interpolation around a circle
	let d1=p1[2],d2=p2[2];
	let dD=(d2-d1)%360;
	if(dD<0) dD+=360;
	if(dD>180) { // CCW
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
ENV.setAntiAliasing=function(isAntiAlias) {
	ENV.displaySettings.antiAlias=isAntiAlias;
	// change the setting of each layer
	if(isAntiAlias) {
		$("#canvas-container").find("canvas").removeClass("pixelated");
	}
	else {
		$("#canvas-container").find("canvas").addClass("pixelated");
	}
	CANVAS.requestRefresh(); // update canvas anti-alias renderings
}

/**
 * change the animation when transforming the canvas
 */
ENV.setTransformAnimation=function(isAnimate) {
	ENV.displaySettings.enableTransformAnimation=isAnimate;
}

ENV.setFileTitle=function(title) {
	$("#filename-input").val(title);
}

ENV.getFileTitle=function() {
	return $("#filename-input").val();
}
// ====================== For Debugging ==========================
/**
 * These functions are intended for debuggggggging purposes.
 * Do not use them in working context
 */

// ============ helper functions ===============
/**
 * load a text file
 * only works on web server
 */
ENV.loadTextFile=function(url,callback) {
	let request=new XMLHttpRequest();
	request.open("GET",url,true);
	request.addEventListener("load",function() {
		callback(request.responseText);
	});
	request.send();
}

ENV.escapeHTML=str => str.replace(/[&<>'"]/g,tag => ({"&": "&amp;","<": "&lt;",">": "&gt;","'": "&#39;",'"': "&#34;"}[tag]||tag));

ENV.b64="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
ENV.uint8Array2base64=function(arr) {
	const b64=ENV.b64;
	let bitmap,a,b,c,result="",rest=arr.length%3; // To determine the final padding

	for(let i=0;i<arr.length;) {
		a=arr[i++];
		b=arr[i++]; // if i out of bound, b/vc will be 0 (undefined)
		c=arr[i++];
		bitmap=(a<<16)|(b<<8)|c;
		result+=b64.charAt(bitmap>>18&63)+b64.charAt(bitmap>>12&63)+b64.charAt(bitmap>>6&63)+b64.charAt(bitmap&63);
	}

	// If there's need of padding, replace the last 'A's with equal signs
	return rest? result.slice(0,rest-3)+"===".substring(rest):result;
};
// Ref: https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/btoa

ENV.uint8Array2base32k=function(data){
	const len=Math.ceil(data.length/4)+1
	const u32=new Uint32Array(len);
	u32[0]=data.length;
	for(let i=0,j=1;i<data.length;i+=4,j++){
		u32[j]=(data[i]<<24)|(data[i+1]<<16)|(data[i+2]<<8)|data[i+3];
	}
	return base32k.encode(u32);
}

ENV.base32k2uint8Array=function(b32k){
	const u32=base32k.decode(b32k);
	const len=u32[0];
	const data=new Uint8Array(len);
	for(let i=0,j=1;i<data.length;i+=4,j++){
		data[i]=u32[j]>>24;
		data[i+1]=u32[j]>>16;
		data[i+2]=u32[j]>>8;
		data[i+3]=u32[j];
	}
	return data;
}