/**
 * Render Base Class
 */
class BasicRenderer{
	constructor(canvas,param){
		this.canvas=canvas; // the target canvas to be rendered !MUST be uninitialized context!
		this.onRefresh=param.onRefresh||(()=>{}); // callback function everytime a refresh happens
	}

	// Setting up rendering context before each render
	init(param){
		// BrushManager.general.sensitivity, general seeting
		this.isOpacityLocked=param.isOpacityLocked||false;
		this.sensitivity=param.sensitivity||1.0;
		this._sPower=Math.pow(BasicRenderer._sBase,this.sensitivity-1);
		this.brush=param.brush;
		this.antiAlias=param.antiAlias||false; // false in default
		this.hardness=this.brush?this.brush.edgeHardness:1;
		this.softness=1-this.hardness;
		

		// ====== params for bezier curve =======
		// Auto quality: 5~50 circles
		// how many circles are overlayed to one pixel. 50 for good quality
		// 2/(this.softness+0.01)+16 adjusts the quality according to softness
		// this.brush.size guarantees that the neighboring circles with 2px interval at least
		this.quality=Math.min(2/(this.softness+0.01)+16,80,Math.max(this.brush.size,5));
		
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
		
	
		const maxR=Math.ceil(Math.max(r0,r1,r2));
		const wL=Math.floor(Math.min(p0[0],p1[0],p2[0])-maxR).clamp(0,w-1);
		const wH=Math.ceil(Math.max(p0[0],p1[0],p2[0])+maxR).clamp(0,w-1);
		const hL=Math.floor(Math.min(p0[1],p1[1],p2[1])-maxR).clamp(0,h-1);
		const hH=Math.ceil(Math.max(p0[1],p1[1],p2[1])+maxR).clamp(0,h-1);
	
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
			kPoints.push([nx,ny,nr,nd]); // add one key point

			// interval is the pixel length between two circle centers
			let interval=Math.max(2*nr/this.quality,1);
			if(bLen<=interval){ // distance for the next
				this.bezierRemDis=interval-bLen;
				break;
			}
			t=bc.getTWithLength(interval,t); // new position
			bLen-=interval; // new length
		}

		this.renderPoints(wL,wH,hL,hH,w,kPoints);
	}

	renderPoints(wL,wH,hL,hH,w,kPoints){
		// abstract
	}

	/**
	 * Fill within the range=[wL,wH,hL,hH], color rgba=[r,g,b,a(0~255)]
	 */
	// The following method must renew canvas in a synchronized way
	fillColor(rgba,range,isOpacityLocked){
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
}

BasicRenderer._sBase=5; // power base 5^(sensitivity-1)