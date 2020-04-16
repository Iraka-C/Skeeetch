/**
 * Render Base Class
 * There are 3 types of initialization:
 * 1. init when whole environment created: constructor
 * 2. init when focusing on a new layer: init
 * 3. init before a stroke (a series of rendering) begins: initBeforeRender
 */

 /**
  * All methods shall be synchronized.
  */
class BasicRenderer{
	// Enums at the end of class definition

	constructor(param){
		this.canvas=param.canvas; // the target canvas to be rendered !MUST be uninitialized context!
		this.isRefreshRequested=false; // refresing requested?
		this.bitDepth=param.bitDepth||8; // init 8-bit, may be modified
	}

	init(param){
		// abstract
	}

	// Setting up rendering context before each stroke
	initBeforeStroke(param){
		// BrushManager.general.sensitivity, general seeting
		this.isOpacityLocked=param.isOpacityLocked||false;
		this.rgb=param.rgb;
		this.sensitivity=param.sensitivity||1.0;
		this._sPower=Math.pow(BasicRenderer._sBase,this.sensitivity-1);
		this.brush=param.brush;
		this.antiAlias=param.antiAlias||false; // false in default
		this.hardness=this.brush?this.brush.edgeHardness:1;
		this.softness=1-this.hardness;

		// ====== params for bezier curve =======
		// Auto quality: 5~100 circles
		// how many circles are overlayed to one pixel. 50 for good quality
		// 2/(this.softness+0.01)+16 adjusts the quality according to softness
		// this.brush.size guarantees that the neighboring circles with 2px interval at least
		// @TODO: quality based on alpha?
		// @TODO: ripples reduction?
		const MAX=this.bitDepth==32?100:this.bitDepth==16?20:10;
		this.quality=Math.min(2/(this.softness+0.01)+16,MAX,Math.max(this.brush.size,5));
		
		this._invQuality=1/this.quality;
		this.bezierRemDis=0; // distance remain = 0 at first
	}

	/**
	 * Universal quadratic Bezier method
	 * p_i=[x_i,y_i,pressure_i]
	 */
	strokeBezier(p0,p1,p2){
		const w=this.canvas.width;
		const h=this.canvas.height;
	
		// radius
		const r0=this.pressureToStrokeRadius(p0[2]);
		const r1=this.pressureToStrokeRadius(p1[2]);
		const r2=this.pressureToStrokeRadius(p2[2]);
		
		// edge pixel & hardness compensation
		const tHardness=3-2*this.hardness; // opacity compensation under low hardness
		const softRadiusCompensation=1+this.softness/2; // radius compensation on soft edge, experimental value
	
		// All rendering happens within [wL,wH)*[hL,hH)
		const maxR=Math.ceil(Math.max(r0,r1,r2))*softRadiusCompensation;
		const wL=Math.floor(Math.min(p0[0],p1[0],p2[0])-maxR)-2;
		const wH=Math.ceil(Math.max(p0[0],p1[0],p2[0])+maxR)+3;
		const hL=Math.floor(Math.min(p0[1],p1[1],p2[1])-maxR)-2;
		const hH=Math.ceil(Math.max(p0[1],p1[1],p2[1])+maxR)+3;
	
		// density according to pressure: 0 <= minAlpha ~ alpha <= 1
		const d0=this.pressureToStrokeOpacity(p0[2]);
		const d1=this.pressureToStrokeOpacity(p1[2]);
		const d2=this.pressureToStrokeOpacity(p2[2]);
	
		// 2-order param
		const ax=p0[0]-2*p1[0]+p2[0];
		const ay=p0[1]-2*p1[1]+p2[1];
		const ar=r0-2*r1+r2;
		const ad=d0-2*d1+d2;
		// 1-order param
		const bx=2*(p1[0]-p0[0]);
		const by=2*(p1[1]-p0[1]);
		const br=2*(r1-r0);
		const bd=2*(d1-d0);

		// calc bezier keypoints
		const bc=new QBezier([p0,p1,p2]);
		let nx,ny,nr,nd;
		let remL=this.bezierRemDis;
		let kPoints=[];
	
		// calculate length at start
		let bLen=bc.arcLength;
		if(bLen<=remL){ // not draw in this section
			this.bezierRemDis=remL-bLen;
			return;
		}
		bLen-=remL;

		for(let t=bc.getTWithLength(remL,0);!isNaN(t);){
			// draw one plate at tstart
			const t2=t*t;
			nx=ax*t2+bx*t+p0[0];
			ny=ay*t2+by*t+p0[1];
			nr=ar*t2+br*t+r0;
			nd=ad*t2+bd*t+d0;
			// At here, nd is the (visual) density at the stroke center
			// convert it to plate alpha
			const na=(1-Math.pow(1-nd,this._invQuality))*tHardness;
			nr*=softRadiusCompensation;
			// Note that na may > 1
			const data=[nx,ny,nr,na.clamp(0,1)];
			kPoints.push(data); // add one key point

			// interval is the pixel length between two circle centers
			let interval=Math.max(2*nr/this.quality,1);
			if(bLen<=interval){ // distance for the next
				this.bezierRemDis=interval-bLen;
				break;
			}
			t=bc.getTWithLength(interval,t); // new position
			bLen-=interval; // new length
		}

		//this.renderPoints(wL,wH,hL,hH,kPoints);
		return [wL,wH,hL,hH,kPoints];
	}

	/**
	 * Render into the image data
	 */
	renderPoints(wL,wH,hL,hH,kPoints){
		// abstract
	}
	
	/**
	 * Render into the image data
	 */
	renderPaintBrush(wL,wH,hL,hH,kPoints){
		// abstract
	}
	// ======================= Display operations ===========================

	drawCanvas(imgData){
		// abstract
	}
	// ========================= Basic image data operations ===============================
	createEmptyImageData(){
		// abstract
	}
	deleteImageData(imgData){
		// abstract
		// Normally, under the work of JS garbage collector, this function is useless
		// Under GL environment, GPU buffers have to be released manually
	}

	/**
	 * Fill within the range=[wL,wH,hL,hH],
	 * target is an imageData
	 */
	// The following method must renew canvas in a synchronized way
	clearImageData(target,range,isOpacityLocked){
		// abstract
	}

	// Shall return {type:"XXrenderer",data:data}
	getImageData(x,y,w,h){
		// abstract
	}

	getImageData8bit(x,y,w,h){
		// abstract
	}

	putImageData(imgData,x,y){
		// abstract, check if same type
	}

	putImageData8bit(imgData,x,y){
		// abstract, check if same type
	}

	pressureToStrokeRadius(pressure){
		const brush=this.brush;
		const p=this.pressureSensitivity(pressure);
		if(brush.isSizePressure){
			return (p*(1-brush.minSize)+brush.minSize)*brush.size/2; // radius
		}
		else{
			return brush.size/2; // radius
		}
	}

	pressureToStrokeOpacity(pressure){
		const brush=this.brush;
		const p=this.pressureSensitivity(pressure);
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
	pressureSensitivity(p){
		return Math.pow(p,this._sPower);
	}

	/**
	 * soft edge distance calc
	 * d is the distance to center (0~1)
	 */
	softEdgeNormal(r){ // softness is not 0
		if(r>0.5){
			let r1=1-r;
			return 1-2*r1*r1;
		}
		return 2*r*r;
		//return r*r; // good for rendering considering convolution, sharp at the center
		//return r; // a bit faster than quad? but quality is worse
		//return (1-Math.cos(Math.PI*r))/2; // easier but slower
	}

	static blendModeNameToEnum(name){
		switch(name){
			case "normal": return BasicRenderer.NORMAL;
			case "source": return BasicRenderer.SOURCE;
			case "multiply": return BasicRenderer.MULTIPLY;
			case "screen": return BasicRenderer.SCREEN;
			case "exclusion": return BasicRenderer.EXCLUSION;
		}
	}
	static blendModeEnumToName(mode){
		switch(mode){
			case BasicRenderer.NORMAL: return "normal";
			case BasicRenderer.SOURCE: return "source";
			case BasicRenderer.MULTIPLY: return "multiply";
			case BasicRenderer.SCREEN: return "screen";
			case BasicRenderer.EXCLUSION: return "exclusion";
		}
	}
}

// Blend Mode enums
BasicRenderer.NONE=-2;
BasicRenderer.ERASE=-1;
BasicRenderer.NORMAL=0;
BasicRenderer.SOURCE=1;
BasicRenderer.MULTIPLY=2;
BasicRenderer.SCREEN=3;
BasicRenderer.EXCLUSION=10;

BasicRenderer._sBase=5; // power base 5^(sensitivity-1)