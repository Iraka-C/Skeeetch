/**
 * History recording & switching
 */
HISTORY={};

HISTORY.list=[];
HISTORY.nowId=-1; // no history yet
HISTORY.MAX_HISTORY=20; // at most 20 steps

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
		 * 	status: the button status (locked, blend, clip) of the present layer
		 * 	prevStatus: the button status (locked, blend, clip) before the change
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
		 * 	status: the button status (locked, blend, clip) of the present layer
		 * 	prevStatus: the button status (locked, blend, clip) before the change
		 * }
		 */

		/**
		 * "change-layer-button-status" type:
		 */
		/**
		 * "history-group" type: a group of actions as a bunch
		 * @TODO: add sumbit-update like API
		 */
	}
}


// =============== Functions ================

/**
 * init AFTER paper size is set and layer canvas added to UI
 */
HISTORY.init=function(){
	EventDistributer.key.addListener($(window),"ctrl+z",event=>{
		HISTORY.undo();
	});
	EventDistributer.key.addListener($(window),"ctrl+shift+z",event=>{
		HISTORY.redo();
	});
	EventDistributer.key.addListener($(window),"ctrl+y",event=>{
		HISTORY.redo();
	});
}

HISTORY.addHistory=function(info){ // see HistoryItem constructor for info structure
	HISTORY.clearAllHistoryAfter(); // delete all item after HISTORY.nowId
	if(HISTORY.list.length>HISTORY.MAX_HISTORY){ // exceed max number
		HISTORY.popHead(); // pop the oldest history and release related resources
	}
	HISTORY.list.push(new HistoryItem(info));
	HISTORY.nowId++;
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
	if(HISTORY.nowId>=HISTORY.list.length-1)return; // no newer history
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
	// use temp renderer without buffer (the buffer will be filled after set active)
	CANVAS.getNewRenderer(layer.$div[0],{disableBuffer:true}).putImageData(info.prevData);
	layer.updateSettings(info.prevData,info.prevStatus);
	LAYERS.setActive(layer); // also update canvas buffer and latest image data
	// @TODO: logic here
}
HISTORY.redoCanvasChange=function(info){
	let layer=LAYERS.layerHash[info.id];
	CANVAS.getNewRenderer(layer.$div[0],{disableBuffer:true}).putImageData(info.data);
	layer.updateSettings(info.data,info.status);
	LAYERS.setActive(layer); // also update canvas buffer and latest image data
}

// "move-layer-item" type
// @TODO: add layer / group status
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
	if(HISTORY.list.length==0){ // check is empty
		return;
	}
	let item=HISTORY.list[0];
	if(item.info.subType=="delete"){ // won't be recalled anymore
		let idList=[item.info.id];
		let obj=LAYERS.layerHash[item.info.id]; // the object deleted
		// clear all its descendants and itself
		obj.$div.find("*").each(function(){
			idList.push($(this).attr("data-layer-id"));
		});
		for(let id of idList){ // remove from layer list to release memory
			delete LAYERS.layerHash[id];
		}
	}
	HISTORY.list.shift();
	HISTORY.nowId--; // <= handled by other functions?
}

// clear all history before present status
HISTORY.clearAllHistoryBefore=function(){
	while(HISTORY.nowId>=0){ // pop all histories before nowId = -1
		HISTORY.popHead();
	}
}

// clear all history after present status
HISTORY.clearAllHistoryAfter=function(){
	let len=HISTORY.list.length;
	for(let i=HISTORY.nowId+1;i<len;i++){ // clear all history afterwards
		let item=HISTORY.list[i];
		if(item.info.subType=="new"){ // creating a layer action, won't be used anymore
			delete LAYERS.layerHash[item.info.id]; // release the resource
		}
	}
	HISTORY.list.splice(HISTORY.nowId+1,len); // len>HISTORY.nowId: delete all item after nowId
}

// clear all histories. nowId should be -1
HISTORY.clearAllHistory=function(){
	HISTORY.clearAllHistoryBefore();
	HISTORY.clearAllHistoryAfter();
}