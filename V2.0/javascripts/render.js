/**
 * Renderer for a canvas context
 * A Tool class for CANVAS, visits CANVAS directly
 */
RENDER={};

RENDER._sBase=5; // power base 5^(sensitivity-1)
/**
 * Render algorithm list
 * 1: WebGL float
 * 2: 16bit
 * 3: 8bit (context draw API)
 */
RENDER.method=0;
RENDER.renderer=null;
/** 
 * init before appointing a canvas to the RENDER
 */ 
RENDER.init=function(param){
	if(!param||!param.canvas){ // clear renderer setting
		RENDER.renderer=null;
		return;
	}
	RENDER.method=param.method||2;
	
	switch(RENDER.method){
	//case 1: RENDER.renderer=new WebGLRenderer(param);break;
	case 2: RENDER.renderer=new CPURenderer(param);break;
	//case 3: RENDER.renderer=new Context2DRenderer(param);break;
	default: RENDER.renderer=null;return;
	}
	

	// ========== param setting =========

	// callback function everytime a refresh happens
	RENDER.onRefresh = param.onRefresh||(()=>{});

	// ======== self ==========
	
}

/**
 * Init before every stroke
 */
RENDER.initBeforeStroke=function(param){
	RENDER.renderer.init(param);
	// BrushManager.general.sensitivity, general seeting
	RENDER.sensitivity=param.sensitivity||1.0;
	RENDER._sPower=Math.pow(RENDER._sBase,RENDER.sensitivity-1);
	RENDER.softness=1-param.brush.edgeHardness;
}

/**
 * Draw a bezier curve from p0->p1->p2
 * p_i=[x_i,y_i,pressure_i]
 */
RENDER.strokeBezier=function(p0,p1,p2){
	RENDER.renderer.strokeBezier(p0,p1,p2);
}

RENDER.fillColor=function(rgba,range,isOpacityLocked){
	RENDER.renderer.fillColor(rgba,range,isOpacityLocked);
}

/**
 * get the ImageData item from renderer
 */
RENDER.getImageData=function(canvas,x,y,w,h){
	if(canvas){ // take a pixel from canvas without changing now context
		switch(RENDER.method){
		//case 1: RENDER.renderer=new WebGLRenderer(param);break;
		case 2:
			const renderer=new CPURenderer({canvas:canvas,disableBuffer:true});
			return renderer.getImageData(x,y,w,h);
		//case 3: RENDER.renderer=new Context2DRenderer(param);break;
		default: return null;
		}
	}
	return RENDER.renderer.getImageData(x,y,w,h);
}

/**
 * get the ImageData item from renderer
 */
RENDER.putImageData=function(canvas,data){
	if(canvas){ // take a pixel from canvas without changing now context
		switch(RENDER.method){
		//case 1: RENDER.renderer=new WebGLRenderer(param);break;
		case 2:
			const renderer=new CPURenderer({canvas:canvas,disableBuffer:true});
			renderer.putImageData(data);
			return;
		//case 3: RENDER.renderer=new Context2DRenderer(param);break;
		}
	}
	RENDER.renderer.putImageData(data);
}
// =================== Tools ======================

/**
 * transform from pressure(0~1) to stroke width(px)
 */
RENDER.pressureToStrokeRadius=function(pressure,brush){
	let p=RENDER.pressureSensitivity(pressure);
	if(brush.isSizePressure){
		return (p*(1-brush.minSize)+brush.minSize)*brush.size/2; // radius
	}
	else{
		return brush.size/2; // radius
	}
}

/**
 * transform from pressure(0~1) to opacity(0~1)
 */
RENDER.pressureToStrokeOpacity=function(pressure,brush){
	let p=RENDER.pressureSensitivity(pressure);
	if(brush.isAlphaPressure){
		return (p*(1-brush.minAlpha)+brush.minAlpha)*brush.alpha;
	}
	else{
		return brush.alpha;
	}
}

/**
 * Consider pressure sensitivity, return new pressure
 */
// @TODO: error when sensitivity is 0
RENDER.pressureSensitivity=function(p){
	return Math.pow(p,RENDER._sPower);
}

/**
 * soft edge distance calc
 * d is the distance to center (0~1)
 */
RENDER.softEdgeNormal=function(d){
	let r=(1-d)/RENDER.softness; // softness is not 0
	if(r>0.5){
		let r1=1-r;
		return 1-2*r1*r1;
	}
	return 2*r*r;
	//return r*r; // good for rendering considering convolution, sharp at the center
	//return r; // a bit faster than quad? but quality is worse
	//return (1-Math.cos(Math.PI*r))/2; // easier but slower
}