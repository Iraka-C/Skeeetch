PALETTE={};
PALETTE.sigmaBias=0.05;

function rgb2hsv(trgb){
	var maxc=Math.max(trgb.r,trgb.g,trgb.b);
	var minc=Math.min(trgb.r,trgb.g,trgb.b);
	var thsv={h:0,s:0,v:maxc*100/255};
	if(maxc==minc){
		return thsv;
	}

	var dc=maxc-minc;
	if(maxc==trgb.r){
		thsv.h=(trgb.g-trgb.b)/dc;
	}
	else if(maxc==trgb.g){
		thsv.h=2+(trgb.b-trgb.r)/dc;
	}
	else{
		thsv.h=4+(trgb.r-trgb.g)/dc;
	}

	thsv.h*=60;
	if(thsv.h<0)thsv.h+=360;

	//thsv.h=Math.floor(thsv.h);
	thsv.s=dc/maxc*100;
	return thsv;
}

function hsv2rgb(thsv){
	var v=thsv.v*255/100;
	if(thsv.s==0){ // gray
		return {r:v,g:v,b:v};
	}
	var h=thsv.h/60; // 0~5
	var s=thsv.s/100;

	var i=Math.floor(h);
	var f=h-i;
	var a=v*(1-s);
	var b=v*(1-s*f);
	var c=v*(1-s*(1-f));

	switch(i){
	case 0:return {r:v,g:c,b:a};
	case 1:return {r:b,g:v,b:a};
	case 2:return {r:a,g:v,b:c};
	case 3:return {r:a,g:b,b:v};
	case 4:return {r:c,g:a,b:v};
	case 5:return {r:v,g:a,b:b};
	}
}

function getSigma(thsv){
	// Solve x for s^x + [(v+d)/(1+d)]^x == 1

	var v=thsv.v/100;
	var s=thsv.s/100;
	// v is the biased brightness
	v=(v+PALETTE.sigmaBias)/(1+PALETTE.sigmaBias);

	if(s==0){
		return v==1?1:0;
	}
	else if(s==1||v==1){
		return Number.POSITIVE_INFINITY;
	}

	var x=0;
	for(var i=0;i<8;i++){
		// 8 iters can ensure 6 digits precision
		var udsx=Math.pow(1/s,x);
		var vdsx=Math.pow(v/s,x);
		x-=(1+vdsx-udsx)/(Math.log(s)+vdsx*Math.log(v));
	}
	return x;
}

function getSaturation(k,sigma){
	// Solve s for s^sigma + [(v+d)/(1+d)]^sigma == 1
	// and v == (1+d)*s + k
	// that is s^sigma + (s+p)^sigma == 1
	var p=(k+PALETTE.sigmaBias)/(1+PALETTE.sigmaBias);

	// init value matters !
	var x=sigma>1?(p>0?1-p:1):(p>0?1E-100:-p+1E-16);
	for(var i=0;i<30;i++){
		var ss=Math.pow(x,sigma-1);
		var sps=Math.pow(x+p,sigma-1);
		var dx=(ss*x+sps*(x+p)-1)/(ss+sps)/sigma;
		x-=dx;
	}
	return x;

}

PALETTE.init=function(){
	PALETTE.rgb={r:134.0,g:192.0,b:224.0};
	PALETTE.hsv=rgb2hsv(PALETTE.rgb);
	PALETTE.sigma=getSigma(PALETTE.hsv);

	var paletteSize=$("#palette_board").width()-32;
	var cvp=$("#palette_SV");
	cvp.attr({
		"width":paletteSize,
		"height":paletteSize
	});
	$("#palette_board_inner").css({
		"width":paletteSize,
		"height":paletteSize
	});
	$("#palette_svg").attr({
		"width":paletteSize,
		"height":paletteSize
	});

	PALETTE.ctx=cvp[0].getContext("2d");
	PALETTE.size=paletteSize;
	PALETTE.panelHeight=$("#palette_panel").height();
	$("#palette_panel").css("height",PALETTE.panelHeight+"px");
	PALETTE.initPaletteWindow();
};

PALETTE.drawPalette=function(hue){ // 0 ~ 360
	var pureRGB=hsv2rgb({h:hue,s:100,v:100});
	var imgData=PALETTE.ctx.getImageData(0,0,PALETTE.size,PALETTE.size);
	var pix=imgData.data;
	for(var j=0;j<PALETTE.size;j++){ // column
		var pj=j/(PALETTE.size-1);
		var qjM=255*(1-pj);
		var rTop=qjM+pureRGB.r*pj;
		var gTop=qjM+pureRGB.g*pj;
		var bTop=qjM+pureRGB.b*pj;

		for(var i=0;i<PALETTE.size;i++){ // row
			var id=(i*PALETTE.size+j)*4;

			var pi=i/(PALETTE.size-1);
			var qi=1-pi;
			var rP=rTop*qi;
			var gP=gTop*qi;
			var bP=bTop*qi;

			pix[id]=rP;
			pix[id+1]=gP;
			pix[id+2]=bP;
			pix[id+3]=255;
		}
	}
	PALETTE.ctx.putImageData(imgData,0,0);
}

PALETTE.initPaletteWindow=function(){
	PALETTE.drawPalette(PALETTE.hsv.h);
	PALETTE.setCursor();

	// Not a global event: handle by palette itself
	$("#palette_SV").on("pointermove",event=>{
		var e=event.originalEvent;
		if(e.buttons){
			PALETTE.selectColor(e.offsetX,e.offsetY);
		}
		e.stopPropagation(); // no drawing
		return false;
	});

	$("#palette_panel").on("wheel",event=>{
		var e=event.originalEvent;
		var hue=PALETTE.hsv.h;
		if(e.wheelDelta>0){
			hue++;
			if(hue>=360){
				hue-=360;
			}
		}
		else if(e.wheelDelta<0){
			hue--;
			if(hue<0){
				hue+=360;
			}
		}
		PALETTE.setHue(hue);
	});

	$("#hue-panel").on("wheel",event=>{
		var e=event.originalEvent;
		e.stopPropagation();
		var hue=PALETTE.hsv.h;
		if(e.wheelDelta>0){
			hue+=10;
			if(hue>=360){
				hue-=360;
			}
		}
		else if(e.wheelDelta<0){
			hue-=10;
			if(hue<0){
				hue+=360;
			}
		}
		PALETTE.setHue(hue);
	});
};

PALETTE.setHue=function(hue){
	PALETTE.hsv.h=hue;
	PALETTE.setHSV(PALETTE.hsv);
	PALETTE.drawPalette(hue);
}

PALETTE.selectColor=function(x,y){
	var pix=PALETTE.ctx.getImageData(x,y,1,1).data;
	PALETTE.setRGB({r:pix[0],g:pix[1],b:pix[2]});
}

PALETTE.getColorString=function(){
	return "RGB("+PALETTE.rgb.r+","+PALETTE.rgb.g+","+PALETTE.rgb.b+")";
};

PALETTE.setRGB=function(rgb){ // no board renew
	PALETTE.rgb=rgb;
	PALETTE.hsv=rgb2hsv(rgb);
	PALETTE.sigma=getSigma(PALETTE.hsv);
	console.log("SIGMA = "+PALETTE.sigma);

	$("#palette_menus").css("background-color",PALETTE.getColorString());
	var textRGB=hsv2rgb({h:PALETTE.hsv.h,s:PALETTE.hsv.s,v:100});
	$("#palette_block").css("color",
		PALETTE.hsv.v>65?"#000000":"RGB("+textRGB.r+","+textRGB.g+","+textRGB.b+")"
	);
	var hueRGB=hsv2rgb({h:PALETTE.hsv.h,s:40,v:100});
	$("#hue-panel").html(Math.round(PALETTE.hsv.h)).css("color",
		"RGB("+hueRGB.r+","+hueRGB.g+","+hueRGB.b+")"
	);
	PALETTE.setCursor();
}

PALETTE.setHSV=function(hsv){ // no board renew
	PALETTE.hsv=hsv;
	PALETTE.rgb=hsv2rgb(hsv);
	PALETTE.sigma=getSigma(PALETTE.hsv);
	console.log("SIGMA = "+PALETTE.sigma);

	$("#palette_menus").css("background-color",PALETTE.getColorString());
	var textRGB=hsv2rgb({h:PALETTE.hsv.h,s:PALETTE.hsv.s,v:100});
	$("#palette_block").css("color",
		PALETTE.hsv.v>65?"#000000":"RGB("+textRGB.r+","+textRGB.g+","+textRGB.b+")"
	);
	var hueRGB=hsv2rgb({h:PALETTE.hsv.h,s:40,v:100});
	$("#hue-panel").html(Math.round(PALETTE.hsv.h)).css("color",
		"RGB("+hueRGB.r+","+hueRGB.g+","+hueRGB.b+")"
	);
	PALETTE.setCursor();
}
// =========== Wheel Handler ==============

PALETTE.changeBrightnessEvent=function(event){
	var e=event.originalEvent;
	if(e.wheelDelta>0){
		PALETTE.changeBrightness(1);
	}
	else if(e.wheelDelta<0){
		PALETTE.changeBrightness(-1);
	}
};

PALETTE.changeBrightness=function(db){
	var nowV=PALETTE.hsv.v/100;
	var nowS=PALETTE.hsv.s/100;
	var k=nowV-(1+PALETTE.sigmaBias)*nowS;
	//console.log(k);

	// change S,V
	k+=db/100;
	var newS=getSaturation(k,PALETTE.sigma);
	var newV=(1+PALETTE.sigmaBias)*newS+k;
	if(k>1||k<-(1+PALETTE.sigmaBias)){
		// out of range
		return;
	}

	if(newS>1)newS=1;
	if(newS<0)newS=0;
	if(newV>1)newV=1;
	if(newV<0)newV=0;


	PALETTE.hsv.s=newS*100;
	PALETTE.hsv.v=newV*100;
	//console.log("newK = "+k+" S = "+newS+" V = "+newV);
	PALETTE.rgb=hsv2rgb(PALETTE.hsv);

	$("#palette_menus").css("background-color",PALETTE.getColorString());
	var textRGB=hsv2rgb({h:PALETTE.hsv.h,s:PALETTE.hsv.s,v:100});
	$("#palette_block").css("color",
		newV>0.65?"#000000":"RGB("+textRGB.r+","+textRGB.g+","+textRGB.b+")"
	);
	PALETTE.setCursor();
};

PALETTE.setCursor=function(){ // two cursors
	$("#palette_cursor").attr({
		"cx":PALETTE.hsv.s/100*PALETTE.size,
		"cy":(1-PALETTE.hsv.v/100)*PALETTE.size,
		"stroke":PALETTE.hsv.v>60?"#000000":"#ffffff"
	});
	CURSOR.setColor();
}
