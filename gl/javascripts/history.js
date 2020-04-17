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
HISTORY.MAX_HISTORY=100; // at most 100 steps

HISTORY.MAX_MEMORY=1024*1024*1024; // at most 1GB
HISTORY.nowRAMUsage=0; // how many RAM is history using?

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
				const oldArea=GLProgram.borderIntersection(oldImageData.validArea,param.area);
				const newArea=GLProgram.borderIntersection(newImageData.validArea,param.area);

				this.oldData=CANVAS.renderer.getBufferFromImageData(oldImageData,oldArea);
				this.newData=CANVAS.renderer.getBufferFromImageData(newImageData,newArea);
				
				// copy contents
				CANVAS.updateLastImageData(node);
				break;
			case "node-pan":
				this.dx=param.dx; // all in paper coordinate, left-top as origin
				this.dy=param.dy;
				break;
			case "node-structure":
				this.from=param.from; // if is null, then it's a new operation
				this.to=param.to; // if is null, then it's a delete operation
				this.oldIndex=param.oldIndex; // old index in the "from" group
				this.newIndex=param.newIndex; // new index in the "to" group
				this.oldActive=param.oldActive; // old active node, may be null
				this.newActive=param.newActive; // new active node, may be null
				break;
			case "node-property":
				this.prevStatus=param.prevStatus;
				this.nowStatus=param.nowStatus;
				break;
			case "bundle":
				this.children=[];
				for(const v of param.children){ // recursive, ascending order
					 // pre-order traversal
					this.children.push(new HistoryItem(v));
				}
				break;
			default:
				throw new Error("Unknown history activity type: "+param.type);
		}

		/**
		 * "bundle" type: a group of actions as a bunch
		 * @TODO: add sumbit-update like API
		 */
	}

	getRAMSize(){ // how many RAM is this item using?
		const pixelBytes=CANVAS.rendererBitDepth/8*4; // RGBA Float(4bytes)
		let size=0;
		switch(this.type){
			case "image-data": // Do not access data directly as the implementation may change
				size+=this.oldData.width*this.oldData.height*pixelBytes;
				size+=this.newData.width*this.newData.height*pixelBytes;
				return size;
			case "bundle":
				for(const v of this.children){
					size+=getHistoryItemRAMSize(v);
				}
				return size;
			default:
				return 0;
		}
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

/**
 * Add History item
 * A HistoryItem shall be added by USER ACTIONS, rather than property manipulation functions
 */
HISTORY.pendingHistoryCnt=0; // How many history item still at pending status? (not added to list)
HISTORY.pendingImageDataChangeParam=new Map(); // pending during busy
HISTORY.addHistory=function(param){ // see HistoryItem constructor for info structure
	// if(HISTORY.list.length>HISTORY.MAX_HISTORY){ // exceed max number
	// 	HISTORY.popHead(); // pop the oldest history and release related resources
	// }
	while(HISTORY.nowRAMUsage>HISTORY.MAX_MEMORY){ // exceed max memory
		console.log("Pop");
		HISTORY.popHead(); // pop the oldest history and release related resources
	}

	/**
	 * special treatment for imagedata change / node property:
	 * Even there are several changes to the same image data during busy, only sumbit once
	 * Even there are several property changes to the same layer, only sumbit once
	 */
	if(param.type=="image-data"){
		if(HISTORY.pendingImageDataChangeParam.has(param.id)){ // already submitted
			const item=HISTORY.pendingImageDataChangeParam.get(param.id);
			item.area=GLProgram.extendBorderSize(item.area,param.area); // extend area, needn't submit again
			return;
		}
		HISTORY.pendingImageDataChangeParam.set(param.id,param); // submit
	}
	if(param.type=="node-property"){
		HISTORY.addPropertyHistory(param);
		return;
	}
	HISTORY.submitPropertyHistory(); // submit pending node-property item
	HISTORY.pendingHistoryCnt++; // new pending
	PERFORMANCE.idleTaskManager.addTask(e=>{
		HISTORY.pendingHistoryCnt--;
		HISTORY.pendingImageDataChangeParam.delete(param.id);
		
		HISTORY.clearAllHistoryAfter(); // delete all item after HISTORY.nowId
		const item=new HistoryItem(param);
		console.log("Add History",item);
		HISTORY.list.push(item);
		HISTORY.nowId++; // point to tail
		HISTORY.nowRAMUsage+=item.getRAMSize();
	});
}

HISTORY.pendingNodePropertyItem=null;
HISTORY.addPropertyHistory=function(param){
	const item=HISTORY.pendingNodePropertyItem;
	if(!item||item.id!=param.id){ // switch to new node
		HISTORY.submitPropertyHistory(item); // submit old
		HISTORY.pendingHistoryCnt++; // new pending
		HISTORY.pendingNodePropertyItem=param; // set new
	}
	else{ // renew status
		item.prevStatus=Object.assign(param.prevStatus,item.prevStatus);
		Object.assign(item.nowStatus,param.nowStatus);
	}
};
HISTORY.submitPropertyHistory=function(param){
	const newParam=param||HISTORY.pendingNodePropertyItem;
	if(newParam){
		PERFORMANCE.idleTaskManager.addTask(e=>{
			HISTORY.pendingHistoryCnt--;
			const item=new HistoryItem(newParam);
			if(param){ // param provided, HISTORY.pendingNodePropertyItem already handled
				// do nothing
			}
			else{ // no param provided, pure update
				HISTORY.pendingNodePropertyItem=null;
			}
			HISTORY.clearAllHistoryAfter(); // delete all item after HISTORY.nowId
			console.log("Add Property History",item);
			HISTORY.list.push(item);
			HISTORY.nowId++; // point to tail
			// No need to update history RAM usage
		});
	}
}

/**
 * Retrieve History item
 */
HISTORY.undo=function(){ // undo 1 step
	const undoInstant=item=>{
		switch(item.type){ // different types
		case "image-data":
			HISTORY.undoImageDataChange(item);
			break;
		case "node-structure":
			HISTORY.undoStructureChange(item);
			break;
		case "node-pan":
			HISTORY.undoNodePan(item);
			break;
		case "node-property":
			HISTORY.undoNodeProperty(item);
			break;
		case "bundle": // pre-order traversal
			for(let i=item.children.length-1;i>=0;i--){
				undoInstant(item.children[i]); // backwards
			}
			break;
		default: // uncategorized
		}
	};
	
	if(HISTORY.nowId<0)return; // no older history
	if(HISTORY.pendingHistoryCnt==0){ // no pending history items, undo immediately
		undoInstant(HISTORY.list[HISTORY.nowId--]);
	}
	else{ // this task is certainly added after all pending tasks
		HISTORY.submitPropertyHistory(); // submit all property change first
		PERFORMANCE.idleTaskManager.addTask(e=>{
			undoInstant(HISTORY.list[HISTORY.nowId--]);
		});
	}
}

HISTORY.redo=function(){ // redo 1 step
	console.log("Redo");

	if(HISTORY.nowId>=HISTORY.list.length-1)return; // no newer history

	const redoInstant=item=>{
		switch(item.type){ // different types
		case "image-data":
			HISTORY.redoImageDataChange(item);
			break;
		case "node-structure":
			HISTORY.redoStructureChange(item);
			break;
		case "node-pan":
			HISTORY.redoNodePan(item);
			break;
		case "node-property":
			HISTORY.redoNodeProperty(item);
			break;
		case "bundle": // pre-order traversal
			for(const v of item.children){
				redoInstant(v);
			}
			break;
		default: // uncategorized
		}
	}
	// redo is always instant
	redoInstant(HISTORY.list[++HISTORY.nowId]);
}

// ================= Deal with each type of Undo/Redo ==================
/**
 * ----------------------------------------------------
 * "image-data" type
 * {type,id,oldData,newData} oldData,newData: GLRAMBuf imageData
 * ----------------------------------------------------
 */
HISTORY.undoImageDataChange=function(item){
	const node=LAYERS.layerHash[item.id];
	LAYERS.setActive(node); // also refresh and set lastRawImageData
	CANVAS.renderer.clearScissoredImageData(node.rawImageData,item.newData);
	CANVAS.renderer.loadToImageData(node.rawImageData,item.oldData);
	CANVAS.updateLastImageData(node);
	node.setRawImageDataInvalid();
	node.updateThumb();
	CANVAS.requestRefresh(); // setActive does not guarantee refresh
}

HISTORY.redoImageDataChange=function(item){
	const node=LAYERS.layerHash[item.id];
	LAYERS.setActive(node); // also refresh and set lastRawImageData
	CANVAS.renderer.clearScissoredImageData(node.rawImageData,item.oldData);
	CANVAS.renderer.loadToImageData(node.rawImageData,item.newData);
	CANVAS.updateLastImageData(node);
	node.setRawImageDataInvalid();
	node.updateThumb();
	CANVAS.requestRefresh(); // setActive does not guarantee refresh
}

/**
 * ----------------------------------------------------
 * "node-structure" type
 * {type,id,from,to,oldIndex,newIndex,oldActive,newActive}
 * ----------------------------------------------------
 */
HISTORY.undoStructureChange=function(item){
	// move obj from newGroup into oldGroup
	const oldGroup=LAYERS.layerHash[item.from];
	const obj=LAYERS.layerHash[item.id];
	
	if(oldGroup){ // a "layer move" operation
		obj.$ui.detach(); // detach $ui from DOM
		obj.detach(); // detach node from layerTree
		oldGroup.insertNode$UI(obj.$ui,item.oldIndex); // insert $ui at old place
		oldGroup.insertNode(obj,item.oldIndex); // insert at old place
		LAYERS.setActive(item.oldActive?item.oldActive:obj); // also refresh. setActive accepts string or Node
		COMPOSITOR.updateLayerTreeStructure(); // call manually. setActive() won't update when active layer's unchanged
	}
	else{ // else: no old group, this is a create-new-layer action
		obj.$ui.detach(); // detach $ui from DOM
		obj.detach(); // detach node from layerTree
		LAYERS.setActive(item.oldActive);
		COMPOSITOR.updateLayerTreeStructure();
	}
}

HISTORY.redoStructureChange=function(item){
	// move obj from oldGroup into newGroup
	const newGroup=LAYERS.layerHash[item.to];
	const obj=LAYERS.layerHash[item.id];
	
	if(newGroup){ // a "layer move" operation
		obj.$ui.detach(); // detach $ui from DOM
		obj.detach(); // detach node from layerTree
		newGroup.insertNode$UI(obj.$ui,item.newIndex); // insert $ui at new place
		newGroup.insertNode(obj,item.newIndex); // insert at new place
		LAYERS.setActive(item.newActive?item.newActive:obj); // also refresh. setActive accepts string or Node
		COMPOSITOR.updateLayerTreeStructure(); // call manually. setActive() won't update when active layer's unchanged
	}
	else{ // else: no new group, this is a delete-layer action
		obj.$ui.detach(); // detach $ui from DOM
		obj.detach(); // detach node from layerTree
		LAYERS.setActive(item.newActive);
		COMPOSITOR.updateLayerTreeStructure();
	}
}

/**
 * ----------------------------------------------------
 * "node-pan" type
 * {type,id,dx,dy}
 * ----------------------------------------------------
 */
HISTORY.undoNodePan=function(item){
	const obj=LAYERS.layerHash[item.id];
	CANVAS.panLayer(obj,-item.dx,-item.dy); // reversely
	obj.setImageDataInvalid(); // merge with clip mask
	CANVAS.requestRefresh();
}
HISTORY.redoNodePan=function(item){
	const obj=LAYERS.layerHash[item.id];
	CANVAS.panLayer(obj,item.dx,item.dy); // again
	obj.setImageDataInvalid(); // merge with clip mask
	CANVAS.requestRefresh();
}

/**
 * ----------------------------------------------------
 * "node-property" type
 * {type,id,prevStatus,nowStatus}
 * ----------------------------------------------------
 */

HISTORY.undoNodeProperty=function(item){
	const obj=LAYERS.layerHash[item.id];
	obj.setProperties(item.prevStatus);
	// refresh / UI updates are handled by setProperties()
}
HISTORY.redoNodeProperty=function(item){
	const obj=LAYERS.layerHash[item.id];
	obj.setProperties(item.nowStatus);
}
// ====================================== Other manip ========================================
// remove the first history record
HISTORY.popHead=function(){
	if(!HISTORY.list.length){ // check is empty
		return;
	}
	const clearAllDeleteNode=item=>{
		if(item.type=="node-structure"&&!item.to){
			const node=LAYERS.layerHash[item.id];
			node.delete(); // destroy imageData or hash number, this method is resursive for a group
		}
		if(item.type=="bundle"){
			for(const v of item.children){
				clearAllDeleteNode(v);
			}
		}
	};

	const item=HISTORY.list[0];
	clearAllDeleteNode(item);
	HISTORY.nowRAMUsage-=item.getRAMSize();
	HISTORY.list.shift();
	HISTORY.nowId--;
}

// clear all history before present status
HISTORY.clearAllHistoryBefore=function(){
	while(HISTORY.nowId>=0){ // pop all histories before nowId = -1
		HISTORY.popHead();
	}
}

// clear all history after present status
HISTORY.clearAllHistoryAfter=function(){
	const clearAllNewNode=item=>{
		if(item.type=="node-structure"&&!item.from){
			const node=LAYERS.layerHash[item.id];
			node.delete(); // destroy imageData or hash number, this method is resursive for a group
		}
		if(item.type=="bundle"){
			for(const v of item.children){
				clearAllNewNode(v);
			}
		}
	};
	let len=HISTORY.list.length;
	for(let i=HISTORY.nowId+1;i<len;i++){ // clear all history afterwards
		const item=HISTORY.list[i];
		clearAllNewNode(item);
		HISTORY.nowRAMUsage-=item.getRAMSize();
	}
	HISTORY.list.splice(HISTORY.nowId+1,len); // len>HISTORY.nowId: delete all item after nowId
}

// clear all histories. nowId should be -1
HISTORY.clearAllHistory=function(){
	HISTORY.clearAllHistoryBefore();
	HISTORY.clearAllHistoryAfter();
}