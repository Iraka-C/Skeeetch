/*
	Written By Iraka
	Environment handlers for Sketch platform
*/

ENV={}; // Environment
ENV.paperSize={width:0,height:0,diag:0}; // diag == sqrt(x^2+y^2) == 1000px
ENV.window={
	SIZE:{width:0,height:0}, // window size, *** NOW READ ONLY! ***
	trans:{x:0,y:0}, // at the center
	rot:0.0, // 0 degree CW
	flip:false, // not flipped
	scale:1.0 // not zoomed
};

ENV.nowPenID=0;
ENV.nowPen=BRUSHES[0]; // Pencil

ENV.displayAntiAlias=false; // only on display

ENV.init=function(){ // When the page is loaded
	ENV.window.SIZE.width=$("#canvas_window").width();
	ENV.window.SIZE.height=$("#canvas_window").height();
	ENV.setPaperSize(window.screen.width,window.screen.height); // no layer yet
	LAYERS.init();
	PALETTE.init();
	EVENTS.init();
	CURSOR.init();
	NETWORK.init();
	ENV.shiftAntiAlias();
	$("#canvas_container").css("display","block");
};
$(ENV.init);

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
	//console.log("matrix("+a+","+b+","+c+","+d+","+e+","+f+")");
	//CURSOR.disfuncCursor(); // avoid a draw after the transform
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
	$("#brush_cursor_round").attr("r",ENV.nowPen.size*ratio/2);
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

ENV.translateTo=function(x,y){ // pixelated
	var borderSize=ENV.paperSize.diag*ENV.window.scale;
	if(Math.abs(x)>borderSize||Math.abs(y)>borderSize){
		//console.log("Reach Border");
		if(x>borderSize)x=borderSize;
		if(x<-borderSize)x=-borderSize;
		if(y>borderSize)y=borderSize;
		if(y<-borderSize)y=-borderSize;
	}
	ENV.window.trans.x=x;
	ENV.window.trans.y=y;
	ENV.refreshTransform();
}

ENV.transformTo=function(x,y,a,r){ // four values, with hint
	//console.log("x = "+x+" y = "+y+" a = "+a);
	if(r>8.0)r=8.0;
	if(r<0.1)r=0.1;

	ENV.window.rot=a;
	ENV.window.scale=r;

	x*=r;
	y*=r;

	var borderSize=ENV.paperSize.diag*ENV.window.scale;
	if(Math.abs(x)>borderSize||Math.abs(y)>borderSize){
		//console.log("Reach Border");
		if(x>borderSize)x=borderSize;
		if(x<-borderSize)x=-borderSize;
		if(y>borderSize)y=borderSize;
		if(y<-borderSize)y=-borderSize;
	}

	ENV.window.trans.x=x;
	ENV.window.trans.y=y;

	ENV.refreshTransform();
	/*ENV.translateTo(x,y);
	ENV.rotateTo(a);*/
	/*ENV.scaleTo(r);
	ENV.translateTo(x,y);*/

	$("#scale_info").html(Math.round(r*100)+"%");
	$("#rotate_info").html(Math.round(a)+"&deg;");
}
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

ENV.dragInit=undefined; // The Original mouse position at the start of Drag
ENV.dragTransInit=undefined; // The Original Translation at the start of Drag
ENV.translateDrag=function(event){
	var dx=event.originalEvent.offsetX-ENV.dragInit.x;
	var dy=event.originalEvent.offsetY-ENV.dragInit.y;

	var newTx=ENV.dragTransInit.x+dx;
	var newTy=ENV.dragTransInit.y+dy;
	ENV.translateTo(newTx,newTy);
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

// ================== Other Settings ====================
ENV.shiftAntiAlias=function(){
	if(ENV.displayAntiAlias){
		ENV.displayAntiAlias=false;
		$("#canvas_container").children(".layer-canvas").addClass("pixelated");
	}
	else{
		ENV.displayAntiAlias=true;
		$("#canvas_container").children(".layer-canvas").removeClass("pixelated");
	}
};

ENV.downloadCanvas=function(canvas,filename){
	var img=canvas.toDataURL("image/png");
	img=img.replace("image/png","image/octet-stream");
	var save_link=document.createElementNS("http://www.w3.org/1999/xhtml","a");
	save_link.href=img;
	save_link.download=filename;
	var event=document.createEvent("MouseEvents");
	event.initMouseEvent("click",true,false,window,0,0,0,0,0,false,false,false,false,0,null);
	save_link.dispatchEvent(event);
};

ENV.setPaperSize=function(w,h){
	if(w&&h){ // value provided
		ENV.paperSize={width:w,height:h,diag:Math.sqrt(w*w+h*h)};
	}
	$("#canvas_container").css({
		"width":ENV.paperSize.width+"px",
		"height":ENV.paperSize.height+"px"
	});

	for(var layer=LAYERS.elementsHead;layer;layer=layer.next){ // down to up
		var cv=layer.layerCanvas.canvas[0];
		var layerData=cv.getContext("2d").getImageData(0,0,ENV.paperSize.width,ENV.paperSize.height);
		//var layerPix=layerData.data;
		//tempPix=layerPix.slice(0);

		cv.width=ENV.paperSize.width;
		cv.height=ENV.paperSize.height;
		// not the previous context any more
		cv.getContext("2d").putImageData(layerData,0,0);

	}

	ENV.refreshTransform();
};

ENV.getRAMUsage=function(){ // in Bytes
	var m=0;
	var canvasRAM=ENV.paperSize.width*ENV.paperSize.height*4; // RGBW
	m+=$("#layers").children().length*canvasRAM;
	m+=LAYERS.history.length*canvasRAM;
	return m;
}
