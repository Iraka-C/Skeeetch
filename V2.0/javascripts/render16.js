RENDER16={};
RENDER16.strokeOverlay=function(p0,p1,p2){ // p=[x,y,pressure]
	let ctx=CANVAS.nowContext;
	RENDER16.drawBezierPlots(ctx,p0,p1,p2);
}
RENDER16.strokeOverlay.quality=10;
RENDER16.strokeOverlay.init=function(){
	RENDER16.drawBezierPlots.remDis=0; // remaining distance to the next curve
	RENDER16.rgba=[ // 16bit color
		PALETTE.rgb[0]*256,
		PALETTE.rgb[1]*256,
		PALETTE.rgb[2]*256
	]; // @TODO: change this to canvas init later
	let opa=1-Math.pow(1-BrushManager.activeBrush.alpha/100,1/(RENDER16.strokeOverlay.quality-1)); // 0~1
	RENDER16.rgba[3]=Math.round(opa*255*256); // 0~65536
	// quality means how many circles are overlayed to one pixel
	/*ctx.globalAlpha=1-Math.pow(1-BrushManager.activeBrush.alpha/100,1/(RENDER16.strokeOverlay.quality-1));*/

}

// ========================= New Algo: post rendering ===========================
RENDER16.drawBezierPlots=function(ctx,p0,p1,p2){
	let w=ctx.canvas.width,h=ctx.canvas.height;

	// radius
	let r0=RENDER.pressureToStrokeRadius(p0[2]);
	let r1=RENDER.pressureToStrokeRadius(p1[2]);
	let r2=RENDER.pressureToStrokeRadius(p2[2]);

	let maxR=Math.ceil(Math.max(r0,r1,r2));
	let wL=Math.floor(Math.min(p0[0],p1[0],p2[0])-maxR).clamp(0,w-1);
	let wH=Math.ceil(Math.max(p0[0],p1[0],p2[0])+maxR).clamp(0,w-1);
	let hL=Math.floor(Math.min(p0[1],p1[1],p2[1])-maxR).clamp(0,h-1);
	let hH=Math.ceil(Math.max(p0[1],p1[1],p2[1])+maxR).clamp(0,h-1);

	// density
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

	let quality=RENDER16.strokeOverlay.quality;
	// interval is the pixel length between two circle centers

	let nx,ny,nr;
	let remL=RENDER16.drawBezierPlots.remDis;
	let bc=new QBezier([p0,p1,p2]);
	let kPoints=[];

	// calculate length at start
	let bLen=bc.arcLength;
	if(bLen<=remL){ // not draw in this section
		RENDER16.drawBezierPlots.remDis=remL-bLen;
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
		kPoints.push([nx,ny,nr,nd]);

		let interval=Math.max(1/(quality-1)*nr,1);
		if(bLen<=interval){ // distance for the next
			RENDER16.drawBezierPlots.remDis=interval-bLen;
			break;
		}

		t=bc.getTWithLength(interval,t);
		bLen-=interval; // new length
	}
	RENDER16.renderPoints(wL,wH,hL,hH,w,kPoints,quality);

	RENDER16.requestRefresh([wL,wH,hL,hH]);
}

/**
 * render a series of key points
 * Slowest! @TODO: speed up
 */
RENDER16.renderPoints=function(wL,wH,hL,hH,w,kPoints,quality){
	let qK=1/(quality-1);
	let rgba=[...RENDER16.rgba]; // spread is the fastest
	let initOpa=RENDER16.rgba[3];

	// first sqrt
	for(let k=0;k<kPoints.length;k++){ // each circle in sequence
		let p=kPoints[k];
		let r2=p[2]*p[2];
		let jL=Math.max(Math.ceil(p[1]-p[2]),hL);
		let jH=Math.min(Math.floor(p[1]+p[2]),hH);
		let opa=1-Math.pow(1-p[3],qK); // plate opacity 0~1
		opa*=initOpa; // 0~65535
		for(let j=jL;j<=jH;j++){
			let jw=j*w;
			let dy=j-p[1];
			let dx=Math.sqrt(r2-dy*dy);
			let iL=Math.max(Math.ceil(p[0]-dx),wL);
			let iH=Math.min(Math.floor(p[0]+dx),wH);
			let idBuf=(jw+iL)<<2;
			for(let i=iL;i<=iH;i++){
				//let idBuf=(jw+i)<<2;
				let dx=i-p[0];
				let dis2Center=Math.sqrt((dx*dx+dy*dy)/r2); // distance to center(0~1)
				rgba[3]=Math.round(RENDER.softEdge(dis2Center)*opa);
				RENDER16.blendNormal(CANVAS.buffer,idBuf,rgba,0);
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
	let ctx=CANVAS.nowContext;
	let w=ctx.canvas.width;
	// renew canvas
	// create is 5x faster than get image data
	let dw=wH-wL+1;
	let imgData=ctx.createImageData(dw,hH-hL+1); // create square. smaller: faster
	let data=imgData.data;
	let buffer=CANVAS.buffer;
	let idImg=0;
	for(let i=hL;i<=hH;i++){ // copy content
		let iw=i*w;
		for(let j=wL;j<=wH;j++){
			//let idImg=((i-hL)*dw+(j-wL))<<2;
			let idBuf=(iw+j)<<2;
			data[idImg]=buffer[idBuf]>>8;
			data[idImg+1]=buffer[idBuf+1]>>8;
			data[idImg+2]=buffer[idBuf+2]>>8;
			data[idImg+3]=buffer[idBuf+3]>>8;
			idImg+=4; // Avoid mult
		}
	}
	ctx.putImageData(imgData,wL,hL);
	CANVAS.onRefreshed();
	RENDER16.requestRefresh.range=[Infinity,0,Infinity,0];
	RENDER16.requestRefresh.isRequested=false;
}

// ========================= 16 bit Pixel Blending ============================
/**
 * p1[id1..id1+3],p2[id2..id2+3]=[r,g,b,a], all 16-bits
 * Blend them in normal mode, p2 over p1, store in the same position p1
 * (renew p1[id1..id1+3])
 */
RENDER16.blendNormal=function(p1,id1,p2,id2){
	let op1=p1[id1+3],op2=p2[id2+3];
	let op=op2+op1-((op2*op1)>>16); // blended op
	let k=op2/op;
	p1[id1]+=k*(p2[id2]-p1[id1]);
	p1[id1+1]+=k*(p2[id2+1]-p1[id1+1]);
	p1[id1+2]+=k*(p2[id2+2]-p1[id1+2]);
	let newOp=Math.max(op,op1+1); // at least +1
	p1[id1+3]=Math.min(newOp,0xFFFF); // 255*256+ is also valid for a=1.0
}
