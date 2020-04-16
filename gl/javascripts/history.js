/**
 * History recording & switching
 */
HISTORY={};
/**
 * HISTORY.list is an array containing a sequence of actions, see HistoryItem
 * HISTORY.nowId points to the tail item of the HISTORY.list
 * HISTORY.nodeDataHistory contains the history buffers of the node rawImageData
 * HISTORY.nodeDataHistory[node.id] is a historical image data array: [imgData]
 */
HISTORY.list=[];
HISTORY.nowId=-1; // no history yet
//HISTORY.nodeDataHistory={};
HISTORY.MAX_HISTORY=20; // at most 20 steps

HISTORY.pendingHistoryCnt=0; // How many history item still at pending status? (not added to list)
HISTORY.pendingImageDataChangeItem=new Map();

class HistoryItem{
	constructor(param){
		this.msg=param.msg?param.msg:null;
		/**
		 * Present available types:
		 * image-data: change the content of the image data
		 * node-pan: translating the image data of the node descendants, contents not changed
		 * node-structure: moved a node item from one place to another (including add/delete)
		 * node-property: changed a property of a node item
		 * bundle: a sequence of HistoryItem
		 */
		this.type=param.type;
		this.id=param.id;

		switch(param.type){
			case "image-data":
				const node=LAYERS.layerHash[param.id];
				const newImageData=node.rawImageData; // fetch rawImgData
				const oldImageData=node.lastRawImageData;
				//const imgBuf=CANVAS.renderer.getBufferFromImageData(rawImageData); // TIME CONSUMING!!!

				this.oldData=CANVAS.renderer.getBufferFromImageData(oldImageData,param.area);
				this.newData=CANVAS.renderer.getBufferFromImageData(newImageData,param.area);
				
				// copy contents
				CANVAS.renderer.adjustImageDataBorders(oldImageData,newImageData,false);
				CANVAS.renderer.clearImageData(oldImageData);
				// @TODO: only copy the changed part to save time
				CANVAS.renderer.blendImageData(newImageData,oldImageData,{mode:BasicRenderer.SOURCE});
				break;
			case "node-pan":
				this.prevPos=param.prevPos;
				this.nowPos=param.nowPos;
			case "node-structure":
				this.from=param.from; // if is null, then it's a new operation
				this.to=param.to; // if is null, then it's a delete operation
				this.oldIndex=param.oldIndex; // old index in the "from" group
				this.newIndex=param.newIndex; // new index in the "to" group
				break;
			case "node-property":
				this.prevStatus=param.prevStatus;
				this.nowStatus=param.nowStatus;
			default:
				throw new Error("Unknown history activity type: "+param.type);
		}

		/**
		 * "bundle" type: a group of actions as a bunch
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

HISTORY.addHistory=function(param){ // see HistoryItem constructor for info structure
	//HISTORY.clearAllHistoryAfter(); // delete all item after HISTORY.nowId
	// if(HISTORY.list.length>HISTORY.MAX_HISTORY){ // exceed max number
	// 	HISTORY.popHead(); // pop the oldest history and release related resources
	// }
	// HISTORY.list.push(new HistoryItem(info));
	// HISTORY.nowId++;
	console.log(param);
	
	//return; // For debug

	if(param.type=="image-data"){ // special treatment for imagedata change: only sumbit once
		if(HISTORY.pendingImageDataChangeItem.has(param.id)){ // already submitted
			const item=HISTORY.pendingImageDataChangeItem.get(param.id);
			item.area=GLProgram.extendBorderSize(item.area,param.area); // extend area, needn't submit again
			return;
		}
		HISTORY.pendingImageDataChangeItem.set(param.id,param); // submit
	}
	HISTORY.pendingHistoryCnt++;
	PERFORMANCE.idleTaskManager.addTask(e=>{
		HISTORY.pendingHistoryCnt--;
		HISTORY.pendingImageDataChangeItem.delete(param.id);
		const item=new HistoryItem(param);
		console.log("Add History",item);
		HISTORY.list.push(item);
		HISTORY.nowId++; // point to tail
	});
}

HISTORY.undo=function(){ // undo 1 step
	const undoInstant=()=>{
		console.log("Undo",HISTORY.list,HISTORY.nowId);
		const item=HISTORY.list[HISTORY.nowId--];
		
		switch(item.type){
		case "image-data":
			HISTORY.undoImageDataChange(item);
			break;
		default: // uncategorized
		}
	};
	
	if(HISTORY.nowId<0)return; // no older history
	if(HISTORY.pendingHistoryCnt==0){ // no pending history items, undo immediately
		undoInstant();
	}
	else{ // this task is certainly added after all pending tasks
		PERFORMANCE.idleTaskManager.addTask(e=>{
			undoInstant();
		});
	}

	// let item=HISTORY.list[HISTORY.nowId--];
	// switch(item.info.type){
	// case "canvas-change":
	// 	HISTORY.undoCanvasChange(item.info);
	// 	break;x
	// case "move-layer-item":
	// 	HISTORY.undoMoveItem(item.info);
	// 	break;
	// default: // uncategorized
	// }
}

HISTORY.redo=function(){ // redo 1 step
	console.log("Redo");

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
// "image-data" type
HISTORY.undoImageDataChange=function(item){
	const layer=LAYERS.layerHash[item.id];
	CANVAS.renderer.clearScissoredImageData(layer.rawImageData,item.newData);
	CANVAS.renderer.loadToImageData(layer.rawImageData,item.oldData);
	// @TODO: maintain lastImageData
	layer.setRawImageDataInvalid();
	CANVAS.requestRefresh();
	LAYERS.setActive(layer); // also update canvas buffer and latest image data
}

HISTORY.redoCanvasChange=function(info){
	let layer=LAYERS.layerHash[info.id];
	CANVAS.getNewRenderer(layer.$div[0],{disableBuffer:true}).putImageData(info.data);
	layer.updateSettings(info.data,info.status);
	LAYERS.setActive(layer); // also update canvas buffer and latest image data
}

// ===================================================================

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