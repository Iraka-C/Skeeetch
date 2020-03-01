class ContentNode extends LayerNode {
	constructor(id) {
		super(id);
		// Image Data
		/**
		 * ImageData management
		 * The rendering pipeline is:
		 * this.rawImageData  |==> this.maskedImageData    |==> this.imageData
		 * this.maskImageData |    other nodes (Clip Masks)|
		 */
		this.rawImageData=CANVAS.renderer.createImageData(); // content
		this.isRawImageDataValid=true; // is this imgData the latest (not modified)

		this.maskImageData={}; // should be "luminance"

		this.maskedImageData=this.rawImageData;
		this.isMaskedImageDataValid=true;

		this.imageData=this.maskedImageData;
		this.isImageDataValid=true;

		// Image Data Managements
		this.isChildrenClipMaskOrderValid=true; // do all children own proper clip mask id?
		/**
		 * arrays determining clip mask orders, null for invalid
		 * ChildrenCnt: how many children does this layer have
		 * ParentId: which node is this node's parent
		 * e.g.
		 * last <--- first child
		 * 6 5 4 3 2 1 0 : children id in parent group node
		 * < @ < < @ @ <
		 * 0 2 0 0 0 1 0 : ChildrenCnt
		 * 6 5 5 5 2 1 1 : ParentId
		 */
		this.clipMaskChildrenCnt=0; // how many clip mask layer over this node, calculated by tree structure
		this.clipMaskParentIndex=-1; // If this node is a clip mask, the target (back drop) layer id. If not, this value is -1 (no parent) or itself (with a parent & calculated)

		// Common properties
		this.properties={
			locked:false, // is this layer locked: true for no operation enabled on this layer
			pixelOpacityLocked:false, // the opacity of every pixel is locked
			opacity:1, // overall display opacity
			visible:true, // is this layer visible in the DOM
			clipMask:false, // is this layer a clip mask
			maskSelected:false // focus on mask canvas of this layer
		};
	}
	getName(name) {
		// Abstract
		return null;
	}
	setName(name){
		// Expected: set the displayed name of this layer
	}
	// =================== Node operation ======================
	insertNode(node,pos){
		this.setClipMaskOrderInvalid();
		this.setRawImageDataInvalid();
		super.insertNode(node,pos);
		this.constructClipMaskOrder(); // redraw
	}
	removeNode(pos){
		this.setClipMaskOrderInvalid();
		this.setRawImageDataInvalid();
		let node=super.removeNode(pos);
		this.constructClipMaskOrder(); // redraw
		return node;
	}
	delete(){
		// release image data
		if(this.rawImageData)CANVAS.renderer.deleteImageData(this.rawImageData);
		if(this.maskImageData)CANVAS.renderer.deleteImageData(this.maskImageData);
		if(this.maskedImageData)CANVAS.renderer.deleteImageData(this.maskedImageData);
		if(this.imageData)CANVAS.renderer.deleteImageData(this.imageData);
		super.delete();
	}
	// ============= Property Operation ===============
	getProperties(){
		return Object.assign({},this.properties); // copy property object
	}
	setProperties(prop){
		const p=this.properties;
		if(prop.locked!==undefined){
			p.locked=prop.locked;
		}
		if(prop.pixelOpacityLocked!==undefined){
			p.pixelOpacityLocked=prop.pixelOpacityLocked;
		}
		if(prop.opacity!==undefined){
			p.opacity=prop.opacity;
		}
		if(prop.visible!==undefined){
			p.visible=prop.visible;
		}
		if(prop.clipMask!==undefined){
			p.clipMask=prop.clipMask;
		}
		if(prop.maskSelected!==undefined){
			p.maskSelected=prop.maskSelected;
		}
		this.updatePropertyUI();
	}
	updatePropertyUI(){
		// abstract
	}
	// =============== mask & clip mask ==================
	createClipMaskImageData(){
		if(this.imageData!=this.maskedImageData)return; // already created
		this.imageData=CANVAS.renderer.createImageData();
	}
	deleteClipMaskImageData(){
		if(this.imageData==this.maskedImageData)return; // already deleted
		CANVAS.renderer.deleteImageData(this.imageData);
		this.imageData=this.maskedImageData;
	}
	createMaskImageData(){
		if(this.maskImageData)return; // already created
		this.maskImageData=CANVAS.renderer.createImageData(); // todo: luminance
		this.maskedImageData=CANVAS.renderer.createImageData();
	}
	deleteMaskImageData(){
		if(!this.maskImageData)return; // already deleted
		CANVAS.renderer.deleteImageData(this.maskImageData);
		this.maskImageData={};
		CANVAS.renderer.deleteImageData(this.maskedImageData);
		this.maskedImageData=this.rawImageData;
	}
	/**
	 * Construct an array representing the composition order
	 * of all children in this group
	 */
	constructClipMaskOrder() {
		if(this.isChildrenClipMaskOrderValid)return; // already constructed

		//console.log(this.id+" clip mask order reconstruct");
		const list=this.children;
		let cnt=0;
		let nowParent=list.length-1;
		for(let i=list.length-1;i>=0;i--) { // reversed order
			const node=list[i];
			node.clipMaskChildrenCnt=0; // no children
			node.clipMaskParentIndex=nowParent; // parent doesn't change
			if(i==0||!list[i-1].properties.clipMask) { // calculate peoperties
				// next node is a new non-clip-mask layer
				// this sequence of clip mask ends here
				list[nowParent].clipMaskChildrenCnt=cnt; // this many mask layer over nowParent node
				nowParent=i-1; // next one
				cnt=0; // reset
			}
			else{
				cnt++;
			}
		}
		// renew image data
		for(let i=list.length-1;i>=0;i--) {
			const node=list[i];
			// These operations won't affect status-unchanged nodes
			if(node.clipMaskChildrenCnt>0){
				node.createClipMaskImageData();
			}
			else{
				node.deleteClipMaskImageData();
			}
		}
		this.isChildrenClipMaskOrderValid=true; // set order array valid
	}
	setClipMaskOrderInvalid(){ // when children order changes, the order info becomes invalid
		this.isChildrenClipMaskOrderValid=false;
		// Optional: children clipMaskChildrenCnt & clipMaskParentIndex reset
	}
	// ================ ImageData validation management =================
	/**
	 * There are two cases of rendering pipe:
	 * 1. This node is not a clip mask and has clip mask children:
	 * 
	 * ┌ imageData          ┐
	 * ┌ imageData          ┐
	 * raw + mask -> masked -> imageData
	 * 
	 * 2. This node is a clip mask:
	 * 
	 * ┌ raw + mask -> masked == imageData ┐
	 * clip parent:[clipMaskParentIndex]   -> clip parent.imageData
	 */
	setRawImageDataInvalid() { // @TODO: follow the pipeline
		//console.log("set raw invalid "+this.id);
		
		if(!this.isRawImageDataValid)return; // already set
		this.isRawImageDataValid=false;
		this.setMaskedImageDataInvalid();
	}

	setMaskedImageDataInvalid(){
		//console.log("set masked invalid "+this.id);
		if(!this.isMaskedImageDataValid)return; // already set
		this.isMaskedImageDataValid=false;
		this.setImageDataInvalid();
	}

	setImageDataInvalid(){
		//console.log("set invalid "+this.id);
		if(!this.isImageDataValid)return; // already set
		this.isImageDataValid=false;
		const parent=this.parent;
		if(parent) {
			if(!parent.isChildrenClipMaskOrderValid){ // clip mask order not calculated
				parent.constructClipMaskOrder();
			}
			const siblings=parent.children;
			if(this.index!=this.clipMaskParentIndex){ // this node is a clip mask
				const clipMaskParent=siblings[this.clipMaskParentIndex];
				clipMaskParent.setImageDataInvalid();
			}
			else{ // normal layer
				// Iterate
				parent.setRawImageDataInvalid();
			}
		}
	}
}