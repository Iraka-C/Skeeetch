/**
 * Handle file import/export, file resize, etc.
 */

FILES={};

FILES.init=function() {
	FILES.initFileMenu();
	FILES.initImportDropHandler();
}

// PSD handlers

/**
 * data is an array buffer containing binary data of a .psd file
 */
FILES.loadAsPSD=function(data,filename) {
	let psdFile=agPsd.readPsd(data); // ag-psd function, use raw Context2D ImageData rather than loading into canvas
	LOGGING&&console.log(psdFile);
	if(psdFile.width>ENV.maxPaperSize||psdFile.height>ENV.maxPaperSize) {
		// larger than maximum paper size
		EventDistributer.footbarHint.showInfo("Error: File dimensions larger than "+ENV.maxPaperSize+"px",2000);
		return;
	}
	//if(ENV.taskCounter.isWorking()) return; // Cannot load when busy

	const layerTreeStr=STORAGE.FILES.saveLayerTree();
	Promise.all([ // save current first TODO: auto saving control?
		STORAGE.FILES.saveLayerTreeInDatabase(layerTreeStr),
		STORAGE.FILES.saveAllContents()
	]).then(() => {
		// init a new storage space
		ENV.fileID=STORAGE.FILES.generateFileID();
		ENV.setFileTitle(filename); // set new title
		STORAGE.FILES.initLayerStorage(ENV.fileID); // create storage

		ENV.setPaperSize(psdFile.width,psdFile.height); // change paper size to fit the file, clear all contents and histories
		FILES.fileSelector.addNewFileUIToSelector(ENV.fileID); // add the icon in selector
	
		FILES.loadPSDNodes.isUnsupportedLayerFound=false;
		FILES.loadPSDNodes.lastLoadingElement=null;
		FILES.loadPSDNodes(psdFile); // Start loading file contents
	});
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
			if(sNode.isMask){ // mask node, similar to CanvasNode
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
				newElement.setProperties({ // also requested recomposition @TODO: add initial value
					locked: false,
					pixelOpacityLocked: false,
					opacity: 1, // 1 by default, change the alpha with the same ratio
					visible: !sNode.disabled,
					clipMask: true, // only to the following one layer by default
					name: sNode.masterName+" "+Lang("layer-mask"),
					blendMode: BasicRenderer.MASK // MASK blend mode
				});

				// store contents
				STORAGE.FILES.saveContentChanges(newElement); // save loaded contents
				this.elem=newElement;
			}
			else if(sNode.hasOwnProperty("children")) { // group node
				//LOGGING&&console.log(sNode.name+": "+sNode.blendMode+", '"+sNode.sectionDivider.key+"'");
				this.N=sNode.children.length; // children count
				const newElement=new LayerGroupNode();

				/**
				 * (p.t,tP) -> (lock,oplock)
				 * (0,0) - (0,0)
				 * (1,1) - (0,1)
				 * (0,1) - (1,1)
				 */
				const lockStatus=(sNode.protected&&sNode.protected.transparency)?
					1:sNode.transparencyProtected? 2:0; // a bit weird
				newElement.setProperties({ // @TODO: add initial value
					name: sNode.name,
					isExpanded: sNode.opened,
					locked: lockStatus==2,
					pixelOpacityLocked: lockStatus>=1,
					opacity: sNode.opacity/255, // in psd, opacity is from 0 to 255
					visible: !sNode.hidden,
					clipMask: sNode.clipping,
					blendMode: BasicRenderer.blendModeNameToEnum(sNode.blendMode)
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
				const lockStatus=(sNode.protected&&sNode.protected.transparency)? 1:sNode.transparencyProtected? 2:0; // a bit weird
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

				if(sNode.version>=70){ // Photoshop 7.0 and afterwards
					// may be unsupported features
					FILES.loadPSDNodes.isUnsupportedLayerFound=true;
				}
			}
			else { // unsupported node (yet)
				FILES.loadPSDNodes.isUnsupportedLayerFound=true;
			}

			if(this.nextNodeToLoad) { // prepare to load the next node
				if(ENV.taskCounter.isTryingToAbort){ // User tries to abort the loading process
					ENV.taskCounter.init(); // reset task indicator
					EventDistributer.footbarHint.showInfo("File loading aborted",2000);
					return; // give up
				}
				setTimeout(e => {
					const percentage=(this.index/loadQueue.length*100).toFixed(1);
					EventDistributer.footbarHint.showInfo("Loading "+percentage+"% ...",5000);
					this.nextNodeToLoad.load();
				},0);
			}

			if(this.N==0) { // no children
				this.loaded();
			}
		}
		append(child) {
			if(child.elem) { // valid node
				this.elem.insertNode(child.elem,0);
				this.elem.insertNode$UI(child.elem.$ui,0);
				child.elem.setImageDataInvalid(); // clip order may change
			}
			this.loadedChildrenCnt++;
			if(this.loadedChildrenCnt==this.N) { // all children loaded
				this.loaded();
			}
		}
		loaded() { // loaded when all children are loaded, and then, append to LayerTree.
			// report sth
			ENV.taskCounter.finishTask(1); // register load node
			if(this.parent) {
				this.parent.append(this);
				if(this.parent.elem.id=="root"&&this.elem) { // parent is root
					FILES.loadPSDNodes.lastLoadingElement=this.elem;
				}
			}
			else { // root loaded
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
		if(M) { // create linked list of loading items
			loadQueue[M-1].nextNodeToLoad=stackNode;
		}
		loadQueue.push(stackNode);

		if(jsonNode.children) { // load children json
			for(let i=0;i<jsonNode.children.length;i++) {
				traverse(jsonNode.children[i],stackNode);
			}
		}

		// Some layers, such as adjustment layers, has a mask without canvas
		if(jsonNode.mask&&jsonNode.mask.canvas) { // load mask json
			const stackNodeM=new StackNode(Object.assign(jsonNode.mask,{
				isMask: true, // Note that this is a mask layer
				masterName: jsonNode.name
			}),parentStackNode);
			const M1=loadQueue.length;
			stackNodeM.index=M1;
			loadQueue[M1-1].nextNodeToLoad=stackNodeM;
			loadQueue.push(stackNodeM);
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
		EventDistributer.footbarHint.showInfo("Unsupported layer or feature in this file is discarded",2000);
	}
	else {
		EventDistributer.footbarHint.showInfo("Loaded");
	}
	ENV.taskCounter.finishTask(1); // finish file loading task
	const toActive=FILES.loadPSDNodes.lastLoadingElement;
	FILES.loadPSDNodes.lastLoadingElement=null; // release ref
	LAYERS.setActive(toActive);
	LAYERS.scrollTo(toActive,true);
	PERFORMANCE.idleTaskManager.addTask(e=>{ // update all layer thumbs when idle
		LAYERS.updateAllThumbs();
		STORAGE.FILES.updateCurrentThumb(); // update the thumb of this psd file
	});

	// Layer tree construction completed. Save layer tree info
	const layerTreeStr=STORAGE.FILES.saveLayerTree();
	STORAGE.FILES.saveLayerTreeInDatabase(layerTreeStr);
}

// Image Handlers. If !layerToLoad, then create a new layer
// layerToLoad must be a CanvasNode!
// will change contents of prop!! If necessary, make a deep copy before
FILES.loadAsImage=function(img,layerToLoad,prop) {
	const layer=layerToLoad||LAYERS.addNewCanvasNode();
	const oldActiveID=LAYERS.active.id; // if layer's the same, then nothing happens
	LAYERS.setActive(layer); // also setup lastRawImageData for history
	CANVAS.renderer.loadToImageData(layer.rawImageData,img);

	const historyItems=[];
	if(!layerToLoad){ // new layer created
		historyItems.push({
			type: "node-structure",
			id: layer.id,
			from: null,
			to: layer.parent.id,
			oldIndex: null,
			newIndex: layer.getIndex(),
			oldActive: oldActiveID,
			newActive: layer.id
		});
	}
	if(prop&&!isNaN(prop.left)&&!isNaN(prop.top)){ // add additional position info
		const vArea=layer.rawImageData.validArea;
		const prevL=vArea.left;
		const prevT=vArea.top;
		const dL=prop.left-prevL;
		const dT=prop.top-prevT;
		layer.rawImageData.left+=dL; // pan contents
		layer.rawImageData.top+=dT;
		vArea.left+=dL;
		vArea.top+=dT;
		// Shouldn't record history
		// the changes of all imagedata will be recorded in "image-data" history
		// historyItems.push({
		// 	type: "node-pan",
		// 	id: layer.id,
		// 	dx: dL,
		// 	dy: dT
		// });
	}

	if(prop&&prop.changedArea){ // previous area before loading img provided
		historyItems.push({ // image data change, after panning
			type: "image-data",
			id: layer.id,
			area: GLProgram.extendBorderSize(layer.rawImageData.validArea,prop.changedArea)
		});
	}
	else{ // use the valid area of layer.rawImageData itself
		historyItems.push({ // image data change, after panning
			type: "image-data",
			id: layer.id,
			area: layer.rawImageData.validArea
		});
	}
	
	if(prop&&!$.isEmptyObject(prop)){ // set property and add history
		const prev=layer.getProperties();
		layer.setProperties(prop); // BTW refresh
		historyItems.push({
			type: "node-property",
			id: layer.id,
			prevStatus: prev,
			nowStatus: prop
		});
		// According to the mechanism of HISTORY,
		// If there's no change in layer properties, won't be recorded
	}

	// refresh display
	layer.setRawImageDataInvalid();
	COMPOSITOR.updateLayerTreeStructure();
	layer.updateThumb();

	HISTORY.addHistory({ // combine all steps
		type: "bundle",
		children: historyItems
	});
	
	STORAGE.FILES.saveContentChanges(layer);
}

// ===================== Export operations ========================

FILES.saveAsPSD=function(psdJSON) { // @TODO: change to async function
	/**
	 * **NOTE** Should not use Promise for asynchronized JSON composition:
	 * Promise() creates microtasks in the task loop,
	 * and the execution priority is higher than UI/events update (macrotasks).
	 * A series of work in Promise also freezes the UI.
	 * 
	 * **What it combining setTimeOut & Promise? Better grammar that doesn't block the UI?
	 */
	psdJSON=psdJSON||LAYERS.layerTree.getAgPSDCompatibleJSON(); // Construct layers

	ENV.taskCounter.startTask(1); // start PSD encoding task
	EventDistributer.footbarHint.showInfo("Encoding ...");
	setTimeout(e => { // convert into binary stream
		const buffer=agPsd.writePsd(psdJSON);
		ENV.taskCounter.finishTask(1); // finish PSD encoding task
		EventDistributer.footbarHint.showInfo("Exporting ...");
		setTimeout(e => { // Download
			const blob=new Blob([buffer],{type: "application/octet-stream"});
			const filename=ENV.getFileTitle();
			FILES.downloadBlob(filename+".psd",blob);
			ENV.taskCounter.finishTask(1); // finish PSD task
		},0);
	},0);
}

FILES.saveAsPNG=function() {
	const imgData=LAYERS.layerTree.imageData;
	// Must be a context2d canvas for Blob
	const canvas=CANVAS.renderer.getContext2DCanvasFromImageData(
		imgData,CANVAS.renderer.viewport);
	canvas.toBlob(blob => { // Only Context2D can be safely changed into blob
		const filename=ENV.getFileTitle();
		FILES.downloadBlob(filename+".png",blob);
		ENV.taskCounter.finishTask(1); // finish PNG task
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