STORAGE.FILES={
	isNowActiveLayerSaved: true
};

STORAGE.FILES.init=function() {
	// get the store of layer imageData & brushtips
	STORAGE.FILES.layerStore=localforage.createInstance({name: "img"});
	STORAGE.FILES.brushtipStore=localforage.createInstance({name: "brush"});
	//STORAGE.FILES.layerStore.clear(); // should there be error?
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
STORAGE.FILES.savingList=new Set();
STORAGE.FILES.saveContentChanges=function(node,isForceSaving) {
	if(!ENV.displaySettings.isAutoSave&&!isForceSaving)return; // do not require contents saving
	if(node) { // operating on a CanvasNode
		//console.log("Saving contents ...");
		
		STORAGE.FILES.savingList.add(node.id);
		$("#icon").attr("href","./resources/favicon-working.png");

		// There shouldn't be several save requests in 1 frame...
		setTimeout(()=>{ // give icon a chance to change
			// Get buffer out of valid area
			const imgData=node.rawImageData;
			const vArea=imgData.validArea;

			// Start Saving
			const CHUNK_SIZE=1024*1024*64; // largest chunk Chrome may store

			const rawData=CANVAS.renderer.getUint8ArrayFromImageData(imgData,vArea);
			const data=Compressor.encode(rawData);
			console.log("Compress "+(100*data.length/rawData.length).toFixed(2)+"%");

			const chunkN=Math.max(Math.ceil(data.length/CHUNK_SIZE),1); // at lease 1 chunk
			
			ENV.taskCounter.startTask(); // start node imagedata structure task
			const bufPromise=STORAGE.FILES.layerStore.setItem(node.id,chunkN).finally(()=>{
				ENV.taskCounter.finishTask();
			});

			ENV.taskCounter.startTask(); // start save chunk task
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

			Promise.all(chunkPromises).then(v => {
				//console.log(node.id+" Saved");
				STORAGE.FILES.savingList.delete(node.id); // delete first
				node.isContentChanged=false;
				console.log(node.id+" Saved");
				if(!STORAGE.FILES.savingList.size){ // all saved
					STORAGE.FILES.isNowActiveLayerSaved=true;
					$("#icon").attr("href","./resources/favicon.png");
				}
			}).catch(err => {
				STORAGE.FILES.savingList.delete(node.id); // remove failed task
				$("#icon").attr("href","./resources/favicon.png");
				console.warn(err);
			}).finally(()=>{
				ENV.taskCounter.finishTask(); // finish save chunk task
			});

			STORAGE.FILES.removeContent(node.id,chunkN); // do separately
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
	for(const k in LAYERS.layerHash){
		const layer=LAYERS.layerHash[k];
		if(layer instanceof CanvasNode){
			if(layer.isContentChanged){ // content modified
				return true;
			}
		}
	}
	return false;
}

STORAGE.FILES.getContent=function(id){
	return STORAGE.FILES.layerStore.getItem(id).then(chunkN => {
		if(!chunkN){ // Not stored or zero chunk
			return null;
		}

		//const chunkN=imgBuf.data;
		const chunkPromises=[];
		for(let i=0;i<chunkN;i++) { // get data slices
			const key=id+"#"+i;
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

			//imgBuf.data=Compressor.decode(data);
			return Compressor.decode(data); // extract
		});
	});
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
			// **NOTE** setProperties() actually requested screen refresh
			const sNode=this.json;
			if(sNode.type=="LayerGroupNode") { // group node
				this.N=sNode.children.length; // children count
				const newElement=new LayerGroupNode(sNode.id);
				this.parent.elem.insertNode(newElement,0); // insert first
				this.parent.elem.insertNode$UI(newElement.$ui,0);
				newElement.setProperties(sNode);
				this.elem=newElement;
				if(this.N==0) {
					this.loaded();
				}
			}
			else if(sNode.type=="CanvasNode") { // canvas node, load image data from canvas
				const newElement=new CanvasNode(sNode.id);
				this.parent.elem.insertNode(newElement,0); // sync insert first
				this.parent.elem.insertNode$UI(newElement.$ui,0);
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
					newElement.setProperties(sNode);
				}).catch(err => { // load failed
					console.warn("ImageData Loading Failed");
					console.error(err);
					STORAGE.FILES.isFailedLayer=true;
				}).finally(()=>{
					this.loaded();
				});
				this.elem=newElement;
			}
			else { // Other layers
				// ...?
				this.loaded();
			}

			if(this.nextNodeToLoad){ // prepare to load the next node
				setTimeout(e=>{
					const percentage=(this.index/loadQueue.length*100).toFixed(1);
					EventDistributer.footbarHint.showInfo("Loading "+percentage+"% ...",5000);
					this.nextNodeToLoad.load();
				},0);
			}
		}
		reportLoad(child) {
			this.loadedChildrenCnt++;
			if(this.loadedChildrenCnt==this.N) { // all children loaded
				// may do compression / composition here
				this.loaded();
			}
		}
		loaded() {
			ENV.taskCounter.finishTask(1); // end loading layer task
			if(this.parent) {
				this.parent.reportLoad(this);
			}
			else { // root loaded
				STORAGE.FILES.onLayerTreeLoad(node.active);
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
	EventDistributer.footbarHint.showInfo("Loading 0.0% ...",5000);
	// for(let i=0;i<loadQueue.length;i++) {
	// 	setTimeout(e => {
	// 		EventDistributer.footbarHint.showInfo(
	// 			"Loading "+(i/loadQueue.length*100).toFixed(1)+"% ...",5000);
	// 		loadQueue[i].load();
	// 	},0);
	// }
	if(loadQueue.length){
		loadQueue[0].load(); // kick
	}
}

STORAGE.FILES.onLayerTreeLoad=function(activeID) {
	STORAGE.FILES.clearUnusedContents(); // maybe uncleared history
	COMPOSITOR.updateLayerTreeStructure(); // async!
	LAYERS.setActive(activeID);
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
