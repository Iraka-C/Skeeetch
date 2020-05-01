/**
 * Handle file import/export, file resize, etc.
 */

FILES={};

FILES.init=function() {
	FILES.initFileMenu();
	FILES.initImportDropHandler();
}

FILES.initFileMenu=function() {
	let fileManager=new SettingManager($("#file-menu-panel"),Lang("Files"));
	fileManager.setOpenButton($("#file-button"));
	fileManager.addSectionTitle(Lang("Add Content"));
	fileManager.addButton(Lang("New Paper"),() => { // clear all, reinit
		// @TODO: clear storage
		ENV.setFileTitle("Skeeetch");
		ENV.setPaperSize(ENV.paperSize.width,ENV.paperSize.height);
		LAYERS.initFirstLayer();
		fileManager.toggleExpand();
	});
	const $fileInput=$("<input type='file' style='display:none;position:fixed;top:-1000em'/>");
	$fileInput.on("change",e=>{ // file selected
		FILES.onFilesLoaded($fileInput[0].files);
	});
	fileManager.addButton(Lang("Open File"),() => {
		$fileInput[0].click();
		fileManager.toggleExpand();
	});

	fileManager.addSectionTitle(Lang("Export Content"));
	fileManager.addButton(Lang("Save as PNG"),e => {
		EventDistributer.footbarHint.showInfo("Saving ...");
		CURSOR.setBusy(true); // set busy cursor
		PERFORMANCE.idleTaskManager.startBusy();
		fileManager.toggleExpand();
		setTimeout(FILES.saveAsPNG,1000); // @TODO: mark IdleTask as Busy?
	});
	fileManager.addButton(Lang("Save as PSD"),e => {
		EventDistributer.footbarHint.showInfo("Rendering ...");
		CURSOR.setBusy(true); // set busy cursor
		PERFORMANCE.idleTaskManager.startBusy();
		fileManager.toggleExpand();
		setTimeout(FILES.saveAsPSD,1000); // @TODO: mark IdleTask as Busy?
	});
}

// =================== Import operations =====================

FILES.initImportDropHandler=function() {
	$("body").on("dragenter dragleave dragover drop",e => {
		e.preventDefault();
		if(e.type=="drop") {
			FILES.onFilesLoaded(e.originalEvent.dataTransfer.files);
		}
	});
}

FILES.onFilesLoaded=function(files){
	let file=files[0]; // @TODO: open multiple files
	console.log(file);

	if(!file) return; // dragging layer

	// Check file type
	if(file.name.endsWith(".psd")) { // a Photoshop file
		CURSOR.setBusy(true); // set busy cursor
		PERFORMANCE.idleTaskManager.startBusy();
		let reader=new FileReader();
		reader.readAsArrayBuffer(file);
		reader.onload=function() {
			FILES.loadAsPSD(this.result,file.name.slice(0,-4));
		}
	}

	if(file.type&&file.type.match(/image*/)) { // an image file
		CURSOR.setBusy(true); // set busy cursor
		PERFORMANCE.idleTaskManager.startBusy();
		window.URL=window.URL||window.webkitURL;
		const img=new Image();
		img.src=window.URL.createObjectURL(file);
		img.filename=file.name;
		img.onload=function(e) {
			FILES.loadAsImage(this);
		}
	}
}

// PSD handlers

/**
 * data is an array buffer containing binary data of a .psd file
 */
FILES.loadAsPSD=function(data,filename) {
	let psdFile=agPsd.readPsd(data); // ag-psd function, use raw Context2D ImageData rather than loading into canvas
	console.log(psdFile);
	if(psdFile.width>ENV.displaySettings.maxPaperSize||psdFile.height>ENV.displaySettings.maxPaperSize) {
		// larger than maximum paper size
		EventDistributer.footbarHint.showInfo("Error: File dimensions larger than "+ENV.displaySettings.maxPaperSize+" px",2000);
		CURSOR.setBusy(false); // free busy cursor
		PERFORMANCE.idleTaskManager.startIdle();
		return;
	}
	ENV.setPaperSize(psdFile.width,psdFile.height); // change paper size to fit the file, clear all contents and histories
	ENV.setFileTitle(filename);

	FILES.loadPSDNodes.isUnsupportedLayerFound=false;
	FILES.loadPSDNodes.lastLoadingElement=null;
	FILES.loadPSDNodes(psdFile);
}

/**
 * This function uses DFS to turn stack structure into a queue,
 * which can save memory during composition
 */
FILES.loadPSDNodes=function(node) {
	class StackNode {
		constructor(json,parent) {
			this.parent=parent;
			this.json=json; // ag-psd json object to load
			this.elem=null;
			this.N=0; // total children
			this.loadedChildrenCnt=0; // loaded children number
		}
		load() { // sync function, can be called async
			// **NOTE** setProperties() actually requested screen refresh
			const sNode=this.json;
			if(sNode.hasOwnProperty("children")) { // group node
				this.N=sNode.children.length; // children count
				const newElement=new LayerGroupNode();
				newElement.setProperties({ // @TODO: add initial value
					name: sNode.name,
					isExpanded: sNode.opened
				});
				this.elem=newElement;
			}
			else if(sNode.canvas) { // canvas node, load image data from canvas
				const newElement=new CanvasNode();
				CANVAS.renderer.loadToImageData(newElement.rawImageData,sNode.canvas);
				if(sNode.hasOwnProperty("left")) { // set both border and valid area
					newElement.rawImageData.left=sNode.left;
					newElement.rawImageData.validArea.left=sNode.left;
				}
				if(sNode.hasOwnProperty("top")) {
					newElement.rawImageData.top=sNode.top;
					newElement.rawImageData.validArea.top=sNode.top;
				}
				STORAGE.FILES.saveContentChanges(newElement);
				// UI/status settings
				const lockStatus=sNode.transparencyProtected?
					sNode.protected.transparency?
						1:2:0; // a bit weird
				newElement.setProperties({ // @TODO: add initial value,
					locked: lockStatus==2,
					pixelOpacityLocked: lockStatus>=1,
					opacity: sNode.opacity/255, // in psd, opacity is from 0 to 255
					visible: !sNode.hidden,
					clipMask: sNode.clipping,
					name: sNode.name,
					blendMode: BasicRenderer.blendModeNameToEnum(sNode.blendMode)
				});
				this.elem=newElement;
			}
			else { // unsupported node (yet)
				FILES.loadPSDNodes.isUnsupportedLayerFound=true;
			}

			if(this.N==0){ // no children
				this.loaded();
			}
		}
		append(child) {
			if(child.elem){ // valid node
				this.elem.insertNode(child.elem,0);
				this.elem.insertNode$UI(child.elem.$ui,0);
				child.elem.setRawImageDataInvalid();
			}
			this.loadedChildrenCnt++;
			if(this.loadedChildrenCnt==this.N){ // all children loaded
				// may do compression / composition here
				this.loaded();
			}
		}
		loaded() {
			if(this.parent){
				this.parent.append(this);
				if(this.parent.elem.id=="root"){ // parent is root
					FILES.loadPSDNodes.lastLoadingElement=this.elem;
				}
			} // else: root node
			// report sth
		}
	}

	// Construct loading queue using DFS
	// 1 exception: root stack node doesn't belong to queue: already in layerTree
	const rootStackNode=new StackNode(node,null);
	rootStackNode.elem=LAYERS.layerTree; // set (already loaded) element
	rootStackNode.N=node.children.length;

	const loadQueue=[];
	const traverse=function(jsonNode,parentStackNode) {
		const stackNode=new StackNode(jsonNode,parentStackNode);
		loadQueue.push(stackNode);
		if(jsonNode.children) { // load children json
			for(let i=0;i<jsonNode.children.length;i++) {
				traverse(jsonNode.children[i],stackNode);
			}
		}
	};
	for(let i=0;i<node.children.length;i++) { // traverse root
		traverse(node.children[i],rootStackNode);
	}

	// Load all children async
	for(let i=0;i<loadQueue.length;i++) {
		setTimeout(e=>{
			EventDistributer.footbarHint.showInfo(
				"Loading "+(i/loadQueue.length*100).toFixed(2)+"% ...",5000);
			loadQueue[i].load();
			if(i==loadQueue.length-1){ // all loaded
				FILES.onPSDLoaded();
			}
		},0);
	}
}

/**
 * Deprecated function
 * node is a node object in psdFile
 * This function makes use of the macro event queue of JS
 * which forms a BFS traversal in the node tree
 */
//FILES.loadPSDNode=function(node,nowGroup,progressAmount) {}

// when all contents of PSD file are loaded
FILES.onPSDLoaded=function() {
	COMPOSITOR.updateLayerTreeStructure(); // async!
	if(FILES.loadPSDNodes.isUnsupportedLayerFound) {
		EventDistributer.footbarHint.showInfo("Unsupported layers in this file are discarded",2000);
	}
	else {
		EventDistributer.footbarHint.showInfo("Loaded");
	}
	CURSOR.setBusy(false); // free busy cursor
	PERFORMANCE.idleTaskManager.startIdle();
	/**
	 * Here is a mysterious bug that thumb updating has to be call asynced.
	 * At this point (here), all canvas contents of psd SHOULD have loaded into CanvasNodes
	 * but calling LAYERS.updateAllThumbs stll (may) reports no src image buffer binding error.
	 * I doubt that this may due to the loading mechanism of ag-psd.
	 * Somehow using texImage2D has become unsynchronized (with an "onload" to which we cannot listen)
	 * and we must queue thumb updating up to wait for fully loaded.
	 * COMPOSITOR.updateLayerTreeStructure doesn't report an error because it is already async
	 * 
	 * Refer to FILES.loadAsImage, this loading doesn't cause any error like this
	 */
	// LAYERS.updateAllThumbs();
	const toActive=FILES.loadPSDNodes.lastLoadingElement;
	FILES.loadPSDNodes.lastLoadingElement=null; // release ref
	PERFORMANCE.idleTaskManager.addTask(e => {
		LAYERS.setActive(toActive);
		LAYERS.updateAllThumbs();
	});
}

// Image Handlers
FILES.loadAsImage=function(img) {
	const layer=LAYERS.addNewCanvasNode();
	const oldActiveID=LAYERS.active.id;
	LAYERS.setActive(layer); // also setup lastRawImageData (as empty here)
	CANVAS.renderer.loadToImageData(layer.rawImageData,img);
	layer.setRawImageDataInvalid();
	layer.updateThumb();
	COMPOSITOR.updateLayerTreeStructure();
	CURSOR.setBusy(false); // free busy cursor
	PERFORMANCE.idleTaskManager.startIdle();
	HISTORY.addHistory({ // combine two steps
		type: "bundle",
		children: [
			{
				type: "node-structure",
				id: layer.id,
				from: null,
				to: layer.parent.id,
				oldIndex: null,
				newIndex: layer.getIndex(),
				oldActive: oldActiveID,
				newActive: layer.id
			},
			{
				type: "image-data",
				id: CANVAS.nowLayer.id,
				area: {...layer.rawImageData.validArea}
			}

		]
	});
	STORAGE.FILES.saveContentChanges(layer);
}

// ===================== Export operations ========================

FILES.saveAsPSD=function() { // @TODO: change to async function
	/**
	 * **NOTE** Should not use Promise for asynchronized JSON composition:
	 * Promise() creates microtasks in the task loop,
	 * and the execution priority is higher than UI/events update (macrotasks).
	 * A series of work in Promise also freezes the UI.
	 * 
	 * **What it combining setTimeOut & Promise? Better grammar that doesn't block the UI?
	 */
	const psdJSON=LAYERS.layerTree.getAgPSDCompatibleJSON(); // Construct layers

	EventDistributer.footbarHint.showInfo("Encoding ...");
	setTimeout(e => { // convert into binary stream
		const buffer=agPsd.writePsd(psdJSON);
		EventDistributer.footbarHint.showInfo("Exporting ...");
		setTimeout(e => { // Download
			const blob=new Blob([buffer],{type: "application/octet-stream"});
			const filename=ENV.getFileTitle();
			FILES.downloadBlob(filename+".psd",blob);
			CURSOR.setBusy(false); // free busy cursor
			PERFORMANCE.idleTaskManager.startIdle();
		},0);
	},0);
}

FILES.saveAsPNG=function() {
	const imgData=LAYERS.layerTree.imageData;
	const canvas=CANVAS.renderer.getContext2DCanvasFromImageData(
		imgData,CANVAS.renderer.viewport);
	canvas.toBlob(blob => { // Only Context2D can be safely changed into blob
		const filename=ENV.getFileTitle();
		FILES.downloadBlob(filename+".png",blob);
		CURSOR.setBusy(false); // free busy cursor
		PERFORMANCE.idleTaskManager.startIdle();
	});
}

FILES.downloadBlob=function(filename,blob) {
	const save_link=document.createElement("a");
	save_link.href=URL.createObjectURL(blob);
	save_link.download=filename;
	const event=document.createEvent("MouseEvents");
	event.initMouseEvent("click",true,false,window,0,0,0,0,0,false,false,false,false,0,null);
	save_link.dispatchEvent(event);
}