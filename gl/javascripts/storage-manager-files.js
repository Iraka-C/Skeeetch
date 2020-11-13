STORAGE.FILES={
	isNowActiveLayerSaved: true
};

 // ================================== Tools ================================
 /**
  * FIXME: do not use dropInstance. use page management by yourself
  * There is a big issue on localForage.dropInstance
  * If you try to drop many instances concurrently, there's a chance that all of them may fail
  * in Chrome 86, the result it dropInstance().then still works but actually not dropped
  * in Firefox 74, the result is an error in .catch(), but this store will be inaccessable
  * 
  * This happens when the user trying to delete a file from repo
  * when another deletion is under processing.
  */

STORAGE.FILES.generateFileID=function(){
	let tag="";
	do { // generate string with alphabet/number, doesn't collide even with non-dropped ones
		tag=ENV.hash().toString(36);
	} while(STORAGE.FILES.filesStore.undroppedList.hasOwnProperty(tag));
	return tag;
}

class FileWorker { // Work on canvas layer content, not files in repository!
	constructor(layerStore,fileID) { // the layerStore and fileID this worker is working on
		this.layerStore=layerStore;
		this.fileID=fileID;
	}
	saveFile(node) {
		const imgData=node.rawImageData;
		const vArea=imgData.validArea;

		if(!window.Worker||document.location.protocol=="file:") { // no worker available

			const rawData=CANVAS.renderer.getUint8ArrayFromImageData(imgData,vArea);

			console.log("Local Save");
			const CHUNK_SIZE=1024*1024*64; // 64MB, largest chunk browser may store in IDB
			const data=Compressor.encode(rawData); // encode first!
			console.log("Compress "+(100*data.length/rawData.length).toFixed(2)+"%");

			const chunkN=Math.max(Math.ceil(data.length/CHUNK_SIZE),1); // at lease 1 chunk

			ENV.taskCounter.startTask(0,"nodeChunkN"); // start node imagedata structure task
			const bufPromise=this.layerStore.setItem(node.id,chunkN).finally(() => {
				ENV.taskCounter.finishTask(0,"nodeChunkN");
			});

			const chunkPromises=[bufPromise];
			for(let i=0;i<chunkN;i++) { // save a slice of data
				const key=node.id+"#"+i;
				const chunk=data.slice(i*CHUNK_SIZE,(i+1)*CHUNK_SIZE);
				const kPromise=this.layerStore.setItem(key,chunk);
				ENV.taskCounter.startTask(0,"Chunk"+i); // start save chunk i task
				chunkPromises.push(kPromise.finally(() => {
					ENV.taskCounter.finishTask(0,"Chunk"+i); // end save chunk i task
				}));
			}
			// Remove all chunks after (including) chunkN
			STORAGE.FILES.removeContent(this.layerStore,node.id,chunkN); // do separately

			return Promise.all(chunkPromises);
		}
		else return new Promise((resolve,reject) => {
			const worker=new Worker("./javascripts/storage-manager-files-worker.js");
			worker.onmessage=result => { // file saved
				worker.terminate();

				const message=result.data;
				if(message.isError) { // error in worker
					reject();
					return;
				}

				const chunkN=message.chunkN;
				STORAGE.FILES.removeContent(this.layerStore,node.id,chunkN); // do separately
				resolve(chunkN);
			};
			worker.onerror=err => {
				worker.terminate();
				reject(err);
			}

			const rawData=CANVAS.renderer.getUint8ArrayFromImageData(imgData,vArea,null,{
				isPreserveArrayType: true
			});
			worker.postMessage({
				fileID: this.fileID,
				id: node.id,
				rawData: rawData,
				save: true
			});
		});
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
		else return new Promise((resolve,reject) => {
			const worker=new Worker("./javascripts/storage-manager-files-worker.js");
			worker.onmessage=result => { // file saved
				worker.terminate();

				const message=result.data;
				if(message.isError) { // error in worker
					reject();
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
				id: nodeID,
				get: true
			});
		});
	}
}


 // ================================== STORAGE.FILES ================================

/**
 * Init the storage database.
 * call callback after initializaiton
 */
STORAGE.FILES.init=function() {
	STORAGE.FILES.loadFilesStore();
	STORAGE.FILES.brushtipStore=localforage.createInstance({name: "brush"});
	STORAGE.FILES.initThumbStore(); // load storage for file thumbs
}

/**
 * switch the current instance of STORAGE.FILES.layerStore to the given ID
 * also update the fileName (so the filename must be set in advance) and lastOpenedDate
 */
STORAGE.FILES.initLayerStorage=function(fileID) { // This is a synced function
	console.log("Change layer store to "+fileID);
	
	// if not in fileStore, blabla
	STORAGE.FILES.layerStore=localforage.createInstance({
		name: "img",
		storeName: fileID
	});

	// update the contents in fileList and filesStore
	const oldContent=STORAGE.FILES.filesStore.fileList[fileID]||{};
	const time=Date.now();
	const fileContent={
		fileName: ENV.getFileTitle()||oldContent.fileName,
		createdDate: oldContent.createdDate||time,
		lastOpenedDate: time // now
		//...
	};
	STORAGE.FILES.filesStore.fileList[fileID]=fileContent;
	STORAGE.FILES.filesStore.undroppedList[fileID]=true;
}

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
		STORAGE.FILES.saveContentChanges(CANVAS.nowLayer);
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

		const storage=STORAGE.FILES.layerStore; // note here in case of layerStore changing
		const fileID=ENV.fileID; // same as above
		// There shouldn't be several save requests of 1 node in 1 frame...
		return new Promise((resolve,reject)=>{
			setTimeout(() => { // give icon a chance to change
				// Get buffer out of valid area
	
				// Start Saving, try saver first
				// FileWorker will try Worker first, then async saving
				const fileSaver=new FileWorker(storage,fileID);
				ENV.taskCounter.startTask();
				fileSaver.saveFile(node).then(() => {
					STORAGE.FILES.savingList.delete(node.id); // delete first
					node.isContentChanged=false;
					console.log(node.id+" Saved");
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
	// set busy status
	EventDistributer.footbarHint.showInfo("Loading saved paper ...");
	STORAGE.FILES.isFailedLayer=false;

	const loadQueue=[]; // A queue of StackNodes
	const storage=STORAGE.FILES.layerStore; // do not change storage here

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
			const loadNextNodeAsync=() => {
				if(ENV.taskCounter.isTryingToAbort) { // User tries to abort the loading process
					ENV.taskCounter.init(); // reset task indicator
					STORAGE.FILES.isFailedLayer=true;
					EventDistributer.footbarHint.showInfo("File loading aborted",2000);
					return; // give up
				}
				if(this.nextNodeToLoad) { // prepare to load the next node
					setTimeout(e => {
						const percentage=(this.index/loadQueue.length*100).toFixed(1);
						EventDistributer.footbarHint.showInfo("Loading "+percentage+"% ...",5000);
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
						STORAGE.FILES.removeContent(storage,sNode.id);
						STORAGE.FILES.isFailedLayer=true;
					}
					newElement.setProperties(sNode); // also request refresh. This might be a potential bottleneck
					// @TODO: possible solution: insert after loading?
				}).catch(err => { // load failed
					console.warn("ImageData Loading Failed");
					console.error(err);
					STORAGE.FILES.isFailedLayer=true;
					// @TODO: delete $ui & texture?
				}).finally(() => {
					this.loaded();
					loadNextNodeAsync();
					// @TODO: load contents after inserting UI?
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
	EventDistributer.footbarHint.showInfo("Loading 0.0% ...",5000);
	if(loadQueue.length) {
		loadQueue[0].load(); // kick
	}
}

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
		EventDistributer.footbarHint.showInfo("ERROR: Loaded with corrupted layers",2000);
	}
	else {
		EventDistributer.footbarHint.showInfo("Loaded");
	}

	PERFORMANCE.idleTaskManager.addTask(e=>{ // update all layer thumbs when idle
		LAYERS.updateAllThumbs(); // update thumbs of every layer
		STORAGE.FILES.updateCurrentThumb(); // update the thumb of this psd file
	});
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

// ======================= File ID related ==========================
STORAGE.FILES.loadFilesStore=function(){
	/**
	 * STORAGE.FILES.filesStore is
	 * {
	 *    fileList: { // containing all files in Skeeetch
	 *       id1: fileItem1,
	 *       ...
	 *    },
	 *    undroppedList: {id1:true, ...} // containing all files that are in database
	 * }
	 * 
	 * Each item in fileList is a fileID - fileContent pair
	 * fileID is a string. ENV.fileID records the current working fileID
	 * fileContent={
	 *   fileName,
	 *   thumb,
	 *   lastOpenedDate,
	 *   createdDate,
	 *   fileSize,
	 *   paperSize,
	 *   ... ...
	 * }
	 */
	STORAGE.FILES.filesStore=JSON.parse(localStorage.getItem("files"))||{
		fileList:{}, // init as nothing
		undroppedList:{}
	};
}

/**
 * This function saves all the file information (including the editing one)
 * especially when exiting the webpage
 */
STORAGE.FILES.saveFilesStore=function(){ // must be sync
	// editing the now-editing file contents
	const nowFileItem=STORAGE.FILES.filesStore.fileList[ENV.fileID];
	nowFileItem.fileName=ENV.getFileTitle();
	nowFileItem.lastOpenedDate=Date.now();
	
	localStorage.setItem("files",JSON.stringify(STORAGE.FILES.filesStore)); // save
}

STORAGE.FILES.removeFileID=function(fileID){ // remove from STORAGE.FILES monitoring
	delete STORAGE.FILES.filesStore.fileList[fileID];
	console.log("Trying to drop store "+fileID);
	ENV.taskCounter.startTask(); // start drop task

	const db=localforage.createInstance({name: "img",storeName: fileID});
	// remove db contents first so it won't take up space even when drop failed
	return db.keys().then(keys =>
		Promise.all(keys.map(k=>db.removeItem(k))) // remove all items from db
	).then(localforage.dropInstance({ // clear database
		name: "img",
		storeName: fileID
	}).then(()=>{ // successfully dropped, remove from undropped
		console.log(fileID+" Dropped");
		delete STORAGE.FILES.filesStore.undroppedList[fileID];
	})
	.catch(err=>{
		console.warn("Something happened when dropping "+fileID,err);
	})
	.finally(()=>{
		ENV.taskCounter.finishTask(); // end drop task
	}));
}

/**
 * Remove stores from database that are deleted in fileList
 * but still remain in database (due to failed deletion, etc)
 * 
 * Check through database everytime when Skeeetch starts
 */
STORAGE.FILES.organizeDatabase=function(){
	// T-ODO: change into sequencial operation?
	// It's Okay...
	for(const id in STORAGE.FILES.filesStore.undroppedList){
		if(!STORAGE.FILES.filesStore.fileList.hasOwnProperty(id)){
			// id only in undropped list
			PERFORMANCE.idleTaskManager.addTask(()=>{
				STORAGE.FILES.removeFileID(id); // try to remove again
			});
		}
	}
}

/**
 * Save the contents of the current opened file as a new file in repo
 * Do not change any content of the previous file
 */
STORAGE.FILES.saveCurrentOpenedFileAs=function(){
	const newID=STORAGE.FILES.generateFileID();
	ENV.fileID=newID; // environment working on new ID
	STORAGE.FILES.initLayerStorage(newID); // create storage for newID with the same title
	// save layer tree and contents in database
	const layerTreeStr=STORAGE.FILES.saveLayerTree();
	STORAGE.FILES.saveLayerTreeInDatabase(layerTreeStr);
	const taskList=[]; // containing all tasks
	for(const k in LAYERS.layerHash) { // Save all layer contents
		const layer=LAYERS.layerHash[k];
		if(layer instanceof CanvasNode) {
			taskList.push(STORAGE.FILES.saveContentChanges(layer,true));
		}
	}
	Promise.all(taskList);
	PERFORMANCE.idleTaskManager.addTask(()=>{
		STORAGE.FILES.updateCurrentThumb(); // update thumb when lazy
	});
	//STORAGE.FILES.savingList.

	FILES.fileSelector.addNewFileUIToSelector(newID); // add the icon in selector, sync
}