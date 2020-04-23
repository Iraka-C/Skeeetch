class V_HSSelector extends PaletteSelector{
	constructor(rgb,colorInfoManager){
		super(rgb,colorInfoManager);
		this.typeID=1;
		this.hueSign.text(Lang("palette-value-sign"));
	}
	_updateBanner(x){ // x: 0~1 is the position selected on banner
		
		const sW=this.hcv.width;
		const sH=this.hcv.height;
		if(!sW)return; // the palette is invisible

		const tX=(x?x:V_HSSelector.invValueSelectorFunc(this.hsv[2]))*sW; // pixels from left
	
		const hctx=this.hctx;
		const valueImgData=hctx.createImageData(sW,sH);
		const pix=valueImgData.data;
		
		const wThr=sW/18; // width threshold
		let h=this.hsv[0];
		for(let j=0;j<sW;j++){ // column
			let targetV=V_HSSelector.valueSelectorFunc(j/sW);

			let disX=Math.abs(j-tX); // distance of j to x
			
			disX=(disX>wThr)?0:1-disX/wThr;
			disX*=disX; // gradient
			let v=Math.max(targetV,160)*disX+targetV*(1-disX);
			let s=180*disX;
			
			let centerColor=hsv2rgb([h,s,v]);
			let pM=(1-Math.abs(j*2-sW)/sW)*2;
			let aM=1-Math.min(pM,1); // gradient opacity on two ends
			aM=Math.sqrt(1-aM*aM);
	
			for(let i=0;i<sH;i++){ // row
				let id=(i*sW+j)*4;
				let aP=(1-i/sH)*aM;
				if(aP>0.5){ // gradient
					let r=1-aP;
					aP=1-2*r*r;
				}
				else{
					aP*=2*aP;
				}
				[pix[id],pix[id+1],pix[id+2],pix[id+3]]=[...centerColor,aP*255];
			}
		}
		hctx.putImageData(valueImgData,0,0);
	}
	// The x ratio of the width span (0~1) map to v (0~255)
	static valueSelectorFunc(x){
		const overlap=0.1;
		let v=x*(1+overlap*2)-overlap;
		return v.clamp(0,1)*255;
	}
	static invValueSelectorFunc(v){
		const overlap=0.1;
		return (v/255+overlap)/(1+overlap*2);
	}
	
	_updateSelector(){
		const sW=this.cv.width;
		const sH=this.cv.height;
		const paletteImgData=this.ctx.createImageData(sW,sH);
		const pix=paletteImgData.data;
		
		const v=this.hsv[2];
		for(let j=0;j<sH;j++){ // col
			for(let i=0;i<sW;i++){ // row
				const id=(j*sW+i)*4;
				const x=i/sW,y=j/sH;
				const hs=V_HSSelector.dxy2hs(x,y);
				const rgb=hsv2rgb([...hs,v]);

				const qC=this.colorInfoManager.query(rgb)[1];
				
				[pix[id],pix[id+1],pix[id+2],pix[id+3]]=[...qC,255];
			}
		}
		this.ctx.putImageData(paletteImgData,0,0);
	}
	static dxy2hs(x,y){ // x,y 0~1
		const dx=2*x-1,dy=2*y-1;
		let angle=Math.atan2(dy,dx)/Math.PI+2/3; // -0.25~1.75
		if(angle<0)angle+=2; // 0~2pi
		const h=angle*180;
		const dis=Math.hypot(dx,dy).clamp(0,1);
		const s=dis*180;
		return [h,s];
	}
	static hs2dxy(h,s){ // x,y 0~1
		let angle=(h/180-2/3)*Math.PI;
		let dis=s/180;
		const x=dis*Math.cos(angle);
		const y=dis*Math.sin(angle);
		return [(x+1)/2,(y+1)/2];
	}
	_updateCursor(x,y){
		if(isNaN(x)||isNaN(y)){
			const xy=V_HSSelector.hs2dxy(this.hsv[0],this.hsv[1]);
			super._updateCursor(...xy);
		}
		else{
			super._updateCursor(x,y);
		}
	}
	_updateInfo(){
		if(this.colorInfoManager.typeID==0){
			this.hueSign.css("display","block");
			this.hueSymbol.css("display","block");
			this.hueValue.text(Math.round(this.hsv[2]*100/255));
		}
		else{
			super._updateInfo();
		}
	}
	onSelectBanner(x){ // x: 0~1 on banner
		this.hsv[2]=V_HSSelector.valueSelectorFunc(x);
		
		this.setHSV(this.hsv,true); // update banner by myself
		this._updateBanner(x);
		this._updateSelector();
		this._updateCursor(); // color may change
	}
	onSelectSelector(x,y,isPickingColor){ // (x,y): LU 0~1 in selector window
		const hs=V_HSSelector.dxy2hs(x,y);
		const newHSV=[...hs,this.hsv[2]];
		if(isPickingColor&&this.colorInfoManager.typeID){ // color range rendered
			const rgb=this.colorInfoManager.query(hsv2rgb(newHSV))[1];
			this.setRGB(rgb); // update everything
		}
		else{
			this._updateCursor(x,y);
			this._updateBanner();
			this.setHSV(newHSV,true); // no need to update selector
		}
	}
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