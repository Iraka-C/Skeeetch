CANVAS={};
CANVAS.enabled=true;
CANVAS.isPressureDevice=true;
// 4 is adequate for most situations, 6 is more precise
// To high quality will lower the color precision
CANVAS.lineQuality=4;

// On paper coordinate
CANVAS.x=Number.NAN; // now
CANVAS.y=Number.NAN;
CANVAS.pressure=0;
CANVAS.x1=Number.NAN; // last
CANVAS.y1=Number.NAN;
CANVAS.pressure1=0;
CANVAS.x2=Number.NAN; // last-last
CANVAS.y2=Number.NAN;
CANVAS.pressure2=0;

CANVAS.setCanvasEnvironment=function(event){
	var cv=LAYERS.activeLayer.layerCanvas.canvas[0];
	var ctx=cv.getContext("2d");
	ctx.fillStyle=ctx.strokeStyle=PALETTE.getColorString();
	ctx.lineWidth=ENV.nowPen.size; // Brush starts thin
	ctx.lineCap="round";
	//ctx.globalAlpha=ENV.nowPen.alpha*ENV.nowPen.alpha;
	var opc=1-Math.pow(1-ENV.nowPen.alpha,2/Math.PI/CANVAS.lineQuality);
	ctx.globalAlpha=opc;
	//console.log("Real Canvas Opacity = "+opc);

	CANVAS.enabled=true;
	CANVAS.isPressureDevice=(event.originalEvent.pointerType=="pen");

	if(ENV.nowPen.name=='Eraser'){
		if(LAYERS.activeLayer.opacityLocked){ // no action
			CANVAS.enabled=false;
		}
		else{ // Erase
			ctx.globalCompositeOperation="destination-out";
		}
	}
	else{
		if(LAYERS.activeLayer.opacityLocked){ // lock opacity
			ctx.globalCompositeOperation="source-atop";
		}
		else{ // Append
			ctx.globalCompositeOperation="source-over";
		}
	}

	CANVAS.nowContext=ctx;
};

CANVAS.updateCursor=function(x,y,pressure){
	CANVAS.x2=CANVAS.x1; // last-last
	CANVAS.y2=CANVAS.y1;
	CANVAS.pressure2=CANVAS.pressure1;
	CANVAS.x1=CANVAS.x; // last
	CANVAS.y1=CANVAS.y;
	CANVAS.pressure1=CANVAS.pressure;

	var XYp=ENV.toPaperXY(x,y);
	CANVAS.x=XYp.x;
	CANVAS.y=XYp.y;
	CANVAS.pressure=pressure;
}

function dis(x1,y1,x2,y2){
	var dx=x1-x2;
	var dy=y1-y2;
	return Math.sqrt(dx*dx+dy*dy);
}

function getRadius(pressure){
	var p=CANVAS.isPressureDevice?pressure:1;
	var pRef=Math.pow(p,ENV.nowPen.sharpness);
	var r=ENV.nowPen.size/2*(ENV.nowPen.minSize*(1-pRef)+pRef);
	return r;
}

CANVAS.drawLine=function(){
	if(!(CANVAS.enabled&&CANVAS.x1&&CANVAS.x2)){
		// disabled or cursor not recorded
		return;
	}

	var ctx=CANVAS.nowContext;

	var startX=(CANVAS.x1+CANVAS.x2)/2;
	var startY=(CANVAS.y1+CANVAS.y2)/2;
	var startR=getRadius((CANVAS.pressure1+CANVAS.pressure2)/2);
	var midX=CANVAS.x1;
	var midY=CANVAS.y1;
	var midR=getRadius(CANVAS.pressure1);
	var endX=(CANVAS.x+CANVAS.x1)/2;
	var endY=(CANVAS.y+CANVAS.y1)/2;
	var endR=getRadius((CANVAS.pressure+CANVAS.pressure1)/2);

	CANVAS.drawBezierPlots(ctx,startX,startY,startR,midX,midY,midR,endX,endY,endR);
};

CANVAS.drawPlate=function(ctx,x,y,r){
	ctx.beginPath();
	ctx.arc(x,y,r,0,2*Math.PI);
	ctx.fill();
};

CANVAS.drawBezierPlots=function(ctx,x0,y0,r0,x1,y1,r1,x2,y2,r2){
	var ax=x0-2*x1+x2;
	var ay=y0-2*y1+y2;
	var ar=r0-2*r1+r2;
	var bx=2*(x1-x0);
	var by=2*(y1-y0);
	var br=2*(r1-r0);

	var nx=x0,ny=y0,nr=r0;
	var nextDis=CANVAS.drawBezierPlots.remDis;
	var lastK=0;

	for(var k=0,iter=0;;iter++){
		// Generally, if stuck, quit by force

		var dx_dk=2*ax*k+bx;
		var dy_dk=2*ay*k+by;
		var gd=Math.sqrt(dx_dk*dx_dk+dy_dk*dy_dk);
		var step=nextDis/gd;
		if(gd==0){
			// No Gradient
			CANVAS.drawBezierPlots.remDis=0;
			return;
		}
		k+=step;
		if(k!=k){
			console.log("ERROR: Bezier K = NaN");
			CANVAS.drawBezierPlots.remDis=0;
			return;
		}
		if(iter>=1000){
			console.log("ERROR: 1000 iters");
			CANVAS.drawBezierPlots.remDis=0;
			return;
		}
		if(k>=1){
			break;
		}
		var lastK=k;
		var k2=k*k;
		nx=ax*k2+bx*k+x0;
		ny=ay*k2+by*k+y0;
		nr=ar*k2+br*k+r0;
		if(nr<0)nr=0;
		CANVAS.drawPlate(ctx,nx,ny,nr);
		nextDis=Math.max(nr/CANVAS.lineQuality,1);
	}
	//console.log(lastK);
	//estimate the remain curve length
	var tx=x1*(1-lastK)+x2*lastK;
	var ty=y1*(1-lastK)+y2*lastK;
	//tx=(nx+tx*2+x2)/4;
	//ty=(ny+ty*2+y2)/4;
	var len=dis(nx,ny,tx,ty)+dis(tx,ty,x2,y2);
	CANVAS.drawBezierPlots.remDis=nr/CANVAS.lineQuality-len;
};
CANVAS.drawBezierPlots.remDis=0;
