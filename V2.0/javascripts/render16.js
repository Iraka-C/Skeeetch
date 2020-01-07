RENDER16={};

RENDER16.strokeOverlay=function(p0,p1,p2){ // p=[x,y,pressure]
	RENDER16.drawBezierPlots(p0,p1,p2);
}

// ========================= New Algo: post rendering ===========================
/**
 * @TODO: move this to RENDER
 */
RENDER16.drawBezierPlots=function(p0,p1,p2){
	const w=RENDER.targetCanvas.width;
	const h=RENDER.targetCanvas.height;

	// radius
	let r0=RENDER.pressureToStrokeRadius(p0[2]);
	let r1=RENDER.pressureToStrokeRadius(p1[2]);
	let r2=RENDER.pressureToStrokeRadius(p2[2]);

	let maxR=Math.ceil(Math.max(r0,r1,r2));
	let wL=Math.floor(Math.min(p0[0],p1[0],p2[0])-maxR).clamp(0,w-1);
	let wH=Math.ceil(Math.max(p0[0],p1[0],p2[0])+maxR).clamp(0,w-1);
	let hL=Math.floor(Math.min(p0[1],p1[1],p2[1])-maxR).clamp(0,h-1);
	let hH=Math.ceil(Math.max(p0[1],p1[1],p2[1])+maxR).clamp(0,h-1);

	// density according to pressure: 0 <= minAlpha ~ alpha <= 1
	let d0=RENDER.pressureToStrokeOpacity(p0[2]);
	let d1=RENDER.pressureToStrokeOpacity(p1[2]);
	let d2=RENDER.pressureToStrokeOpacity(p2[2]);

	// 2-order param
	let ax=p0[0]-2*p1[0]+p2[0];
	let ay=p0[1]-2*p1[1]+p2[1];
	let ar=r0-2*r1+r2;
	let ad=d0-2*d1+d2;
	// 1-order param
	let bx=2*(p1[0]-p0[0]);
	let by=2*(p1[1]-p0[1]);
	let br=2*(r1-r0);
	let bd=2*(d1-d0);

	let quality=RENDER.quality;
	// quality means how many circles are overlayed to one pixel
	// interval is the pixel length between two circle centers

	let nx,ny,nr;
	let remL=RENDER.bezierRemDis;
	let bc=new QBezier([p0,p1,p2]);
	let kPoints=[];

	// calculate length at start
	let bLen=bc.arcLength;
	if(bLen<=remL){ // not draw in this section
		RENDER.bezierRemDis=remL-bLen;
		return;
	}

	bLen-=remL;
	for(let t=bc.getTWithLength(remL,0);!isNaN(t);){
		// draw one plate at tstart
		let t2=t*t;
		nx=ax*t2+bx*t+p0[0];
		ny=ay*t2+by*t+p0[1];
		nr=ar*t2+br*t+r0;
		nd=ad*t2+bd*t+d0;
		kPoints.push([nx,ny,nr,nd]); // add one key point

		let interval=Math.max(2*nr/quality,1);
		if(bLen<=interval){ // distance for the next
			RENDER.bezierRemDis=interval-bLen;
			break;
		}
		t=bc.getTWithLength(interval,t);
		bLen-=interval; // new length
	}
	RENDER16.renderPoints(wL,wH,hL,hH,w,kPoints);

	// submit a request to refresh the area within (wL~wH,hL~hH)
	RENDER16.requestRefresh([wL,wH,hL,hH]);
}

/**
 * render a series of key points (plate shapes) into the buffer
 * Slowest! @TODO: speed up
 */
RENDER16.renderPoints=function(wL,wH,hL,hH,w,kPoints){
	let qK=RENDER._invQuality; // 1/quality
	let rgba=[...RENDER.rgba]; // spread is the fastest
	let hd=RENDER.brush.edgeHardness;

	// first sqrt
	for(let k=0;k<kPoints.length;k++){ // each circle in sequence
		const p=kPoints[k];
		const r2=p[2]*p[2];
		const rIn=p[2]*hd; // solid radius range
		const rI2=rIn*rIn;

		const jL=Math.max(Math.ceil(p[1]-p[2]),hL); // y lower bound
		const jH=Math.min(Math.floor(p[1]+p[2]),hH); // y upper bound
		const opa=Math.round((1-Math.pow(1-p[3],qK))*0xFFFF); // plate opacity 0~65535
		const x=p[0];
		for(let j=jL;j<=jH;j++){ // y-axis
			const dy=j-p[1];
			const dy2=dy*dy;
			const sx=Math.sqrt(r2-dy2);
			const solidDx=rIn>dy?Math.sqrt(rI2-dy2):0; // dx range where is not soft edge

			const iL=Math.max(Math.ceil(x-sx),wL); // x lower bound
			const iH=Math.min(Math.floor(x+sx),wH); // x upper bound
			let idBuf=(j*w+iL)<<2;
			for(let i=iL;i<=iH;i++){ // x-axis, this part is the most time consuming
				const dx=i-x;
				if(dx<solidDx&&dx>-solidDx){ // must be solid
					rgba[3]=opa; // opacity of this point
				}
				else{ // this part is also time-consuming
					const dis2Center=Math.sqrt((dx*dx+dy2)/r2); // distance to center(0~1)
					rgba[3]=Math.floor(RENDER.softEdge(dis2Center)*opa);
				}
				RENDER.blendFunction(RENDER.buffer,idBuf,rgba,0);
				idBuf+=4; // avoid mult
			}
		}
	}
}
// =============== Displaying =================

/**
 * refresh screen in range=[wL,wH,hL,hH]
 */
/**
 * @TODO: Add performance monitor
 */
RENDER16.requestRefresh=function(range){
	let nowRange=RENDER16.requestRefresh.range;
	if(nowRange[0]>range[0])nowRange[0]=range[0]; // wL
	if(nowRange[1]<range[1])nowRange[1]=range[1]; // wH
	if(nowRange[2]>range[2])nowRange[2]=range[2]; // hL
	if(nowRange[3]<range[3])nowRange[3]=range[3]; // hH

	if(RENDER16.requestRefresh.isRequested)return; // already requested
	RENDER16.requestRefresh.isRequested=true;
	requestAnimationFrame(RENDER16._refresh);
}
RENDER16.requestRefresh.range=[Infinity,0,Infinity,0];
RENDER16.requestRefresh.isRequested=false;

/**
 * for requestAnimationFrame
 */
RENDER16._refresh=function(){
	let range=RENDER16.requestRefresh.range;
	let wL=range[0],wH=range[1];
	let hL=range[2],hH=range[3];
	let ctx=RENDER.targetContext;
	let w=RENDER.targetCanvas.width;
	// renew canvas
	// create is 5x faster than get image data
	let imgData=ctx.createImageData(wH-wL+1,hH-hL+1); // create square. smaller: faster
	let data=imgData.data;
	let buffer=RENDER.buffer;
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
	 * On some browsers putImageData is slow
	 */
	/**
	 * !NEW: ctx.drawImage has low image quality!
	 */
	// window.createImageBitmap(imgData).then(imgBitmap=>{
	// 	ctx.drawImage(imgBitmap,wL,hL);
	// });
	ctx.putImageData(imgData,wL,hL); // time is spent here
	//CANVAS.onRefreshed();
	RENDER16.requestRefresh.range=[Infinity,0,Infinity,0];
	RENDER16.requestRefresh.isRequested=false;
}

// ========================= 16 bit Pixel Blending ============================
/**
 * p1[id1..id1+3],p2[id2..id2+3]=[r,g,b,a], all 16-bits
 * Blend them in normal mode, p2 over p1, store in the same position p1
 * (renew p1[id1..id1+3])
 */
// @TODO: using pre-multiplied color for blending to speed up?
RENDER16.blendNormal=function(p1,id1,p2,id2){
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
 * Destination-out blend mode
 * for eraser
 */
RENDER16.blendDestOut=function(p1,id1,p2,id2){
	const op1=p1[id1+3],op2=p2[id2+3];
	const op=(op1*(0x10000-op2))>>>16; // blended op, shoud be (op1*(0xFFFF-op2))/0xFFFF
	// no change to color params, has nothing to do with the color of p2
	// op holds op>=0
	p1[id1+3]=op; // only change opacity
}
