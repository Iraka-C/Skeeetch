PIXEL={};

PIXEL.blendPixel=function(pix1,pix2,mode){

	// pix = {r,g,b,a},  pix2 on pix1
	// r,g,b: 0~255, a: 0~1

	var res={r:0,g:0,b:0,a:0};
	if(mode=="NORMAL"){ // NORMAL mode
		var opc=pix1.a+pix2.a-pix1.a*pix2.a;
		if(opc==0)return res;

		var p=pix2.a/opc,q=1-p;
		res.r=pix2.r*p+pix1.r*q;
		res.g=pix2.g*p+pix1.g*q;
		res.b=pix2.b*p+pix1.b*q;
		res.a=opc;

		return res;
	}
	if(mode=="MULTIPLY"){ // MULTIPLY mode

		var v2=(pix2.r+pix2.g+pix2.b)/3;
		var opc=pix1.a+(1-pix1.a)*pix2.a*(1-v2/255);
		if(opc==0)return res;

		var kr1=pix1.a*(1-pix1.r/255),kr2=pix2.a*(1-pix2.r/255);
		var kg1=pix1.a*(1-pix1.g/255),kg2=pix2.a*(1-pix2.g/255);
		var kb1=pix1.a*(1-pix1.b/255),kb2=pix2.a*(1-pix2.b/255);

		res.r=255*(1-(kr1+kr2-kr1*kr2)/opc);
		res.g=255*(1-(kg1+kg2-kg1*kg2)/opc);
		res.b=255*(1-(kb1+kb2-kb1*kb2)/opc);
		res.a=opc;

		return res;
	}
	if(mode=="SCREEN"){ // SCREEN mode

		var v2=(pix2.r+pix2.g+pix2.b)/3;
		var opc=pix1.a+(1-pix1.a)*pix2.a*(v2/255);
		if(opc==0)return res;

		var kr1=pix1.a*pix1.r/255,kr2=pix2.a*pix2.r/255;
		var kg1=pix1.a*pix1.g/255,kg2=pix2.a*pix2.g/255;
		var kb1=pix1.a*pix1.b/255,kb2=pix2.a*pix2.b/255;

		res.r=255*(kr1+kr2-kr1*kr2)/opc;
		res.g=255*(kg1+kg2-kg1*kg2)/opc;
		res.b=255*(kb1+kb2-kb1*kb2)/opc;
		res.a=opc;

		return res;
	}
};

PIXEL.pickColor=function(x,y){ // 5*5 range
	//var pix0={r:0,g:0,b:0,a:0};
	var pix0={r:255,g:255,b:255,a:1};
	for(var layer=LAYERS.elementsHead;layer;layer=layer.next){ // down to up
		var ctx=layer.layerCanvas.canvas[0].getContext("2d");
		var pixData=ctx.getImageData(x-2,y-2,5,5).data;
		var pix1={r:0,g:0,b:0,a:0};
		for(var i=0;i<25*4;i+=4){
			pix1.r+=pixData[i];
			pix1.g+=pixData[i+1];
			pix1.b+=pixData[i+2];
			pix1.a+=pixData[i+3];
		}
		pix1.r/=25;
		pix1.g/=25;
		pix1.b/=25;
		pix1.a/=25*255;
		pix0=PIXEL.blendPixel(pix0,pix1,"NORMAL");
	}
	PALETTE.setRGB({r:pix0.r,g:pix0.g,b:pix0.b});
	PALETTE.drawPalette(PALETTE.hsv.h);
};

PIXEL.blendLayers=function(){
	var cv=document.createElement("canvas"); // canvas for mixing and output
	cv.width=ENV.paperSize.width;
	cv.height=ENV.paperSize.height;
	var ctx=cv.getContext("2d");
	var outData=ctx.getImageData(0,0,ENV.paperSize.width,ENV.paperSize.height);
	var outPix=outData.data;

	for(var layer=LAYERS.elementsHead;layer;layer=layer.next){ // down to up
		var lc=layer.layerCanvas;
		if(!lc.visible||lc.opacity==0){ // hidden
			continue;
		}

		var layerData=lc.canvas[0].getContext("2d").getImageData(0,0,ENV.paperSize.width,ENV.paperSize.height);
		var layerPix=layerData.data;

		var layerAlpha=lc.opacity/100;
		var layerBlendMode="NORMAL"; // Blend mode
		for(var i=0;i<layerPix.length;i+=4){
			if(layerPix[i+3]){ // visible pixel

				var pix1={r:outPix[i],g:outPix[i+1],b:outPix[i+2],a:outPix[i+3]/255};
				var pix2={r:layerPix[i],g:layerPix[i+1],b:layerPix[i+2],a:layerPix[i+3]/255*layerAlpha};
				var pix0=PIXEL.blendPixel(pix1,pix2,layerBlendMode);

				outPix[i]=pix0.r;
				outPix[i+1]=pix0.g;
				outPix[i+2]=pix0.b;
				outPix[i+3]=pix0.a*255;
			}
		}

	}

	ctx.putImageData(outData,0,0);
	return cv;
}

PIXEL.fillCanvas=function(cv,rgba,isFillAlpha){
	var ctx=cv.getContext("2d");
	var outData=ctx.getImageData(0,0,cv.width,cv.height);
	var outPix=outData.data;
	for(var i=0;i<outPix.length;i+=4){
		outPix[i]=rgba.r;
		outPix[i+1]=rgba.g;
		outPix[i+2]=rgba.b;
		if(isFillAlpha){
			outPix[i+3]=rgba.a*255;
		}
	}
	ctx.putImageData(outData,0,0);
};
