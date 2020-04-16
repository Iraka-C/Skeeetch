/**
 * Memory Optimizer for layers
 * Regarding the layer composition policies in CANVAS
 */

COMPOSITOR={};

/**
 * There should be a monitor watching every change in the layer tree, and create cache structures
 */
COMPOSITOR.isUpdateRequested=false;
COMPOSITOR.updateLayerTreeStructure=function(){
	if(COMPOSITOR.isUpdateRequested) {
		return; // already requested
	}
	COMPOSITOR.isUpdateRequested=true;
	requestAnimationFrame(() => {
		COMPOSITOR.onUpdate(); // call refresh callback
		COMPOSITOR.isUpdateRequested=false;
	});
}
/**
 * This function entrance assumes that all nodes have valid imageData.
 */
COMPOSITOR.onUpdate=function(){
	console.log("Update");
	if(!LAYERS.layerTree.isImageDataValid){
		//console.warn(LAYERS.layerTree._getTreeNodeString()); // print the present layer tree
		//throw new Error("Try to construct cache structure while there are invalid image data.");
	}
	/**
	 * @TODO: update cache structure
	 * 1. determine the new cache structure
	 * 2. determine which to freeze or restore
	 * 3. composite while freezing/restoring
	 */
	// Presently, use the same function as CANVAS.refreshScreen
	CANVAS.refreshScreen();
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
 */
COMPOSITOR.recompositeLayers=function(node) {
	node=node||LAYERS.layerTree; // init: root
	//console.log("Recomposite "+node.id,node.isRawImageDataValid);

	if(node.isRawImageDataValid){
		// ...?
	}
	else if(node instanceof CanvasNode){
		const sBuf=node.strokeBuffer; // has stroke buffer
		if(sBuf.originalImageData&&sBuf.strokeImageData){
			console.log("Composite Stroke Buffer");
			
			CANVAS.renderer.clearImageData(node.rawImageData);
			CANVAS.renderer.blendImageData(sBuf.originalImageData,node.rawImageData,{mode:BasicRenderer.SOURCE});
			CANVAS.renderer.blendImageData(sBuf.strokeImageData,node.rawImageData);
		}
	}
	else if(node.children.length) { // there's children
		// raw data of this node needs recomposition
		// Only group/root will reach here
		if(!node.isChildrenClipMaskOrderValid) { // clip mask order not calculated
			node.constructClipMaskOrder();
		}

		// clip mask order here is correct
		const list=node.children;
		const childrenToBlend=[];
		let initSize={width: 0,height: 0,left: 0,top: 0};
		for(let i=list.length-1;i>=0;) { // reversed order
			const child=list[i];
			// for group, only blend non-clip mask layers
			// use node.imageDataCombinedCnt to skip clip mask
			COMPOSITOR.recompositeLayers(child); // recomposite this level
			if(child.properties.visible&&child.imageData.width&&child.imageData.height){
				// visible and has content
				// to blend the imageData into layer's raw imageData
				childrenToBlend.push(i);
				initSize=GLProgram.extendBorderSize(initSize,child.imageData.validArea);
			}
			i-=child.clipMaskChildrenCnt+1; // skip clip masks
		}

		// Now the initSize contains the minimum size to contain the children's imageData
		let bg=node.rawImageData; // present uncleared imagedata
		CANVAS.renderer.adjustImageDataBorders(bg,initSize,false);
		CANVAS.renderer.clearImageData(bg,null,false); // clear the data to blank

		// blend the children
		for(const v of childrenToBlend) {
			const child=list[v];
			CANVAS.renderer.blendImageData(child.imageData,bg,{
				mode: child.properties.blendMode,
				srcAlpha: child.properties.opacity
			}); // blend layer with backdrop
			if(PERFORMANCE.debugger.isDrawingLayerBorder){ // For DEBUG: draw the edge of each layer
				CANVAS.renderer.drawEdge(child.imageData,bg);
			}
		}

	}
	node.isRawImageDataValid=true;

	if(!node.isMaskedImageDataValid) { // masked data needs recomposition
		if(node.maskImageData) { // there is a mask in this layer
			// @TODO: blend raw & mask ==> masked

		}
		// else: node.maskedImageData==node.rawImageData;
	}
	node.isMaskedImageDataValid=true;

	if(!node.isImageDataValid) { // image data needs recomposition (with clip masks)
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
				if(!clipMaskNode.imageData.width||!clipMaskNode.imageData.height) continue; // contains 0 pixel: do not blend
				childrenToBlend.push(v);
			}

			// Now the initSize contains the minimum size to contain the children's & this node's imageData
			const mask=node.maskedImageData;
			const clipped=node.imageData; // present uncleared imagedata
			CANVAS.renderer.adjustImageDataBorders(clipped,mask.validArea,false); // move to the position of mask
			CANVAS.renderer.clearImageData(clipped,null,false); // clear the data to blank.
			// combine all image data
			CANVAS.renderer.blendImageData(mask,clipped,{mode: BasicRenderer.SOURCE}); // copy masked image
			for(const v of childrenToBlend) {
				const clipMaskNode=siblings[v];
				CANVAS.renderer.blendImageData(clipMaskNode.imageData,clipped,{
					mode: clipMaskNode.properties.blendMode,
					alphaLock: true, // lock alpha
					srcAlpha: clipMaskNode.properties.opacity
				});
				if(PERFORMANCE.debugger.isDrawingLayerBorder){
					CANVAS.renderer.drawEdge(clipMaskNode.imageData,clipped);
				}
			}
		}
		// else: clipped==node.maskedImageData
	}
	node.isImageDataValid=true;
}