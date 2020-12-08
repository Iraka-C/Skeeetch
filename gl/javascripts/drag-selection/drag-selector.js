DRAG={
	points: [[100,100],[100,200],[200,200],[200,100]], // 4 points, in canvas window coordinate
	paperP: [null,null,null,null], // 4 points, in paper coordinate
	dragHandler: null, // handling the dragged result
};
/**
 * The class controlling dragging on the drag layer
 * DRAG.mode: ("free"|"xy"|"none")
 */

/**
 * Class prototype for dragger
 */
class DragHandler{
	constructor(callback){
		this.callback=callback||null; // callback function after a drag action
	}

	/**
	 * When starting/acting/performing dragging,
	 * record the target (document element id)
	 * and offset from the canvas window
	 * @param {Number} id order of target in document (0~3)
	 * @param {[x,y]} offset x and y offsets in array
	 */
	startDraggingPoint(id,offset){}
	startDraggingLine(id,offset){}

	// These two functions shall modify the DRAG.points
	draggingPoint(id,offset){}
	draggingLine(id,offset){}

	endDraggingPoint(id,offset){}
	endDraggingLine(id,offset){}
}

// ========================= Drag global interface =========================
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

	DRAG.$ui.on("pointerdown",e=>{
		const event=e.originalEvent;
		if(!(event.buttons&1))return; // not left click
		const target=event.target.id; // the id of target
		idTable[target][0].setPointerCapture(event.pointerId);

		if(!DRAG.dragHandler)return; // no handler
		const offsetSVG=DRAG.$ui.offset();
		const offset=[event.pageX-offsetSVG.left,event.pageY-offsetSVG.top];
		const id=target.charAt(1)-1; // present point id
		if(target.startsWith("c")){
			DRAG.dragHandler.startDraggingPoint(id,offset);
		}
		else{
			DRAG.dragHandler.startDraggingLine(id,offset);
		}
	});

	DRAG.$ui.on("pointermove",e=>{
		const event=e.originalEvent;
		if(!(event.buttons&1))return; // not left click
		const target=event.target.id; // the id of target

		if(!DRAG.dragHandler)return; // no handler
		const offsetSVG=DRAG.$ui.offset();
		const offset=[event.pageX-offsetSVG.left,event.pageY-offsetSVG.top];
		const id=target.charAt(1)-1; // present point id

		if(target.startsWith("c")){
			DRAG.dragHandler.draggingPoint(id,offset);
		}
		else{
			DRAG.dragHandler.draggingLine(id,offset);
		}
		_updatePaperP(); // update paper positions
		_updateUI();// move all objects
		if(DRAG.dragHandler.callback){ // callback every move
			DRAG.dragHandler.callback();
		}
	});

	DRAG.$ui.on("pointerup",e=>{
		const event=e.originalEvent;
		if(!(event.buttons&1))return; // not left click
		const target=event.target.id; // the id of target
		idTable[target][0].releasePointerCapture(event.pointerId);


		if(!DRAG.dragHandler)return; // no handler
		const offsetSVG=DRAG.$ui.offset();
		const offset=[event.pageX-offsetSVG.left,event.pageY-offsetSVG.top];
		const id=target.charAt(1)-1; // present point id

		if(target.startsWith("c")){
			DRAG.dragHandler.draggingPoint(id,offset);
		}
		else{
			DRAG.dragHandler.draggingLine(id,offset);
		}
	});

	// ========================== Update contents ============================
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
}

/**
 * Set the DRAG.mode param = mode_
 * 
 * handler_ is the optional callback when dragging
 * verifier_ is the rule for restricting the points
 */
DRAG.setDragHandler=function(handler){
	DRAG.dragHandler=handler||null;
	if(DRAG.$ui){ // initialized
		if(handler){
			DRAG.$ui.fadeIn(250);
		}
		else{
			DRAG.$ui.fadeOut(250);
		}
	}
}