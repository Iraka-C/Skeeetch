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

// ================== Tool Functions =====================
// rgb=[r,g,b], return [h,s,v]
function rgb2hsv(rgb){
	let r=rgb[0],g=rgb[1],b=rgb[2];
	let maxc=Math.max(r,g,b);
	let minc=Math.min(r,g,b);
	if(maxc==minc){ // pure gray
		return [0,0,maxc];
	}

	let h=0,s=0,v=maxc;
	let dc=maxc-minc;
	if(maxc==r){
		h=(g-b)/dc;
	}
	else if(maxc==g){
		h=2+(b-r)/dc;
	}
	else{
		h=4+(r-g)/dc;
	}

	h*=60;
	if(h<0)h+=360;
	s=dc*180/maxc;
	return [h,s,v];
}

// hsv=[h,s,v], return [r,g,b]
function hsv2rgb(hsv){
	let v=hsv[2];
	let s=hsv[1]/180; // 0~1
	if(s==0){ // pure gray
		return [v,v,v];
	}
	let h=hsv[0]/60; // 0~5

	let i=Math.floor(h);
	let f=h-i;
	let a=v*(1-s);
	let b=v*(1-s*f);
	let c=v*(1-s*(1-f));

	switch(i){
	case 6: // Precision issues
	case 0:return [v,c,a];
	case 1:return [b,v,a];
	case 2:return [a,v,c];
	case 3:return [a,b,v];
	case 4:return [c,a,v];
	case 5:return [v,a,b];
	}
}

function h2rgb(hue){ // hue to pure color
	hue=hue%360;
	if(hue<0){
		hue+=360;
	}
	
	let h=hue/60; // 0~5
	let i=Math.floor(h);
	let f=h-i;
	let c=255*f;
	let b=255-c;

	switch(i){
	case 6:
	case 0:return [255,c,0];
	case 1:return [b,255,0];
	case 2:return [0,255,c];
	case 3:return [0,b,255];
	case 4:return [c,0,255];
	case 5:return [255,0,b];
	}
}

// ================== Render Palette ==========================

// Draw the palette with a certain hue
PALETTE.drawPalette=function(hue){ // 0 ~ 360
	let pureRGB=h2rgb(hue);
	let paletteImgData=PALETTE.ctx.getImageData(0,0,PALETTE.size,PALETTE.size);
	let pix=paletteImgData.data;
	for(let j=0;j<256;j++){ // column
		let pj=j/255;
		let qjM=255*(1-pj);
		let rTop=qjM+pureRGB[0]*pj;
		let gTop=qjM+pureRGB[1]*pj;
		let bTop=qjM+pureRGB[2]*pj;

		for(let i=0;i<255;i++){ // row
			let id=(i*256+j)*4;

			let pi=i/255;
			let qi=1-pi;
			let rP=rTop*qi;
			let gP=gTop*qi;
			let bP=bTop*qi;

			pix[id]=rP;
			pix[id+1]=gP;
			pix[id+2]=bP;
			pix[id+3]=255;
		}
	}
	PALETTE.ctx.putImageData(paletteImgData,0,0);
}

/**
 * draw hue selector
 */
PALETTE.drawHueSelector=function(){
	let sctx=PALETTE.hctx;
	let sW=PALETTE.hueWidth;
	let sH=PALETTE.hueHeight;
	
	let hueImgData=sctx.getImageData(0,0,sW,sH);
	let pix=hueImgData.data;
	
	for(let j=0;j<sW;j++){ // column
		let h=PALETTE.hueSelectorFunc(j/sW);
		let centerColor=h2rgb(h*360);
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
	//CURSOR.setColor(): on the main canvas
}

PALETTE.updatePaletteNoRenew=function(){
	$("#palette-button").css("background-color",PALETTE.getColorString());
	var textRGB=hsv2rgb([PALETTE.hsv[0],PALETTE.hsv[1],255]);
	$("#palette-button").css("color",
		PALETTE.hsv[2]>150?"#000000":PALETTE.getColorString(textRGB)
	);
	/*var hueRGB=hsv2rgb({h:PALETTE.hsv.h,s:40,v:100});
	$("#hue-panel").html(Math.round(PALETTE.hsv.h)).css("color",
		"RGB("+hueRGB.r+","+hueRGB.g+","+hueRGB.b+")"
	);*/
	
	$("#palette-hue-value").text(Math.round(PALETTE.hsv[0]));
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
PALETTE.init=function(){
	/**
	 * @TODO: hue selector cursor
	 */
	
	PALETTE.rgb=[134.0,194.0,224.0];
	PALETTE.hsv=rgb2hsv(PALETTE.rgb);

	let cvp=$("#palette-canvas"); // Fixed 256x256. Larger palette UI can be operated by css zooming.
	PALETTE.ctx=cvp[0].getContext("2d");
	PALETTE.size=256;
	PALETTE.width=cvp.width();
	PALETTE.height=cvp.height();
	PALETTE.offset=cvp.offset();

	// hue selector
	let scvp=$("#palette-hue-selector-canvas");
	scvp[0].width=$("#palette-title").width();
	PALETTE.hctx=scvp[0].getContext("2d");
	PALETTE.hueWidth=scvp.width();
	PALETTE.hueHeight=scvp.height();

	// Flags
	PALETTE.isSelectingSV=false;
	PALETTE.isSelectingHue=false;
	
	PALETTE.initPaletteWindow();
	
};

PALETTE.initPaletteWindow=function(){
	PALETTE.drawPalette(PALETTE.hsv[0]);
	PALETTE.setHSV(PALETTE.hsv); // draw all items
	PALETTE.setCursor();

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
	$("#palette-hue-info").on("pointerdown pointermove",event=>{
		if(CURSOR.isDown){ // is drawing
			return false;
		}
		let e=event.originalEvent;
		// @TODO: change here from hard coded number to a div
		if(!PALETTE.isSelectingHue&&!PALETTE.isSelectingSV&&e.offsetY<=24){
			PALETTE.isSelectingHue=true;
			$("#palette-hue-selector-canvas").fadeIn(500);
		}
		if(e.buttons&&PALETTE.isSelectingHue){ // is selecting
			e.stopPropagation(); // do not pass this event to SV selector
			// select
			let x=e.offsetX/PALETTE.hueWidth;
			PALETTE.setHue(360*PALETTE.hueSelectorFunc(x));
		}
		
	});
	$("#palette-hue-info").on("pointerout pointercancel",event=>{
		PALETTE.isSelectingHue=false;
		$("#palette-hue-selector-canvas").fadeOut(500);
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