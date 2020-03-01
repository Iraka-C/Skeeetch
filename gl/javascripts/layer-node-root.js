class RootNode extends ContentNode{ // only one root node
	constructor(){
		super("root");
		LAYERS.set$ElementAsLayerContainer($("#layer-panel-inner")); // root container
		this.$ui=$("#layer-panel-scroll");
	}
	insertNode$UI(node,pos){ // insert a new node into children at pos
		const ct=$("#layer-panel-inner");
		if(!pos){ // First position: pos===undefined or pos===0
			ct.prepend(node.$ui);
		}
		else{ // other positions
			const $children=ct.children();
			$children.eq(pos-1).after(node.$ui);
		}
	}
	// ================ ImageData management =================
	setImageDataInvalid(){
		//console.log("set invalid "+this.id);
		if(!this.isImageDataValid)return; // already set
		this.isImageDataValid=false;
		// no parent, stop here
	}
}