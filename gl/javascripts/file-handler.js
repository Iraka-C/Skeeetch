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
		STORAGE.FILES.removeContent();
		ENV.setFileTitle("Skeeetch");
		ENV.setPaperSize(ENV.paperSize.width,ENV.paperSize.height);
		LAYERS.initFirstLayer();
		fileManager.toggleExpand();
	});
	const $fileInput=$("<input type='file' style='display:none;position:fixed;top:-1000px'/>");
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
			let file=e.originalEvent.dataTransfer.files[0]; // @TODO: open multiple files
			console.log(file);

			if(!file) return; // dragging layer

			// Check file type
			if(file.name.endsWith(".psd")) { // a Photoshop file
				CURSOR.setBusy(true); // set busy cursor
				PERFORMANCE.idleTaskManager.startBusy();
				EventDistributer.footbarHint.showInfo("Reading file contents ...");
				ENV.taskCounter.startTask(1); // register load file task
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
	});
}

// PSD handlers

/**
 * data is an array buffer containing binary data of a .psd file
 */
FILES.loadAsPSD=function(data,filename) {
	let psdFile=agPsd.readPsd(data); // ag-psd function, use raw Context2D ImageData rather than loading into canvas
	//console.log(psdFile);
	if(psdFile.width>ENV.maxPaperSize||psdFile.height>ENV.maxPaperSize) {
		// larger than maximum paper size
		EventDistributer.footbarHint.showInfo("Error: File dimensions larger than "+ENV.maxPaperSize+"px",2000);
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
	const loadQueue=[]; // A queue of StackNodes

	class StackNode {
		constructor(json,parent) {
			this.parent=parent;
			this.json=json; // ag-psd json object to load
			this.elem=null;
			this.N=0; // total children
			this.loadedChildrenCnt=0; // loaded children number

			// Loading queue related
			this.index=0;
			this.nextNodeToLoad=null;
			ENV.taskCounter.startTask(1); // register load node
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
				CANVAS.renderer.loadToImageData(newElement.rawImageData,sNode.canvas); // load data
				// Release canvas contents
				sNode.canvas.width=0;
				sNode.canvas.height=0;
				// Set image data position
				if(sNode.hasOwnProperty("left")) { // set both border and valid area
					newElement.rawImageData.left=sNode.left;
					newElement.rawImageData.validArea.left=sNode.left;
				}
				if(sNode.hasOwnProperty("top")) {
					newElement.rawImageData.top=sNode.top;
					newElement.rawImageData.validArea.top=sNode.top;
				}

				// UI/status settings
				const lockStatus=sNode.transparencyProtected?
					sNode.protected.transparency?
						1:2:0; // a bit weird
				newElement.setProperties({ // also requested recomposition @TODO: add initial value
					locked: lockStatus==2,
					pixelOpacityLocked: lockStatus>=1,
					opacity: sNode.opacity/255, // in psd, opacity is from 0 to 255
					visible: !sNode.hidden,
					clipMask: sNode.clipping,
					name: sNode.name,
					blendMode: BasicRenderer.blendModeNameToEnum(sNode.blendMode)
				});
				
				// store contents
				STORAGE.FILES.saveContentChanges(newElement); // save loaded contents
				this.elem=newElement;
			}
			else { // unsupported node (yet)
				FILES.loadPSDNodes.isUnsupportedLayerFound=true;
			}

			if(this.nextNodeToLoad){ // prepare to load the next node
				setTimeout(e=>{
					const percentage=(this.index/loadQueue.length*100).toFixed(1);
					EventDistributer.footbarHint.showInfo("Loading "+percentage+"% ...",5000);
					this.nextNodeToLoad.load();
				},0);
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
				this.loaded();
			}
		}
		loaded() {
			// report sth
			ENV.taskCounter.finishTask(1); // register load node
			if(this.parent){
				this.parent.append(this);
				if(this.parent.elem.id=="root"&&this.elem){ // parent is root
					FILES.loadPSDNodes.lastLoadingElement=this.elem;
				}
			}
			else{ // root loaded
				FILES.onPSDLoaded();
			}
		}
	}

	// Construct loading queue using DFS
	// 1 exception: root stack node doesn't belong to queue: already in layerTree
	const rootStackNode=new StackNode(node,null);
	rootStackNode.elem=LAYERS.layerTree; // set (regarded as already loaded) root element
	rootStackNode.N=node.children.length;
	
	const traverse=function(jsonNode,parentStackNode) {
		const stackNode=new StackNode(jsonNode,parentStackNode);
		const M=loadQueue.length;
		stackNode.index=M;
		if(M){ // create linked list of loading items
			loadQueue[M-1].nextNodeToLoad=stackNode;
		}
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
	// @TODO: length==0?
	EventDistributer.footbarHint.showInfo("Loading 0.0% ...",5000);
	loadQueue[0].load(); // kick!
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
	ENV.taskCounter.finishTask(1); // finish file loading task
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