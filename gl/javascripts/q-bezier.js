class QBezier{ // quadratic bezier curve
	/**
	 * pArr is a point array [p0,p1,p2] where each point is {x,y}
	 */
	constructor(pArr,isNull){
		
		this.Px=[]; // control point array
		this.Py=[];
		this.isNull=isNull?true:false;
		
		for(let i=0;i<3;i++){
			this.Px[i]=pArr[i][0];
			this.Py[i]=pArr[i][1];
		}
		this.ux=this.Px[1]-this.Px[0],this.vx=this.Px[2]-this.Px[1];
		this.uy=this.Py[1]-this.Py[0],this.vy=this.Py[2]-this.Py[1];
		
		this.u2=this.ux*this.ux+this.uy*this.uy;
		this.v2=this.vx*this.vx+this.vy*this.vy;
		this.uv=this.ux*this.vx+this.uy*this.vy;
		// u2+v2-2uv>=0

		this.arcLength=this.getArcLength(0,1);
	}
	// Get the point {x,y} at param t
	getPoint(t){
		if(this.isNull){
			return {x:this.Px[0],y:this.Py[0]};
		}
		let s=1-t;
		let t2=t*t;
		let s2=s*s;
		
		return {
			x:this.Px[1]-s2*this.ux+t2*this.vx,
			y:this.Py[1]-s2*this.uy+t2*this.vy
		};
	}
	// Get the derative {x,y} at param t
	getDir(t){
		if(this.isNull){
			return {x:NaN,y:NaN};
		}
		let s=1-t;
		return {
			x:2*(s*this.ux+t*this.vx),
			y:2*(s*this.uy+t*this.vy)
		};
	}

	// Get the t value where the point is the bottom point of the parabola
	getParabolaTop(){
		if(this.isNull){
			return {x:this.Px[0],y:this.Py[0]};
		}
		let d=this.u2+this.v2-2*this.uv;
		let n=this.u2-this.uv;
		return n/d;
	}

	// Get arc length from t1 to t2
	getArcLength(t1,t2){
		if(this.isNull){
			return 0;
		}
		let a=this.u2+this.v2-2*this.uv; // a holds a>=0
		let b=2*(this.uv-this.u2);
		let c=this.u2;
		let l1=this._getQuadraticIntegrateVal(a,b,c,t1);
		let l2=this._getQuadraticIntegrateVal(a,b,c,t2);
		
		return l2-l1;
	}
	/**
	 * Integrate 2*sqrt(ax^2+bx+c), calculate value at t
	 * HOLDS a>=0
	 */
	_getQuadraticIntegrateVal(a,b,c,t){
		if(a>1E-6){ // Quadratic
			let at=a*t;
			let s=Math.sqrt(a);
			let p=b+at; // b+a*t
			let p1=p+at; // b+2*a*t
			let q=Math.sqrt(c+p*t); // sqrt(c+t*(b+a*t))
			let d=b*b-4*a*c; // delta
			let r1=p1*q/(2*a);
			let lpq=p1+2*s*q;
			let r2=lpq>0?d*Math.log(lpq)/(4*a*s):0;
			return r1-r2;
		}
		else if(Math.abs(b)>1E-6){ // Linear
			let v=b*t+c;
			return 4*v*Math.sqrt(v)/(3*b);
		}
		else{ // constant
			return 2*Math.sqrt(c)*t;
		}
	}

	/**
	 * start from t0, t0 to t1(0~1) has the arc length. find t1
	 * 0 < length < arclength
	 * length in 0.1 px is acceptable
	 */
	getTWithLength(length,t0){
		if(length<1E-1){ // precise enough
			return t0;
		}
		let nowDis=this.getArcLength(t0,1);
		if(nowDis<length){
			return NaN; // cannot find
		}
		if(nowDis-length<1E-2){ // 1E-2 makes the answer
			return 1;
		}
		let l=t0,r=1,mid=(l+r)/2;
		while(r-l>1E-4){ // 1E-4 is sure to find an approximate answer
			
			mid=(l+r)/2;
			nowDis=this.getArcLength(t0,mid);
			if(Math.abs(nowDis-length)<1E-1){ // precise enough
				return mid;
			}
			if(nowDis>length){ // mid too large
				r=mid;
			}
			else{
				l=mid;
			}
		}
		return NaN; // r-l lower than threshold
	}

	// Get the approximate intersection range of a circle and a flat-enough QBezier
	// Flat enough means at most two intersection points along t in R
	getFlatIntersectionPoint(x0,y0,r){
		if(this.isNull){
			return [0,0];
		}
		let r2=r*r;
		let isStartIn=(dis2(this.Px[0],this.Py[0],x0,y0)<=r2);
		let isEndIn=(dis2(this.Px[2],this.Py[2],x0,y0)<=r2);
		if(isStartIn&&isEndIn){ // Almost sure whole curve is inside the circle
			return [0,1];
		}

		let vS=0,vE=1;
		let eS=1,eE=1;
		const MaxError=1E-2;
		if(!isStartIn){
			let vS_t=this._findIntersection(x0,y0,r2,0,0.1);
			let pS=this.getPoint(vS_t);
			eS=Math.sqrt(dis2(x0,y0,pS.x,pS.y))/r;
			
			if(eS<1+MaxError){ // There is intersection
				if(vS_t>0&&vS_t<1){ // intersection point inside
					vS=vS_t;
				}
				else{
					vS=vS_t<0?0:1;
				}
			}
			else{ // no intersection point
				return [0,0];
			}
		}
		if(!isEndIn){
			let vE_t=this._findIntersection(x0,y0,r2,1,0.9);
			let pE=this.getPoint(vE_t);
			eE=Math.sqrt(dis2(x0,y0,pE.x,pE.y))/r;
			if(eE<1+MaxError){
				if(vE_t>0&&vE_t<1){
					vE=vE_t;
				}
				else{
					vE=vE_t<0?0:1;
				}
			}
			else{ // no intersection point
				return [1,1];
			}
		}
		
		return [vS,vE];
	}

	/**
	 * Newton mode - not stable
	 */
	// _findIntersection(x,y,r2,t0){
	// 	let t=t0,dt=1;
	// 	for(let i=0;i<10;i++){ // Affects calculation speed !!
	// 		let pT=this.getPoint(t);
	// 		let dT=this.getDir(t);
	// 		let val=dis2(x,y,pT.x,pT.y)-r2;
	// 		let dir=2*(dT.x*(pT.x-x)+dT.y*(pT.y-y));
	// 		dt=-val/dir;
	// 		t+=dt;
	// 	}
	// 	return t;
	// }

	/**
	 * Tangent line mode
	 */
	_valTo(x,y,t){
		let pT=this.getPoint(t);
		return dis2(x,y,pT.x,pT.y);
	}
	_findIntersection(x,y,r2,t0_,t1_){
		let t0=t0_,t1=t1_,dt=t1-t0;
		let val0=this._valTo(x,y,t0)-r2;
		for(let i=0;i<8;i++){
			let val1=this._valTo(x,y,t1)-r2;
			let rate=val1/(val0-val1);
			dt*=Math.abs(rate)<4?rate:1; // get rid of sudden jump
			t0=t1,val0=val1;
			t1+=dt; // Update
		}
		return t1;
	}

	/**
	 * split this curve at point t
	 * return two new curves
	 */
	split(t){
		if(this.isNull){ //return two copies
			return [this,this];
		}
		if(t<=0){
			return [new QBezier([
				{x:this.Px[0],y:this.Py[0]},
				{x:this.Px[0],y:this.Py[0]},
				{x:this.Px[0],y:this.Py[0]}
			],true),this];
		}
		if(t>=1){
			return [this,new QBezier([
				{x:this.Px[2],y:this.Py[2]},
				{x:this.Px[2],y:this.Py[2]},
				{x:this.Px[2],y:this.Py[2]}
			],true)];
		}
		let pLx=this.Px[0]*(1-t)+this.Px[1]*t;
		let pLy=this.Py[0]*(1-t)+this.Py[1]*t;
		let pRx=this.Px[1]*(1-t)+this.Px[2]*t;
		let pRy=this.Py[1]*(1-t)+this.Py[2]*t;
		let pMx=pLx*(1-t)+pRx*t;
		let pMy=pLy*(1-t)+pRy*t;
		return [
			new QBezier([
				{x:this.Px[0],y:this.Py[0]},
				{x:pLx,y:pLy},
				{x:pMx,y:pMy}
			]),
			new QBezier([
				{x:pMx,y:pMy},
				{x:pRx,y:pRy},
				{x:this.Px[2],y:this.Py[2]},
			])
		];
	}
}