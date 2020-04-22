class H_SVSelector extends PaletteSelector{
	constructor(rgb){
		super(rgb);
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
			let aM=1-(pM*2<1?pM*2:1); // gradient opacity
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

				pix[id]=rP;
				pix[id+1]=gP;
				pix[id+2]=bP;
				// pix[id]=webC[0];
				// pix[id+1]=webC[1];
				// pix[id+2]=webC[2];
				pix[id+3]=255;
			}
		}
		this.ctx.putImageData(paletteImgData,0,0);
	}
	_setCursor(){
		const $cv=$(this.cv);
		const cW=$cv.width();
		const cH=$cv.height();
		this.cursor.attr({
			"cx":this.hsv[1]/180*cW,
			"cy":(1-this.hsv[2]/255)*cH,
			"stroke":this.hsv[2]>150?"#000000":"#ffffff"
		});
	}
	_setInfo(){
		$("#palette-hue-value").text(Math.round(this.hsv[0]));
	}
	onSelectBanner(x){ // x: 0~1 on banner
		this.hsv[0]=H_SVSelector.hueSelectorFunc(x);
		
		this.setHSV(this.hsv,false); // update banner by myself
		this._updateBanner(x);
		this._updateSelector();
	}
	onSelectSelector(x,y){ // (x,y): LU 0~1 in selector window
		let newS=x*180;
		let newV=(1-y)*255;
		this.setHSV([this.hsv[0],newS,newV],true); // no need to update canvas
	}
	setRGB(rgb,isSelfCall){
		super.setRGB(rgb);
		if(!isSelfCall){
			this._updateBanner();
			this._updateSelector();
		}
	}
	setHSV(hsv,isSelfCall){
		super.setHSV(hsv);
		if(!isSelfCall){
			this._updateBanner();
			this._updateSelector();
		}
	}
};