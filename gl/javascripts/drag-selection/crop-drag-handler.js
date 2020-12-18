"use strict";
class CropDragHandler extends DragHandler{
	constructor(callback){
		super(callback);
		this.dragOffset=null;
		this.initYX=null;
	}

	startDraggingPoint(id,offset){
		this.initYX=[DRAG.paperP[0][0]-DRAG.paperP[2][0],DRAG.paperP[0][1]-DRAG.paperP[2][1]];
	}
	startDraggingLine(id,offset){
		const startP=DRAG.paperP[id];
		this.dragOffset=[offset[0]-startP[0],offset[1]-startP[1]];
	}
	startDraggingArea(offset){
		const startP=DRAG.paperP[0]; // ref point
		this.dragOffset=[offset[0]-startP[0],offset[1]-startP[1]];
	}

	draggingPoint(id,offset){
		if(EVENTS.key.shift){ // zoom
			const id1=(id+1)%4;
			const id2=(id+2)%4;
			const id3=(id+3)%4;

			const p0=DRAG.paperP[id];
			const p1=DRAG.paperP[id1];
			const p2=DRAG.paperP[id2];
			const p3=DRAG.paperP[id3];

			const g02=this.initYX; // initial diagonal line
			const h02=[-g02[1],g02[0]]; // perpendicular to g02
			const g02Flip=[g02[0],-g02[1]]; // y-flipped
			const h02Flip=[-g02Flip[1],g02Flip[0]]; // perpendicular to g02Flip

			const offset1=SMath.lineIntersectionPV(p2,g02,offset,h02);
			const offset2=SMath.lineIntersectionPV(p2,g02Flip,offset,h02Flip);
			offset=dis(offset,offset1)<dis(offset,offset2)?offset1:offset2; // choose the nearest

			const newP0=CropDragHandler._verifyCropPointZoom(id,...offset);
			if(isNaN(newP0[0])||isNaN(newP0[1]))return; // invalid (may be div by 0)
			
			// old points
			const gp1=SMath.vector(p2,p1);
			const gp3=SMath.vector(p2,p3);
			// calculate intersection
			const newP1S=SMath.lineIntersectionPV(p2,gp1,newP0,SMath.vector(p0,p1));
			const newP3S=SMath.lineIntersectionPV(p2,gp3,newP0,SMath.vector(p0,p3));
			// update new points
			DRAG.paperP[id]=newP0;
			DRAG.paperP[id1]=[newP1S[0],newP1S[1]];
			DRAG.paperP[id3]=[newP3S[0],newP3S[1]];
		}
		else if(EVENTS.key.ctrl){ // pan
			const newP0=offset;

			const id1=(id+1)%4;
			const id2=(id+2)%4;
			const id3=(id+3)%4;
			const p0=DRAG.paperP[id];
			const p1=DRAG.paperP[id1];
			const p2=DRAG.paperP[id2];
			const p3=DRAG.paperP[id3];

			// pan
			const diff=SMath.vector(p0,newP0);
			DRAG.paperP[id]=newP0;
			DRAG.paperP[id1]=[p1[0]+diff[0],p1[1]+diff[1]];
			DRAG.paperP[id2]=[p2[0]+diff[0],p2[1]+diff[1]];
			DRAG.paperP[id3]=[p3[0]+diff[0],p3[1]+diff[1]];
		}
		else{ // xy-free
			const p0=DRAG.paperP[id];
			const newP0=CropDragHandler._verifyCropPoint(id,...offset);
			const id1=(id+1)%4;
			const id2=(id+2)%4;
			const id3=(id+3)%4;

			// old points
			const p1=DRAG.paperP[id1];
			const p2=DRAG.paperP[id2];
			const p3=DRAG.paperP[id3];
			const gp1=SMath.vector(p2,p1);
			const gp3=SMath.vector(p2,p3);
			// calculate intersection
			const newP1S=SMath.lineIntersectionPV(p2,gp1,newP0,SMath.vector(p0,p1));
			const newP3S=SMath.lineIntersectionPV(p2,gp3,newP0,SMath.vector(p0,p3));
			// update new points
			DRAG.paperP[id]=newP0;
			DRAG.paperP[id1]=[newP1S[0],newP1S[1]];
			DRAG.paperP[id3]=[newP3S[0],newP3S[1]];
		}
	}

	draggingLine(id,offset){
		if(EVENTS.key.ctrl){ // pan
			const newP0=SMath.vector(this.dragOffset,offset);
			const id1=(id+1)%4;
			const id2=(id+2)%4;
			const id3=(id+3)%4;

			// old points
			const p0=DRAG.paperP[id];
			const p1=DRAG.paperP[id1];
			const p2=DRAG.paperP[id2];
			const p3=DRAG.paperP[id3];

			// pan
			const diff=SMath.vector(p0,newP0);
			DRAG.paperP[id]=newP0;
			DRAG.paperP[id1]=[p1[0]+diff[0],p1[1]+diff[1]];
			DRAG.paperP[id2]=[p2[0]+diff[0],p2[1]+diff[1]];
			DRAG.paperP[id3]=[p3[0]+diff[0],p3[1]+diff[1]];
		}
		else{ // free-xy
			const newP0=CropDragHandler._verifyCropLine(id,...offset);

			const id1=(id+1)%4;
			const id2=(id+2)%4;
			const id3=(id+3)%4;

			// old points
			const p0=DRAG.paperP[id];
			const p1=DRAG.paperP[id1];
			const p2=DRAG.paperP[id2];
			const p3=DRAG.paperP[id3];

			const gp01=SMath.vector(p0,p1);
			const gp12=SMath.vector(p1,p2);
			const gp03=SMath.vector(p0,p3);

			// calculate intersection
			const newP0S=SMath.lineIntersectionPV(p0,gp03,newP0,gp01);
			const newP1S=SMath.lineIntersectionPV(p1,gp12,newP0,gp01);
			// @TODO: one more verification here, not exceed the paper outer edges
			// update new points
			DRAG.paperP[id]=[newP0S[0],newP0S[1]];
			DRAG.paperP[id1]=[newP1S[0],newP1S[1]];
		}
	}

	draggingArea(offset){
		const newP0=SMath.vector(this.dragOffset,offset);

		// old points
		const p0=DRAG.paperP[0];
		const p1=DRAG.paperP[1];
		const p2=DRAG.paperP[2];
		const p3=DRAG.paperP[3];

		// pan
		const diff=SMath.vector(p0,newP0);
		DRAG.paperP[0]=newP0;
		DRAG.paperP[1]=[p1[0]+diff[0],p1[1]+diff[1]];
		DRAG.paperP[2]=[p2[0]+diff[0],p2[1]+diff[1]];
		DRAG.paperP[3]=[p3[0]+diff[0],p3[1]+diff[1]];
	}

	endDraggingLine(id,offset){
		this.dragOffset=null;
	}
	endDraggingArea(offset){
		this.dragOffset=null;
	}

	// ===================== Verifications for size control =====================
	// verify valid points when doing transform

	static _verifyCropPoint(id,xP,yP){ // verify an active point when cropping
		const [xPRel,yPRel]=DRAG.paperP[(id+2)%4]; // relative reference point
		
		// fix diff lower than 16 pixels
		const [dX,dY]=[xP-xPRel,yP-yPRel];
		if(Math.abs(dX)<16){
			xP=xPRel+16*(Math.sign(dX)||1);
		}
		else if(Math.abs(dX)>ENV.maxPaperSize){
			xP=xPRel+ENV.maxPaperSize*(Math.sign(dX)||1);
		}
		if(Math.abs(dY)<16){
			yP=yPRel+16*(Math.sign(dY)||1);
		}
		else if(Math.abs(dY)>ENV.maxPaperSize){
			yP=yPRel+ENV.maxPaperSize*(Math.sign(dY)||1);
		}

		return [xP,yP];
	}

	static _verifyCropPointZoom(id,xP,yP){ // verify an active point when cropping, zoom
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
		}
		if(xr<1){ // too large
			xP=xPRel+dX*xr;
			yP=yPRel+dY*xr;
		}
		return [xP,yP];
	}

	static _verifyCropLine(id,xP,yP){
		const pRel1=DRAG.paperP[(id+2)%4]; // relative line
		const pRel2=DRAG.paperP[(id+3)%4];
		const dis=SMath.getPointToLineDis(...pRel1,...pRel2,xP,yP);
		if(dis<16){
			return DRAG.paperP[id%4]; // original
		}
		return [xP,yP];
	}
}