/**
 * Manage the contents of a file
 */

// Save || get file: when saving, save only valid area
class FileWorker { // Work on canvas layer content, not files in repository!
	constructor(layerStore,fileID) { // the layerStore and fileID this worker is working on
		this.layerStore=layerStore;
		this.fileID=fileID;
	}
	saveFile(node) {
		const CHUNK_SIZE=1024*1024*64; // 64MB, largest single item browser may store in IDB
		const layerStore=this.layerStore;
		const imgData=node.rawImageData;
		const vArea=imgData.validArea;

		function saveChunks(data){ // data is encoded (compressed) texture contents
			const chunkN=Math.max(Math.ceil(data.length/CHUNK_SIZE),1); // at lease 1 chunk

			ENV.taskCounter.startTask(0,"nodeChunkN"); // start node imagedata structure task
			const bufPromise=layerStore.setItem(node.id,chunkN).finally(() => {
				ENV.taskCounter.finishTask(0,"nodeChunkN");
			});

			const chunkPromises=[bufPromise];
			if(chunkN==1){ // 1 slice step saved
				const key=node.id+"#0";
				const kPromise=layerStore.setItem(key,data); // don't need to slice
				ENV.taskCounter.startTask(); // start save chunk i task
				chunkPromises.push(kPromise.finally(() => {
					ENV.taskCounter.finishTask(); // end save chunk i task
				}));
			}
			else{ // need slice
				for(let i=0;i<chunkN;i++) { // save a slice of data
					const key=node.id+"#"+i;
					const chunk=data.slice(i*CHUNK_SIZE,(i+1)*CHUNK_SIZE);
					const kPromise=layerStore.setItem(key,chunk);
					ENV.taskCounter.startTask(0,"Chunk"+i); // start save chunk i task
					chunkPromises.push(kPromise.finally(() => {
						ENV.taskCounter.finishTask(0,"Chunk"+i); // end save chunk i task
					}));
				}
			}
			// Remove all chunks after (including) chunkN
			STORAGE.FILES.removeContent(layerStore,node.id,chunkN); // do separately, not in promise
			return Promise.all(chunkPromises);
		}
		if(!window.Worker||document.location.protocol=="file:") { // no worker available
			// before we can work with thread-safe worker
			const rawData=CANVAS.renderer.getUint8ArrayFromImageData(imgData,vArea);

			LOGGING&console.log("Local Save");
			const data=Compressor.encode(rawData); // encode first!
			LOGGING&console.log("Compress "+(100*data.length/rawData.length).toFixed(2)+"%");

			return saveChunks(data);
		}
		else{
			return new Promise((resolve,reject) => {
				console.log("Save in Worker");
				const worker=new Worker("./javascripts/workers/compressor-worker.js");
				worker.onmessage=result => { // file saved
					worker.terminate();
					resolve(result.data);
				};
				worker.onerror=err => {
					worker.terminate();
					reject(err);
				}

				const rawData=CANVAS.renderer.getUint8ArrayFromImageData(imgData,vArea,null,{
					isPreserveArrayType: true
				});
				worker.postMessage({
					id: node.id,
					rawData: rawData,
				});
			}).then(msg=>{ // save file promises. msg is the object containing all data
				return saveChunks(msg.data);
			});
		}
	}
	getFile(nodeID) {
		if(!window.Worker||document.location.protocol=="file:") { // no worker available
			return this.layerStore.getItem(nodeID).then(chunkN => {
				if(!chunkN) { // Not stored or zero chunk
					return null;
				}

				//const chunkN=imgBuf.data;
				const chunkPromises=[];
				for(let i=0;i<chunkN;i++) { // get data slices
					const key=nodeID+"#"+i;
					const kPromise=this.layerStore.getItem(key);
					chunkPromises.push(kPromise);
				}
				return Promise.all(chunkPromises).then(chunks => {
					// reconstruct data
					let totalLen=0;
					for(const v of chunks) {
						totalLen+=v.length;
					}
					let data=new Uint8Array(totalLen);
					let offset=0;
					for(const v of chunks) {
						data.set(v,offset);
						offset+=v.length;
					}

					return Compressor.decode(data); // extract
				});
			});
		}
		else return new Promise((resolve,reject) => { // read with worker
			const worker=new Worker("./javascripts/workers/storage-manager-files-reader.js");
			worker.onmessage=result => { // file get
				worker.terminate();
				const message=result.data;
				if(message.error) { // error in worker
					reject(error);
					return;
				}
				const data=message.data;
				resolve(data);
			};
			worker.onerror=err => {
				worker.terminate();
				reject(err);
			}
			worker.postMessage({
				fileID: this.fileID,
				id: nodeID
			});
		});
	}
}

// ============================ Operations ================================

STORAGE.FILES.reportUnsavedContentChanges=function() {
	if(STORAGE.FILES.isNowActiveLayerSaved) {
		//const htmlEtt=ENV.escapeHTML($("#filename-input").val());
		//$("title").html("&bull;&nbsp;"+htmlEtt);
		STORAGE.FILES.isNowActiveLayerSaved=false;
	}
}

// save file when there is a change
STORAGE.FILES.requestSaveContentChanges=function() {
	// If save not requested
	if(!STORAGE.FILES.isNowActiveLayerSaved
		&&CANVAS.nowLayer
		&&!STORAGE.FILES.savingList.has(CANVAS.nowLayer.id)) {
		return STORAGE.FILES.saveContentChanges(CANVAS.nowLayer);
	}
	else{
		return Promise.resolve();
	}
}

// save directly, without interfering with the UI
// @TODO: change flag into all + hint when exit
// Max length of 1 key-value is 127MB!
// isForceSaving is only used when saving manually
STORAGE.FILES.savingList=new Map();
STORAGE.FILES.saveContentChanges=function(node,isForceSaving) {
	if(!ENV.displaySettings.isAutoSave&&!isForceSaving){ // do not require contents saving
		return Promise.resolve();
	}
	if(node) { // @TODO: operating on a CanvasNode
		//console.trace("Saving contents ...");

		STORAGE.FILES.savingList.set(node.id,node);
		//$("#icon").attr("href","./resources/favicon-working.png");

		const layerStore=STORAGE.FILES.layerStore; // note here in case of layerStore changing
		const fileID=ENV.fileID; // same as above
		// There shouldn't be several save requests of 1 node in 1 frame...
		return new Promise((resolve,reject)=>{
			setTimeout(() => { // give icon a chance to change
				// Get buffer out of valid area
	
				// Start Saving, try saver first
				// FileWorker will try Worker first, then async saving
				const fileSaver=new FileWorker(layerStore,fileID);
				ENV.taskCounter.startTask();
				
				fileSaver.saveFile(node).then(() => {
					STORAGE.FILES.savingList.delete(node.id); // delete first
					node.isContentChanged=false;
					LOGGING&console.log(node.id+" Saved");
					if(!STORAGE.FILES.savingList.size) { // all saved
						STORAGE.FILES.isNowActiveLayerSaved=true;
						//$("#icon").attr("href","./resources/favicon.png");
					}
				}).catch(err => {
					STORAGE.FILES.savingList.delete(node.id); // remove failed task
					//$("#icon").attr("href","./resources/favicon.png");
					console.warn(err);
				}).finally(() => {
					ENV.taskCounter.finishTask();
					resolve(); // resolve promise
				});
			},0);
		});
	}
	return Promise.resolve();
}

STORAGE.FILES.saveAllContents=function() { // force save all changed contents
	const taskList=[]; // containing all tasks
	for(const k in LAYERS.layerHash) { // Save all layers
		const layer=LAYERS.layerHash[k];
		if(layer instanceof CanvasNode) {
			if(layer.isContentChanged) { // content modified
				taskList.push(STORAGE.FILES.saveContentChanges(layer,true));
			}
		}
	}
	STORAGE.FILES.isNowActiveLayerSaved=true; // sure to be saved
	return Promise.all(taskList);
}


STORAGE.FILES.isUnsaved=function() {
	if(!STORAGE.FILES.isNowActiveLayerSaved) {
		return true;
	}
	if(STORAGE.FILES.savingList.size) { // still saving
		return true;
	}
	if(!ENV.displaySettings.isAutoSave) { // not auto-saving, check modified layer
		for(const k in LAYERS.layerHash) {
			const layer=LAYERS.layerHash[k];
			if(layer instanceof CanvasNode) {
				if(layer.isContentChanged) { // content modified
					return true;
				}
			}
		}
	}
	return false;
}

STORAGE.FILES.getContent=function(id) {
	let fileReader=new FileWorker(STORAGE.FILES.layerStore,ENV.fileID);
	return fileReader.getFile(id);
}

// if(!layerStore_), use default STORAGE.FILES.layerStore
STORAGE.FILES.removeContent=function(layerStore_,id,startChunk) {
	//console.warn("Trying to remove ",id,startChunk);
	const layerStore=layerStore_||STORAGE.FILES.layerStore;

	if(id) {
		if(isNaN(startChunk)) { // remove whole id
			ENV.taskCounter.startTask(); // start remove task
			layerStore.removeItem(id).then(() => {
				//console.log("removed",id);
			}).finally(() => {
				ENV.taskCounter.finishTask(); // end remove task
			});
		}
		// remove chunk larger/equal startChunk
		startChunk=startChunk||0;
		layerStore.keys().then(keys => {
			for(const v of keys) { // for all keys keys
				if(v.startsWith(id)) {
					const sPos=v.lastIndexOf("#");
					if(sPos<0) continue; // not a chunk
					const chunkId=parseInt(v.substring(sPos+1));
					if(chunkId>=startChunk) { // to remove
						ENV.taskCounter.startTask(); // start remove chunk task
						layerStore.removeItem(v).then(() => {
							//console.log("removed chunk "+chunkId+" of "+id,v);
						}).finally(() => {
							ENV.taskCounter.finishTask(); // end remove chunk task
						});
					}
				}
			}
		}).catch(function(err) { // get key promise
			console.log(err);
		});
	}
	else { // clear all
		ENV.taskCounter.startTask();
		layerStore.clear().then(() => {
			console.log("IDB: Remove all");
		}).catch(err => {
			console.log(err);
		}).finally(() => {
			ENV.taskCounter.finishTask();
		});
	}

}

// ==================== Layer tree operation ===========================

STORAGE.FILES.clearLayerTree=function() {
	localStorage.removeItem("layer-tree");
}

// return a string of layer tree JSON
STORAGE.FILES.saveLayerTree=function() {
	const storageJSON=LAYERS.getStorageJSON();
	localStorage.setItem("layer-tree",JSON.stringify(storageJSON));
	return storageJSON;
}

/**
 * Save the layer tree structure in database.
 * Async function.
 * 
 * When closing a file (because of creating new file or ...)
 * When manually saving a file
 * When reading layer tree from localStorage (sync with localStorage)
 */
STORAGE.FILES.saveLayerTreeInDatabase=function(json) {
	ENV.taskCounter.startTask(); // start saving layer tree task
	return STORAGE.FILES.layerStore.setItem("layer-tree",json).finally(() => {
		ENV.taskCounter.finishTask();
	});
}
STORAGE.FILES.getLayerTreeFromDatabase=function(){ // returns a Promise
	return STORAGE.FILES.layerStore.getItem("layer-tree");
}

STORAGE.FILES.getLayerTree=function() {
	const sJSON=localStorage.getItem("layer-tree");
	return sJSON? JSON.parse(sJSON):null;
}

// ================ Load Layer Contents ==================
STORAGE.FILES.loadLayerTree=function(node) {
	const loadLayerTreePromise=new Promise((resolve,reject)=>{
		STORAGE.FILES.loadLayerTree._resolve=resolve;
		STORAGE.FILES.loadLayerTree._reject=reject;
	});
	// set busy status
	EventDistributer.footbarHint.showInfo(Lang("Loading saved paper")+" ...");
	STORAGE.FILES.isFailedLayer=false;

	const loadQueue=[]; // A queue of StackNodes
	const layerStore=STORAGE.FILES.layerStore; // do not change storage here
	//console.log("Now store",layerStore);
	const loadReport={
		title: Lang("open-psd-report")+ENV.getFileTitle(),
		items: []
	};

	class StackNode {
		constructor(json,parent) {
			this.parent=parent;
			this.json=json; // storage json object to load
			this.elem=null;
			this.N=0; // total children
			this.loadedChildrenCnt=0; // loaded children number

			// Loading queue related
			this.index=0;
			this.nextNodeToLoad=null;
			ENV.taskCounter.startTask(1); // register load node
		}
		load() { // sync function, can be called async
			const loadNextNodeAsync=() => {
				if(ENV.taskCounter.isTryingToAbort) { // User tries to abort the loading process
					ENV.taskCounter.init(); // reset task indicator
					STORAGE.FILES.isFailedLayer=true;
					EventDistributer.footbarHint.showInfo(Lang("File loading aborted"),5000);
					STORAGE.FILES.onLayerTreeAborted();
					return; // give up, do not call this.loaded
				}
				if(this.nextNodeToLoad) { // prepare to load the next node
					setTimeout(e => {
						const percentage=(this.index/loadQueue.length*100).toFixed(1);
						EventDistributer.footbarHint.showInfo(Lang("Loading")+" "+percentage+"% ...",5000);
						this.nextNodeToLoad.load();
					},0);
				}
			};

			// **NOTE** setProperties() actually requested screen refresh
			const sNode=this.json;
			if(sNode.type=="LayerGroupNode") { // group node
				this.N=sNode.children.length; // children count
				const newElement=new LayerGroupNode(sNode.id);
				newElement.setProperties(sNode);
				this.elem=newElement;
				if(this.N==0) { // No children: already fully loaded
					this.loaded();
				}
				// else: load the next node (children)
			}
			else if(sNode.type=="CanvasNode") { // canvas node, load image data from canvas
				const newElement=new CanvasNode(sNode.id);
				newElement.setRawImageDataInvalid();
				STORAGE.FILES.getContent(sNode.id).then(imgBuf => {
					//console.log("Trying to get imgData id "+sNode.id+" from store "+ENV.fileID,imgBuf);
					
					if(imgBuf&&sNode.rawImageData) { // contents get
						sNode.rawImageData.data=imgBuf;
						CANVAS.renderer.resizeImageData(newElement.rawImageData,sNode.rawImageData);
						CANVAS.renderer.loadToImageData(newElement.rawImageData,sNode.rawImageData);
						sNode.rawImageData.data=1; // release object
						newElement.isContentChanged=false; // saved contents
					}
					else { // failed to get content, delete broken chunk
						STORAGE.FILES.removeContent(layerStore,sNode.id);
						STORAGE.FILES.isFailedLayer=true;
						loadReport.items.push({
							content: Lang("failed-storage-report1")
								+sNode.name
								+Lang("failed-storage-report2"),
							target: newElement.id
						});
					}
					newElement.setProperties(sNode); // also request refresh. This might be a potential bottleneck
					// @TODO: possible solution: insert after loading?
				}).catch(err => { // load failed
					console.warn("ImageData Loading Failed");
					//console.error(err);
					STORAGE.FILES.isFailedLayer=true;
					loadReport.items.push({
						content: Lang("failed-storage-report1")
							+sNode.name
							+Lang("failed-storage-report2"),
						target: newElement.id
					});
					// @TODO: delete $ui & texture?
				}).finally(() => {
					this.loaded();
					loadNextNodeAsync();
					// @TODO-: load contents after inserting UI?
				});
				this.elem=newElement;
				return;
			}
			else { // Other layers
				// ...?
				this.loaded();
			}

			loadNextNodeAsync();
		}
		append(child) {
			if(child.elem) { // valid node
				this.elem.insertNode(child.elem,0);
				this.elem.insertNode$UI(child.elem.$ui,0);
				child.elem.setImageDataInvalid(); // clip order may change
			}

			this.loadedChildrenCnt++;
			if(this.loadedChildrenCnt==this.N) { // all children loaded
				// may do compression / composition here
				this.loaded();
			}
		}
		loaded() {
			ENV.taskCounter.finishTask(1); // end loading layer task
			if(this.parent) {
				this.parent.append(this);
			}
			else { // root loaded
				PERFORMANCE.REPORTER.report(loadReport);
				STORAGE.FILES.onLayerTreeLoad(LAYERS.layerHash[node.active]);
			}
		}
	}

	// Construct loading queue using DFS
	// 1 exception: root stack node doesn't belong to queue: already in layerTree
	const rootStackNode=new StackNode(node,null);
	rootStackNode.elem=LAYERS.layerTree; // set (already loaded) element
	rootStackNode.N=node.children.length;

	const traverse=function(jsonNode,parentStackNode) {
		const stackNode=new StackNode(jsonNode,parentStackNode);
		const M=loadQueue.length;
		stackNode.index=M; // start from 1 (0 for root)
		if(M) { // create linked list of loading items
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
	EventDistributer.footbarHint.showInfo(Lang("Loading")+" 0.0% ...",5000);
	if(loadQueue.length) {
		loadQueue[0].load(); // kick
	}
	else{
		rootStackNode.loaded(); // finish now
	}

	return loadLayerTreePromise;
}
STORAGE.FILES.loadLayerTree._resolve=null;
STORAGE.FILES.loadLayerTree._reject=null;

STORAGE.FILES.onLayerTreeLoad=function(activeNode) {
	STORAGE.FILES.clearUnusedContents(STORAGE.FILES.layerStore); // maybe uncleared history
	COMPOSITOR.updateLayerTreeStructure(); // async!
	LAYERS.setActive(activeNode);
	LAYERS.scrollTo(activeNode,true);
	/**
	 * Note: even if there's "reading file thumb from storage" for the opened file
	 * the thumb in storage might not be the latest
	 * because it was not updated before last closeing Skeeetch
	 * 
	 * Update it after loading (and write it again to the storage) allow
	 * the storage to contain the latest thumb image
	 */

	if(STORAGE.FILES.isFailedLayer) {
		EventDistributer.footbarHint.showInfo(Lang("error-corrupted-layer"),2000);
	}
	else {
		EventDistributer.footbarHint.showInfo(Lang("Loaded"));
	}

	PERFORMANCE.idleTaskManager.addTask(e=>{ // update all layer thumbs when idle
		LAYERS.updateAllThumbs(); // update thumbs of every layer
		STORAGE.FILES.updateCurrentThumb(); // update the thumb of this psd file
	});
	STORAGE.FILES.loadLayerTree._resolve(); // resolve loading
	STORAGE.FILES.loadLayerTree._resolve=null;
	STORAGE.FILES.loadLayerTree._reject=null;
}

/**
 * Abort loading, use a blank new page instead
 */
STORAGE.FILES.onLayerTreeAborted=function(){
	const fileID=ENV.fileID; // record ID before abort
	const fileName=ENV.getFileTitle();
	// use 256x256 as init, at most 1MB
	FILES.tempPaperSize.width=256;
	FILES.tempPaperSize.height=256;
	FILES.newPaperAction(fileName+Lang("file-name-abort")); // DO NOT save, use a new paper instead
	STORAGE.FILES.updateThumbFromDatabase(fileID);

	// draw a sign in the new paper
	const canvas=$("canvas")[0];
	canvas.width=canvas.height=256;
	const ctx2d=canvas.getContext("2d");
	ctx2d.font="32px "
		+window.getComputedStyle(document.body)
		.getPropertyValue("--default-font-family");
	ctx2d.fillStyle="#cccccc";
	ctx2d.textAlign="center";
	ctx2d.textBaseline="middle";
	ctx2d.fillText(Lang("load-layertree-error-hint"),128,128);

	// load to image
	CANVAS.renderer.loadToImageData(CANVAS.nowLayer.rawImageData,canvas);
	CANVAS.nowLayer.setImageDataInvalid();
	COMPOSITOR.updateLayerTreeStructure();

	STORAGE.FILES.loadLayerTree._reject(); // reject loading
	STORAGE.FILES.loadLayerTree._resolve=null;
	STORAGE.FILES.loadLayerTree._reject=null;
}

// clear buf/chunk unused by any layer
// do not clear oversized chunks: done by STORAGE.FILES.removeContent()
STORAGE.FILES.clearUnusedContents=function(layerStore) {
	layerStore.keys().then(keys => {
		for(const v of keys) { // remove unused keys
			if(v=="layer-tree") continue; // default layer tree structure item
			if(!LAYERS.layerHash.hasOwnProperty(v.replace(/#.*$/,""))) {
				ENV.taskCounter.startTask(); // start remove unused task
				layerStore.removeItem(v).then(() => {
					console.log("Clear unused",v);
				}).finally(() => {
					ENV.taskCounter.finishTask(); // end remove unused task
				});
			}
		}
	}).catch(function(err) { // get keys promise
		console.log(err);
	});
}

STORAGE.FILES.getUnsavedCheckDialog=function(){
	// returns a promise: if there is unsaved content, resolve after a dialog box
	// else, resolve directly
	return ( // detect if is to save current file
		ENV.displaySettings.isAutoSave||!STORAGE.FILES.isUnsaved()?
		Promise.resolve(true):
		FILES.showSaveFileDialogBox()
	).then(isToSave=>{
		if(isToSave){
			const layerTreeStr=STORAGE.FILES.saveLayerTree();
			STORAGE.FILES.updateCurrentThumb();
			return Promise.all([ // save current contents
				STORAGE.FILES.saveLayerTreeInDatabase(layerTreeStr),
				STORAGE.FILES.saveAllContents()
			]);
		}
		else{
			return Promise.resolve();
		}
	});
}
