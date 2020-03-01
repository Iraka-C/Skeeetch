// ================ UI ==================
LAYERS.$newLayerGroupUI=function(id) {
	let layerGroupUI=$("<div class='layer-item layer-group-ui'>");
	layerGroupUI.attr("data-layer-id",id);

	let groupTitle=$("<div class='group-title-panel'>");
	groupTitle.append($("<div class='group-title-expand-button group-expanded'>").text(">"));

	let nameLabel=$("<input class='group-name-label'>");
	nameLabel.attr({"value": "","type": "text","maxLength": "256","size": "10"});
	EVENTS.disableInputSelection(nameLabel);
	groupTitle.append(nameLabel);
	layerGroupUI.append(groupTitle);

	let groupButton=$("<div class='group-button-panel'>");
	// Opacity
	let opacityLabel=$("<div class='group-opacity-label'>");
	let opacityInput=$("<input class='group-opacity-input'>");
	opacityInput.attr({"value": "100%","type": "text","maxLength": "4","size": "4"});
	opacityLabel.append(opacityInput);
	// Others
	let lockButton=$("<div>").html("&para;");
	let blendModeButton=$("<div>").html("&#9677;");
	let maskButton=$("<div>").html("&#8628;");
	let mergeButton=$("<div>").html("&#9641;");
	groupButton.append(opacityLabel,lockButton,blendModeButton,maskButton,mergeButton);
	layerGroupUI.append(groupButton);

	let layerContainer=$("<div class='layer-group-container'>"); // The container of children
	layerContainer.attr("data-layer-id",id); // Same id as UI
	LAYERS.set$ElementAsLayerContainer(layerContainer); // Enable drag into
	layerGroupUI.append(layerContainer);
	layerGroupUI.on("pointerdown",event => {
		if(event.originalEvent.pointerType=="pen") {
			event.stopPropagation(); // cancel the following "drag" event on pen
		}
	});
	return layerGroupUI;
}

// ============= Node ===============
class LayerGroupNode extends ContentNode {
	constructor() {
		super();
		this.$ui=LAYERS.$newLayerGroupUI(this.id); // set ui in layer list

		// Properties
		this.isExpanded=true; // is the container of this group expanded?
		
		this.setName(this.id); // For DEBUG
		this.$ui.on("pointerdown",event => { // click to activate
			if($.contains(this.$ui.children(".layer-group-container")[0],event.target)) {
				// The event is from one of my containings
				event.stopPropagation();
			}
			else {
				LAYERS.setActive(this);
				if(event.target==this.$ui.children(".group-title-panel").children("input")[0]) {
					// The event is from input selection
					event.stopPropagation();
				}
			}
		});

		// init property button operation
		this.initButtons();
	}
	setName(name) {
		// set the displayed name of this layer
		this.$ui.children(".group-title-panel").children(".group-name-label").val(name);
	}
	setActiveUI(isActive) {
		// Expected: set the UI effect of this node
		if(isActive) {
			this.$ui.addClass("layer-group-ui-active");
		}
		else {
			this.$ui.removeClass("layer-group-ui-active");
		}
	}
	insertNode$UI($ui,pos) { // insert a new node ui into children at pos
		const ct=this.$ui.children(".layer-group-container");
		if(!pos) { // First position: pos===undefined or pos===0
			ct.prepend($ui);
		}
		else { // other positions
			const $children=ct.children();
			$children.eq(pos-1).after($ui);
		}
	}
	delete() {
		for(let v of this.children) {
			v.delete();
		}
		super.delete();
	}
	// ================= button =================
	initButtons(){
		this.buttonUpdateFuncs={};

		const titlePanel=this.$ui.children(".group-title-panel");
		const expandButton=titlePanel.children(".group-title-expand-button");
		expandButton.on("click",event=>{
			this.isExpanded=!this.isExpanded;
			this.toggleExpandCollapse();
		});
	}
	toggleExpandCollapse(){
		const titlePanel=this.$ui.children(".group-title-panel");
		const expandButton=titlePanel.children(".group-title-expand-button");
		let $ct=this.$ui.children(".layer-group-container");
		expandButton.toggleClass("group-expanded");
		$ct.toggleClass("layer-group-container-collapsed");
		$ct.slideToggle(250,()=>{ // update scrollbar after toggle
			LAYERS._updateScrollBar(true);
		});
	}
	updatePropertyUI(){ // update all UIs
		//this.buttonUpdateFuncs.lockButton();
		//this.buttonUpdateFuncs.clipButton();
	}
}