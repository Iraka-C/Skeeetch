/**
 * Layer manager
 */
LAYERS={};
LAYERS.layerHash={}; // layer id => layer object
/**
 * The node order in layerTree is identical to the Layer Panel DOM
 * which means, rendering order is reversed (tail->head)
 */
LAYERS.layerTree=null; // no node yet
LAYERS.active=null;

/**
 * generate a unique hash tag for every layer/group
 */
LAYERS.generateHash=function(prefix){
	const PRIME=2147483647;
	let tag="";
	const randArr=new Uint32Array(1);
	do{
		window.crypto.getRandomValues(randArr);
		tag=prefix+randArr[0]%PRIME;
	}while(LAYERS.layerHash.hasOwnProperty(tag));
	return tag;
}

// =================== Node definition ===================

class LayerNode{
	constructor(id){
		// if a specific id provided (e.g. root), use that id
		/**
		 * A layer can have many properties. These are the common ones:
		 * 1. layer id: an id to register itself to the hash table.
		 * 2. parent: the parent node of this node. if root, set to null.
		 * 3. name: the name of this layer
		 */
		this.id=id||LAYERS.generateHash("i");
		LAYERS.layerHash[this.id]=this; // register this node
		this.parent=null; // not specified, should be a node
		this.children=[]; // not specified, should be an array of nodes
		this.index=NaN; // the index in parent node. NaN for no parent
		// Not -1. some index-based selectors accept negative number
	}
	setActiveUI(isActive){
		// Expected: set the UI effect of this node
	}
	delete(){
		console.log("Delete "+this.id);
		
		// Expected: called when deleting this node, release resource
		// implementation: throw layer contents, detach DOM elements, ...
		delete LAYERS.layerHash[this.id]; // anyway, remove from hash table
		/**
		 * NOTICE: different from deleting the node from layer menu!
		 * In that case, the node might still be in the history record
		 * */
		// This method shall be iterative: calls on one node releases all subnodes

	}
	// ============= Node Position Operation =============
	getIndex(){ // get the index of this node in the parent's children
		// if(!this.parent)return NaN; // no parent
		// const children=this.parent.children;
		// for(let i=0;i<children.length;i++){
		// 	if(children[i]==this){ // found
		// 		return i;
		// 	}
		// }
		// return NaN; // not found
		return this.index;
	}
	detach(){ // remove this object from the parent
		if(!this.parent)return; // already detached
		this.parent.removeNode(this.getIndex()); // the return value is 'this'
	}
	insertNode(node,pos){ // insert a new node reference into children at pos
		if(pos===undefined)throw new Error("Cannot insert at undefined");
		// put node at pos, shift +1 the original nodes from pos
		const children=this.children;
		children.splice(pos,0,node);
		node.parent=this; // add parent pointer
		for(let i=pos;i<children.length;i++){ // rearrange index
			children[i].index=i;
		}
	}
	addNodeBefore(node){ // add another node before this one
		if(!this.parent){ // Fail
			console.error(this);
			throw new Error("Node has no parent");
		}
		this.parent.insertNode(node,this.getIndex());
	}
	addNodeAfter(node){ // add another node after this one
		if(!this.parent){ // Fail
			console.error(this);
			throw new Error("Node has no parent");
		}
		this.parent.insertNode(node,this.getIndex()+1);
	}
	removeNode(pos){ // remove a node reference from this.children
		if(isNaN(pos)||pos<0)throw new Error("Removing node index out of bound: "+pos); // Fail
		const children=this.children;
		const removed=children[pos];
		removed.parent=null; // remove parent pointer
		children.splice(pos,1); // delete from this node
		for(let i=pos;i<children.length;i++){ // rearrange index
			children[i].index=i;
		}
		return removed;
	}
	_getTreeNodeString(_depth){
		_depth=_depth||0; // start from 0
		let str="   ".repeat(_depth)+this.id+": "+(this.parent?this.parent.id:"---")+"\n";
		for(let v of this.children){
			str+=v._getTreeNodeString(_depth+1);
		}
		return str;
	}
}

// =================== Layer construction =======================

/**
 * Enable drag-and-sort on this element
 */
LAYERS.set$ElementAsLayerContainer=function($el){
	return new Sortable($el[0],{
		group:"layer-group",
		animation:200,
		fallbackOnBody:true,
		swapThreshold:0.2, // sensitivity. Better keep low
		onAdd:LAYERS.onOrderChanged, // group structure changed
		onUpdate:LAYERS.onOrderChanged, // group remains, order within group changed
		onStart:()=>{
			$("#layer-panel-drag-up").css("display","block");
			$("#layer-panel-drag-down").css("display","block");
		},
		onEnd:()=>{
			$("#layer-panel-drag-up").css("display","none");
			$("#layer-panel-drag-down").css("display","none");
		}
	});
}

LAYERS.onOrderChanged=function(event){
	// Before: Remove all other divs in the canvas container
	const oldGroupId=event.from.getAttribute("data-layer-id");
	const newGroupId=event.to.getAttribute("data-layer-id");
	const itemId=event.item.getAttribute("data-layer-id");
	const oldIndex=event.oldIndex;
	const newIndex=event.newIndex;

	let oldGroup=LAYERS.layerHash[oldGroupId];
	let newGroup=LAYERS.layerHash[newGroupId];
	let obj=LAYERS.layerHash[itemId];
	obj.detach(); // remove from original node
	newGroup.insertNode(obj,newIndex); // insert at new place

	// HISTORY.addHistory({ // add a history item
	// 	type:"move-layer-item",
	// 	id:itemId,
	// 	from:oldGroupId,
	// 	to:newGroupId,
	// 	oldIndex:oldIndex,
	// 	newIndex:newIndex
	// });

	// set these data invalid: @RENEW: handled in node operation
	// oldGroup.setClipMaskOrderInvalid(); // clip mask order may change
	// newGroup.setClipMaskOrderInvalid();
	// oldGroup.setRawImageDataInvalid(); // needs recomposition
	// newGroup.setRawImageDataInvalid();
	CANVAS.requestRefresh(); // recomposite immediately
}

// ========================= Manipulation ===========================
/**
 * Init layer panels and functions
 */
LAYERS.init=function(){
	
	LAYERS.layerTree=new RootNode(); // The root of the layer tree

	LAYERS.initFirstLayer();
	LAYERS.initLayerPanelButtons();
	LAYERS.initScrollbar();

	 // prevent dragging from starting a stroke on <html>
	$("#layer-panel").on("pointerdown",event=>{
		event.stopPropagation();
	});
}

/**
 * Add a first blank layer to the layer panel
 */
LAYERS.initFirstLayer=function(){
	let layer=new CanvasNode();
	LAYERS.layerTree.insertNode$UI(layer); 
	LAYERS.layerTree.insertNode(layer,0); // append the contents to layerTree
	//layer.setName(Lang("Background"));
	LAYERS.setActive(layer);
	// layer.$ui.children(".layer-name-label").val(Lang("Background"));
	// LAYERS.active.$ui.children(".layer-group-container").prepend(layer.$ui);
	// LAYERS.active.$div.append(layer.$div);
	// LAYERS.setActive(layer);
	// // @TODO: try registering Once handler list
	// CANVAS.renderer.fillColor([255,255,255,255]); // Sync!
	// layer.latestImageData=CANVAS.renderer.getImageData(); // get filled image data
	// layer._setButtonStatus({
	// 	lock:1
	// }); // lock background opacity
	// layer.prevStatus=layer._getButtonStatus(); // save first status
}

/**
 * Set a layer / group as the present active object
 * Also set the canvas target to this object
 * but WON'T update latest image data: in fact it uses this data
 */
LAYERS.setActive=function(obj){ // layer or group or id
	if(typeof(obj)=="string"){ // id
		obj=LAYERS.layerHash[obj];
	}
	if(LAYERS.active==obj){ // already active
		return;
	}
	LAYERS._inactive();

	obj.setActiveUI(true);
	LAYERS.active=obj;
	if(obj instanceof CanvasNode){ // canvas layer
		CANVAS.setTargetLayer(obj,obj.rawImageData); // set CANVAS draw target
	}
	else if(obj instanceof LayerGroupNode){ // group
		// @TODO: Optimize when selecting the same canvas layer again
		CANVAS.setTargetLayer(null); // disable canvas
	}
}

// deactivate the present active object
LAYERS._inactive=function(){
	if(!LAYERS.active){ // already deactivated
		return;
	}
	LAYERS.active.setActiveUI(false);
	LAYERS.active=null;
}

// ======================= UI Settings =============================

LAYERS.initLayerPanelButtons=function(){
	// New Layer Button
	$("#new-layer-button").on("click",event=>{ // new layer
		let layer=new CanvasNode();
		// active type
		// @TODO: add history record in each type
		if(LAYERS.active instanceof CanvasNode){
			LAYERS.active.addNodeBefore(layer);
			LAYERS.active.$ui.before(layer.$ui);
		}
		else if(LAYERS.active instanceof LayerGroupNode){
			if(LAYERS.active.isExpanded){ // put new layer at first
				LAYERS.active.insertNode(layer,0);
				LAYERS.active.insertNode$UI(layer.$ui,0);
			}
			else{
				LAYERS.active.addNodeBefore(layer);
				LAYERS.active.$ui.before(layer.$ui);
			}
		}
		LAYERS.setActive(layer);
	});
	EventDistributer.footbarHint($("#new-layer-button"),()=>Lang("Add a new layer"));

	$("#new-group-button").on("click",event=>{ // new group
		let group=new LayerGroupNode();
		// Always add group before
		LAYERS.active.addNodeBefore(group);
		LAYERS.active.$ui.before(group.$ui);
		LAYERS.setActive(group);
	});
	EventDistributer.footbarHint($("#new-group-button"),()=>Lang("Add a new layer group"));

	$("#delete-button").on("click",event=>{
		LAYERS.deleteItem(LAYERS.active);
	});
	EventDistributer.footbarHint($("#delete-button"),()=>Lang("Delete current layer / group"));

	$("#clear-button").on("click",event=>{
		CANVAS.clearAll();
	});
	EventDistributer.footbarHint($("#clear-button"),()=>Lang("Clear current layer"));
}

/**
 * Delete obj from layer ui container (but not layer tree: for history recording)
 */
LAYERS.deleteItem=function(obj){
	let newActive;

	let i=obj.getIndex(); // obj is not root, i must be valid
	if(obj.parent.children.length-1>i){ // There's next child
		newActive=obj.parent.children[i+1];
	}
	else if(i>0){ // There's previous child
		newActive=obj.parent.children[i-1];
	}
	else{ // no next and no prev: set parent active
		newActive=obj.parent;
	}
	if(newActive==LAYERS.layerTree){ // only the root remains
		return; // cannot delete
	}
	LAYERS._inactive();
	LAYERS.setActive(newActive);

	// HISTORY.addHistory({ // add a delete layer history item, before detach
	// 	type:"move-layer-item",
	// 	subType:"delete",
	// 	id:obj.id,
	// 	from:obj.$ui.parent().attr("data-layer-id"),
	// 	to:null,
	// 	oldIndex:obj.$ui.index(),
	// 	newIndex:null
	// });

	obj.$ui.detach(); // remove layer ui

	obj.parent.setImageDataInvalid(); // the content of parent is changed
	obj.detach(); // remove from layer tree
	CANVAS.refreshScreen(); // recomposite immediately

	// remove from hash: in HISTORY.addHistory when this layer won't be retrieved
	// The followings are only for debugging delete
	obj.delete();
}
