/**
 * content operations related to db file operation
 * @TODO: add indicators and halt indication
 */

// dump a DB store file content into ArrayBuffer
STORAGE.FILES.dumpImgDB=function(fileID){
	const fileItem=STORAGE.FILES.filesStore.fileList[fileID];
	if(!fileItem){
		return Promise.reject("No fileID found"); // no such a file
	}
	const layerStore=new MyForage("img",fileID);
	return layerStore.init()
	.then(()=>{
		return layerStore.keys();
	})
	.then(keys=>{ // when keys got
		if(!keys||!keys.length){ // is null or []
			throw new Error(); // empty store
		}
		
		const taskList=[];
		for(const k of keys){ // record k-v pairs
			taskList.push(layerStore.getItem(k).then(v=>[k,v]));
		}
		return Promise.all(taskList);
	})
	.then(kvs=>{ // get all keys and values
		for(const kv of kvs){
			if(typeof(kv[1])=="object"){
				if(kv[1].buffer instanceof ArrayBuffer){
					continue; // a typed array
				}
				kv[1]=JSON.stringify(kv[1]); // stringify normal objects
			}
		}
		kvs.unshift(["hash",fileItem.hash||""]);
		const buffer=STORAGE.FILES._kvPairToArrayBuffer(kvs);
		return Promise.resolve(buffer);
	});
}

STORAGE.FILES._kvPairToArrayBuffer=function(kvs){
	let totalLen=0;
	for(const [k,v] of kvs){
		totalLen+=TypedWriter.getBytesNeeded(k)+TypedWriter.getBytesNeeded(v);
	}

	const buffer=new ArrayBuffer(totalLen);
	const writer=new TypedWriter(buffer);
	for(const [k,v] of kvs){
		writer.write(k);
		writer.write(v);
	}
	
	return buffer;
}

// =========================== Open File ==============================

STORAGE.FILES._arrayBufferToKVPair=function(buffer){
	const kvs=[];
	const reader=new TypedReader(buffer);
	while(!reader.isEnd()){
		const k=reader.read();
		const v=reader.read();
		kvs.push([k,v]);
	}
	return kvs;
}

STORAGE.FILES.insertImgDB=function(buffer,filename){
	const kvs=STORAGE.FILES._arrayBufferToKVPair(buffer);
	const hashItem=kvs.shift();
	if(hashItem[0]!="hash"){
		console.warn("Not a legal skeeetch db file");
		return;
	}

	for(const key in STORAGE.FILES.filesStore.fileList){
		const item=STORAGE.FILES.filesStore.fileList[key];
		console.log(item,hashItem[1]);
		
		if(item.hash==hashItem[1]){
			console.warn("Duplicate hash code"); // need special treatment
			return;
			// break;
		}
	}

	// A new file
	STORAGE.FILES.getUnsavedCheckDialog()
	.then(() => { // after saving or giving up
		// init a new storage space
		ENV.fileID=STORAGE.FILES.generateFileID();
		ENV.setFileTitle(filename); // set new title
		const initPromise=STORAGE.FILES.initLayerStorage(ENV.fileID);
		FILES.fileSelector.addNewFileUIToSelector(ENV.fileID); // add the icon in selector
		return initPromise;
	})
	.then(()=>{ // after init, fill in database
		const layerStore=STORAGE.FILES.layerStore;
		const taskList=[];
		for(const kv of kvs){ // get k-v pairs
			if(typeof(kv[1])=="string"){
				kv[1]=JSON.parse(kv[1]); // retrieve object
			}
			taskList.push(layerStore.setItem(kv[0],kv[1]));
		}
		return Promise.all(taskList);
	})
	.then(()=>STORAGE.FILES.getLayerTreeFromDatabase()) // after database filled
	.then(layerTree => { // after getting layer tree
		localStorage.setItem("layer-tree",JSON.stringify(layerTree));
		
		// reset tempPaperSize
		FILES.tempPaperSize={
			width: layerTree.paperSize[0],
			height: layerTree.paperSize[1],
			left: 0,
			top: 0
		};
		ENV.setPaperSize(...layerTree.paperSize); // set paper size and clear all contents
		STORAGE.FILES.loadLayerTree(layerTree).catch(err=>{ // load contents
			// error
		});
	});
}