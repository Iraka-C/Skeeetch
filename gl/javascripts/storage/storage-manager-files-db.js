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
	
	let saveLTPromise=Promise.resolve();
	if(fileID==ENV.fileID){ // shall save current layer tree
		const storageJSON=LAYERS.getStorageJSON();
		saveLTPromise=STORAGE.FILES.saveLayerTreeInDatabase(storageJSON);
	}

	const layerStore=new MyForage("img",fileID);
	return saveLTPromise.then(()=>{ // first init
		return layerStore.init();
	})
	.then(()=>{ // then get keys
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
		kvs.unshift([ // push header infos
			"header",
			JSON.stringify({
				"hash": fileItem.hash,
				"createdDate": fileItem.createdDate,
				"lastModifiedDate": fileItem.lastModifiedDate
			})
		]);
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
// kvCnt is how many pairs to be read from start
STORAGE.FILES._arrayBufferToKVPair=function(buffer,kvCnt){
	const kvs=[];
	const reader=new TypedReader(buffer);
	kvCnt=kvCnt||Infinity;
	for(let i=0;!reader.isEnd()&&i<kvCnt;i++){
		const k=reader.read();
		const v=reader.read();
		kvs.push([k,v]);
	}
	return kvs;
}

/**
 * option: specify file info {
 * fileName
 * lastOpenedDate
 * }
 */

STORAGE.FILES.insertImgDB=function(buffer,option){
	const headerHV=STORAGE.FILES._arrayBufferToKVPair(buffer,1)[0]; // read header info
	if(headerHV[0]!="header"){
		console.warn("Not a legal skeeetch db file");
		return Promise.reject("Unsupported file content.");
	}
	// To number of date
	const headerJSON=JSON.parse(headerHV[1]);

	let toLoadPromise=Promise.resolve(0); // 0: no existing file, new file
	let sameFileID=null;
	for(const key in STORAGE.FILES.filesStore.fileList){
		const item=STORAGE.FILES.filesStore.fileList[key];
		if(item.hash==headerJSON.hash){ // same hash
			if(item.lastModifiedDate==headerJSON.lastModifiedDate){ // same file, no need to reload
				return Promise.reject("File already in repository");
			}
			else{ // same file, one is newer
				//console.log(item.lastModifiedDate,headerJSON.lastModifiedDate);
				sameFileID=key;
				toLoadPromise=STORAGE.FILES.confirmOverwriteDialog(
					item.lastModifiedDate, // existing
					headerJSON.lastModifiedDate, // importing
					item.fileName
				);
				break;
			}
		}
	}

	return toLoadPromise.then(isToOverwrite=>{ // if confirm overwrite
		if(isToOverwrite==1){ // delete existing first
			const $uiList=FILES.fileSelector.$uiList;
			const $ui=$uiList[sameFileID];
			delete $uiList[sameFileID]; // remove from selector hash
			$ui.remove(); // remove from selector panel
			return STORAGE.FILES.removeFileID(sameFileID); // after removing file
		}
		else if(isToOverwrite==2){ // open as new file
			headerJSON.hash=STORAGE.FILES.generateFileHash(); // new hash code
		}
		// if not isToOverwrite, this is a new file
		// if rejected, directly stop all following loading process
	})
	.then(()=>{ // if there is a same file, cleared.
		// init a new storage space
		ENV.fileID=STORAGE.FILES.generateFileID();
		const initPromise=STORAGE.FILES.initLayerStorage(ENV.fileID);

		// modify file item info
		const item=STORAGE.FILES.filesStore.fileList[ENV.fileID];
		Object.assign(item,option);
		Object.assign(item,headerJSON); // stored header info

		FILES.fileSelector.addNewFileUIToSelector(ENV.fileID); // add the icon in selector
		return initPromise;
	})
	.then(()=>{ // write the file info into a new file
		// read all contents now
		const kvs=STORAGE.FILES._arrayBufferToKVPair(buffer);
		kvs.shift(); // skip header

		const layerStore=STORAGE.FILES.layerStore;
		const taskList=[];
		for(const kv of kvs){ // get k-v pairs
			if(typeof(kv[1])=="string"){
				kv[1]=JSON.parse(kv[1]); // retrieve object
			}
			taskList.push(layerStore.setItem(kv[0],kv[1]));
		}
		return Promise.all(taskList);
	});
}

STORAGE.FILES.confirmOverwriteDialog=function(originT,newT,originName){
	const oTS="<span style='color:#fff'>"+ENV.getTimeString(originT)+"</span>";
	const nTS="<span style='color:#fff'>"+ENV.getTimeString(newT)+"</span>";
	const owNewerTag=Lang("file-overwrite-newer");
	const owNewerTags=originT<newT?[owNewerTag,""]:["",owNewerTag];

	return new Promise((resolve,reject)=>{
		const $text=DialogBoxItem.textBox({text: Lang("file-overwrite-warning")(...owNewerTags,originName)});
		const $textO=DialogBoxItem.textBox({text: Lang("file-overwrite-old")(oTS)});
		const $textN=DialogBoxItem.textBox({text: Lang("file-overwrite-new")(nTS)});
		$text.css("margin-bottom","1em");
		$textO.css("font-size","80%");
		$textN.css("font-size","80%");
		const dialog=new DialogBoxItem([$text,$textO,$textN],[{ // overwrite
			text: Lang("file-overwrite-yes"),
			callback: e=>{
				resolve(1); // need to overwrite
			}
		},{ // do not overwrite, save as new
			text: Lang("file-overwrite-newfile"),
			callback: e=>{
				resolve(2); // save as new
			}
		},{ // reject: abort loading
			text: Lang("file-overwrite-no"),
			callback: e=>{
				reject("file-name-abort");
			}
		}]);
		DIALOGBOX.show(dialog,{abc:1});
	});
}