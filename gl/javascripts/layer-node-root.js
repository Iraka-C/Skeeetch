class RootNode extends ContentNode { // only one root node
	constructor() {
		super("root");
		// this.rawImageData ==always== this.imageData
		LAYERS.set$ElementAsLayerContainer($("#layer-panel-inner")); // root container
		this.$ui=$("#layer-panel-scroll");

		// assign image data at the whole canvas size
		this.assignNewRawImageData(CANVAS.targetCanvas.width,CANVAS.targetCanvas.height,0,0);
	}
	insertNode$UI($ui,pos) { // insert a new node into children at pos
		const ct=$("#layer-panel-inner");
		if(!pos) { // First position: pos===undefined or pos===0
			ct.prepend($ui);
		}
		else { // other positions
			const $children=ct.children();
			$children.eq(pos-1).after($ui);
		}
	}
	// ================ ImageData management =================
	setImageDataInvalid() {
		//console.log("set invalid "+this.id);
		if(!this.isImageDataValid) return; // already set
		this.isImageDataValid=false;
		// no parent, stop here
	}

	// ================ Export =================
	getAgPSDCompatibleJSON() {
		// do not use ContentNode function, create properties on this. own
		let childrenJson=[];
		for(let v=this.children.length-1;v>=0;v--) { // reversed order
			// Add the JSON source from children
			childrenJson.push(this.children[v].getAgPSDCompatibleJSON());
		}

		const imgData=this.rawImageData; // contents not saved here, only for dimensions
		return {
			"width": imgData.width,
			"height": imgData.height,
			"channels": 4,
			"bitsPerChannel": 8, // only support 8-bit output
			"colorMode": 3, // RGBA
			"children": childrenJson,
			"canvas": CANVAS.renderer.getContext2DCanvasFromImageData(
				imgData,CANVAS.renderer.viewport
			)
		};
	}

	getStorageJSON(){
		const childrenJson=[];
		for(let v=this.children.length-1;v>=0;v--){ // reversed order
			// Add the JSON source from children
			childrenJson.push(this.children[v].getStorageJSON());
		}

		return {
			id: this.id,
			children: childrenJson,
			type: "RootNode"
		};
	}
}