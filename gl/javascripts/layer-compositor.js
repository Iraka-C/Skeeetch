/**
 * Memory Optimizer for layers
 * Regarding the layer composition policies in CANVAS
 */

COMPOSITOR={};

/**
 * Set the node on the crucial path in the layer tree.
 * The crucial path is the path from the active layer to the root.
 * This function is recursive. Only need to specify the root node.
 */
COMPOSITOR.setCrucialPathStatus=function(node){
	if(COMPOSITOR.setCrucialPathStatus.nowRoot){
		COMPOSITOR._unsetCrucialPathStatus(COMPOSITOR.setCrucialPathStatus.nowRoot);
		COMPOSITOR.setCrucialPathStatus.nowRoot=null;
	}
	node.cache.isOnCrucialPath=true;
	if(node.parent){
		COMPOSITOR.setCrucialPathStatus(node.parent);
	}
	COMPOSITOR.setCrucialPathStatus.nowRoot=node; // the first caller will be set as the root
}
COMPOSITOR.setCrucialPathStatus.nowRoot=null;
COMPOSITOR._unsetCrucialPathStatus=function(node){ // delete all crucial path status
	node.cache.isOnCrucialPath=false;
	if(node.parent){
		COMPOSITOR.setCrucialPathStatus(node.parent);
	}
}

/**
 * isToFreezeImageData determines whether node.imageData is to be frozen.
 * freezeDescendants(node) freezes the raw/mask/masked(/-)ImageData of this node,
 * and all image data of the descendant nodes.
 * Won't care about clip mask nodes of this node.
 */
COMPOSITOR.freezeDescendants=function(node,isToFreezeImageData){
	if(CANVAS.renderer.isImageDataFrozen(node.imageData)){ // already frozen
		return;
	}
	if(!CANVAS.renderer.isImageDataFrozen(node.rawImageData)){ // children not frozen
		for(const v of node.children) {
			COMPOSITOR.freezeDescendants(v,true);
		}
	}
	if(node.imageData!=node.rawImageData){
		CANVAS.renderer.freezeImageData(node.rawImageData);
	}
	if(node.imageData!=node.maskedImageData){ // if same as raw, won't freeze again
		CANVAS.renderer.freezeImageData(node.maskedImageData);
		// @TODO: maskImageData
	}
	if(isToFreezeImageData){ // if same as masked/raw, won't freeze again
		CANVAS.renderer.freezeImageData(node.imageData);
	}
}

/**
 * Cache consecutive siblings into the first sibling's imageData.
 * Also, freeze the contents of the children of cached nodes.
 * 
 * There are four cases:
 * 1. The layer
 */

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
	//console.log("Recomposite "+node.id);

	if(!node.isRawImageDataValid&&node.children.length) {
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
				childrenToBlend.push(i);
				initSize=GLProgram.extendBorderSize(initSize,child.imageData);
				// to blend the imageData into layer's raw imageData
			}
			i-=child.imageDataCombinedCnt;
		}
		// Now the initSize contains the minimum size to contain the children's imageData
		let bg=node.rawImageData; // present uncleared imagedata
		CANVAS.renderer.adjustImageDataBorders(bg,initSize,false);
		CANVAS.renderer.clearImageData(bg,null,false); // clear the data to blank

		// blend the children
		for(const v of childrenToBlend) {
			const child=list[v];
			if(PERFORMANCE.debugger.isDrawingLayerBorder){ // For DEBUG: draw the edge of each layer
				CANVAS.renderer.drawEdge(child.imageData,bg);
			}
			CANVAS.renderer.blendImageData(child.imageData,bg,{
				mode: child.properties.blendMode,
				srcAlpha: child.properties.opacity
			}); // blend layer with backdrop
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
			CANVAS.renderer.adjustImageDataBorders(clipped,mask,false); // move to the position of mask
			//CANVAS.renderer.clearImageData(clipped,null,false); // clear the data to blank.
			// combine all image data
			CANVAS.renderer.blendImageData(mask,clipped,{mode: BasicRenderer.SOURCE}); // copy masked image
			for(const v of childrenToBlend) {
				const clipMaskNode=siblings[v];
				// for DEBUG, blend with normal mode. @TODO: add blend mode
				if(PERFORMANCE.debugger.isDrawingLayerBorder){ // For DEBUG: draw the edge of each layer
					CANVAS.renderer.drawEdge(clipMaskNode.imageData,clipped);
				}
				CANVAS.renderer.blendImageData(clipMaskNode.imageData,clipped,{
					mode: clipMaskNode.properties.blendMode,
					alphaLock: true, // lock alpha
					srcAlpha: clipMaskNode.properties.opacity
				});
			}
			node.imageDataCombinedCnt=node.clipMaskChildrenCnt+1; // including itself
		}
		// else: clipped==node.maskedImageData
	}
	node.isImageDataValid=true;
}