/*
	Written By Iraka
	Environment handlers for Sketch platform
*/

ENV={}; // Environment
ENV.paperSize={width:800,height:600,diag:1000}; // diag == sqrt(x^2+y^2) == 1000px
ENV.window={
	SIZE:{width:0,height:0}, // window size, *** NOW READ ONLY! ***
	trans:{x:0,y:0}, // at the center
	rot:0.0, // 0 degree CW
	flip:false, // not flipped
	scale:1.0 // not zoomed
};

ENV.nowPenID=0;
ENV.nowPen=BRUSHES[0]; // Pencil

ENV.init=function(){ // When the page is loaded
	ENV.window.SIZE.width=$("#canvas_window").width();
	ENV.window.SIZE.height=$("#canvas_window").height();
	ENV.setPaperSize();
	LAYERS.init();
	PALETTE.init();
	EVENTS.init();
	CURSOR.init();
	$("#canvas_container").css("display","block");
};
$(ENV.init);

ENV.setPaperSize=function(w,h){
	if(w&&h){
		ENV.paperSize={width:w,height:h,diag:Math.sqrt(w*w+h*h)};
	}
	$("#canvas_container").css({
		"width":ENV.paperSize.width+"px",
		"height":ENV.paperSize.height+"px"
	});
	ENV.refreshTransform();
};

ENV.refreshTransform=function(){
	var cpw=ENV.window.SIZE.width;
	var cph=ENV.window.SIZE.height;

	var transCX=-ENV.paperSize.width/2;
	var transCY=-ENV.paperSize.height/2;

	var rot=ENV.window.rot/180*Math.PI;
	var rotS=Math.sin(rot);
	var rotC=Math.cos(rot);
	var scale=ENV.window.scale;
	var flip=ENV.window.flip?-1:1;

	var transWX=cpw/2+ENV.window.trans.x;
	var transWY=cph/2+ENV.window.trans.y;

	var c=-scale*rotS;
	var d=scale*rotC;
	var a=d*flip;
	var b=-c*flip;

	var e=transCX+transWX;
	var f=transCY+transWY;

	$("#canvas_container").css("transform",
		"matrix("+a+","+b+","+c+","+d+","+e+","+f+")"
	);
};

ENV.toPaperXY=function(x,y){
	// (x,y) is the coordinate under canvas window
	// transform it to the coordinate of paper
	var xp=x-ENV.window.SIZE.width/2-ENV.window.trans.x;
	var yp=y-ENV.window.SIZE.height/2-ENV.window.trans.y;

	var rot=ENV.window.rot/180*Math.PI;
	var rotS=Math.sin(rot);
	var rotC=Math.cos(rot);
	var xr=rotC*xp+rotS*yp;
	var yr=rotC*yp-rotS*xp;

	var scale=ENV.window.scale;
	var flip=ENV.window.flip?-1:1;
	var xc=xr*flip/scale+ENV.paperSize.width/2;
	var yc=yr/scale+ENV.paperSize.height/2;

	return {x:xc,y:yc};
};

ENV.scaleTo=function(ratio){
	var r=ENV.window.scale;
	ENV.window.scale=ratio;
	var tr=ratio/r;
	ENV.window.trans.x*=tr;
	ENV.window.trans.y*=tr;
	ENV.refreshTransform();
};

ENV.rotateTo=function(angle){ // degree
	var r=ENV.window.rot;
	ENV.window.rot=angle;
	var tx=ENV.window.trans.x;
	var ty=ENV.window.trans.y;

	var dr=(angle-r)/180*Math.PI;
	var Cr=Math.cos(dr);
	var Sr=Math.sin(dr);
	ENV.window.trans.x=Cr*tx-Sr*ty;
	ENV.window.trans.y=Sr*tx+Cr*ty;
	ENV.refreshTransform();
};

// ================== Operations =========================

ENV.scaleScrollRatio=1.1;
ENV.scaleScroll=function(event){
	var e=event.originalEvent;
	var scale=ENV.window.scale;
	if(e.wheelDelta>0&&scale<8){
		scale*=ENV.scaleScrollRatio;
	}
	if(e.wheelDelta<0&&scale>0.1){
		scale/=ENV.scaleScrollRatio;
	}
	$("#scale_info").html(Math.round(scale*100)+"%");
	ENV.scaleTo(scale);
};

ENV.rotateScrollStep=5; // 5 degree
ENV.rotateScroll=function(event){
	var e=event.originalEvent;
	var rot=ENV.window.rot;
	if(e.wheelDelta>0){
		rot+=ENV.rotateScrollStep;
		if(rot>180){
			rot-=360;
		}
	}
	else if(e.wheelDelta<0){
		rot-=ENV.rotateScrollStep;
		if(rot<=-180){
			rot+=360;
		}
	}

	$("#rotate_info").html(Math.round(rot)+"&deg;");
	ENV.rotateTo(rot);
};

ENV.translateDrag=function(){
	if(!CURSOR.x||!CURSOR.x1){ // not recorded
		return;
	}
	var dx=CURSOR.x-CURSOR.x1;
	var dy=CURSOR.y-CURSOR.y1;
	var newTx=ENV.window.trans.x+dx;
	var newTy=ENV.window.trans.y+dy;
	var borderSize=ENV.paperSize.diag*ENV.window.scale;
	if(Math.abs(newTx)>borderSize||Math.abs(newTy)>borderSize){
		console.log("Reach Border");
		if(newTx>borderSize)newTx=borderSize;
		if(newTx<-borderSize)newTx=-borderSize;
		if(newTy>borderSize)newTy=borderSize;
		if(newTy<-borderSize)newTy=-borderSize;
	}
	ENV.window.trans.x=newTx;
	ENV.window.trans.y=newTy;
	ENV.refreshTransform();
};

// ======================== Brush ===================
ENV.shiftBrush=function(){
	ENV.nowPenID++;
	if(ENV.nowPenID>=BRUSHES.num){
		ENV.nowPenID=0;
	}
	ENV.nowPen=BRUSHES[ENV.nowPenID];
	$("#brush_type").html(ENV.nowPen.name);
	BRUSHES.setNowBrushSize(ENV.nowPen.size);
};
