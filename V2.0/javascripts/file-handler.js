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

	FILES.loadPsdNode.isSetActive=false;
	FILES.loadPsdNode.progress=0;
	FILES.loadPsdNode(psdFile,LAYERS.layerHash["root"],1); // start with root
}
FILES.loadPsdNode=function(node,nowGroup,progressAmount){
	//if(node.mask) // masking layer

	// node is certainly a group, its equivalent layer object is nowGroup
	const children=node.children;
	const progressFrac=progressAmount/children.length;
	// For each child
	for(let i=0;i<children.length;i++){
		const sNode=children[i];
		setTimeout(event=>{ // in 'parallel' (Tree structure, order irrelevant)
			let newElement;
			if(sNode.children){ // has children, is a group
				newElement=new LayerGroup();
				newElement.$ui.children(".group-title-panel").children(".group-name-label").val(sNode.name); // sNode.name
				FILES.loadPsdNode(sNode,newElement,progressFrac); // iteratively
				// load the progress in all: progressFrac
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

				// add progress on non-group element
				FILES.loadPsdNode.progress+=progressFrac;
				EventDistributer.footbarHint.showInfo(
					"Loading "+(FILES.loadPsdNode.progress*100).toFixed(2)+"% ...");
			}
			nowGroup.addInside(newElement,true);

			if(!FILES.loadPsdNode.isSetActive){ // set the first active
				FILES.loadPsdNode.isSetActive=true;
				LAYERS.setActive(newElement);
			}
		},0);
	}
}