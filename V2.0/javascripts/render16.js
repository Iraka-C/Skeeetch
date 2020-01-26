class CPURenderer{
	/**
	 * called before attaching to a canvas
	 */
	constructor(param){
		// context init
		this.canvas=param.canvas;
		this.ctx=this.canvas.getContext("2d");
		// @TODO: check ctx==null

		// Under certain cases, the buffer could be disabled.
		// get/putImageData is still available
		if(!param.disableBuffer){
			const imgData=param.imgData||this.ctx.getImageData( // temp imgdata for buffer
				0,0,param.canvas.width,param.canvas.height
			);
			this._initBuffer(imgData.data); // Uint8[...]
		}

		// init refresh range
		this.refreshRange=[Infinity,0,Infinity,0];
	}

	_initBuffer(data){
		this.buffer=new Uint16Array(data); // buffer containing 16bit data
		const size=data.length;
		for(let i=0;i<size;i++){ // 8bit->16bit: 0~255 -> 0~65535
			this.buffer[i]+=this.buffer[i]<<8; // *257
		}
	}

	// ====================== for each stroke =======================
	/**
	 * init before a stroke
	 */
	init(param){
		if(!this.buffer)return; // do not init without buffer

		// 16-bit color
		this.rgba=new Uint16Array([ // fill all element to 0~65535
			param.rgb[0]*257,
			param.rgb[1]*257,
			param.rgb[2]*257,
			0 // opacity info in brush
		]);

		// init operation function, there's a brush in param
		this.brush=param.brush;
		const softness=1-param.brush.edgeHardness;
		if(softness<1E-2){ // no soft edge
			this.softEdge=(()=>1); // always 1
		}
		else{ // normal soft edge
			this.softEdge=RENDER.softEdgeNormal;
		}

		// Assign render function
		if(param.isOpacityLocked){
			this.blendFunction=(this.brush.blendMode==-1)? // Erase/draw
				CPURenderer.blendDestOutOpacityLocked:
				CPURenderer.blendNormalOpacityLocked;
		}
		else{
			this.blendFunction=(this.brush.blendMode==-1)? // Erase/draw
				CPURenderer.blendDestOut:
				CPURenderer.blendNormal;
		}

		this.quality=param.quality||24; // how many circles are overlayed to one pixel. 48 for good quality
		// @TODO: auto quality
		this._invQuality=1/this.quality;
		this.bezierRemDis=0; // distance remain = 0 at first

		// render flags
		this.refreshRange=[Infinity,0,Infinity,0];
		this.isRefreshRequested=false;
	}

	/**
	 * Universal quadratic Bezier method
	 * p_i=[x_i,y_i,pressure_i]
	 */
	strokeBezier(p0,p1,p2){
		if(!this.buffer)return; // do not stroke without buffer
		
		const w=this.canvas.width;
		const h=this.canvas.height;
	
		// radius
		const r0=RENDER.pressureToStrokeRadius(p0[2],this.brush);
		const r1=RENDER.pressureToStrokeRadius(p1[2],this.brush);
		const r2=RENDER.pressureToStrokeRadius(p2[2],this.brush);
	
		const maxR=Math.ceil(Math.max(r0,r1,r2));
		const wL=Math.floor(Math.min(p0[0],p1[0],p2[0])-maxR).clamp(0,w-1);
		const wH=Math.ceil(Math.max(p0[0],p1[0],p2[0])+maxR).clamp(0,w-1);
		const hL=Math.floor(Math.min(p0[1],p1[1],p2[1])-maxR).clamp(0,h-1);
		const hH=Math.ceil(Math.max(p0[1],p1[1],p2[1])+maxR).clamp(0,h-1);
	
		// density according to pressure: 0 <= minAlpha ~ alpha <= 1
		const d0=RENDER.pressureToStrokeOpacity(p0[2],this.brush);
		const d1=RENDER.pressureToStrokeOpacity(p1[2],this.brush);
		const d2=RENDER.pressureToStrokeOpacity(p2[2],this.brush);
	
		// 2-order param
		const ax=p0[0]-2*p1[0]+p2[0];
		const ay=p0[1]-2*p1[1]+p2[1];
		const ar=r0-2*r1+r2;
		const ad=d0-2*d1+d2;
		// 1-order param
		const bx=2*(p1[0]-p0[0]);
		const by=2*(p1[1]-p0[1]);
		const br=2*(r1-r0);
		const bd=2*(d1-d0);

		// calc bezier keypoints
		const bc=new QBezier([p0,p1,p2]);
		let nx,ny,nr,nd;
		let remL=this.bezierRemDis;
		let kPoints=[];
	
		// calculate length at start
		let bLen=bc.arcLength;
		if(bLen<=remL){ // not draw in this section
			this.bezierRemDis=remL-bLen;
			return;
		}
		bLen-=remL;

		for(let t=bc.getTWithLength(remL,0);!isNaN(t);){
			// draw one plate at tstart
			const t2=t*t;
			nx=ax*t2+bx*t+p0[0];
			ny=ay*t2+by*t+p0[1];
			nr=ar*t2+br*t+r0;
			nd=ad*t2+bd*t+d0;
			kPoints.push([nx,ny,nr,nd]); // add one key point

			// interval is the pixel length between two circle centers
			let interval=Math.max(2*nr/this.quality,1);
			if(bLen<=interval){ // distance for the next
				this.bezierRemDis=interval-bLen;
				break;
			}
			t=bc.getTWithLength(interval,t); // new position
			bLen-=interval; // new length
		}
		this.renderPoints(wL,wH,hL,hH,w,kPoints);
	
		// submit a request to refresh the area within (wL~wH,hL~hH)
		this.requestRefresh([wL,wH,hL,hH]);
	}

	/**
	 * render a series of key points (plate shapes) into the buffer
	 * Slowest! @TODO: speed up
	 */
	renderPoints(wL,wH,hL,hH,w,kPoints){
		let qK=this._invQuality; // 1/quality
		let rgba=[...this.rgba]; // spread is the fastest
		let hd=this.brush.edgeHardness;
	
		// first sqrt
		for(let k=0;k<kPoints.length;k++){ // each circle in sequence
			const p=kPoints[k];
			const r2=p[2]*p[2];
			const rIn=p[2]*hd; // solid radius range
			const rI2=rIn*rIn;
	
			const jL=Math.max(Math.ceil(p[1]-p[2]),hL); // y lower bound
			const jH=Math.min(Math.floor(p[1]+p[2]),hH); // y upper bound
			const opa=(1-Math.pow(1-p[3],qK))*0xFFFF; // plate opacity 0~65535
			const x=p[0];
			for(let j=jL;j<=jH;j++){ // y-axis
				const dy=j-p[1];
				const dy2=dy*dy;
				const sx=Math.sqrt(r2-dy2);
				const solidDx=rIn>dy?Math.sqrt(rI2-dy2):0; // dx range of not soft edge
				const iL=Math.max(Math.ceil(x-sx),wL); // x lower bound
				const iH=Math.min(Math.floor(x+sx),wH); // x upper bound
				let idBuf=(j*w+iL)<<2;
				for(let i=iL;i<=iH;i++){ // x-axis, this part is the most time consuming
					const dx=i-x;
					if(dx<solidDx&&dx>-solidDx){ // must be solid
						rgba[3]=Math.round(opa); // opacity of this point
					}
					else{ // this part is also time-consuming
						// distance to center(0~1)
						const dis2Center=Math.sqrt((dx*dx+dy2)/r2);
						rgba[3]=Math.round(this.softEdge(dis2Center)*opa);
					}
					this.blendFunction(this.buffer,idBuf,rgba,0);
					idBuf+=4; // avoid mult
				}
			}
		}
	}

	/**
	 * Fill within the range=[wL,wH,hL,hH], color rgba=[r,g,b,a(0~255)]
	 */
	fillColor(rgba,range,isOpacityLocked){
		isOpacityLocked=isOpacityLocked||false;
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
		const imgData=this.ctx.createImageData(wH-wL+1,hH-hL+1);
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

	// =============== Displaying =================

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

		RENDER.onRefresh(); // call refresh callback
	}

	/**
	 * return ImageData
	 */
	getImageData(x,y,w,h){
		const cv=this.canvas;
		if(typeof(x)=="number"){ // metrics provided
			return this.ctx.getImageData(x,y,w,h);
		}
		return this.ctx.getImageData(0,0,cv.width,cv.height);
	}

	/**
	 * draw ImageData, must be the same size
	 */
	putImageData(data){
		this.ctx.putImageData(data,0,0);
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