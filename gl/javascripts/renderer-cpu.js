/**
 * 16-bit cpu renderer
 */
class CPURenderer extends BasicRenderer{
	constructor(canvas,param){
		super(canvas,param);
		this.ctx=canvas.getContext("2d"); // @TODO: check ctx==null

		if(!param.disableBuffer){ // if didn't mentioned creating a buffer
			if(param.imgData&&param.imgData.type=="CPURenderer"){
				this._initBuffer(param.imgData.data.data); // Uint8[...]
			}
			else{
				this._initBuffer(this.ctx.getImageData( // temp imgdata for buffer
					0,0,canvas.width,canvas.height
				).data);
			}
		}

		// init refresh range
		this.refreshRange=[Infinity,0,Infinity,0];
	}

	/**
	 * Init 16-bit buffer for drawing
	 */
	_initBuffer(data){
		this.buffer=new Uint16Array(data); // buffer containing 16bit data
		const size=data.length;
		for(let i=0;i<size;i++){ // 8bit->16bit: 0~255 -> 0~65535
			this.buffer[i]+=this.buffer[i]<<8; // *257
		}
	}

	init(param){
		if(!this.buffer)return; // do not init without buffer, if disabled
		super.init(param);

		// 16-bit color
		if(param.rgb){
			this.rgba=new Uint16Array([ // fill all element to 0~65535
				param.rgb[0]*257,
				param.rgb[1]*257,
				param.rgb[2]*257,
				0 // opacity info in brush
			]);
		}
		
		if(!this.antiAlias&&this.softness<1E-5){ // no soft edge
			this.softEdge=(()=>1); // always 1
		}
		else{ // normal soft edge
			this.softEdge=this.softEdgeNormal;
		}

		// Assign render function
		if(this.isOpacityLocked){
			this.blendFunction=(this.brush.blendMode==-1)? // Erase/draw
				CPURenderer.blendDestOutOpacityLocked:
				CPURenderer.blendNormalOpacityLocked;
		}
		else{
			this.blendFunction=(this.brush.blendMode==-1)? // Erase/draw
				CPURenderer.blendDestOut:
				CPURenderer.blendNormal;
		}

		// render flags
		this.refreshRange=[Infinity,0,Infinity,0];
		this.isRefreshRequested=false;
	}

	/**
	 * render a series of key points (plate shapes) into the buffer
	 * Slowest! @TODO: speed up
	 */
	renderPoints(wL,wH,hL,hH,kPoints){
		const w=this.canvas.width;
		let rgba=[...this.rgba]; // spread is the fastest
		const hd=this.hardness;
		const fixedSoftEdge=this.antiAlias?2:0;
	
		// first sqrt
		for(let k=0;k<kPoints.length;k++){ // each circle in sequence
			const p=kPoints[k];
			const r2=p[2]*p[2];
			const rIn=p[2]*hd-fixedSoftEdge; // solid radius range, may be Negative!
			const softRange=this.softness+fixedSoftEdge/p[2];
			const rI2=rIn>0?rIn*rIn:0; // if rIn is negative: all soft
	
			const jL=Math.max(Math.ceil(p[1]-p[2]),hL); // y lower bound
			const jH=Math.min(Math.floor(p[1]+p[2]),hH); // y upper bound
			// The 2-hd is to compensate the soft edge opacity
			const opa=p[3]*0xFFFF; // plate opacity 0~65535

			const x=p[0];
			for(let j=jL;j<=jH;j++){ // y-axis
				const dy=j-p[1];
				const dy2=dy*dy;
				const sx=Math.sqrt(r2-dy2);
				const solidDx=rI2>dy2?Math.sqrt(rI2-dy2):0; // dx range of not soft edge
				const iL=Math.max(Math.ceil(x-sx),wL); // x lower bound
				const iH=Math.min(Math.floor(x+sx),wH); // x upper bound
				let idBuf=(j*w+iL)<<2;
				for(let i=iL;i<=iH;i++){ // x-axis, this part is the most time consuming
					const dx=i-x;
					if(dx<solidDx&&dx>-solidDx){ // must be solid
						rgba[3]=Math.min(Math.round(opa),0xFFFF); // opacity of this point
					}
					else{ // this part is also time-consuming
						// distance to center(0~1)
						const dis2Center=Math.sqrt((dx*dx+dy2)/r2);
						rgba[3]=Math.min(Math.round(this.softEdge((1-dis2Center)/softRange)*opa),0xFFFF);
					}
					this.blendFunction(this.buffer,idBuf,rgba,0);
					idBuf+=4; // avoid mult
				}
			}
		}

		// submit a request to refresh the area within (wL~wH,hL~hH)
		this.requestRefresh([wL,wH,hL,hH]);
	}

	/**
	 * refresh screen in range=[wL,wH,hL,hH]
	 */
	/**
	 * @TODO: Add performance monitor
	 */
	requestRefresh(range){
		let nowRange=this.refreshRange;
		if(nowRange[0]>range[0])nowRange[0]=range[0]; // wL
		if(nowRange[1]<range[1])nowRange[1]=range[1]; // wH
		if(nowRange[2]>range[2])nowRange[2]=range[2]; // hL
		if(nowRange[3]<range[3])nowRange[3]=range[3]; // hH

		if(this.isRefreshRequested){
			return; // already requested
		}
		this.isRefreshRequested=true;
		requestAnimationFrame(()=>this._refresh()); // refresh canvas at next frame
	}

	/**
	 * for requestAnimationFrame
	 */
	_refresh(){
		const range=this.refreshRange;
		const wL=range[0],wH=range[1];
		const hL=range[2],hH=range[3];
		const w=this.canvas.width;
		if(wL>wH||hL>hH)return; // not renewed
		// renew canvas
		// create is 5x faster than get image data
		// create square. smaller: faster
		const imgData=this.ctx.createImageData(wH-wL+1,hH-hL+1);
		const data=imgData.data;
		const buffer=this.buffer;
		let idImg=0;
		for(let j=hL;j<=hH;j++){ // copy content
			let idBuf=(j*w+wL)<<2;
			for(let i=wL;i<=wH;i++){ // It's OK to keep it this way
				data[idImg]=buffer[idBuf]/257; // not that time consuming
				data[idImg+1]=buffer[idBuf+1]/257;
				data[idImg+2]=buffer[idBuf+2]/257;
				data[idImg+3]=buffer[idBuf+3]/257;
				idImg+=4; // Avoid mult
				idBuf+=4;
			}
		}
	
		/**
		 * These methods spend almost the same time: drawImage spent on painting
		 * Need to be tested over more browsers
		 * On some browsers putImageData is slow*/
		// window.createImageBitmap(imgData,{ // low quality !
		// 	resizeQuality:"high"
		// }).then(imgBitmap=>{
		// 	this.ctx.drawImage(imgBitmap,wL,hL);
		// });
		this.ctx.putImageData(imgData,wL,hL); // time is spent here
		this.refreshRange=[Infinity,0,Infinity,0];
		this.isRefreshRequested=false;

		this.onRefresh(); // call refresh callback
	}

	fillColor(rgba,range,isOpacityLocked){
		if(!range)range=[0,this.canvas.width,0,this.canvas.height];
		const rgba16=new Uint16Array([ // fill all element to 0~65535
			rgba[0]*257,
			rgba[1]*257,
			rgba[2]*257,
			rgba[3]*257
		]);
		
		// Fill buffer
		const wL=range[0],wH=range[1];
		const hL=range[2],hH=range[3];
		const w=this.canvas.width;
		const buffer=this.buffer;
		for(let j=hL;j<hH;j++){ // copy content
			let idBuf=(j*w+wL)<<2;
			for(let i=wL;i<wH;i++){
				buffer[idBuf]=rgba16[0];
				buffer[idBuf+1]=rgba16[1];
				buffer[idBuf+2]=rgba16[2];
				buffer[idBuf+3]=isOpacityLocked?buffer[idBuf+3]:rgba16[3];
				idBuf+=4;
			}
		}

		// Fill image data
		const imgData=this.ctx.getImageData(wL,hL,wH-wL+1,hH-hL+1);
		const data=imgData.data;
		let idImg=0;
		for(let j=hL;j<=hH;j++){ // copy content
			for(let i=wL;i<=wH;i++){ // It's OK to keep it this way
				data[idImg]=rgba[0]; // not that time consuming
				data[idImg+1]=rgba[1];
				data[idImg+2]=rgba[2];
				data[idImg+3]=isOpacityLocked?data[idImg+3]:rgba[3];
				idImg+=4; // Avoid mult
			}
		}
		this.ctx.putImageData(imgData,wL,hL);
	}

	/**
	 * return ImageData
	 */
	getImageData(x,y,w,h){
		const cv=this.canvas;
		if(typeof(x)=="number"){ // metrics provided
			return {
				type:"CPURenderer",
				data:this.ctx.getImageData(x,y,w,h)
			};
		}
		return {
			type:"CPURenderer",
			data:this.ctx.getImageData(0,0,cv.width,cv.height)
		};
	}

	/**
	 * draw ImageData, must be the same size
	 */
	putImageData(imgData,x,y){
		if(imgData.type=="CPURenderer"){
			this.ctx.putImageData(imgData.data,x||0,y||0);
			if(this.buffer){ // buffer enabled
				const cv=this.canvas;
				this._initBuffer(this.ctx.getImageData(0,0,cv.width,cv.height));
			}
		}
	}

	putImageData8bit(imgData,x,y){ // imgData is a image data from context2d
		this.ctx.putImageData(imgData,x||0,y||0);
		if(this.buffer){ // buffer enabled
			const cv=this.canvas;
			this._initBuffer(this.ctx.getImageData(0,0,cv.width,cv.height));
		}
	}

	// ============= tools ==============

	/**
	 * p1[id1..id1+3],p2[id2..id2+3]=[r,g,b,a], all 16-bits
	 * Blend them in normal mode, p2 over p1, store in the same position p1
	 * (renew p1[id1..id1+3])
	 */
	// @TODO: using pre-multiplied color for blending to speed up?
	static blendNormal(p1,id1,p2,id2){
		const op1=p1[id1+3],op2=p2[id2+3];
		// blended op, should be (op2*op1)/0xFFFF. The difference is negligible
		// @TODO: op==0?
		const op=Math.min(op2+op1-((op2*op1)>>>16),0xFFFF);
		const k=op2/op;
		p1[id1]+=k*(p2[id2]-p1[id1]);
		p1[id1+1]+=k*(p2[id2+1]-p1[id1+1]);
		p1[id1+2]+=k*(p2[id2+2]-p1[id1+2]);
		p1[id1+3]=op;
	}

	/**
	 * p1[id1..id1+3],p2[id2..id2+3]=[r,g,b,a], all 16-bits
	 * Blend them in normal mode, p2 over p1, store in the same position p1
	 * (renew p1[id1..id1+3])
	 * The opacity of p1 doesn't change
	 */
	static blendNormalOpacityLocked(p1,id1,p2,id2){
		const op1=p1[id1+3],op2=p2[id2+3];
		const op=Math.min(op2+op1-((op2*op1)>>>16),0xFFFF);
		const k=op2/op;
		p1[id1]+=k*(p2[id2]-p1[id1]);
		p1[id1+1]+=k*(p2[id2+1]-p1[id1+1]);
		p1[id1+2]+=k*(p2[id2+2]-p1[id1+2]);
	}

	/**
	 * Destination-out blend mode
	 * for eraser
	 */
	static blendDestOut(p1,id1,p2,id2){
		const op1=p1[id1+3],op2=p2[id2+3];
		const op=(op1*(0x10000-op2))>>>16;
		// blended op, shoud be (op1*(0xFFFF-op2))/0xFFFF
		// no change to color params, has nothing to do with the color of p2
		// op holds op>=0
		p1[id1+3]=op; // only change opacity
	}

	/**
	 * Destination-out blend mode
	 * for eraser
	 * Opacity doesn't change, mix with white color
	 */
	static blendDestOutOpacityLocked(p1,id1,p2,id2){
		const op1=p1[id1+3],op2=p2[id2+3];
		const op=Math.min(op2+op1-((op2*op1)>>>16),0xFFFF);
		const k=op2/op;
		p1[id1]+=k*(0xFFFF-p1[id1]);
		p1[id1+1]+=k*(0xFFFF-p1[id1+1]);
		p1[id1+2]+=k*(0xFFFF-p1[id1+2]);
	}
}