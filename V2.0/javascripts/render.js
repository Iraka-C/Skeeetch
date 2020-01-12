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
	RENDER.sensitivity = param.sensitivity||1.0;
	RENDER._sPower = Math.pow(RENDER._sBase,RENDER.sensitivity-1);
}

/**
 * Draw a bezier curve from p0->p1->p2
 * p_i=[x_i,y_i,pressure_i]
 */
RENDER.strokeBezier=function(p0,p1,p2){
	RENDER.renderer.strokeBezier(p0,p1,p2);
}
// =================== Tools ======================

/**
 * transform from pressure(0~1) to stroke width
 */
RENDER.pressureToStrokeRadius=function(pressure,brush){
	let p=RENDER.pressureSensitivity(pressure);
	if(brush.isSizePressure){
		return (p*(brush.size-brush.minSize)+brush.minSize)/2; // radius
	}
	else{
		return brush.size/2; // radius
	}
}

/**
 * transform from pressure(0~1) to opacity
 */
RENDER.pressureToStrokeOpacity=function(pressure,brush){
	let p=RENDER.pressureSensitivity(pressure);
	if(brush.isAlphaPressure){
		return (p*(brush.alpha-brush.minAlpha)+brush.minAlpha)/100;
	}
	else{
		return brush.alpha/100;
	}
}

/**
 * Consider pressure sensitivity, return new pressure
 */
RENDER.pressureSensitivity=function(p){
	return Math.pow(p,RENDER._sPower);
}