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
LAYERS.generateHash=function() {
	let tag="";
	do {
		tag=ENV.hash("i");
	} while(LAYERS.layerHash.hasOwnProperty(tag));
	return tag;
}

// =================== Node definition ===================

class LayerNode {
	constructor(id) {
		// if a specific id provided (e.g. root), use that id
		/**
		 * A layer can have many properties. These are the common ones:
		 * 1. layer id: an id to register itself to the hash table.
		 * 2. parent: the parent node of this node. if root, set to null.
		 * 3. name: the name of this layer
		 */
		this.id=id||LAYERS.generateHash();
		LAYERS.layerHash[this.id]=this; // register this node
		this.parent=null; // not specified, should be a node
		this.children=[]; // not specified, should be an array of nodes
		this.index=NaN; // the index in parent node. NaN for no parent, order same as in the ui container
		// Not -1. some index-based selectors accept negative number
		this.name=""; // displayed name
	}
	setActiveUI(isActive) {
		// Expected: set the UI effect of this node
	}
	delete() {
		//console.log("Delete "+this.id);

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
	getIndex() { // get the index of this node in the parent's children
		return this.index;
	}
	detach() { // remove this object from the parent
		if(!this.parent) return; // already detached
		this.parent.removeNode(this.getIndex()); // the return value is 'this'
	}
	insertNode(node,pos) { // insert a new node reference into children at pos
		if(typeof (pos)!="number") throw new Error("Cannot insert at not a number position");
		// put node at pos, shift +1 the original nodes from pos
		const children=this.children;
		children.splice(pos,0,node);
		node.parent=this; // add parent pointer
		for(let i=pos;i<children.length;i++) { // rearrange index
			children[i].index=i;
		}
	}
	addNodeBefore(node) { // add another node before this one
		if(!this.parent) { // Fail
			console.error(this);
			throw new Error("Node has no parent");
		}
		this.parent.insertNode(node,this.getIndex());
	}
	addNodeAfter(node) { // add another node after this one
		if(!this.parent) { // Fail
			console.error(this);
			throw new Error("Node has no parent");
		}
		this.parent.insertNode(node,this.getIndex()+1);
	}
	removeNode(pos) { // remove a node reference from this.children
		if(isNaN(pos)||pos<0) throw new Error("Removing node index out of bound: "+pos); // Fail
		const children=this.children;
		const removed=children[pos];
		removed.parent=null; // remove parent pointer
		children.splice(pos,1); // delete from this node
		for(let i=pos;i<children.length;i++) { // rearrange index
			children[i].index=i;
		}
		return removed;
	}
	_getTreeNodeString(_depth) {
		_depth=_depth||0; // start from 0
		let str="   ".repeat(_depth)+this.id+"\n";
		for(let v of this.children) {
			str+=v._getTreeNodeString(_depth+1);
		}
		return str;
	}
	// get a JSON object that is writable by ag-psd
	getAgPSDCompatibleJSON() {
		// abstract
	}
}

// =================== Layer construction =======================

/**
 * Enable drag-and-sort on this element
 */
LAYERS.set$ElementAsLayerContainer=function($el) {
	return new Sortable($el[0],{
		group: "layer-group",
		animation: 200,
		fallbackOnBody: true,
		swapThreshold: 0.2, // sensitivity. Better keep low
		onAdd: LAYERS.onOrderChanged, // group structure changed
		onUpdate: LAYERS.onOrderChanged, // group remains, order within group changed
		onStart: () => {
			$("#layer-panel-drag-up").css("display","block");
			$("#layer-panel-drag-down").css("display","block");
		},
		onEnd: () => {
			$("#layer-panel-drag-up").css("display","none");
			$("#layer-panel-drag-down").css("display","none");
		}
	});
}

LAYERS.onOrderChanged=function(event) {
	// Before: Remove all other divs in the canvas container
	const oldGroupId=event.from.getAttribute("data-layer-id");
	const newGroupId=event.to.getAttribute("data-layer-id");
	const itemId=event.item.getAttribute("data-layer-id");
	const oldIndex=event.oldIndex;
	const newIndex=event.newIndex;

	//let oldGroup=LAYERS.layerHash[oldGroupId];
	let newGroup=LAYERS.layerHash[newGroupId];
	let obj=LAYERS.layerHash[itemId];
	obj.detach(); // remove from original node, set coresponding nodes invalid
	newGroup.insertNode(obj,newIndex); // insert at new place, set coresponding nodes invalid

	HISTORY.addHistory({ // add a history item
		type: "node-structure",
		id: itemId,
		from: oldGroupId,
		to: newGroupId,
		oldIndex: oldIndex,
		newIndex: newIndex
	});

	COMPOSITOR.updateLayerTreeStructure(); // recomposite immediately
}

// ========================= Manipulation ===========================
/**
 * Init layer panels and functions
 */
LAYERS.init=function(layerTreeJSON) {

	LAYERS.layerTree=new RootNode(); // The root of the layer tree
	LAYERS.initLayerPanelButtons();
	LAYERS.initScrollbar();
	if(!LAYERS.blendModeSelector){ // create a selector
		LAYERS.blendModeSelector=new LayerBlendModeSelector();
	}

	// prevent dragging from starting a stroke on <html>
	$("#layer-panel").on("pointerdown",event => {
		event.stopPropagation();
	});

	if(!layerTreeJSON){
		LAYERS.initFirstLayer();
	}
	else{ // blabla
		console.log("loading layer tree");
		STORAGE.FILES.loadLayerTree(layerTreeJSON);
	}
}

/**
 * Add a first blank layer to the layer panel
 */
LAYERS.initFirstLayer=function() {
	// Create Node
	let layer=new CanvasNode();
	LAYERS.layerTree.insertNode$UI(layer.$ui);
	LAYERS.layerTree.insertNode(layer,0); // append the contents to layerTree
	// Clear Blank imageData
	layer.assignNewRawImageData(ENV.paperSize.width,ENV.paperSize.height,0,0);
	CANVAS.renderer.clearImageData(layer.rawImageData,[1,1,1,1],false);
	layer.setRawImageDataInvalid();
	// Set Properties
	layer.setProperties({name: Lang("Background"),pixelOpacityLocked: true});
	LAYERS.setActive(layer);
	STORAGE.FILES.saveContentChanges(layer);
}

/**
 * Set a layer / group as the present active object
 * Also set the canvas target to this object
 * but WON'T update latest image data: in fact it uses this data
 */
LAYERS.setActive=function(obj) { // layer or group or id
	if(typeof (obj)=="string") { // id
		obj=LAYERS.layerHash[obj];
	}
	if(LAYERS.active==obj) { // already active
		return;
	}
	LAYERS._inactive();

	obj.setActiveUI(true);
	LAYERS.active=obj;
	if(obj instanceof CanvasNode) { // canvas layer
		CANVAS.setTargetLayer(obj); // set CANVAS draw target, also prepare history
		$("#clear-button").children("img").attr("src","./resources/clear-layer.svg"); // clear
	}
	else if(obj instanceof LayerGroupNode) { // group
		// @TODO: Optimize when selecting the same canvas layer again
		CANVAS.setTargetLayer(null); // disable canvas
		$("#clear-button").children("img").attr("src","./resources/merge-group.svg"); // merge
	}
	COMPOSITOR.updateLayerTreeStructure();
}

// deactivate the present active object
LAYERS._inactive=function() {
	if(!LAYERS.active) { // already deactivated
		return;
	}
	STORAGE.FILES.requestSaveContentChanges(); // check is saved
	LAYERS.active.setActiveUI(false);
	LAYERS.active=null;
}
// ======================= UI Settings =============================

LAYERS.initLayerPanelButtons=function() {
	// New Layer Button
	$("#new-layer-button").on("click",event => { // new layer
		const layer=LAYERS.addNewCanvasNode();
		HISTORY.addHistory({ // add a history item
			type: "node-structure",
			id: layer.id,
			from: null,
			to: layer.parent.id,
			oldIndex: null,
			newIndex: layer.getIndex(),
			oldActive: LAYERS.active.id,
			newActive: layer.id
		});
		LAYERS.setActive(layer);
		STORAGE.FILES.saveContentChanges(layer);
		// No need to refresh canvas: a transparent layer
	});
	EventDistributer.footbarHint($("#new-layer-button"),() => Lang("Add a new layer"));

	// New group button
	$("#new-group-button").on("click",event => { // new group
		const group=new LayerGroupNode();
		// Always add group before
		LAYERS.active.addNodeBefore(group);
		LAYERS.active.$ui.before(group.$ui);
		HISTORY.addHistory({ // add a history item
			type: "node-structure",
			id: group.id,
			from: null,
			to: group.parent.id,
			oldIndex: null,
			newIndex: group.getIndex(),
			oldActive: LAYERS.active.id,
			newActive: group.id
		});
		LAYERS.setActive(group);
	});
	EventDistributer.footbarHint($("#new-group-button"),() => Lang("Add a new layer group"));

	// Delete layer / group button
	$("#delete-button").on("click",event => {
		if(LAYERS.active.isLocked()) { // locked layer
			return;
		}
		const objId=LAYERS.active.id;
		const fromId=LAYERS.active.parent.id;
		const fromIndex=LAYERS.active.getIndex();
		const isSuccess=LAYERS.deleteItem(LAYERS.active);
		if(isSuccess){
			HISTORY.addHistory({ // add a history item
				type: "node-structure",
				id: objId,
				from: fromId,
				to: null,
				oldIndex: fromIndex,
				newIndex: null,
				oldActive: objId,
				newActive: LAYERS.active.id
			});
		}
	});
	EventDistributer.footbarHint($("#delete-button"),() => Lang("Delete current layer / group"));

	// Clear layer content button
	$("#clear-button").on("click",event => {
		if(LAYERS.active.isLocked()) { // locked layer
			return;
		}
		if(LAYERS.active instanceof LayerGroupNode) { // group: merge content
			LAYERS.replaceGroupWithLayer(LAYERS.active);
		}
		else { // canvas: clear image data
			if(CANVAS.clearAll()){ // successfully cleared
				STORAGE.FILES.saveContentChanges(CANVAS.nowLayer);
			}
		}
	});
	EventDistributer.footbarHint($("#clear-button"),() => {
		if(LAYERS.active instanceof LayerGroupNode) { // group
			return Lang("Merge group contents into one layer");
		}
		else { // canvas
			return Lang("Clear current layer");
		}
	});

	// Expand / Collapse button
	LAYERS.isUIExpanded=true;
	$("#layer-panel-right-menu").on("click",event => {
		LAYERS.isUIExpanded=!LAYERS.isUIExpanded;
		if(LAYERS.isUIExpanded) {
			LAYERS.expandUI();
		}
		else {
			LAYERS.shrinkUI();
		}
	});
}

/**
 * add a new canvas layer in the ui & layerTree
 * This function does not refresh canvas.
 */
LAYERS.addNewCanvasNode=function() {
	const layer=new CanvasNode();
	if((LAYERS.active instanceof LayerGroupNode)&&LAYERS.active.isExpanded) {
		LAYERS.active.insertNode(layer,0);
		LAYERS.active.insertNode$UI(layer.$ui,0);
	}
	else {
		LAYERS.active.addNodeBefore(layer);
		LAYERS.active.$ui.before(layer.$ui);
	}
	return layer; // return the new node
}

/**
 * Delete obj from layer ui container (but not layer tree: for history recording)
 */
LAYERS.deleteItem=function(obj) {
	let newActive;

	let i=obj.getIndex(); // obj is not root, i must be valid
	if(obj.parent.children.length-1>i) { // There's next child
		newActive=obj.parent.children[i+1];
	}
	else if(i>0) { // There's previous child
		newActive=obj.parent.children[i-1];
	}
	else { // no next and no prev: set parent active
		newActive=obj.parent;
	}
	if(newActive==LAYERS.layerTree) { // only the root remains
		EventDistributer.footbarHint.showInfo(Lang("Cannot delete the only layer/group."));
		return false; // cannot delete
	}

	obj.$ui.detach(); // remove layer ui
	obj.detach(); // remove from layer tree, also handles data/clip order invalidation

	LAYERS.setActive(newActive); // meanwhile refresh the screen

	// remove from hash: in HISTORY.addHistory when this layer won't be retrieved
	// The followings are only for debugging delete
	//obj.delete();
	return true;
}

/**
 * Replace group with a layer containing the composited contents
 * Only replace contents. Do not change the properties including masks.
 */
LAYERS.replaceGroupWithLayer=function(group) {
	// insert new node before
	const layer=new CanvasNode();
	group.addNodeBefore(layer);
	group.$ui.before(layer.$ui);
	const hist1={ // add a history item
		type: "node-structure",
		id: layer.id,
		from: null,
		to: layer.parent.id,
		oldIndex: null,
		newIndex: layer.getIndex(),
		oldActive: group.id,
		newActive: group.id // active layr not set yet
	};

	LAYERS.setActive(layer); // set lastImageData (as empty)

	// copy properties, and adjust image data structures (such as clip mask...)
	const prop=group.getProperties();
	layer.setProperties(prop);
	// Here, needless to set property change history: after all a "new" operation before

	// transfer image data
	CANVAS.renderer.adjustImageDataBorders(layer.rawImageData,group.rawImageData.validArea,false);
	CANVAS.renderer.blendImageData(group.rawImageData,layer.rawImageData,{mode: GLTextureBlender.SOURCE});
	// @TODO: layer.maskImageData
	const hist2={ // add raw image data changed history
		type: "image-data",
		id: layer.id,
		area: {...group.rawImageData.validArea}
	};

	// delete old imageData to save space. @TODO: clear all non-leaf imageData
	group.assignNewRawImageData(0,0);
	group.assignNewMaskedImageData(0,0);
	group.assignNewImageData(0,0);
	group.maskImageData=null; // @TODO
	group.setRawImageDataInvalid();
	layer.setMaskedImageDataInvalid();

	// remove group from ui
	const groupId=group.id;
	const fromId=group.parent.id;
	const fromIndex=group.getIndex();
	group.$ui.detach(); // remove layer ui
	group.detach(); // remove from layer tree, also handles data/clip order invalidation


	const hist3={ // add a history item
		type: "node-structure",
		id: groupId,
		from: fromId,
		to: null,
		oldIndex: fromIndex,
		newIndex: null,
		oldActive: groupId,
		newActive: layer.id
	};
	HISTORY.addHistory({ // combine 3 steps
		type: "bundle",
		children: [hist1,hist2,hist3]
	});

	// recomposite
	COMPOSITOR.updateLayerTreeStructure();
	STORAGE.FILES.saveContentChanges(layer);
	layer.updateThumb();
}

LAYERS.updateAllThumbs=function() {
	// refresh layer UI display
	// for(const k in LAYERS.layerHash) {
	// 	const layer=LAYERS.layerHash[k];
	// 	if(layer instanceof CanvasNode) {
	// 		layer.updateThumb();
	// 	}
	// }
	if(LAYERS.layerTree) {
		LAYERS.layerTree.updateThumb();
	}
}

// ================ Debuggings ================

LAYERS.getStorageJSON=function() {
	const layerTreeJSON=LAYERS.layerTree.getStorageJSON();
	return Object.assign(layerTreeJSON,{
		title: ENV.getFileTitle(),
		paperSize: [ENV.paperSize.width,ENV.paperSize.height],
		active: LAYERS.active?LAYERS.active.id:null
		// @TODO: add trans?
	});
}

LAYERS.debugRootStorage=function() {
	let startT=Date.now();

	const rootImg=CANVAS.renderer.getUint8ArrayFromImageData(LAYERS.layerTree.imageData);
	const encoded=Compressor.encode(rootImg);
	const b32k=ENV.uint8Array2base32k(encoded);

	let endT=Date.now();
	console.log("Encoding Time = "+((endT-startT)/1000).toFixed(2)+"s");
	console.log(
		(encoded.length/1024/1024).toFixed(2)+"MB",
		(b32k.length*2/1024/1024).toFixed(2)+"MB b32k",
		(200*b32k.length/rootImg.length).toFixed(2)+"%"
	);
	//console.log(b32k.substring(0,100));
	

	startT=Date.now();
	const oriEncoded=ENV.base32k2uint8Array(b32k);
	const newImg=Compressor.decode(oriEncoded);

	endT=Date.now();
	console.log("Decoding Time = "+((endT-startT)/1000).toFixed(2)+"s");
	let isSame=true;
	for(let i=0;i<rootImg.length;i++){
		if(rootImg[i]!=newImg[i]){
			isSame=false;
			break;
		}
	}
	console.log("Is same: "+(isSame?"true":"false"));
}