DRAG={
	mode: "none",
	points: [[100,100],[100,200],[200,200],[200,100]], // 4 points, in canvas window coordinate
	paperP: [null,null,null,null], // 4 points, in paper coordinate
	handler: null, // handling the dragged result
	verifier: "crop" // "none"|"crop"
};
/**
 * The class controlling dragging on the drag layer
 * DRAG.mode: ("free"|"xy"|"none")
 */

DRAG.init=function(){
	DRAG.$ui=$("#drag-selection-layer");
	const idTable={ // id-$item quick table
		"c1": DRAG.$ui.find("#c1"),
		"c2": DRAG.$ui.find("#c2"),
		"c3": DRAG.$ui.find("#c3"),
		"c4": DRAG.$ui.find("#c4"),

		"l12": DRAG.$ui.find("#l12"),
		"l23": DRAG.$ui.find("#l23"),
		"l34": DRAG.$ui.find("#l34"),
		"l41": DRAG.$ui.find("#l41"),
		"l12s": DRAG.$ui.find("#l12s"),
		"l23s": DRAG.$ui.find("#l23s"),
		"l34s": DRAG.$ui.find("#l34s"),
		"l41s": DRAG.$ui.find("#l41s"),
		// The paddings for receiving events
		"l12p": DRAG.$ui.find("#l12p"),
		"l23p": DRAG.$ui.find("#l23p"),
		"l34p": DRAG.$ui.find("#l34p"),
		"l41p": DRAG.$ui.find("#l41p")
	};
	_updatePaperP(); // init paper point

	let lineDragOffset=null;

	DRAG.$ui.on("pointerdown",e=>{
		const event=e.originalEvent;
		const target=event.target.id; // the id of target
		
		idTable[target][0].setPointerCapture(event.pointerId);
		if(target.startsWith("l")){ // dragging a line, record start offset
			const offsetSVG=DRAG.$ui.offset();
			const offsetX=event.pageX-offsetSVG.left;
			const offsetY=event.pageY-offsetSVG.top;
			const id=target.charAt(1)-1; // present point id
			const startP=DRAG.points[id];
			lineDragOffset=[offsetX-startP[0],offsetY-startP[1]];
		}
	});

	DRAG.$ui.on("pointermove",e=>{
		const event=e.originalEvent;
		const target=event.target.id; // the id of target
		if(!(event.buttons&1))return; // not left click

		if(target.startsWith("c")){
			const id=target.charAt(1)-1; // present point id
			dragPoint(event,id);
		}
		else if(target.startsWith("l")){
			const id=target.charAt(1)-1; // present point id
			dragLine(event,id);
		}
		_updatePaperP(); // update paper positions
		_updateUI();// move all objects
		if(DRAG.handler){ // callback every move
			DRAG.handler();
		}
	});

	function dragPoint(event,id){
		// calculate event offset
		// NOTICE: event.offsetX/Y isn't reliable
		// it may consider the root as the dragged item, not relative to svg
		const offsetSVG=DRAG.$ui.offset();
		let offsetX=event.pageX-offsetSVG.left;
		let offsetY=event.pageY-offsetSVG.top;
		
		let nowDragMode="none";
		switch(DRAG.mode){ // assign new point
			case "free":
				if(EVENTS.key.shift)nowDragMode="zoom";
				else if(EVENTS.key.ctrl)nowDragMode="rotate";
				else if(EVENTS.key.alt)nowDragMode="free";
				else nowDragMode="xy";
				break;
			case "xy": // also adjust neighbor 2 points
				if(EVENTS.key.shift)nowDragMode="zoom";
				else if(EVENTS.key.ctrl)nowDragMode="pan";
				else nowDragMode="xy";
				break;
			default: // including "none", do nothing
				return;
		}

		switch(nowDragMode){ // verify
			case "zoom":{
				const p0=DRAG.points[id];
				const p2=DRAG.points[(id+2)%4];
				const g02=SMath.vector(p0,p2); // orthogonal line
				const h02=[-g02[1],g02[0]]; // perpendicular to g02
				[offsetX,offsetY]=SMath.lineIntersectionPV(p0,g02,[offsetX,offsetY],h02);
				if(DRAG.verifier=="crop"){ // meet the size requirements of crop
					[offsetX,offsetY]=_verifyCropPointZoom(id,offsetX,offsetY);
				}
				break;
			}
			case "xy":{
				if(DRAG.verifier=="crop"){ // meet the size requirements of crop
					[offsetX,offsetY]=_verifyCropPoint(id,offsetX,offsetY);
				}
			}
			
		}

		switch(nowDragMode){ // assign new point
			case "free":
				DRAG.points[id]=[offsetX,offsetY];
				break;
			case "zoom": // already dealt with new position
			case "xy":{ // also adjust neighbor 2 points
				const p0=DRAG.points[id];
				const newP0=[offsetX,offsetY];
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
				// @TODO: one more verification here, not exceed the paper outer edges
				// update new points
				DRAG.points[id]=newP0;
				DRAG.points[id1]=[newP1S[0],newP1S[1]];
				DRAG.points[id3]=[newP3S[0],newP3S[1]];
				break;
			}
			case "pan":{
				const newP0=[offsetX,offsetY];

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

				break;
			}
			default: // including "none", do nothing
				return;
		}
	}

	function dragLine(event,id){
		// calculate event offset
		// NOTICE: event.offsetX/Y isn't reliable
		// it may consider the root as the dragged item, not relative to svg
		const offsetSVG=DRAG.$ui.offset();
		let offsetX=event.pageX-offsetSVG.left;
		let offsetY=event.pageY-offsetSVG.top;


		let nowDragMode="none";
		switch(DRAG.mode){ // assign new point
			case "free":
				if(EVENTS.key.shift||EVENTS.key.ctrl)nowDragMode="pan";
				else if(EVENTS.key.alt)nowDragMode="free";
				else nowDragMode="xy";
				break;
			case "xy": // also adjust neighbor 2 points
				if(EVENTS.key.shift||EVENTS.key.ctrl)nowDragMode="pan";
				else nowDragMode="xy";
				break;
			default: // including "none", do nothing
				return;
		}

		if(DRAG.verifier=="crop"){ // meet the size requirements of crop
			[offsetX,offsetY]=_verifyCropLine(id,offsetX,offsetY);
		}

		switch(nowDragMode){ // assign new point
			case "free":{
				const id1=(id+1)%4;
				const dLine=SMath.vector(DRAG.points[id],DRAG.points[id1]);
				const newP0=[offsetX-lineDragOffset[0],offsetY-lineDragOffset[1]];
				DRAG.points[id]=newP0;
				DRAG.points[id1]=[newP0[0]+dLine[0],newP0[1]+dLine[1]];
				break;
			}
			case "xy":{ // also adjust neighbor 2 points
				const newP0=[offsetX,offsetY];

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
				break;
			}
			case "pan":{
				const newP0=[offsetX-lineDragOffset[0],offsetY-lineDragOffset[1]];
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
			default: // including "none", do nothing
				return;
			}
	}

	DRAG.$ui.on("pointerup",e=>{
		const event=e.originalEvent;
		const target=event.target.id; // the id of target
		idTable[target][0].releasePointerCapture(event.pointerId);
		lineDragOffset=null;
	});

	function _updateUI(p2wTransArr){ // in a closure
		let points;
		if(p2wTransArr){ // decide with a certain transform array [x,y,r,s]
			points=new Array(4);
			for(let i=0;i<4;i++){
				points[i]=ENV.toWindowXY(...DRAG.paperP[i],p2wTransArr);
			}
		}
		else{
			points=DRAG.points;
		}
		const pc1={"cx":points[0][0],"cy":points[0][1]};
		const pc2={"cx":points[1][0],"cy":points[1][1]};
		const pc3={"cx":points[2][0],"cy":points[2][1]};
		const pc4={"cx":points[3][0],"cy":points[3][1]};
	
		idTable["c1"].attr(pc1);
		idTable["c2"].attr(pc2);
		idTable["c3"].attr(pc3);
		idTable["c4"].attr(pc4);
	
		const pl12={"x1":points[0][0],"y1":points[0][1],"x2":points[1][0],"y2":points[1][1]};
		const pl23={"x1":points[1][0],"y1":points[1][1],"x2":points[2][0],"y2":points[2][1]};
		const pl34={"x1":points[2][0],"y1":points[2][1],"x2":points[3][0],"y2":points[3][1]};
		const pl41={"x1":points[3][0],"y1":points[3][1],"x2":points[0][0],"y2":points[0][1]};
		idTable["l12"].attr(pl12); idTable["l12s"].attr(pl12); idTable["l12p"].attr(pl12);
		idTable["l23"].attr(pl23); idTable["l23s"].attr(pl23); idTable["l23p"].attr(pl23);
		idTable["l34"].attr(pl34); idTable["l34s"].attr(pl34); idTable["l34p"].attr(pl34);
		idTable["l41"].attr(pl41); idTable["l41s"].attr(pl41); idTable["l41p"].attr(pl41);
	}
	DRAG.updateUI=_updateUI;

	function _updatePaperP(){ // points -> paperP
		for(let i=0;i<4;i++){
			DRAG.paperP[i]=ENV.toPaperXY(...DRAG.points[i]);
		}
	}
	function _updatePoints(){ // paperP -> points
		for(let i=0;i<4;i++){
			DRAG.points[i]=ENV.toWindowXY(...DRAG.paperP[i]);
		}
	}
	DRAG.setNewPaperPoints=function(paperP){
		DRAG.paperP=paperP;
		_updatePoints();
		_updateUI();
	}

	// verify valid points when doing transform

	function _verifyCropPoint(id,xW,yW){ // verify an active point when cropping
		let [xP,yP]=ENV.toPaperXY(xW,yW);
		const [xPRel,yPRel]=DRAG.paperP[(id+2)%4]; // relative reference point
		
		// fix diff lower than 16 pixels
		const [dX,dY]=[xP-xPRel,yP-yPRel];
		let isGood=true;
		if(Math.abs(dX)<16){
			xP=xPRel+16*(Math.sign(dX)||1);
			isGood=false;
		}
		if(Math.abs(dY)<16){
			yP=yPRel+16*(Math.sign(dY)||1);
			isGood=false;
		}
		if(isGood){ // no change at all
			return [xW,yW];
		}

		return ENV.toWindowXY(xP,yP); // new position in window
	}

	function _verifyCropPointZoom(id,xW,yW){ // verify an active point when cropping, zoom
		let [xP,yP]=ENV.toPaperXY(xW,yW);
		const [xPRel,yPRel]=DRAG.paperP[(id+2)%4]; // relative reference point
		
		// fix diff lower than 16 pixels
		const [dX,dY]=[xP-xPRel,yP-yPRel];
		const ratioX=16/Math.abs(dX),ratioY=16/Math.abs(dY);
		const r=Math.max(ratioX,ratioY,1);
		if(r==1){ // no change at all
			return [xW,yW];
		}
		xP=xPRel+dX*r;
		yP=yPRel+dY*r;
		return ENV.toWindowXY(xP,yP); // new position in window
	}

	function _verifyCropLine(id,xW,yW){
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

/**
 * Set the DRAG.mode param = mode_
 * 
 * handler_ is the optional callback when dragging
 * verifier_ is the rule for restricting the points
 */
DRAG.setMode=function(mode_,handler_,verifier_){
	DRAG.mode=mode_||"none";
	if(DRAG.mode=="none"){ // cancel all action
		if(DRAG.$ui)DRAG.$ui.fadeOut(250);
		DRAG.handler=null;
		DRAG.verifier="none";
	}
	else{
		if(DRAG.$ui)DRAG.$ui.fadeIn(250);
		if(handler_)DRAG.handler=handler_;
		if(verifier_)DRAG.verifier=verifier_;
	}
}