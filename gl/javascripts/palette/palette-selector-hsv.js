"use strict";
class H_SVSelector extends PaletteSelector{
	constructor(rgb,colorInfoManager){
		super(rgb,colorInfoManager);
		this.typeID=0;
		this.hueSign.text(Lang("palette-hue-sign"));
	}
	_updateBanner(x){ // x: 0~1 is the position selected on banner
		
		const sW=this.hcv.width;
		const sH=this.hcv.height;
		if(!sW)return; // the palette is invisible

		const tX=(x?x:H_SVSelector.invHueSelectorFunc(this.hsv[0]))*sW; // pixels from left
	
		const hctx=this.hctx;
		const hueImgData=hctx.createImageData(sW,sH);
		const pix=hueImgData.data;
		
		const wThr=sW/18; // width threshold
		for(let j=0;j<sW;j++){ // column
			let h=H_SVSelector.hueSelectorFunc(j/sW);

			let disX=Math.abs(j-tX); // distance of j to x
			
			disX=(disX>wThr)?0:1-disX/wThr;
			disX*=disX; // gradient
			let v=160+95*disX;
			let s=100+80*disX;
			
			let centerColor=hsv2rgb([h,s,v]);
			let pM=1-Math.abs(j*2-sW)/sW;
			let aM=1-(pM*2<1?pM*2:1); // gradient opacity on two ends
			aM=Math.sqrt(1-aM*aM);
	
			for(let i=0;i<sH;i++){ // row
				let id=(i*sW+j)*4;
				let aP=(1-i/sH)*aM;
				aP*=aP;
				[pix[id],pix[id+1],pix[id+2],pix[id+3]]=[...centerColor,aP*255];
			}
		}
		hctx.putImageData(hueImgData,0,0);
	}
	// The x ratio of the width span (0~1) map to hue (0~360)
	static hueSelectorFunc(x){
		const overlap=0.1;
		let h=x*(1+overlap*2)-overlap;
		if(h<0)h+=1;
		if(h>=1)h-=1;
		return h*360;
	}
	static invHueSelectorFunc(h){
		const overlap=0.1;
		let x=(h/360+overlap)/(1+overlap*2);
		return x;
	}
	_updateSelector(){
		const pureRGB=h2rgb(this.hsv[0]);
		const sW=this.cv.width;
		const sH=this.cv.height;
		let paletteImgData=this.ctx.createImageData(sW,sH);
		let pix=paletteImgData.data;
		
		for(let j=0;j<sW;j++){ // column
			const pj=j/(sW-1);
			const qjM=255*(1-pj);
			const rTop=qjM+pureRGB[0]*pj;
			const gTop=qjM+pureRGB[1]*pj;
			const bTop=qjM+pureRGB[2]*pj;
	
			for(let i=0;i<sH;i++){ // row
				let id=(i*sW+j)*4;
				const pi=i/(sH-1);
				const qi=1-pi;
				const rP=rTop*qi;
				const gP=gTop*qi;
				const bP=bTop*qi;

				const qC=this.colorInfoManager.query([rP,gP,bP])[1];
				[pix[id],pix[id+1],pix[id+2],pix[id+3]]=[...qC,255];
			}
		}
		this.ctx.putImageData(paletteImgData,0,0);
	}
	_updateCursor(x,y){
		if(isNaN(x)||isNaN(y)){
			super._updateCursor(this.hsv[1]/180,1-this.hsv[2]/255);
		}
		else{
			super._updateCursor(x,y);
		}
	}
	_updateInfo(){
		if(this.colorInfoManager.typeID==0){
			this.hueSign.css("display","block");
			this.hueSymbol.css("display","block");
			this.hueValue.text(Math.round(this.hsv[0]));
		}
		else{
			super._updateInfo();
		}
	}
	onSelectBanner(x){ // x: 0~1 on banner
		this.hsv[0]=H_SVSelector.hueSelectorFunc(x);
		
		this.setHSV(this.hsv,true); // update banner by myself
		this._updateBanner(x);
		this._updateSelector();
	}
	onSelectSelector(x,y,isPickingColor){ // (x,y): LU 0~1 in selector window
		const newS=x*180;
		const newV=(1-y)*255;
		const newHSV=[this.hsv[0],newS,newV];
		
		if(isPickingColor&&this.colorInfoManager.typeID){ // color range rendered
			const rgb=this.colorInfoManager.query(hsv2rgb(newHSV))[1];
			this.setRGB(rgb);
		}
		else{
			this._updateCursor(x,y);
			this.setHSV(newHSV,true); // no need to update canvas
		}
	}
	onScrollBanner(dw){
		const oldH=this.hsv[0];
		let newH=oldH+dw*3;
		if(newH>=360)newH-=360;
		if(newH<0)newH+=360;
		this.hsv[0]=newH;
		this.setHSV(this.hsv,true);
		this._updateBanner();
		this._updateSelector();
	}

	// ================= Set colors ===================

	setRGB(rgb,isSelfCall){
		super.setRGB(rgb);
		if(!isSelfCall){
			this._updateCursor();
			this._updateBanner();
			this._updateSelector();
		}
	}
	setHSV(hsv,isSelfCall){
		super.setHSV(hsv);
		if(!isSelfCall){
			this._updateCursor();
			this._updateBanner();
			this._updateSelector();
		}
	}
};