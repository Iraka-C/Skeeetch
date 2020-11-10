STORAGE.FILES={
	isNowActiveLayerSaved: true,
	fileList: new Map() // A Map containing all fileID-fileContent pairs
};

class FileWorker{
	constructor(){
		// Empty...
	}
	saveFile(node){
		const imgData=node.rawImageData;
		const vArea=imgData.validArea;

		if(!window.Worker||document.location.protocol=="file:"){ // no worker available
			
			const rawData=CANVAS.renderer.getUint8ArrayFromImageData(imgData,vArea);

			console.log("Local Save");
			const CHUNK_SIZE=1024*1024*64; // 64MB, largest chunk browser may store in IDB
			const data=Compressor.encode(rawData); // encode first!
			console.log("Compress "+(100*data.length/rawData.length).toFixed(2)+"%");

			const chunkN=Math.max(Math.ceil(data.length/CHUNK_SIZE),1); // at lease 1 chunk
			
			ENV.taskCounter.startTask(); // start node imagedata structure task
			const bufPromise=STORAGE.FILES.layerStore.setItem(node.id,chunkN).finally(()=>{
				ENV.taskCounter.finishTask();
			});

			const chunkPromises=[bufPromise];
			for(let i=0;i<chunkN;i++) { // save a slice of data
				const key=node.id+"#"+i;
				const chunk=data.slice(i*CHUNK_SIZE,(i+1)*CHUNK_SIZE);
				const kPromise=STORAGE.FILES.layerStore.setItem(key,chunk);
				ENV.taskCounter.startTask(); // start save chunk i task
				chunkPromises.push(kPromise.finally(()=>{
					ENV.taskCounter.finishTask(); // end save chunk i task
				}));
			}
			STORAGE.FILES.removeContent(node.id,chunkN); // do separately

			return Promise.all(chunkPromises);
		}
		else return new Promise((resolve,reject)=>{
			const worker=new Worker("./javascripts/storage-manager-files-worker.js");
			worker.onmessage=result=>{ // file saved
				worker.terminate();

				const message=result.data;
				if(message.isError){ // error in worker
					reject();
					return;
				}
		
				const chunkN=message.chunkN;
				STORAGE.FILES.removeContent(node.id,chunkN); // do separately
				resolve(chunkN);
			};
			worker.onerror=err=>{
				worker.terminate();
				reject(err);
			}

			const rawData=CANVAS.renderer.getUint8ArrayFromImageData(imgData,vArea,null,{
				isPreserveArrayType: true
			});
			worker.postMessage({
				id: node.id,
				rawData: rawData,
				save: true
			});
		});
	}
	getFile(nodeID){
		if(!window.Worker||document.location.protocol=="file:"){ // no worker available
			return STORAGE.FILES.layerStore.getItem(nodeID).then(chunkN => {
				if(!chunkN){ // Not stored or zero chunk
					return null;
				}
		
				//const chunkN=imgBuf.data;
				const chunkPromises=[];
				for(let i=0;i<chunkN;i++) { // get data slices
					const key=nodeID+"#"+i;
					const kPromise=STORAGE.FILES.layerStore.getItem(key);
					chunkPromises.push(kPromise);
				}
				return Promise.all(chunkPromises).then(chunks=>{
					// reconstruct data
					let totalLen=0;
					for(const v of chunks){
						totalLen+=v.length;
					}
					let data=new Uint8Array(totalLen);
					let offset=0;
					for(const v of chunks){
						data.set(v,offset);
						offset+=v.length;
					}

					return Compressor.decode(data); // extract
				});
			});
		}
		else return new Promise((resolve,reject)=>{
			const worker=new Worker("./javascripts/storage-manager-files-worker.js");
			worker.onmessage=result=>{ // file saved
				worker.terminate();

				const message=result.data;
				if(message.isError){ // error in worker
					reject();
					return;
				}
		
				const data=message.data;
				resolve(data);
			};
			worker.onerror=err=>{
				worker.terminate();
				reject(err);
			}
			worker.postMessage({
				id: nodeID,
				get: true
			});
		});
	}
}

STORAGE.FILES.init=function() { // @TODO: create multiple instances of workers
	STORAGE.FILES.layerStore=localforage.createInstance({name: "img"});
	STORAGE.FILES.brushtipStore=localforage.createInstance({name: "brush"});
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
	if(!ENV.displaySettings.isAutoSave&&!isForceSaving)return; // do not require contents saving
	if(node) { // @TODO: operating on a CanvasNode
		console.log("Saving contents ...");
		
		STORAGE.FILES.savingList.set(node.id,node);
		$("#icon").attr("href","./resources/favicon-working.png");

		// There shouldn't be several save requests of 1 node in 1 frame...
		setTimeout(()=>{ // give icon a chance to change
			// Get buffer out of valid area

			// Start Saving, try saver first
			// FileWorker will try Worker first, then async saving
			const fileSaver=new FileWorker();
			ENV.taskCounter.startTask();
			fileSaver.saveFile(node).then(()=>{
				STORAGE.FILES.savingList.delete(node.id); // delete first
				node.isContentChanged=false;
				console.log(node.id+" Saved");
				if(!STORAGE.FILES.savingList.size){ // all saved
					STORAGE.FILES.isNowActiveLayerSaved=true;
					$("#icon").attr("href","./resources/favicon.png");
				}
			}).catch(err=>{
				STORAGE.FILES.savingList.delete(node.id); // remove failed task
				$("#icon").attr("href","./resources/favicon.png");
				console.warn(err);
			}).finally(()=>{
				ENV.taskCounter.finishTask();
			});
			
		},0);
	}
}

STORAGE.FILES.saveAllContents=function(){ // force save all contents
	for(const k in LAYERS.layerHash){ // Save all layers
		const layer=LAYERS.layerHash[k];
		if(layer instanceof CanvasNode){
			if(layer.isContentChanged){ // content modified
				STORAGE.FILES.saveContentChanges(layer,true);
			}
		}
	}
}


STORAGE.FILES.isUnsaved=function(){
	if(!STORAGE.FILES.isNowActiveLayerSaved){
		return true;
	}
	if(STORAGE.FILES.savingList.size){ // still saving
		return true;
	}
	if(!ENV.displaySettings.isAutoSave){ // not auto-saving, check modified layer
		for(const k in LAYERS.layerHash){
			const layer=LAYERS.layerHash[k];
			if(layer instanceof CanvasNode){
				if(layer.isContentChanged){ // content modified
					return true;
				}
			}
		}
	}
	return false;
}

STORAGE.FILES.getContent=function(id){
	let fileReader=new FileWorker();
	return fileReader.getFile(id);
}

STORAGE.FILES.removeContent=function(id,startChunk) {
	//console.warn("Trying to remove ",id,startChunk);
	
	if(id) {
		if(isNaN(startChunk)){ // remove whole id
			ENV.taskCounter.startTask(); // start remove task
			STORAGE.FILES.layerStore.removeItem(id).then(()=>{
				//console.log("removed",id);
			}).finally(()=>{
				ENV.taskCounter.finishTask(); // end remove task
			});
		}
		// remove chunk larger/equal startChunk
		startChunk=startChunk||0;
		STORAGE.FILES.layerStore.keys().then(keys => {
			for(const v of keys) { // for all keys keys
				if(v.startsWith(id)) {
					const sPos=v.lastIndexOf("#");
					if(sPos<0)continue; // not a chunk
					const chunkId=parseInt(v.substring(sPos+1));
					if(chunkId>=startChunk){ // to remove
						ENV.taskCounter.startTask(); // start remove chunk task
						STORAGE.FILES.layerStore.removeItem(v).then(()=>{
							//console.log("removed",v);
						}).finally(()=>{
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
		STORAGE.FILES.layerStore.clear().then(()=>{
			console.log("IDB: Remove all");
		}).catch(err=>{
			console.log(err);
		}).finally(()=>{
			ENV.taskCounter.finishTask();
		});
	}

}

STORAGE.FILES.clearLayerTree=function() {
	localStorage.setItem("layer-tree","");
}

STORAGE.FILES.saveLayerTree=function() {
	const storageJSON=JSON.stringify(LAYERS.getStorageJSON());
	localStorage.setItem("layer-tree",storageJSON);
}

STORAGE.FILES.getLayerTree=function() {
	const sJSON=localStorage.getItem("layer-tree");
	return sJSON? JSON.parse(sJSON):null;
}

// ================ Load Layers ==================

STORAGE.FILES.loadLayerTree=function(node) {
	// set busy status
	EventDistributer.footbarHint.showInfo("Loading saved paper ...");
	STORAGE.FILES.isFailedLayer=false;

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
			const loadNextNodeAsync=()=>{
				if(ENV.taskCounter.isTryingToAbort){ // User tries to abort the loading process
					ENV.taskCounter.init(); // reset task indicator
					STORAGE.FILES.isFailedLayer=true;
					EventDistributer.footbarHint.showInfo("File loading aborted",2000);
					return; // give up
				}
				if(this.nextNodeToLoad){ // prepare to load the next node
					setTimeout(e=>{
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
					if(imgBuf&&sNode.rawImageData){ // contents get
						sNode.rawImageData.data=imgBuf;
						CANVAS.renderer.resizeImageData(newElement.rawImageData,sNode.rawImageData);
						CANVAS.renderer.loadToImageData(newElement.rawImageData,sNode.rawImageData);
						sNode.rawImageData.data=1; // release object
						newElement.isContentChanged=false; // saved contents
					}
					else{ // failed to get content, delete broken chunk
						STORAGE.FILES.removeContent(sNode.id);
						STORAGE.FILES.isFailedLayer=true;
					}
					newElement.setProperties(sNode); // also request refresh. This might be a potential bottleneck
					// @TODO: possible solution: insert after loading?
				}).catch(err => { // load failed
					console.warn("ImageData Loading Failed");
					console.error(err);
					STORAGE.FILES.isFailedLayer=true;
					// @TODO: delete $ui & texture?
				}).finally(()=>{
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
				child.elem.setRawImageDataInvalid();
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
	EventDistributer.footbarHint.showInfo("Loading 0.0% ...",5000);
	if(loadQueue.length){
		loadQueue[0].load(); // kick
	}
}

STORAGE.FILES.onLayerTreeLoad=function(activeNode) {
	STORAGE.FILES.clearUnusedContents(); // maybe uncleared history
	COMPOSITOR.updateLayerTreeStructure(); // async!
	LAYERS.setActive(activeNode);
	LAYERS.scrollTo(activeNode,true);
	LAYERS.updateAllThumbs();
	if(STORAGE.FILES.isFailedLayer){
		EventDistributer.footbarHint.showInfo("ERROR: Loaded with corrupted layers",2000);
	}
	else{
		EventDistributer.footbarHint.showInfo("Loaded");
	}
}

// clear buf/chunk unused by any layer
// do not clear oversized chunks: done by STORAGE.FILES.removeContent()
STORAGE.FILES.clearUnusedContents=function() {
	STORAGE.FILES.layerStore.keys().then(keys => {
		for(const v of keys) { // remove unused keys
			if(!LAYERS.layerHash.hasOwnProperty(v.replace(/#.*$/,""))) {
				ENV.taskCounter.startTask(); // start remove unused task
				STORAGE.FILES.layerStore.removeItem(v).then(()=>{
					console.log("Clear unused",v);
				}).finally(()=>{
					ENV.taskCounter.finishTask(); // end remove unused task
				});
			}
		}
	}).catch(function(err) { // get keys promise
		console.log(err);
	});
}
