/**
 * Renderer for a canvas context
 * A Tool class for CANVAS, visits CANVAS directly
 */
RENDER={};

/**
 * Render algorithm list
 * 0: Integration calculation method: render on a part of the image data (RENDER.strokeInt)
 * 1: Overlay circle method: render by context2d drawcircle function
 */

// ===================== Stroke rendering =======================

/**
 * Integration algorithm
 */
RENDER.strokeInt=function(p0,p1,p2){
	let ctx=CANVAS.nowContext;
	//ctx.strokeStyle="rgb("+Math.round(Math.random()*255)+","+Math.round(Math.random()*255)+","+Math.round(Math.random()*255)+")";

	// ======= for DEBUG =======
	ctx.beginPath();
	ctx.moveTo(p2[0],p2[1]);
	ctx.lineTo(p1[0],p1[1]);
	ctx.lineTo(p0[0],p0[1]);
	//ctx.quadraticCurveTo(p1[0],p1[1],p0[0],p0[1]);
	ctx.stroke();
}


/**
 * Overlay algorithm
 */

RENDER.strokeOverlay=function(p0,p1,p2){
	let ctx=CANVAS.nowContext;
	RENDER.drawBezierPlots(ctx,p0,p1,p2);
}
RENDER.strokeOverlay.quality=12;
RENDER.strokeOverlay.init=function(){
	// Initialize
	RENDER.drawBezierPlots.remDis=0; // remaining distance to the next curve
	let ctx=CANVAS.nowContext;

	// quality means how many circles are overlayed to one pixel
	ctx.globalAlpha=1-Math.pow(1-BrushManager.activeBrush.alpha/100,1/(RENDER.strokeOverlay.quality-1)); // @TODO: unify alpha-render alpha function
}

RENDER.drawPlate=function(ctx,x,y,r){
	ctx.beginPath();
	ctx.arc(x,y,r,0,2*Math.PI);
	ctx.fill();
};

RENDER.drawBezierPlots=function(ctx,p0,p1,p2){
	let ax=p0[0]-2*p1[0]+p2[0];
	let ay=p0[1]-2*p1[1]+p2[1];
	let ar=p0[2]-2*p1[2]+p2[2];
	let bx=2*(p1[0]-p0[0]);
	let by=2*(p1[1]-p0[1]);
	let br=2*(p1[2]-p0[2]);

	let quality=RENDER.strokeOverlay.quality;
	// interval is the pixel length between two circle centers

	let nx,ny,nr;
	let remL=RENDER.drawBezierPlots.remDis;
	let bc=new QBezier([p0,p1,p2]);

	// calculate length at start
	let bLen=bc.arcLength;
	if(bLen<=remL){ // not draw in this section
		RENDER.drawBezierPlots.remDis=remL-bLen;
		return;
	}

	bLen-=remL;
	for(let t=bc.getTWithLength(remL,0);!isNaN(t);){
		// draw one plate at tstart
		let t2=t*t;
		nx=ax*t2+bx*t+p0[0];
		ny=ay*t2+by*t+p0[1];
		nr=ar*t2+br*t+p0[2];
		RENDER.drawPlate(ctx,nx,ny,nr);

		let interval=Math.max(1/(quality-1)*nr,1);

		if(bLen<=interval){ // distance for the next
			RENDER.drawBezierPlots.remDis=interval-bLen;
			break;
		}

		t=bc.getTWithLength(interval,t);
		bLen-=interval; // new length
	}
}

// =================== Settings ======================

/**
 * transform from pressure to stroke width
 */
RENDER.pressureToStrokeRadius=function(pressure){
	return pressure*BrushManager.activeBrush.size/2;
}

// =========================== Tool functions ==============================

/**
 * Line l does through (x1,y1) & (x2,y2)
 * Circle c centers at (x0,y0) with radius r
 * return the intersection part length of l & c
 */
function getLineCircleIntersectionLength(x1,y1,x2,y2,x0,y0,r){
	let dx=x2-x1,dy=y2-y1;
	let dis=Math.sqrt(dx*dx+dy*dy);
	let tx=x1-x0,ty=y1-y0;
	let a=dx*dx+dy*dy;
	if(a<=1E-4)return 0;
	let b=2*(dx*tx+dy*ty);
	let c=tx*tx+ty*ty-r*r;
	let p=b/(2*a);
	let q=c/a;

	let d=p*p-q;
	if(d<=0)return 0;

	let sd=Math.sqrt(d);
	let t1=-p-sd;
	let t2=-p+sd;
	t1=Math.max(Math.min(t1,1),0);
	t2=Math.max(Math.min(t2,1),0);
	return dis*(t2-t1);
}

/**
 * Line l does through (x1,y1) & (x2,y2)
 * return the distance from l to (x0,y0)
 */
function getPointToLineDis(x1,y1,x2,y2,x0,y0){
	let dx=x2-x1,dy=y2-y1;
	let dis2_=dx*dx+dy*dy;
	if(dis2_<1E-6){
		return dis2(x0,y0,x1,y1);
	}
	return Math.abs(dx*y0-dy*x0+x1*y2-x2*y1)/Math.sqrt(dis2_);
}