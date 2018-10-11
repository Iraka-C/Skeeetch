EVENTS={};

EVENTS.isShiftDown=false;
EVENTS.isCtrlDown=false;
EVENTS.isAltDown=false;

EVENTS.init=function(){
	EVENTS.wheelEventDistributor.init();

	$("html").on("contextmenu",()=>false);
	$(window).on("resize",()=>{
		ENV.window.SIZE.width=$("#canvas_window").width();
		ENV.window.SIZE.height=$("#canvas_window").height();
		ENV.refreshTransform();
		CURSOR.refreshBrushLayerSize();
	});

	$("html").on("keydown",EVENTS.onKeyDown);
	$("html").on("keyup",EVENTS.onKeyUp);

	$("#canvas_window").on("pointerover",event=>{
		CURSOR.showCursor(event);
	});
	$("#canvas_window").on("pointermove",event=>{
		CURSOR.moveCursor(event);
		if(CURSOR.isDown){
			if(EVENTS.isShiftDown){ // pan
				ENV.translateDrag(event);
			}
			else{ // draw
				CANVAS.drawLine();
			}
		}
	});
	$("#canvas_window").on("pointerout",CURSOR.hideCursor);

	// DOWN / UP outside the window
	$("html").on("pointerdown",event=>{
		if(event.originalEvent.button==0){ // left / pen
			CANVAS.setCanvasEnvironment(event);
			ENV.dragInit={x:event.originalEvent.offsetX,y:event.originalEvent.offsetY};
			ENV.dragTransInit={x:ENV.window.trans.x,y:ENV.window.trans.y};
			CURSOR.pointerDown();
		}
		else{
			var paperPoint=ENV.toPaperXY(event.originalEvent.offsetX,event.originalEvent.offsetY);
			PIXEL.pickColor(paperPoint.x,paperPoint.y);
		}
	});
	$("html").on("pointerup",event=>{
		if(event.originalEvent.button==0){ // left
			if(event.target==$("#canvas_window")[0]){ // on canvas
				CURSOR.moveCursor(event);
				if(!EVENTS.isShiftDown){ // end of the line
					CANVAS.drawLine();
				}
			}
			CURSOR.pointerUp(event);
			if(CANVAS.isVisited){ // content changed
				LAYERS.addHistory(LAYERS.activeLayer,CANVAS.imgDataAtInit,"draw");
			}
		}

	});

	/*var events=[
		"pointerover","pointerdown","pointermove",
		"MSPointerOver","MSPointerDown","MSPointerMov",
		"pointerup","pointerout","pointercancel",
		"MSPointerUp","MSPointerOut","MSPointerCancel"
	];*/

	EVENTS.wheelEventDistributor.addListener($("#scale_info"),ENV.scaleScroll);
	EVENTS.wheelEventDistributor.addListener($("#canvas_window"),ENV.scaleScroll);
	EVENTS.wheelEventDistributor.addListener($("#rotate_info"),ENV.rotateScroll);

	// reset
	$("#scale_info").on("click",()=>{ // reset scale
		$("#scale_info").html("100%");
		ENV.scaleTo(1);
	});
	$("#rotate_info").on("click",()=>{ // reset rotate
		$("#rotate_info").html("0&deg;");
		ENV.rotateTo(0);
	});
	$("#reset_info").on("click",()=>{ // reset rotate
		if(NETWORK.isWorking){
			NETWORK.toInitTransform=true;
		}
		else{
			$("#rotate_info").html("0&deg;");
			ENV.transformTo(0,0,0,1);
		}
	});

	$("#brush_type").on("click",event=>{ENV.shiftBrush();EVENTS.refreshSettingPanel();});
	EVENTS.wheelEventDistributor.addListener($("#brush_size"),BRUSHES.changeNowBrushSize);
	EVENTS.wheelEventDistributor.addListener($("#palette_menus"),PALETTE.changeBrightnessEvent);
	$("#palette_menus").on("click",()=>{
		var pp=$("#palette_panel");
		pp.css("height",pp.height()?"0px":PALETTE.panelHeight+"px");
	});

	$("#setting_button").on("click",()=>{ // shift setting panels
		var pp=$("#setting_panel");
		var isOpen=pp.width()?true:false;
		if(!isOpen){ // to Open
			EVENTS.refreshSettingPanel();
		}
		pp.css("width",isOpen?"0em":"13em");
	});

	$("#export_button").on("click",()=>{ // export image
		var cv=PIXEL.blendLayers();
		ENV.downloadCanvas(cv,$("#filename_input")[0].value+".png");
	});

	EVENTS.refreshSettingPanel();
	EVENTS.initSettingButtons();
	EVENTS.initFileHandler();
};

EVENTS.onKeyDown=function(event){
	if(event.shiftKey==1&&EVENTS.isShiftDown==false){
		// Shift Pressed
		EVENTS.isShiftDown=true;
		// Special: Translation DRAG
		ENV.dragInit={x:CURSOR.x,y:CURSOR.y};
		ENV.dragTransInit={x:ENV.window.trans.x,y:ENV.window.trans.y};
	}
	if(event.ctrlKey==1&&EVENTS.isCtrlDown==false){
		// Ctrl Pressed
		EVENTS.isCtrlDown=true;
	}
	if(event.altKey==1&&EVENTS.isAltDown==false){
		// Alt Pressed
		EVENTS.isAltDown=true;
	}
	if(event.which==90){ // z
		if(EVENTS.isCtrlDown){
			LAYERS.undo();
		}
	}
};

EVENTS.onKeyUp=function(event){
	if(event.shiftKey==0&&EVENTS.isShiftDown==true){
		// Shift Left
		EVENTS.isShiftDown=false;
	}
	if(event.ctrlKey==0&&EVENTS.isCtrlDown==true){
		// Ctrl Left
		EVENTS.isCtrlDown=false;
	}
	if(event.altKey==0&&EVENTS.isAltDown==true){
		// Alt Left
		EVENTS.isAltDown=false;
	}
};

EVENTS.wheelEventDistributor={
	init:function(){
		$(window).on("wheel",event=>this.onwheel(event));
	},
	nowListener:undefined, // a DOM Object
	nowFunction:()=>{}, // a function
	addListener:function(element,func){ // element is a jQuery Object
		var el=element[0];
		// The only hack: Deal with record during capture stage
		el.addEventListener("pointerover",event=>{
			//console.log("Element In");
			//console.log(el);
			this.nowListener=el;
			this.nowFunction=func;
		},true);
		el.addEventListener("pointerout",event=>{
			if(event.target==el){
				//console.log("Element Out");
				//console.log(el);
				this.nowListener=undefined;
			}
		},true);
	},
	onwheel:function(event){
		//console.log("wheel");
		if(this.nowListener&&this.nowFunction){
			//console.log("wheel deliver");
			this.nowFunction(event);
		}
	}
};

// ======================= Button Handlers ==========================

EVENTS.to2Digits=v=>{
	var r=v>0.4?10:20;
	return (Math.round(v*r)/r).toFixed(2);
}

EVENTS.initSettingButtons=function(){
	EVENTS.wheelEventDistributor.addListener($("#pen_density_block"),event=>{
		var e=event.originalEvent;
		var pd=ENV.nowPen.alpha;
		if(e.wheelDelta>0&&pd<100)pd+=5;
		if(e.wheelDelta<0&&pd>5)pd-=5;
		ENV.nowPen.alpha=pd;
		$("#pen_density_block").children(".setting-item-right").html(pd);
	});
	EVENTS.wheelEventDistributor.addListener($("#pen_sharpness_block"),event=>{
		var e=event.originalEvent;
		var sp=ENV.nowPen.sharpness;
		if(e.wheelDelta>0&&sp<4)sp*=1.2;
		if(e.wheelDelta<0&&sp>0.2)sp/=1.2;
		ENV.nowPen.sharpness=sp;
		$("#pen_sharpness_block").children(".setting-item-right").html(EVENTS.to2Digits(sp));
	});
	EVENTS.wheelEventDistributor.addListener($("#pen_minsize_block"),event=>{
		var e=event.originalEvent;
		var ms=ENV.nowPen.minSize;
		if(e.wheelDelta>0&&ms<100)ms+=5;
		if(e.wheelDelta<0&&ms>0)ms-=5;
		ENV.nowPen.minSize=ms;
		$("#pen_minsize_block").children(".setting-item-right").html(ms);
	});
	EVENTS.wheelEventDistributor.addListener($("#pen_quality_block"),event=>{
		var e=event.originalEvent;
		var q=CANVAS.lineQuality;
		if(e.wheelDelta>0&&q<16)q++;
		if(e.wheelDelta<0&&q>1)q--;
		CANVAS.lineQuality=q;
		$("#pen_quality_block").children(".setting-item-right").html(q);
	});

	EVENTS.wheelEventDistributor.addListener($("#paper_width_block").children(".setting-item-right"),event=>{
		var pj=$("#paper_width_block").children(".setting-item-right");
		EVENTS.changeBufferPaperSize("width",event,pj.width());
		pj.html(EVENTS.bufferPaperSize.width);
	});
	EVENTS.wheelEventDistributor.addListener($("#paper_height_block").children(".setting-item-right"),event=>{
		var pj=$("#paper_height_block").children(".setting-item-right");
		EVENTS.changeBufferPaperSize("height",event,pj.width());
		pj.html(EVENTS.bufferPaperSize.height);
	});
	$("#paper_size_submit_block").children(".setting-item-right").on("click",event=>{
		LAYERS.clear();
		ENV.setPaperSize(EVENTS.bufferPaperSize.width,EVENTS.bufferPaperSize.height);
		EVENTS.refreshSettingPanel();
	});

	EVENTS.wheelEventDistributor.addListener($("#env_antialias_block"),event=>{
		ENV.shiftAntiAlias();
		$("#env_antialias_block").children(".setting-item-right").html(ENV.displayAntiAlias?"ON":"OFF");
	});
	$("#env_antialias_block").children(".setting-item-right").on("click",event=>{
		ENV.shiftAntiAlias();
		$("#env_antialias_block").children(".setting-item-right").html(ENV.displayAntiAlias?"ON":"OFF");
	});

	$("#ip_hint_block").children(".setting-item-right").on("click",event=>{
		NETWORK.connect($("#ip_addr_input")[0].value);
		$("#ip_hint_block").children(".setting-item-right").html("Waiting");
	});
	$("#ip_addr_input").on("keydown",event=>{
		if(event.which==13){ // Enter
			NETWORK.connect($("#ip_addr_input")[0].value);
			$("#ip_hint_block").children(".setting-item-right").html("Waiting");
		}
	});
	$("#ip_addr_input").on("focus",event=>{
		$("#ip_addr_input").css("color","#a0a0a0");
	});
};

// The paper width / height that hasn't been submitted
EVENTS.bufferPaperSize={width:0,height:0};
EVENTS.changeBufferPaperSize=function(target,event,blockWidth){
	var l=EVENTS.bufferPaperSize[target];
	var e=event.originalEvent;
	var sl=l.toString();
	var digitN=sl.length;
	var digitWidth=blockWidth/digitN;
	var px=Math.min(Math.max(e.offsetX,0),blockWidth);

	var digitFromR=Math.max(digitN-Math.floor(px/digitWidth)-1,0);
	// A refinement for descending. 1000 -> 900, etc.
	if(digitN-1==digitFromR&&digitFromR>0&&sl[0]=='1'&&e.wheelDelta<0)digitFromR--;
	var deltaL=Math.pow(10,digitFromR);
	l+=e.wheelDelta>0?deltaL:-deltaL;

	if(l<1)l=1;
	if(l>5000)l=5000;
	EVENTS.bufferPaperSize[target]=Math.round(l);
};

EVENTS.refreshSettingPanel=function(){
	$("#pen_density_block").children(".setting-item-right").html(ENV.nowPen.alpha);
	$("#pen_sharpness_block").children(".setting-item-right").html(EVENTS.to2Digits(ENV.nowPen.sharpness));
	$("#pen_minsize_block").children(".setting-item-right").html(ENV.nowPen.minSize);
	$("#pen_quality_block").children(".setting-item-right").html(CANVAS.lineQuality);

	// deep copy
	EVENTS.bufferPaperSize.width=ENV.paperSize.width;
	EVENTS.bufferPaperSize.height=ENV.paperSize.height;
	$("#paper_width_block").children(".setting-item-right").html(ENV.paperSize.width);
	$("#paper_height_block").children(".setting-item-right").html(ENV.paperSize.height);

	$("#env_antialias_block").children(".setting-item-right").html(ENV.displayAntiAlias?"ON":"OFF");

	var ramMB=ENV.getRAMUsage()/Math.pow(2,20);
	$("#env_memory_block").children(".setting-item-right").html(ramMB<100?ramMB.toFixed(1):Math.round(ramMB));
};

// ===================== File Handlers ========================
EVENTS.initFileHandler=function(){
	var drop=$("body")[0];
	drop.addEventListener("dragenter",EVENTS.dragHandle,false);
	drop.addEventListener("dragleave",EVENTS.dragHandle,false);
	drop.addEventListener("dragover",EVENTS.dragHandle,false);
	drop.addEventListener("drop",EVENTS.dragHandle,false);
};

EVENTS.dragHandle=function(e){
	e.preventDefault();
	if(e.type=="dragenter"||e.type=="dragover"){
		$("#mask").css("display","inline");
	}
	if(e.type=="dragleave"){
		console.log("LEAVE");
		$("#mask").css("display","none");
	}
	if(e.type=="drop"){
		$("#mask").css("display","none");

		for(i in e.dataTransfer.files){
			var file=e.dataTransfer.files[i];
			if(!file||!file.type||!file.type.match(/image*/))continue;

			window.URL=window.URL||window.webkitURL;
			var img=new Image();
			img.src=window.URL.createObjectURL(file);
			img.filename=file.name;
			img.onload=function(e){
				addNewImageLayer(this);
			}
		}
	}
	EVENTS.refreshSettingPanel();
}
