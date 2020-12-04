DRAG={
	mode: "xy",
	points: [[100,100],[100,200],[200,200],[200,100]], // 4 points, in canvas window coordinate
	paperP: [null,null,null,null], // 4 points, in paper coordinate
	handler: null, // handling the dragged result
	verifier: "crop" // "none"|"crop"
};
/**
 * The class controlling dragging on the drag layer
 * DRAG.mode: ("free"|"xy"|"pan"|"none")
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
		"l41s": DRAG.$ui.find("#l41s")
	};
	_updatePaperP(); // init paper point

	DRAG.$ui.on("pointerdown",e=>{
		const event=e.originalEvent;
		const target=event.target.id; // the id of target
		idTable[target][0].setPointerCapture(event.pointerId);
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

		if(DRAG.verifier=="crop"){ // meet the size requirements of crop
			[offsetX,offsetY]=_verifyCrop(id,offsetX,offsetY);
		}
		
		switch(DRAG.mode){ // assign new point
		case "free":
			DRAG.points[id]=[offsetX,offsetY];
			break;
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

		return;
	}

	DRAG.$ui.on("pointerup",e=>{
		const event=e.originalEvent;
		const target=event.target.id; // the id of target
		idTable[target][0].releasePointerCapture(event.pointerId);
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
		idTable["l12"].attr(pl12); idTable["l12s"].attr(pl12);
		idTable["l23"].attr(pl23); idTable["l23s"].attr(pl23);
		idTable["l34"].attr(pl34); idTable["l34s"].attr(pl34);
		idTable["l41"].attr(pl41); idTable["l41s"].attr(pl41);
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

	function _verifyCrop(id,xW,yW){ // verify an active point when cropping
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