PALETTE={};

/**
 * Palette panel driver
 * RGB Mode: R(0~255), G(0~255), B(0~255)
 * HSV Mode: H(0~360), S(0~180), V(0~255)
 * For integer values, HSV covers 99.65% of the RGB space.
 */

/**
 * The palette canvas size is set to 255x255
 */

// ====================== Palette Controller ==================
class PaletteSelector{ // Abstract!
	constructor(){
		// Fixed 256x256. Larger palette UI can be operated by css zooming.
		const cv=$("#palette-canvas");
		this.ctx=cv[0].getContext("2d");
		this.size=256;
		this.colorRange="normal";
	}
	updateBanner(x){ // x: 0~1 is the position selected on banner

	}
	updateSelector(){

	}
	setCursor(){

	}
	updatePaletteButton(){
		const button=$("#palette-button");
		button.css("background-color",PALETTE.getColorString());
		if(PALETTE.hsv[2]>150){
			button.css("color","#000000");

		}
		else{
			const textRGB=hsv2rgb([PALETTE.hsv[0],PALETTE.hsv[1],255]);
			button.css("color",PALETTE.getColorString(textRGB));
		}
	}
	/**
	 * 
	 * @param {String} s "normal"|"web-safe-color"|"web-named-color"|"named-color"|"8bit"
	 */
	setColorRange(s){
		this.colorRange=s;
	}
};

// ================== Render Palette ==========================

// Draw the palette with a certain hue
PALETTE.drawPalette=function(hue){ // 0 ~ 360
	const startT=Date.now();
	if(hue===undefined){
		hue=PALETTE.hsv[0];
	}
	let pureRGB=h2rgb(hue);
	let paletteImgData=PALETTE.ctx.createImageData(PALETTE.size,PALETTE.size);
	let pix=paletteImgData.data;
	for(let j=0;j<256;j++){ // column
		const pj=j/255;
		const qjM=255-j;
		const rTop=qjM+pureRGB[0]*pj;
		const gTop=qjM+pureRGB[1]*pj;
		const bTop=qjM+pureRGB[2]*pj;

		let id=j*4;
		for(let i=0;i<256;i++,id+=1024){ // row
			const pi=i/255;
			const qi=1-pi;
			const rP=rTop*qi;
			const gP=gTop*qi;
			const bP=bTop*qi;

			const webC=PALETTE.colorManager.rgb2namedColor([rP,gP,bP])[1];

			// pix[id]=rP;
			// pix[id+1]=gP;
			// pix[id+2]=bP;
			pix[id]=webC[0];
			pix[id+1]=webC[1];
			pix[id+2]=webC[2];
			pix[id+3]=255;
		}
	}
	PALETTE.ctx.putImageData(paletteImgData,0,0);
	console.log("Time:",Date.now()-startT);
	
}

/**
 * draw hue selector
 */
PALETTE.drawHueSelector=function(x){
	let sW=PALETTE.hueWidth;
	let sH=sW/3;
	if(!sW)return; // the palette is invisible
	PALETTE.scvp.width=sW;
	PALETTE.scvp.height=sH;

	let sctx=PALETTE.hctx;
	
	let hueImgData=sctx.getImageData(0,0,sW,sH);
	let pix=hueImgData.data;
	
	let wThr=sW/18; // width threshold
	for(let j=0;j<sW;j++){ // column
		let h=PALETTE.hueSelectorFunc(j/sW);
		let s=180,v=255;
		if(!isNaN(x)){ // highlighted
			let disX=Math.abs(j-x); // distance of j to x
			disX=(disX>wThr)?0:1-disX/wThr;
			disX*=disX; // gradient
			v=160+95*disX;
			s=100+80*disX;
		}
		let centerColor=hsv2rgb([h*360,s,v]);
		let pM=1-Math.abs(j*2-sW)/sW;
		let aM=pM*2<1?pM*2:1;
		aM=1-aM; // gradient opacity
		aM=Math.sqrt(1-aM*aM);

		for(let i=0;i<sH;i++){ // row
			let id=(i*sW+j)*4;

			let rP=centerColor[0];
			let gP=centerColor[1];
			let bP=centerColor[2];
			let aP=(1-i/sH)*aM;
			aP*=aP;
			

			pix[id]=rP;
			pix[id+1]=gP;
			pix[id+2]=bP;
			pix[id+3]=aP*255;
		}
	}
	sctx.putImageData(hueImgData,0,0);
}

PALETTE.setCursor=function(){
	$("#palette-cursor").attr({
		"cx":PALETTE.hsv[1]/180*PALETTE.width,
		"cy":(1-PALETTE.hsv[2]/255)*PALETTE.height,
		"stroke":PALETTE.hsv[2]>150?"#000000":"#ffffff"
	});
	
	$("#palette-hue-value").text(PALETTE.colorManager.rgb2namedColor(PALETTE.rgb)[0]);
	//$("#palette-hue-value").text(Math.round(PALETTE.hsv[0]));
}

PALETTE.updatePaletteNoRenew=function(){
	const button=$("#palette-button");
	button.css("background-color",PALETTE.getColorString());
	if(PALETTE.hsv[2]>150){
		button.css("color","#000000");

	}
	else{
		const textRGB=hsv2rgb([PALETTE.hsv[0],PALETTE.hsv[1],255]);
		button.css("color",PALETTE.getColorString(textRGB));
	}
	/*var hueRGB=hsv2rgb({h:PALETTE.hsv.h,s:40,v:100});
	$("#hue-panel").html(Math.round(PALETTE.hsv.h)).css("color",
		"RGB("+hueRGB.r+","+hueRGB.g+","+hueRGB.b+")"
	);*/
	
	//$("#palette-hue-value").text(Math.round(PALETTE.hsv[0]));
	PALETTE.setCursor();
}

PALETTE.setRGB=function(rgb){ // no palette canvas renew
	PALETTE.rgb=rgb;
	PALETTE.hsv=rgb2hsv(rgb);
	//PALETTE.sigma=getSigma(PALETTE.hsv);
	//console.log("SIGMA = "+PALETTE.sigma);
	PALETTE.updatePaletteNoRenew();
	CURSOR.updateColor();
}

PALETTE.setHSV=function(hsv){ // no palette canvas renew
	PALETTE.hsv=hsv;
	PALETTE.rgb=hsv2rgb(hsv);
	//PALETTE.sigma=getSigma(PALETTE.hsv);
	//console.log("SIGMA = "+PALETTE.sigma);
	PALETTE.updatePaletteNoRenew();
	CURSOR.updateColor();
}

PALETTE.getColorString=function(rgb){
	if(!rgb){
		return PALETTE.getColorString(PALETTE.rgb);
	}
	if(rgb[3]){
		return "rgba("+rgb[0]+","+rgb[1]+","+rgb[2]+","+rgb[3]+")";
	}
	else{
		return "rgb("+rgb[0]+","+rgb[1]+","+rgb[2]+")";
	}
};

// changes hue (0~360), redraw panel
PALETTE.setHue=function(hue){
	PALETTE.hsv[0]=hue;
	PALETTE.drawPalette(hue);
	PALETTE.setHSV(PALETTE.hsv);
}

PALETTE.onSelectSV=function(x,y){ // do not change hue, no palette canvas renew
	var newS=x*180;
	var newV=(1-y)*255;
	PALETTE.setHSV([PALETTE.hsv[0],newS,newV]);
}
// ================== init ======================
PALETTE.init=function(sysSettingParams){
	// Init palette color
	if(sysSettingParams.paletteColor&&sysSettingParams.paletteColor.length>=3){
		PALETTE.rgb=sysSettingParams.paletteColor.slice(0,3);
	}
	else{ // initRGB
		PALETTE.rgb=[134.0,194.0,224.0];
	}
	PALETTE.hsv=rgb2hsv(PALETTE.rgb);

	// colorManagement
	PALETTE.colorManager.init(PALETTE.namedColorList);

	// SV selector
	PALETTE.refreshUIParam();
	
	const cv=$("#palette-canvas");
	PALETTE.ctx=cv[0].getContext("2d");
	PALETTE.size=256;

	// hue selector
	PALETTE.scvp=$("#palette-hue-selector-canvas")[0];
	PALETTE.hctx=PALETTE.scvp.getContext("2d");

	// Flags
	PALETTE.isSelectingSV=false;
	PALETTE.isSelectingHue=false;
	
	PALETTE.initPaletteWindow();

	// Palette top button
	EventDistributer.setClick($("#palette-button"),event=>{
		$("#palette-panel").animate({"height":"toggle"},300); // == .slideToggle(300)
		// The params may be changed before expanding, redraw the items
		PALETTE.refreshUIParam();
		PALETTE.drawHueSelector();
		PALETTE.setCursor();
	});
};

PALETTE.initPaletteWindow=function(){
	PALETTE.drawPalette();
	PALETTE.setHSV(PALETTE.hsv); // draw all items
	PALETTE.setCursor();

	let cvp=$("#palette-canvas"); // Fixed 256x256. Larger palette UI can be operated by css zooming.
	// Not a global event: handle by palette itself
	$("#palette-panel").on("pointerdown pointermove",event=>{
		if(CURSOR.isDown){ // is drawing
			return false;
		}
		let e=event.originalEvent;
		
		// make sure to select pure color
		let x=Math.min(Math.max(e.pageX-PALETTE.offset.left,0),PALETTE.width-1)/(PALETTE.width-1);
		let y=Math.min(Math.max(e.pageY-PALETTE.offset.top,0),PALETTE.height-1)/(PALETTE.height-1);
		if(e.buttons){ // is pressing
			PALETTE.isSelectingSV=true;
			PALETTE.onSelectSV(x,y);
		}
		else{
			PALETTE.isSelectingSV=false;
		}
		e.stopPropagation(); // no drawing on canvas
		return false;
	});
	$("#palette-selector").on("pointerdown",event=>{
		if(CURSOR.isDown){ // is drawing
			return false;
		}
		let e=event.originalEvent;
		PALETTE.isSelectingSV=true;

		// make sure to select pure color
		let x=Math.min(Math.max(e.pageX-PALETTE.offset.left,0),PALETTE.width-1)/(PALETTE.width-1);
		let y=Math.min(Math.max(e.pageY-PALETTE.offset.top,0),PALETTE.height-1)/(PALETTE.height-1);
		PALETTE.onSelectSV(x,y);
		e.stopPropagation(); // no drawing on canvas
		return false;
	});

	// Hue selector
	$("#palette-hue-selector-canvas").on("pointerdown pointermove",event=>{
		let e=event.originalEvent;
		if(!PALETTE.isSelectingHue&&!PALETTE.isSelectingSV){
			PALETTE.isSelectingHue=true;
		}
		if(e.buttons&&PALETTE.isSelectingHue){ // is selecting
			e.stopPropagation(); // do not pass this event to SV selector
			// select
			let x=e.offsetX/PALETTE.hueWidth;
			PALETTE.setHue(360*PALETTE.hueSelectorFunc(x));
			PALETTE.drawHueSelector(e.offsetX);
		}
		
	});
	$("#palette-hue-selector-canvas").on("pointerup",event=>{
		// recover solid selector
		PALETTE.drawHueSelector();
	});
	$("#palette-hue-selector-canvas").on("pointerout pointercancel",event=>{
		PALETTE.isSelectingHue=false;
		PALETTE.drawHueSelector();
	});

	PALETTE.initHueSelector();
}

// The x ratio of the width span (0~1) map to hue (0~1)
PALETTE.hueSelectorFunc=function(x){
	const overlap=0.1;
	let h=x*(1+overlap*2)-overlap;
	if(h<0)h+=1;
	if(h>=1)h-=1;
	return h;
}

PALETTE.initHueSelector=function(){
	PALETTE.drawHueSelector();
}

PALETTE.refreshUIParam=function(){
	const cvp=$("#palette-canvas"); // Fixed 256x256. Larger palette UI can be operated by css zooming.
	PALETTE.width=cvp.width();
	PALETTE.height=cvp.height();
	PALETTE.offset=cvp.offset();
	PALETTE.hueWidth=$("#palette-title").width();
}