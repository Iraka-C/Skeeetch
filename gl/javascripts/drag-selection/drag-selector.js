DRAG={};
/**
 * The class controlling dragging on the drag layer
 */

DRAG.init=function(){
	DRAG.$ui=$("#drag-selection-layer");
	DRAG.$ui.on("pointerdown",e=>{
		console.log(e);
		
	});
};