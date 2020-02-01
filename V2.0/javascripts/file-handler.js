/**
 * Handle file import/export, file resize, etc.
 */

FILES={};

FILES.init=function(){
	FILES.initFileMenu();
	FILES.initImportDropHandler();
}

FILES.initFileMenu=function(){
	let fileManager=new SettingManager($("#file-menu-panel"),Lang("Files"));
	fileManager.setOpenButton($("#file-button"));
	fileManager.addSectionTitle(Lang("Import / Export"));
	fileManager.addButton(Lang("Import File"),()=>{});
	fileManager.addButton(Lang("Save as PNG"),()=>{});
	fileManager.addButton(Lang("Save as PSD"),()=>{});
}

FILES.initImportDropHandler=function(){
	$("body").on("dragenter dragleave dragover drop",e=>{
		e.preventDefault();
		if(e.type=="drop"){
			let file=e.originalEvent.dataTransfer.files[0];
			console.log(file);

			if(!file)return; // dragging layer

			// Check file type
			if(file.name.endsWith(".psd")){
				let reader=new FileReader();
				reader.readAsArrayBuffer(file);
				reader.onload=function(){
					FILES.loadAsPsd(this.result);
				}
			}
		}
	});
}

/**
 * data is an array buffer containing binary data of a .psd file
 */
FILES.loadAsPsd=function(data){
	let psdFile=agPsd.readPsd(data); // ag-psd function
	console.log(psdFile);
	ENV.setPaperSize(psdFile.width,psdFile.height); // change paper size to fit the file, clear history

	// clear all existing layers
	for(let id in LAYERS.layerHash){ // LAYERS.layerHash not iterable
		if(id=="root")continue; // except root
		delete LAYERS.layerHash[id];
	}
	$("#layer-panel-inner").empty();
	$("#canvas-layers-container").empty();
	// init Layerhash, ui container, div container

	FILES.loadPsdNode(psdFile,LAYERS.layerHash["root"]); // start with root
}
FILES.loadPsdNode=function(node,nowGroup){
	//if(node.mask) // masking layer

	// node is certainly a group, its equivalent layer object is nowGroup
	const children=node.children;
	let lastChild=null;
	for(let i=0;i<children.length;i++){
		let sNode=children[i];
		let newElement;
		if(sNode.children){ // has children, is a group
			newElement=new LayerGroup();
			newElement.$ui.children(".group-title-panel").children(".group-name-label").val(sNode.name); // sNode.name
			FILES.loadPsdNode(sNode,newElement); // iteratively
		}
		else{
			newElement=new Layer();
			let cv=sNode.canvas;
			let imgData=cv.getContext("2d").getImageData(0,0,cv.width,cv.height); // get imagedata from canvas
			
			let tmpRenderer=CANVAS.getNewRenderer(newElement.$div[0],{disableBuffer:true});
			tmpRenderer.putImageData8bit(imgData,sNode.left,sNode.top); // put in data
			newElement.latestImageData=tmpRenderer.getImageData(); // update ImageData for history
			
			// UI/status settings
			let lockStatus=sNode.transparencyProtected?sNode.protected.transparency?1:2:0;
			newElement._setButtonStatus({lock:lockStatus}); // lock background opacity
			newElement._setButtonStatus({opacity:sNode.opacity*100/255}); // set opacity
			newElement.prevStatus=newElement._getButtonStatus(); // update prev status for history

			// sNode.blendMode
			newElement.$ui.children(".layer-name-label").val(sNode.name); // sNode.name
			requestAnimationFrame(()=>newElement.updateThumb()); // Thumb, putImageData is Async ?
		}
		nowGroup.addInside(newElement,true);
		lastChild=newElement;
	}
	if(nowGroup.id=="root"){ // the root, set the top child as active
		LAYERS.setActive(lastChild);
	}
}