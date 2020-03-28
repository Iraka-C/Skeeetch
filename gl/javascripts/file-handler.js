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
	fileManager.addButton(Lang("Save as PNG"),e=>{
		EventDistributer.footbarHint.showInfo("Saving ...");
		CURSOR.updateAppearance.setBusy(true); // set busy cursor
		fileManager.toggleExpand();
		setTimeout(FILES.saveAsPNG,1000); // @TODO: mark IdleTask as Busy?
	});
	fileManager.addButton(Lang("Save as PSD"),e=>{
		EventDistributer.footbarHint.showInfo("Rendering ...");
		CURSOR.updateAppearance.setBusy(true); // set busy cursor
		fileManager.toggleExpand();
		setTimeout(FILES.saveAsPSD,1000); // @TODO: mark IdleTask as Busy?
	});
}

// =================== Import operations =====================

FILES.initImportDropHandler=function(){
	$("body").on("dragenter dragleave dragover drop",e=>{
		e.preventDefault();
		if(e.type=="drop"){
			let file=e.originalEvent.dataTransfer.files[0]; // @TODO: open multiple files
			console.log(file);

			if(!file)return; // dragging layer

			// Check file type
			if(file.name.endsWith(".psd")){ // a Photoshop file
				CURSOR.updateAppearance.setBusy(true); // set busy cursor
				let reader=new FileReader();
				reader.readAsArrayBuffer(file);
				reader.onload=function(){
					FILES.loadAsPSD(this.result,file.name.slice(0,-4));
				}
			}

			if(file.type&&file.type.match(/image*/)){ // an image file
				CURSOR.updateAppearance.setBusy(true); // set busy cursor
				window.URL=window.URL||window.webkitURL;
				const img=new Image();
				img.src=window.URL.createObjectURL(file);
				img.filename=file.name;
				img.onload=function(e){
					FILES.loadAsImage(this);
				}
			}
		}
	});
}

// PSD handlers

/**
 * data is an array buffer containing binary data of a .psd file
 */
FILES.loadAsPSD=function(data,filename){
	let psdFile=agPsd.readPsd(data); // ag-psd function, use raw Context2D ImageData rather than loading into canvas
	//console.log(psdFile);
	ENV.setPaperSize(psdFile.width,psdFile.height); // change paper size to fit the file, clear history
	ENV.setFileTitle(filename);

	// clear all existing layers // @TODO: judge if to clear all using HISTORY length
	LAYERS.active=null; // disable layer operation and canvas
	CANVAS.setTargetLayer(null);
	for(const v of LAYERS.layerTree.children){
		v.delete(); // delete these layers and resources
	}
	LAYERS.layerTree.children=[];
	$("#layer-panel-inner").empty();
	$("#canvas-layers-container").empty();
	// init Layerhash, ui container, div container

	//FILES.loadPsdNode.isSetActive=false;
	FILES.loadPSDNode.progress=0;
	FILES.loadPSDNode.isUnsupportedLayerFound=false;
	FILES.loadPSDNode.status={};
	FILES.loadPSDNode.lastLoadingElement=null;
	FILES.loadPSDNode(psdFile,LAYERS.layerTree,1); // start with root
}

/**
 * node is a node object in psdFile
 */
FILES.loadPSDNode=function(node,nowGroup,progressAmount){
	const STATUS=FILES.loadPSDNode.status;
	STATUS[nowGroup.id]=0; // start loading this node
	//if(node.mask) // masking layer

	// node is certainly a group, its equivalent layer object a GroupNode (nowGroup)
	const children=node.children;
	const progressFrac=progressAmount/children.length;

	// For each child
	for(let i=0;i<children.length;i++){
		const sNode=children[i];
		STATUS[nowGroup.id]++;
		setTimeout(event=>{ // in 'parallel' (Tree structure, loading order follows the event created order)
			let newElement=null;
			if(sNode.children){ // has children, is a group
				newElement=new LayerGroupNode();
				newElement.setProperties({ // @TODO: add initial value
					name: sNode.name,
					isExpanded: sNode.opened
				});
				newElement.setRawImageDataInvalid();

				FILES.loadPSDNode(sNode,newElement,progressFrac); // iteratively
				FILES.loadPSDNode.lastLoadingElement=newElement;
				// load the progress in all: progressFrac
			}
			else if(sNode.canvas){ // There might be unsupported layer such as info/adjustments
				newElement=new CanvasNode();
				CANVAS.renderer.loadImageToImageData(newElement.rawImageData,sNode.canvas); // load image data from canvas
				if(sNode.hasOwnProperty("left")){
					newElement.rawImageData.left=sNode.left;
				}
				if(sNode.hasOwnProperty("top")){
					newElement.rawImageData.top=sNode.top;
				}
				
				// UI/status settings
				const lockStatus=sNode.transparencyProtected?sNode.protected.transparency?1:2:0; // a bit weird
				newElement.setProperties({ // @TODO: add initial value
					locked: lockStatus==2,
					pixelOpacityLocked: lockStatus>=1,
					opacity: sNode.opacity/255, // in psd, opacity is from 0 to 255
					visible: !sNode.hidden,
					clipMask: sNode.clipping,
					name: sNode.name,
					blendMode: BasicRenderer.blendModeNameToEnum(sNode.blendMode)
				});

				// add progress on non-group element
				FILES.loadPSDNode.progress+=progressFrac;
				let p=FILES.loadPSDNode.progress;
				p=p*p; // progress^4
				p=p*p;
				EventDistributer.footbarHint.showInfo("Loading "+(p*100).toFixed(2)+"% ...");
				// the actuall progress considering the depth should be a function of progress in average
				// 4 is the approx. value
				FILES.loadPSDNode.lastLoadingElement=newElement;
			}
			else{
				FILES.loadPSDNode.isUnsupportedLayerFound=true;
			}

			if(newElement){ // successfully created, insert the new layer
				nowGroup.insertNode(newElement,0);
				nowGroup.insertNode$UI(newElement.$ui,0);
			}

			STATUS[nowGroup.id]--; // loaded, remove from list
			if(!STATUS[nowGroup.id]){ // all nodes of nowGroup loaded
				delete STATUS[nowGroup.id];
			}

			if($.isEmptyObject(STATUS)){
				CANVAS.requestRefresh();
				LAYERS.updateAllThumbs();
				if(FILES.loadPSDNode.isUnsupportedLayerFound){
					EventDistributer.footbarHint.showInfo("Unsupported layers in this file are discarded");
				}
				else{
					EventDistributer.footbarHint.showInfo("Loaded");
					LAYERS.setActive(FILES.loadPSDNode.lastLoadingElement);
					FILES.loadPSDNode.lastLoadingElement=null; // release reference
					CURSOR.updateAppearance.setBusy(false); // free busy cursor
				}
			}
			//console.log(STATUS,nowGroup.id);
		},0);
	}
}

// Image Handlers
FILES.loadAsImage=function(img){
	const layer=LAYERS.addNewCanvasNode();
	CANVAS.renderer.loadImageToImageData(layer.rawImageData,img);
	layer.setRawImageDataInvalid();
	layer.updateThumb();
	LAYERS.setActive(layer);
	CANVAS.requestRefresh();
	CURSOR.updateAppearance.setBusy(false); // free busy cursor
}

// ===================== Export operations ========================

FILES.saveAsPSD=function(){ // @TODO: change to async function
	/**
	 * **NOTE** Should not use Promise for asynchronized JSON composition:
	 * Promise() creates microtasks in the task loop,
	 * and the execution priority is higher than UI/events update (macrotasks).
	 * A series of work in Promise also freezes the UI.
	 * 
	 * **What it combining setTimeOut & Promise? Better grammar that doesn't block the UI?
	 */
	let psdJSON=LAYERS.layerTree.getAgPSDCompatibleJSON(); // Construct layers
	let buffer;

	EventDistributer.footbarHint.showInfo("Encoding ...");
	setTimeout(e=>{ // convert into binary stream
		buffer=agPsd.writePsd(psdJSON);
		EventDistributer.footbarHint.showInfo("Exporting ...");
	},0);
	setTimeout(e=>{ // Download
		const blob=new Blob([buffer],{type: "application/octet-stream"});
		const filename=ENV.getFileTitle();
		FILES.downloadBlob(filename+".psd",blob);
		CURSOR.updateAppearance.setBusy(false); // free busy cursor
	},0);
}

FILES.saveAsPNG=function(){
	const imgData=LAYERS.layerTree.rawImageData;
	const canvas=CANVAS.renderer.getContext2DCanvasFromImageData(
		imgData,ENV.paperSize.width,ENV.paperSize.height,imgData.left,imgData.top);
	canvas.toBlob(blob=>{ // Only Context2D can be safely changed into blob
		const filename=ENV.getFileTitle();
		FILES.downloadBlob(filename+".png",blob);
		CURSOR.updateAppearance.setBusy(false); // free busy cursor
	});
}

FILES.downloadBlob=function(filename,blob){
	const save_link=document.createElement("a");
	save_link.href=URL.createObjectURL(blob);
	save_link.download=filename;
	const event=document.createEvent("MouseEvents");
	event.initMouseEvent("click",true,false,window,0,0,0,0,0,false,false,false,false,0,null);
	save_link.dispatchEvent(event);
}