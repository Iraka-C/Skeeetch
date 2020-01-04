RENDER16={};
RENDER16.strokeOverlay=function(p0,p1,p2){
	let ctx=CANVAS.nowContext;
	RENDER16.drawBezierPlots(ctx,p0,p1,p2);
}
RENDER16.strokeOverlay.quality=20;
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
	let maxR=Math.ceil(Math.max(p0[2],p1[2],p2[2]));
	let wL=Math.floor(Math.min(p0[0],p1[0],p2[0])-maxR).clamp(0,w-1);
	let wH=Math.ceil(Math.max(p0[0],p1[0],p2[0])+maxR).clamp(0,w-1);
	let hL=Math.floor(Math.min(p0[1],p1[1],p2[1])-maxR).clamp(0,h-1);
	let hH=Math.ceil(Math.max(p0[1],p1[1],p2[1])+maxR).clamp(0,h-1);

	let ax=p0[0]-2*p1[0]+p2[0];
	let ay=p0[1]-2*p1[1]+p2[1];
	let ar=p0[2]-2*p1[2]+p2[2];
	let bx=2*(p1[0]-p0[0]);
	let by=2*(p1[1]-p0[1]);
	let br=2*(p1[2]-p0[2]);

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
		nr=ar*t2+br*t+p0[2];
		kPoints.push([nx,ny,nr])

		let interval=Math.max(1/(quality-1)*nr,1);
		if(bLen<=interval){ // distance for the next
			RENDER16.drawBezierPlots.remDis=interval-bLen;
			break;
		}

		t=bc.getTWithLength(interval,t);
		bLen-=interval; // new length
	}
	RENDER16.renderPoints(wL,wH,hL,hH,w,kPoints);

	// renew canvas
	// create is 5x faster than get image data
	let dw=wH-wL+1;
	let imgData=ctx.createImageData(dw,hH-hL+1); // create square. smaller: faster
	let data=imgData.data;
	for(let i=hL;i<=hH;i++){ // copy content
		for(let j=wL;j<=wH;j++){
			let idImg=((i-hL)*dw+(j-wL))<<2;
			let idBuf=(i*w+j)<<2;
			data[idImg]=CANVAS.buffer[idBuf]>>8;
			data[idImg+1]=CANVAS.buffer[idBuf+1]>>8;
			data[idImg+2]=CANVAS.buffer[idBuf+2]>>8;
			data[idImg+3]=CANVAS.buffer[idBuf+3]>>8;
		}
	}
	ctx.putImageData(imgData,wL,hL);
}

/**
 * render a series of key points
 */
RENDER16.renderPoints=function(wL,wH,hL,hH,w,kPoints){
	for(let i=hL;i<=hH;i++){
		for(let j=wL;j<=wH;j++){
			let idBuf=(i*w+j)<<2;
			for(let k=0;k<kPoints.length;k++){
				let p=kPoints[k];
				let dx=j-p[0],dy=i-p[1];
				if(dx*dx+dy*dy<p[2]*p[2]){
					RENDER16.blendNormal(CANVAS.buffer,idBuf,RENDER16.rgba,0);
				}
			}
		}
	}
}

// ========================= 16 bit Pixel Blending ============================
/**
 * p1[id1..id1+3],p2[id2..id2+3]=[r,g,b,a], all 16-bits
 * Blend them in normal mode, p2 over p1, store in the same position p1
 * (renew p1[id1..id1+3])
 */
RENDER16.blendNormal=function(p1,id1,p2,id2){
	let op=p2[id2+3]+p1[id1+3]-((p2[id2+3]*p1[id1+3])>>16); // blended op
	let k=p2[id2+3]/op;
	p1[id1]+=k*(p2[id2]-p1[id1]);
	p1[id1+1]+=k*(p2[id2+1]-p1[id1+1]);
	p1[id1+2]+=k*(p2[id2+2]-p1[id1+2]);
	let newOp=Math.max(op,p1[id1+3]+1); // at least +1
	p1[id1+3]=Math.min(newOp,0xFFFF); // 255*256+ is also valid for a=1.0
}