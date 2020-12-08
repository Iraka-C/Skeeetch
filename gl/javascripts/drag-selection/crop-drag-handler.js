class CropDragHandler extends DragHandler{
	constructor(callback){
		super(callback);
		this.lineDragOffset=null;
	}

	startDraggingLine(id,offset){
		const startP=DRAG.points[id];
		this.lineDragOffset=[offset[0]-startP[0],offset[1]-startP[1]];
	}

	draggingPoint(id,offset){
		if(EVENTS.key.shift){ // zoom
			const id1=(id+1)%4;
			const id2=(id+2)%4;
			const id3=(id+3)%4;

			const p0=DRAG.points[id];
			const p1=DRAG.points[id1];
			const p2=DRAG.points[id2];
			const p3=DRAG.points[id3];

			const g02=SMath.vector(p0,p2); // orthogonal line
			const h02=[-g02[1],g02[0]]; // perpendicular to g02
			offset=SMath.lineIntersectionPV(p0,g02,offset,h02);

			const newP0=CropDragHandler._verifyCropPointZoom(id,...offset);
			
			// old points
			const gp1=SMath.vector(p2,p1);
			const gp3=SMath.vector(p2,p3);
			// calculate intersection
			const newP1S=SMath.lineIntersectionPV(p2,gp1,newP0,SMath.vector(p0,p1));
			const newP3S=SMath.lineIntersectionPV(p2,gp3,newP0,SMath.vector(p0,p3));
			// update new points
			DRAG.points[id]=newP0;
			DRAG.points[id1]=[newP1S[0],newP1S[1]];
			DRAG.points[id3]=[newP3S[0],newP3S[1]];
		}
		else if(EVENTS.key.ctrl){ // pan
			const newP0=offset;

			const id1=(id+1)%4;
			const id2=(id+2)%4;
			const id3=(id+3)%4;
			const p0=DRAG.points[id];
			const p1=DRAG.points[id1];
			const p2=DRAG.points[id2];
			const p3=DRAG.points[id3];

			// pan
			const diff=SMath.vector(p0,newP0);
			DRAG.points[id]=newP0;
			DRAG.points[id1]=[p1[0]+diff[0],p1[1]+diff[1]];
			DRAG.points[id2]=[p2[0]+diff[0],p2[1]+diff[1]];
			DRAG.points[id3]=[p3[0]+diff[0],p3[1]+diff[1]];
		}
		else{ // xy-free
			const p0=DRAG.points[id];
			const newP0=CropDragHandler._verifyCropPoint(id,...offset);
			const id1=(id+1)%4;
			const id2=(id+2)%4;
			const id3=(id+3)%4;

			// old points
			const p1=DRAG.points[id1];
			const p2=DRAG.points[id2];
			const p3=DRAG.points[id3];
			const gp1=SMath.vector(p2,p1);
			const gp3=SMath.vector(p2,p3);
			// calculate intersection
			const newP1S=SMath.lineIntersectionPV(p2,gp1,newP0,SMath.vector(p0,p1));
			const newP3S=SMath.lineIntersectionPV(p2,gp3,newP0,SMath.vector(p0,p3));
			// update new points
			DRAG.points[id]=newP0;
			DRAG.points[id1]=[newP1S[0],newP1S[1]];
			DRAG.points[id3]=[newP3S[0],newP3S[1]];
		}
	}

	draggingLine(id,offset){
		if(EVENTS.key.shift||EVENTS.key.ctrl){ // pan
			const newP0=SMath.vector(this.lineDragOffset,offset);
			const id1=(id+1)%4;
			const id2=(id+2)%4;
			const id3=(id+3)%4;

			// old points
			const p0=DRAG.points[id];
			const p1=DRAG.points[id1];
			const p2=DRAG.points[id2];
			const p3=DRAG.points[id3];

			// pan
			const diff=SMath.vector(p0,newP0);
			DRAG.points[id]=newP0;
			DRAG.points[id1]=[p1[0]+diff[0],p1[1]+diff[1]];
			DRAG.points[id2]=[p2[0]+diff[0],p2[1]+diff[1]];
			DRAG.points[id3]=[p3[0]+diff[0],p3[1]+diff[1]];
		}
		else{ // free-xy
			const newP0=CropDragHandler._verifyCropLine(id,...offset);

			const id1=(id+1)%4;
			const id2=(id+2)%4;
			const id3=(id+3)%4;

			// old points
			const p0=DRAG.points[id];
			const p1=DRAG.points[id1];
			const p2=DRAG.points[id2];
			const p3=DRAG.points[id3];

			const gp01=SMath.vector(p0,p1);
			const gp12=SMath.vector(p1,p2);
			const gp03=SMath.vector(p0,p3);

			// calculate intersection
			const newP0S=SMath.lineIntersectionPV(p0,gp03,newP0,gp01);
			const newP1S=SMath.lineIntersectionPV(p1,gp12,newP0,gp01);
			// @TODO: one more verification here, not exceed the paper outer edges
			// update new points
			DRAG.points[id]=[newP0S[0],newP0S[1]];
			DRAG.points[id1]=[newP1S[0],newP1S[1]];
		}
	}

	endDraggingLine(id,offset){
		this.lineDragOffset=null;
	}

	// ===================== Verifications for size control =====================
	// verify valid points when doing transform

	static _verifyCropPoint(id,xW,yW){ // verify an active point when cropping
		let [xP,yP]=ENV.toPaperXY(xW,yW);
		const [xPRel,yPRel]=DRAG.paperP[(id+2)%4]; // relative reference point
		
		// fix diff lower than 16 pixels
		const [dX,dY]=[xP-xPRel,yP-yPRel];
		let isGood=true;
		// @TODO: add max-length restriction
		if(Math.abs(dX)<16){
			xP=xPRel+16*(Math.sign(dX)||1);
			isGood=false;
		}
		else if(Math.abs(dX)>ENV.maxPaperSize){
			xP=xPRel+ENV.maxPaperSize*(Math.sign(dX)||1);
			isGood=false;
		}
		if(Math.abs(dY)<16){
			yP=yPRel+16*(Math.sign(dY)||1);
			isGood=false;
		}
		else if(Math.abs(dY)>ENV.maxPaperSize){
			yP=yPRel+ENV.maxPaperSize*(Math.sign(dY)||1);
			isGood=false;
		}
		if(isGood){ // no change at all
			return [xW,yW];
		}

		return ENV.toWindowXY(xP,yP); // new position in window
	}

	static _verifyCropPointZoom(id,xW,yW){ // verify an active point when cropping, zoom
		let [xP,yP]=ENV.toPaperXY(xW,yW);
		const [xPRel,yPRel]=DRAG.paperP[(id+2)%4]; // relative reference point
		
		// fix diff lower than 16 pixels
		const [dX,dY]=[xP-xPRel,yP-yPRel];
		const mRatioX=16/Math.abs(dX),mRatioY=16/Math.abs(dY);
		const mr=Math.max(mRatioX,mRatioY,1);

		const xRatioX=ENV.maxPaperSize/Math.abs(dX);
		const xRatioY=ENV.maxPaperSize/Math.abs(dY);
		const xr=Math.min(xRatioX,xRatioY,1);

		if(mr>1){ // too small
			xP=xPRel+dX*mr;
			yP=yPRel+dY*mr;
			return ENV.toWindowXY(xP,yP); // new position in window
		}
		if(xr<1){ // too large
			xP=xPRel+dX*xr;
			yP=yPRel+dY*xr;
			return ENV.toWindowXY(xP,yP); // new position in window
		}
		return [xW,yW];
	}

	static _verifyCropLine(id,xW,yW){
		let [xP,yP]=ENV.toPaperXY(xW,yW);
		const pRel1=DRAG.paperP[(id+2)%4]; // relative line
		const pRel2=DRAG.paperP[(id+3)%4];
		const dis=SMath.getPointToLineDis(...pRel1,...pRel2,xP,yP);
		if(dis<16){
			return DRAG.points[id%4]; // original
		}
		return [xW,yW];
	}
}