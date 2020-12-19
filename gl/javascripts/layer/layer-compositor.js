/**
 * Memory Optimizer for layers
 * Regarding the layer composition policies in CANVAS
 */
"use strict";
const COMPOSITOR={};

/**
 * There should be a monitor watching every change in the layer tree, and create cache structures
 */
COMPOSITOR.updateLayerTreeStructure=function(){
	COMPOSITOR.onUpdate(); // call refresh callback
}
/**
 * This function entrance assumes that all nodes have valid imageData.
 */
COMPOSITOR.onUpdate=function(){
	//LOGGING&&console.log("Update");
	if(!LAYERS.layerTree.isImageDataValid){
		//LOGGING&&console.warn(LAYERS.layerTree._getTreeNodeString()); // print the present layer tree
		//throw new Error("Try to construct cache structure while there are invalid image data.");
	}
	/**
	 * @TODO: update cache structure
	 * 1. determine the new cache structure
	 * 2. determine which to freeze or restore
	 * 3. composite while freezing/restoring
	 */
	// Presently, use the same function as CANVAS.refreshScreen
	CANVAS.requestRefresh();
}
// =========================== Main Cache Constructor =============================
/**
 * A layer tree is just like a grammar tree in programming,
 * and pre-compilation makes it work better.
 * Compilation traces the active nodes, and gives an executing order
 * for every update on a node.
 * This allows caching the inactive nodes into the RAM.
 */
COMPOSITOR.compileLayerTree=function(){
	/**
	 * @TODO:
	 * Do this later.
	 * Now most OS is equipped with automatic GPUMem <=> RAM <=> VirtualMem transfer.
	 * 
	 */
}
// ============================ Main Compositor ===================================
/**
 * Use mid-order traverse: the backdrop of a group is transparent
 * SAI uses mid-order
 * PS, Web use pre-order: the backdrop is the underlaying layers
 * 
 * In this module, size auto-growth is used.
 * If one texture at the leaf node (CanvasNode) expands,
 * All textures along the route to the root will be reallocated.
 * This is time consuming.
 * 
 * @param node a ContentNode to be recomposited
 * @TODO: implement dirty area recomposition
 */
COMPOSITOR.recompositeLayers=function(node,dirtyArea) {
	node=node||LAYERS.layerTree; // init: root
	const isNeutralColor=ENV.displaySettings.blendWithNeutralColor;
	//dirtyArea=null;
	// If no dirty area provided, assume that node shall contain all contents of leaves
	//if(dirtyArea)console.log("dirty");else console.log("normal");
	

	if(!node.isRawImageDataValid&&!(node instanceof CanvasNode)) {
		// raw data of this node needs recomposition
		// Only group/root will reach here
		if(!node.isChildrenClipMaskOrderValid) { // clip mask order not calculated
			node.constructClipMaskOrder();
		}

		// clip mask order here is correct
		const list=node.children;
		const childrenToBlend=[];
		let initSize={width: 0,height: 0,left: 0,top: 0};
		for(let i=list.length-1,j;i>=0;i-=j+1) { // reversed order, skip clip masks
			const child=list[i];
			j=child.clipMaskChildrenCnt;
			// for group, only blend non-clip mask layers
			// use node.imageDataCombinedCnt to skip clip mask
			COMPOSITOR.recompositeLayers(child,dirtyArea); // recomposite this level
			if(child.properties.visible&&( // still blend even if no w/h when black mask
				(child.imageData.width&&child.imageData.height||child.properties.blendMode==BasicRenderer.MASKB)
			)){
				// visible and has content
				// to blend the imageData into layer's raw imageData
				childrenToBlend.push(i);
				if(child.properties.blendMode==BasicRenderer.MASK){
					// mask, no need to extend
				}
				else if(child.properties.blendMode==BasicRenderer.MASKB){
					// black: cut inside
					if(!(child.imageData.width&&child.imageData.height)){ // reset
						childrenToBlend.length=0; // clear
						initSize={width: 0,height: 0,left: 0,top: 0};
						continue;
					}
					initSize=GLProgram.borderIntersection(initSize,child.imageData.validArea);
				}
				else{ // normal extension
					initSize=GLProgram.extendBorderSize(initSize,child.imageData.validArea);
				}
				// @TODO-: change GL to other class
			}
		}
		// Make sizes integer to contain all layers
		initSize.left=Math.floor(initSize.left);
		initSize.top=Math.floor(initSize.top);
		initSize.width=Math.ceil(initSize.width);
		initSize.height=Math.ceil(initSize.height);

		// Now the initSize contains the minimum size to contain the children's imageData
		let bg=node.rawImageData; // present uncleared imagedata
		// Shall contain all children size.
		if(dirtyArea){
			CANVAS.renderer.adjustImageDataBorders(bg,initSize,true);
			CANVAS.renderer.clearScissoredImageData(bg,dirtyArea); // clear only dirtyArea part
		}
		else{
			CANVAS.renderer.adjustImageDataBorders(bg,initSize,false);
			CANVAS.renderer.clearImageData(bg); // clear the data to blank.
		}

		// blend the children
		for(const v of childrenToBlend) {
			const child=list[v];
			CANVAS.renderer.blendImageData(child.imageData,bg,{
				mode: child.properties.blendMode,
				srcAlpha: child.properties.opacity,
				blendWithNeutralColor: isNeutralColor,
				targetArea: dirtyArea||null // default all area
			}); // blend layer with backdrop
			if(PERFORMANCE.debugger.isDrawingLayerBorder){ // For DEBUG: draw the edge of each layer
				CANVAS.renderer.drawEdge(child.imageData,bg,dirtyArea);
			}
		}

	}
	node.isRawImageDataValid=true;

	// Discard mask layer logic
	/*if(!node.isMaskedImageDataValid) { // masked data needs recomposition
		if(node.maskImageData) { // there is a mask in this layer
			// @TODO: blend raw & mask ==> masked
		}
		// else: node.maskedImageData==node.rawImageData;
		// do nothing
	}
	node.isMaskedImageDataValid=true;*/

	if(!node.isImageDataValid) { // image data needs recomposition (with clip masks)
		// @TODO: change condition to imagedata equal
		// @TODO: black mask area
		if(node.clipMaskChildrenCnt>0) { // there is a clip mask over this layer
			// At here, imageData is surely not equal to rawImageData
			const siblings=node.parent.children;
			const childrenToBlend=[];
			const index=node.getIndex();
			for(let i=0;i<node.clipMaskChildrenCnt;i++) {
				const v=index-1-i; // reversed order
				const clipMaskNode=siblings[v];
				COMPOSITOR.recompositeLayers(clipMaskNode); // recomposite this level
				if(!clipMaskNode.properties.visible) continue; // invisible: pass this node
				if(!(clipMaskNode.imageData.width&&clipMaskNode.imageData.height) // contains 0 pixel: do not blend
					&&clipMaskNode.properties.blendMode!=BasicRenderer.MASKB) continue; // nor a black mask
				childrenToBlend.push(v);
			}

			// Now the initSize contains the minimum size to contain the children's & this node's imageData
			const raw=node.rawImageData;
			const clipped=node.imageData; // present uncleared imagedata

			if(dirtyArea){
				CANVAS.renderer.adjustImageDataBorders(clipped,raw.validArea,true); // move to the position of raw
				CANVAS.renderer.blendImageData(raw,clipped,{
					mode: BasicRenderer.SOURCE,
					targetArea: dirtyArea
				}); // copy raw image
			}
			else{
				CANVAS.renderer.adjustImageDataBorders(clipped,raw.validArea,false); // move to the position of raw
				CANVAS.renderer.clearImageData(clipped); // clear the data to blank.
				CANVAS.renderer.blendImageData(raw,clipped,{mode: BasicRenderer.SOURCE}); // copy raw image
			}
			// combine all image data
			for(const v of childrenToBlend) {
				const clipMaskNode=siblings[v];
				CANVAS.renderer.blendImageData(clipMaskNode.imageData,clipped,{
					mode: clipMaskNode.properties.blendMode,
					alphaLock: true, // lock alpha
					srcAlpha: clipMaskNode.properties.opacity,
					blendWithNeutralColor: isNeutralColor,
					targetArea: dirtyArea||null // default all area
				});
				if(PERFORMANCE.debugger.isDrawingLayerBorder){
					CANVAS.renderer.drawEdge(clipMaskNode.imageData,clipped);
				}
			}
		}
		// else: no children clipped==node.rawImageData
	}
	node.isImageDataValid=true;
}