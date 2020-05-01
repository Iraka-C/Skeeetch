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
	if(!STORAGE.FILES.isNowActiveLayerSaved) {
		STORAGE.FILES.saveContentChanges(CANVAS.nowLayer);
	}
}

// save directly, without interfering with the UI
// @TODO: change flag into all + hint when exit
// Max length of 1 key-value is 127MB!
STORAGE.FILES.savingList=new Set();
STORAGE.FILES.saveContentChanges=function(node) { // @TODO: Empty Layer
	if(node) { // operating on a CanvasNode
		STORAGE.FILES.savingList.add(node.id);
		$("#icon").attr("href","./resources/favicon-working.png");

		// There shouldn't be several save requests in 1 frame...
		requestAnimationFrame(()=>{ // give icon a chance to change
			// Get buffer out of valid area
			const imgData=node.rawImageData;
			const vArea=imgData.validArea;
			const imgBuf={
				type: "GLRAMBuf8",
				id: imgData.id,
				tagColor: imgData.tagColor,
				bitDepth: 8,
				data: CANVAS.renderer.getUint8ArrayFromImageData(imgData,vArea),
				width: vArea.width,
				height: vArea.height,
				left: vArea.left,
				top: vArea.top,
				validArea: vArea // borrow values
			};

			// Start Saving
			const CHUNK_SIZE=1024*1024*64; // largest chunk Chrome may store

			const rawData=imgBuf.data;
			const data=Compressor.encode(rawData);
			console.log("Compress "+(100*data.length/rawData.length).toFixed(2)+"%");

			const chunkN=Math.ceil(data.length/CHUNK_SIZE);
			imgBuf.data=chunkN; // record the number
			const bufPromise=STORAGE.FILES.layerStore.setItem(node.id,imgBuf);

			const chunkPromises=[bufPromise];
			for(let i=0;i<chunkN;i++) { // save a slice of data
				const key=node.id+"#"+i;
				const chunk=data.slice(i*CHUNK_SIZE,(i+1)*CHUNK_SIZE);
				const kPromise=STORAGE.FILES.layerStore.setItem(key,chunk);
				chunkPromises.push(kPromise);
			}

			Promise.all(chunkPromises).then(v => {
				//console.log(node.id+" Saved");
				STORAGE.FILES.savingList.delete(node.id);
				
				if(!STORAGE.FILES.savingList.size){ // all saved
					STORAGE.FILES.isNowActiveLayerSaved=true;
					$("#icon").attr("href","./resources/favicon.png");
				}
			}).catch(err => {
				STORAGE.FILES.savingList.delete(node.id);
				STORAGE.FILES.isNowActiveLayerSaved=true;
				$("#icon").attr("href","./resources/favicon.png");

				console.warn(err);
			});

			STORAGE.FILES.removeContent(node.id,chunkN); // do separately
		});
	}
}


STORAGE.FILES.isUnsaved=function(){
	if(!STORAGE.FILES.isNowActiveLayerSaved){
		return true;
	}
	if(STORAGE.FILES.savingList.size){
		return true;
	}
	return false;
}

STORAGE.FILES.getContent=function(id){
	return STORAGE.FILES.layerStore.getItem(id).then(imgBuf => {
		// @TODO: if imgBuf==null, then set related layers as empty
		const chunkN=imgBuf.data;
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

			imgBuf.data=Compressor.decode(data); // extract
			return imgBuf;
		});
	});
}

STORAGE.FILES.removeContent=function(id,startChunk) {
	if(id) {
		if(isNaN(startChunk)){ // remove whole id
			STORAGE.FILES.layerStore.removeItem(id).then(()=>{
				//console.log("removed",id);
			});
		}
		// remove chunk larger/equal startChunk
		startChunk=startChunk||0;
		STORAGE.FILES.layerStore.keys().then(keys => {
			for(const v of keys) { // remove unused keys
				if(v.startsWith(id)) {
					const sPos=v.lastIndexOf("#");
					if(sPos<0)continue; // not a chunk
					const chunkId=parseInt(v.substring(sPos+1));
					if(chunkId>=startChunk){ // to remove
						STORAGE.FILES.layerStore.removeItem(v).then(()=>{
							//console.log("removed",v);
						});
					}
				}
			}
		}).catch(function(err) {
			console.log(err);
		});
	}
	else { // clear all
		console.log("IDB: Remove all");
		console.trace();

		STORAGE.FILES.layerStore.clear();
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
	CURSOR.setBusy(true); // set busy cursor
	PERFORMANCE.idleTaskManager.startBusy();
	EventDistributer.footbarHint.showInfo("Loading saved paper ...");


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
					CANVAS.renderer.resizeImageData(newElement.rawImageData,imgBuf);
					CANVAS.renderer.loadToImageData(newElement.rawImageData,imgBuf);
					newElement.setProperties(sNode);
					this.loaded();
				}).catch(err => { // load failed
					console.warn("ImageData Loading Failed");
					console.error(err);
				});
				this.elem=newElement;
			}
			else { // Other layers
				// ...?
				this.loaded();
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
		setTimeout(e => {
			EventDistributer.footbarHint.showInfo(
				"Loading "+(i/loadQueue.length*100).toFixed(2)+"% ...",5000);
			loadQueue[i].load();
		},0);
	}
}

STORAGE.FILES.onLayerTreeLoad=function(activeID) {
	STORAGE.FILES.clearUnusedContents(); // maybe uncleared history
	COMPOSITOR.updateLayerTreeStructure(); // async!
	console.log("Active",activeID);
	CURSOR.setBusy(false); // free busy cursor
	PERFORMANCE.idleTaskManager.startIdle();
	LAYERS.setActive(activeID);
	LAYERS.updateAllThumbs();
	EventDistributer.footbarHint.showInfo("Loaded");
}

// clear buf/chunk unused by any layer
// do not clear oversized chunks: done by STORAGE.FILES.removeContent()
STORAGE.FILES.clearUnusedContents=function() {
	STORAGE.FILES.layerStore.keys().then(keys => {
		for(const v of keys) { // remove unused keys
			if(!LAYERS.layerHash.hasOwnProperty(v.replace(/#.*$/,""))) {
				STORAGE.FILES.layerStore.removeItem(v).then(()=>{
					console.log("Clear unused",v);
				});
			}
		}
	}).catch(function(err) {
		console.log(err);
	});
}
