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
class BasicRenderer {
	// Enums at the end of class definition

	constructor(param) {
		this.canvas=param.canvas; // the target canvas to be rendered !MUST be uninitialized context!
		this.isRefreshRequested=false; // refresing requested?
		this.bitDepth=param.bitDepth||8; // init 8-bit, may be modified
	}

	init(param) {
		// abstract
	}

	// Setting up rendering context before each stroke
	initBeforeStroke(param) {
		// BrushManager.general.sensitivity, general seeting
		this.isOpacityLocked=param.isOpacityLocked||false;
		this.rgb=param.rgb;
		this.sensitivity=param.sensitivity||1.0;
		this._sPower=Math.pow(BasicRenderer._sBase,this.sensitivity-1);
		this.brush=param.brush;
		this.antiAlias=param.antiAlias||false; // false in default
		this.hardness=this.brush? this.brush.edgeHardness:1;
		this.softness=1-this.hardness;

		// ====== params for bezier curve =======
		// Auto quality: 5~100 circles
		// how many circles are overlayed to one pixel. 50 for good quality
		// 2/(this.softness+0.01)+16 adjusts the quality according to softness
		// this.brush.size guarantees that the neighboring circles with 2px interval at least
		// @TODO: quality based on alpha?
		// @TODO: ripples reduction?
		if(this.brush.blendMode==2) {
			this.quality=this.brush.size;
		}
		else {
			// The MAX param is only for controling alpha composition quality
			// does not do with speed
			const MAX_NORMAL=this.bitDepth==32? 100:this.bitDepth==16? 20:10;
			this.quality=Math.min(2/(this.softness+0.01)+16,MAX_NORMAL,Math.max(this.brush.size,5));
		}
		//console.log(this.quality);

		this._invQuality=1/this.quality;
		this.bezierRemDis=0; // distance remain = 0 at first
	}

	/**
	 * Universal quadratic Bezier method
	 * p_i=[x_i,y_i,pressure_i]
	 * 
	 * return: [wL,wH,hL,hH,kPoints]
	 * [wL,wH,hL,hH]: renewed area
	 * kPoints[i]=[x,y,r,a,vx,vy]
	 *    [x,y]: circle position
	 *    r: radius
	 *    a: opacity
	 *    [vx,vy]: speed **NOTE**: diff from Bezier curve, NOT related with time!
	 */
	strokeBezier(p0,p1,p2) {

		// edge pixel & hardness compensation
		const tHardness=3-2*this.hardness; // opacity compensation under low hardness
		const softRadiusCompensation=1+this.softness/2; // radius compensation on soft edge, experimental value

		// pressure considering sensitivity: 0 <= minAlpha ~ alpha <= 1
		const d0=this.pressureSensitivity(p0[2]);
		const d1=this.pressureSensitivity(p1[2]);
		const d2=this.pressureSensitivity(p2[2]);

		// All rendering happens within [wL,wH)*[hL,hH)
		// calculate max radius
		const r0=this.pressureToStrokeRadius(d0);
		const r1=this.pressureToStrokeRadius(d1);
		const r2=this.pressureToStrokeRadius(d2);
		const maxR=Math.ceil(Math.max(r0,r1,r2))*softRadiusCompensation;
		const wL=Math.floor(Math.min(p0[0],p1[0],p2[0])-maxR)-2;
		const wH=Math.ceil(Math.max(p0[0],p1[0],p2[0])+maxR)+3;
		const hL=Math.floor(Math.min(p0[1],p1[1],p2[1])-maxR)-2;
		const hH=Math.ceil(Math.max(p0[1],p1[1],p2[1])+maxR)+3;



		// these values can be derived also from bc(QBezier), putting here just to interpolate other params (r, a)
		// 2-order param
		const ax=p0[0]-2*p1[0]+p2[0];
		const ay=p0[1]-2*p1[1]+p2[1];
		const ad=d0-2*d1+d2;
		// 1-order param
		const bx=2*(p1[0]-p0[0]);
		const by=2*(p1[1]-p0[1]);
		const bd=2*(d1-d0);

		// calc bezier keypoints
		const bc=new QBezier([p0,p1,p2]);
		let nx,ny,nr,nd;
		let remL=this.bezierRemDis;
		let kPoints=[];

		// calculate length at start
		let bLen=bc.arcLength;
		if(bLen<=remL) { // not draw in this section
			this.bezierRemDis=remL-bLen;
			return;
		}
		bLen-=remL;

		for(let t=bc.getTWithLength(remL,0);!isNaN(t);) {
			// draw one plate at tstart
			const t2=t*t;
			nx=ax*t2+bx*t+p0[0];
			ny=ay*t2+by*t+p0[1];
			// At here, nd is pressure (0~1) at the stroke center
			nd=ad*t2+bd*t+d0;
			// compensate R for visual soft edged circle radius
			nr=this.pressureToStrokeRadius(nd)*softRadiusCompensation;
			// convert pressure to plate alpha. Note that na may > 1
			const targetOpa=this.pressureToStrokeOpacity(nd);
			const na=(1-Math.pow(1-targetOpa,this._invQuality))*tHardness;
			// Calculate speed
			const nsBezier=bc.getDir(t);
			const data=[nx,ny,nr,nd,targetOpa,na.clamp(0,1),nsBezier.x,nsBezier.y];
			kPoints.push(data); // add one key point

			// interval is the pixel length between two circle centers
			const interval=Math.max(2*nr/this.quality,0.5); // no less than 0.5 pixels

			if(bLen<=interval) { // distance for the next
				this.bezierRemDis=interval-bLen;
				break;
			}
			t=bc.getTWithLength(interval,t); // new position
			bLen-=interval; // new length
		}

		//this.renderPoints(wL,wH,hL,hH,kPoints);
		if(kPoints.length) {
			return [wL,wH,hL,hH,kPoints];
		}
		else { // not renewed
			return [wL,wL,hL,hL,kPoints];
		}
	}

	/**
	 * Render into the image data
	 */
	renderPoints(wL,wH,hL,hH,kPoints) {
		// abstract
	}

	/**
	 * Render into the image data
	 */
	renderPaintBrush(wL,wH,hL,hH,kPoints) {
		// abstract
	}
	// ======================= Display operations ===========================

	drawCanvas(imgData) {
		// abstract
	}
	// ========================= Basic image data operations ===============================
	createEmptyImageData() {
		// abstract
	}
	deleteImageData(imgData) {
		// abstract
		// Normally, under the work of JS garbage collector, this function is useless
		// Under GL environment, GPU buffers have to be released manually
	}

	/**
	 * Fill within the range=[wL,wH,hL,hH],
	 * target is an imageData
	 */
	// The following method must renew canvas in a synchronized way
	clearImageData(target,range,isOpacityLocked) {
		// abstract
	}

	// Shall return {type:"XXrenderer",data:data}
	getImageData(x,y,w,h) {
		// abstract
	}

	getImageData8bit(x,y,w,h) {
		// abstract
	}

	putImageData(imgData,x,y) {
		// abstract, check if same type
	}

	putImageData8bit(imgData,x,y) {
		// abstract, check if same type
	}

	pressureToStrokeRadius(pressure) {
		const brush=this.brush;

		if(brush.isSizePressure) {
			return (pressure*(1-brush.minSize)+brush.minSize)*brush.size/2; // radius
		}
		else {
			return brush.size/2;
		}
	}

	pressureToStrokeOpacity(pressure) {
		const brush=this.brush;
		if(brush.isAlphaPressure) {
			return (pressure*(1-brush.minAlpha)+brush.minAlpha)*brush.alpha;
		}
		else {
			return brush.alpha;
		}
	}

	/**
	 * Consider pressure sensitivity, return new pressure
	 */
	pressureSensitivity(p) {
		return Math.pow(p,this._sPower);
	}

	/**
	 * soft edge distance calc
	 * d is the distance to center (0~1)
	 */
	softEdgeNormal(r) { // softness is not 0
		if(r>0.5) {
			let r1=1-r;
			return 1-2*r1*r1;
		}
		return 2*r*r;
		//return r*r; // good for rendering considering convolution, sharp at the center
		//return r; // a bit faster than quad? but quality is worse
		//return (1-Math.cos(Math.PI*r))/2; // easier but slower
	}

	static blendModeNameToEnum(name) {
		return BasicRenderer.blendModeNameList[name]||BasicRenderer.NORMAL;
	}
	static blendModeEnumToName(mode) {
		return BasicRenderer.blendModeNameList[mode]||"normal";
	}

	static blendModeEnumToDisplayedName(mode) {
		switch(mode) {
			default:
			case BasicRenderer.NORMAL: return Lang("blend-normal");
			case BasicRenderer.MULTIPLY: return Lang("blend-multiply");
			case BasicRenderer.SCREEN: return Lang("blend-screen");
			case BasicRenderer.OVERLAY: return Lang("blend-overlay");
			case BasicRenderer.HARD_LIGHT: return Lang("blend-hard-light");
			case BasicRenderer.SOFT_LIGHT: return Lang("blend-soft-light");
			case BasicRenderer.DARKEN: return Lang("blend-darken");
			case BasicRenderer.LIGHTEN: return Lang("blend-lighten");
			case BasicRenderer.DIFFERENCE: return Lang("blend-difference");
			case BasicRenderer.EXCLUSION: return Lang("blend-exclusion");
			case BasicRenderer.COLOR_DODGE: return Lang("blend-color-dodge");
			case BasicRenderer.COLOR_BURN: return Lang("blend-color-burn");
			case BasicRenderer.LINEAR_DODGE: return Lang("blend-linear-dodge");
			case BasicRenderer.LINEAR_BURN: return Lang("blend-linear-burn");
			case BasicRenderer.LINEAR_LIGHT: return Lang("blend-linear-light");
			case BasicRenderer.VIVID_LIGHT: return Lang("blend-vivid-light");
			case BasicRenderer.PIN_LIGHT: return Lang("blend-pin-light");
			case BasicRenderer.DARKER_COLOR: return Lang("blend-darker-color");
			case BasicRenderer.LIGHTER_COLOR: return Lang("blend-lighter-color");
			case BasicRenderer.HARD_MIX: return Lang("blend-hard-mix");
			case BasicRenderer.SUBTRACT: return Lang("blend-subtract");
			case BasicRenderer.DIVIDE: return Lang("blend-divide");
			case BasicRenderer.HUE: return Lang("blend-hue");
			case BasicRenderer.SATURATION: return Lang("blend-saturation");
			case BasicRenderer.COLOR: return Lang("blend-color");
			case BasicRenderer.LUMINOSITY: return Lang("blend-luminosity");
		}
	}

	/**
	 * Returns [r,g,b,a] as the neutral color of mode
	 * Works under both pre-/non-pre-multiplied alpha
	 * @param {*} mode 
	 */
	static blendModeNeutralColor(mode) {
		switch(mode) {
			// White color
			//case BasicRenderer.DARKEN:
			case BasicRenderer.COLOR_BURN:
			case BasicRenderer.LINEAR_BURN:
			//case BasicRenderer.DARKER_COLOR:
			//case BasicRenderer.DIVIDE:
			//case BasicRenderer.MULTIPLY:
				return [1,1,1,1];

			// Black color
			//case BasicRenderer.LIGHTEN:
			case BasicRenderer.COLOR_DODGE:
			case BasicRenderer.LINEAR_DODGE:
			//case BasicRenderer.LIGHTER_COLOR:
			case BasicRenderer.DIFFERENCE:
			//case BasicRenderer.EXCLUSION:
			//case BasicRenderer.SUBTRACT:
			//case BasicRenderer.SCREEN:
				return [0,0,0,1];

			// 50% gray
			//case BasicRenderer.SOFT_LIGHT:
			//case BasicRenderer.HARD_LIGHT:
			case BasicRenderer.VIVID_LIGHT:
			case BasicRenderer.LINEAR_LIGHT:
			//case BasicRenderer.PIN_LIGHT:
			//case BasicRenderer.OVERLAY:
				return [.5,.5,.5,1];

			// No neutral color
			default: return [0,0,0,0];
		}
	}
}

// Blend Mode enums, 1 for source-only, minus value for ither porter-duff operations
BasicRenderer.NORMAL=0;
BasicRenderer.MULTIPLY=2;
BasicRenderer.SCREEN=3;
BasicRenderer.OVERLAY=4;
BasicRenderer.HARD_LIGHT=5;
BasicRenderer.SOFT_LIGHT=6;
BasicRenderer.DARKEN=7;
BasicRenderer.LIGHTEN=8;
BasicRenderer.DIFFERENCE=9;
BasicRenderer.EXCLUSION=10;
BasicRenderer.COLOR_DODGE=11;
BasicRenderer.COLOR_BURN=12;

// Followings are blend modes not included in CSS3 standard
BasicRenderer.LINEAR_DODGE=20;
BasicRenderer.LINEAR_BURN=21;
BasicRenderer.LINEAR_LIGHT=22;
BasicRenderer.VIVID_LIGHT=23;
BasicRenderer.PIN_LIGHT=24;
BasicRenderer.DARKER_COLOR=25;
BasicRenderer.LIGHTER_COLOR=26;
BasicRenderer.HARD_MIX=27;

BasicRenderer.SUBTRACT=30;
BasicRenderer.DIVIDE=31;
BasicRenderer.HUE=40;
BasicRenderer.SATURATION=41;
BasicRenderer.COLOR=42;
BasicRenderer.LUMINOSITY=43;

BasicRenderer.blendModeNameList={ // name: PSD standard
	"normal": BasicRenderer.NORMAL,
	"overlay": BasicRenderer.OVERLAY,
	"multiply": BasicRenderer.MULTIPLY,
	"screen": BasicRenderer.SCREEN,

	"darken": BasicRenderer.DARKEN,
	"lighten": BasicRenderer.LIGHTEN,
	"darker color": BasicRenderer.DARKER_COLOR,
	"lighter color": BasicRenderer.LIGHTER_COLOR,

	"linear burn": BasicRenderer.LINEAR_BURN,
	"linear dodge": BasicRenderer.LINEAR_DODGE,
	"color burn": BasicRenderer.COLOR_BURN,
	"color dodge": BasicRenderer.COLOR_DODGE,

	"soft light": BasicRenderer.SOFT_LIGHT,
	"hard light": BasicRenderer.HARD_LIGHT,
	"vivid light": BasicRenderer.VIVID_LIGHT,
	"linear light": BasicRenderer.LINEAR_LIGHT,
	"pin light": BasicRenderer.PIN_LIGHT,

	"hard mix": BasicRenderer.HARD_MIX,
	"difference": BasicRenderer.DIFFERENCE,
	"exclusion": BasicRenderer.EXCLUSION,
	"subtract": BasicRenderer.SUBTRACT,
	"divide": BasicRenderer.DIVIDE,

	"hue": BasicRenderer.HUE,
	"saturation": BasicRenderer.SATURATION,
	"color": BasicRenderer.COLOR,
	"luminosity": BasicRenderer.LUMINOSITY
};
// create reversed list
for(const v of Object.keys(BasicRenderer.blendModeNameList)) {
	BasicRenderer.blendModeNameList[BasicRenderer.blendModeNameList[v]]=v;
}

// Pressure sensitivity constant
BasicRenderer._sBase=5; // power base 5^(sensitivity-1)