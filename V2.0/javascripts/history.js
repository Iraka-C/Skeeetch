/**
 * History recording & switching
 */
HISTORY={};

HISTORY.list=[];
HISTORY.nowId=-1; // no history yet
HISTORY.nowLength=0;
HISTORY.late

class HistoryItem{
	constructor(info){
		this.info=info;
		/**
		 * Present available types:
		 * canvas-change: change the content of the canvas
		 * move-layer-item: moved a layer item from one place to another (including add/delete)
		 * change-layer-item-property: changed a property of a layer item
		 */
		/**
		 * "canvas-change" type:
		 * info={
		 * 	type: "canvas-change"
		 * 	id: layer id
		 * 	data: imageData
		 * 	prevData: the imageData before the change
		 * }
		 */
		/**
		 * "move-layer-item" type:
		 * info={
		 * 	type: "move-layer-item"
		 * 	subType: (Optional):new,delete
		 * 	id: layer id
		 * 	from: old container id
		 * 	to: new container id
		 * 	oldIndex: index in the old container
		 * 	newIndex: index in the new container
		 * }
		 */
	}
}


// =============== Functions ================

/**
 * init AFTER paper size is set and layer canvas added to UI
 */
HISTORY.init=function(){

}

HISTORY.addHistory=function(info){ // see HistoryItem constructor for info structure
	return; // For debugging
	let len=HISTORY.list.length;
	for(let i=HISTORY.nowId+1;i<len;i++){ // clear all history afterwards
		let item=HISTORY.list[i];
		if(item.info.subType=="new"){ // creating a layer, won't be used anymore
			//console.log("delete",item.info.id);
			delete LAYERS.layerHash[item.info.id]; // release the resource
		}
	}
	HISTORY.nowId++;
	HISTORY.list.splice(HISTORY.nowId,len,new HistoryItem(info)); // len>HISTORY.nowId: delete all item after HISTORY.nowId
	HISTORY.nowLength=HISTORY.list.length;
}

HISTORY.undo=function(){ // undo 1 step
	if(HISTORY.nowId<0)return; // no older history
	let item=HISTORY.list[HISTORY.nowId--];
	switch(item.info.type){
	case "canvas-change":
		HISTORY.undoCanvasChange(item.info);
		break;
	case "move-layer-item":
		HISTORY.undoMoveItem(item.info);
		break;
	default: // uncategorized
	}
}

HISTORY.redo=function(){ // redo 1 step
	if(HISTORY.nowId>=HISTORY.nowLength-1)return; // no newer history
	let item=HISTORY.list[++HISTORY.nowId];
	switch(item.info.type){
	case "canvas-change":
		HISTORY.redoCanvasChange(item.info);
		break;
	case "move-layer-item":
		HISTORY.redoMoveItem(item.info);
		break;
	default: // uncategorized
	}
}

// ================= Deal with each type of Undo/Redo ==================
// "canvas-change" type
HISTORY.undoCanvasChange=function(info){
	let layer=LAYERS.layerHash[info.id];
	let ctx=layer.$div[0].getContext("2d");
	ctx.putImageData(info.prevData,0,0); // use putImageData to ensure image quality
	LAYERS.setActive(layer); // also update canvas buffer and latest image data
	layer.updateSettings(info.prevData);
}
HISTORY.redoCanvasChange=function(info){
	let layer=LAYERS.layerHash[info.id];
	let ctx=layer.$div[0].getContext("2d");
	ctx.putImageData(info.data,0,0);
	LAYERS.setActive(layer); // also update canvas buffer and latest image data
	layer.updateSettings(info.data);
}

// "move-layer-item" type
HISTORY.undoMoveItem=function(info){
	let oldGroup=LAYERS.layerHash[info.from];
	let obj=LAYERS.layerHash[info.id];
	

	if(oldGroup){
		let $ui=obj.$ui.detach(); // get the DOM element $
		let $div=obj.$div.detach(); // get the DOM element $
		oldGroup.insert$UIAt($ui,info.oldIndex);
		oldGroup.insert$At($div,info.oldIndex); // insert at old place
		LAYERS.setActive(obj); // also update canvas buffer and latest image data
		//obj.updateSettings(); // no need because contents weren't changed
	}
	else{ // else: no old group, this is a create-new-layer action
		if(info.to=="root"){ // root
			let $newActive=obj.$ui.next(); // there will always be a next because root always create a new layer before next
			LAYERS.setActive(LAYERS.layerHash[$newActive.attr("data-layer-id")]);
		}
		else{ // normal group
			let newGroup=LAYERS.layerHash[info.to];
			LAYERS.setActive(newGroup);
		}
		obj.$ui.detach(); // get the DOM element $
		obj.$div.detach(); // get the DOM element $
	}
}
HISTORY.redoMoveItem=function(info){
	let newGroup=LAYERS.layerHash[info.to];
	let obj=LAYERS.layerHash[info.id];


	if(newGroup){
		let $ui=obj.$ui.detach(); // get the DOM element $
		let $div=obj.$div.detach(); // get the DOM element $
		newGroup.insert$UIAt($ui,info.newIndex);
		newGroup.insert$At($div,info.newIndex); // insert at new place
		LAYERS.setActive(obj); // also update canvas buffer and latest image data
	}
	else{ // else: no new group, this is a delete-layer action
		if(info.from=="root"){ // simulate the delete - new active layer logic
			let $newActive=obj.$ui.next();
			if(!$newActive.length){
				$newActive=obj.$ui.prev();
			}
			if(!$newActive.length){
				$newActive=obj.$ui.parent();
			}
			// new active layer
			let newActive=LAYERS.layerHash[$newActive.attr("data-layer-id")];
			LAYERS.setActive(newActive);
		}
		else{ // normal group
			let oldGroup=LAYERS.layerHash[info.from];
			LAYERS.setActive(oldGroup);
		}
		obj.$ui.detach(); // get the DOM element $
		obj.$div.detach(); // get the DOM element $
	}
}

// ============== Other manip ================
// remove the first history record
HISTORY.popHead=function(){
	// @TODO: when deleting one element, remove all inner contents from LAYERS list
	let item=HISTORY.list[0];
	if(item.subType=="delete"){ // won't be recalled anymore
		let obj=LAYERS.layerHash[item.info.id]; // the object deleted
		// clear all its descendants
		let $desc=obj.$div.find("*");
		for(let i=0;i<$desc.length;i++){ // for all descendants
			let id=$desc[i].attr("data-layer-id");

		}
	}
}

// clear all history
HISTORY.clearAll=function(){
}