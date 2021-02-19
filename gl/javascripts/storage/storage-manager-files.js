"use strict";
STORAGE.FILES={
	isNowActiveLayerSaved: true
};

 // ================================== Tools ================================
 /**
  * Do not use dropInstance. use page management by yourself
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

STORAGE.FILES.generateFileHash=function(){
	const randArr=new Uint32Array(8);
	window.crypto.getRandomValues(randArr);
	let tag="";
	for(let i=0;i<8;i++){ // generate a hash string of length 48. In total 248 bits.
		tag+=(randArr[i]&0x7FFFFFFF).toString(36).padStart(6,"0");
	}
	return tag;
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
STORAGE.FILES.initLayerStorage=function(fileID) { // This is an async function (layerStore.init())
	console.log("Change layer store to "+fileID);
	
	// if not in fileStore, blabla
	const layerStore=new MyForage("img",fileID);
	const initPromise=layerStore.init(); // FIXME: what??? an async function. How does initLayerStorage worked properly?!
	STORAGE.FILES.layerStore=layerStore;

	// update the contents in fileList and filesStore
	const oldContent=STORAGE.FILES.filesStore.fileList[fileID]||{};
	const time=Date.now();
	const fileContent={
		fileName: oldContent.fileName||ENV.getFileTitle(),
		createdDate: oldContent.createdDate||time,
		lastModifiedDate: oldContent.lastModifiedDate||time, // if no last modified, set it as now
		lastOpenedDate: time, // now
		lastRenameDate: oldContent.lastRenameDate||time,
		hash: oldContent.hash||STORAGE.FILES.generateFileHash() // length 48 hash code
	};
	STORAGE.FILES.filesStore.fileList[fileID]=fileContent;
	STORAGE.FILES.filesStore.undroppedList[fileID]=true; // In fact not used at present.
	return initPromise;
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
	localStorage.setItem("files",JSON.stringify(STORAGE.FILES.filesStore)); // save
}

STORAGE.FILES.reportModifiedTime=function(){ // This function is managed by HISTORY.addHistory/undo/redo
	const nowFileItem=STORAGE.FILES.filesStore.fileList[ENV.fileID];
	nowFileItem.lastModifiedDate=Date.now();
}

STORAGE.FILES.removeFileID=function(fileID){ // remove from STORAGE.FILES monitoring
	delete STORAGE.FILES.filesStore.fileList[fileID];
	ENV.taskCounter.startTask(); // start drop task

	//remove db contents first so it won't take up space even when drop failed
	const db=new MyForage("img",fileID);
	return db.init()
	.then(()=>db.drop()) // try to drop the store
	.then(()=>{ // dropped successfully. @TODO: remove undroppedList logic
		delete STORAGE.FILES.filesStore.undroppedList[fileID];
	}).catch(err=>{
		console.warn("Something happened when dropping "+fileID,err);
	}).finally(()=>{
		ENV.taskCounter.finishTask(); // end drop task
	});
	
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
	/*const taskList=[];
	for(const id in STORAGE.FILES.filesStore.undroppedList){
		if(!STORAGE.FILES.filesStore.fileList.hasOwnProperty(id)){
			// id only in undropped list
			// PERFORMANCE.idleTaskManager.addTask(()=>{
			// 	STORAGE.FILES.removeFileID(id); // try to remove again
			// });
			taskList.push(STORAGE.FILES.removeFileID(id));
		}
	}*/
	const fileList=STORAGE.FILES.filesStore.fileList;
	//@TODO-: add MyForage self-organization check
	return MyForage.organizeStorage("img").then(()=>{
		return MyForage.getStoreNames("img");
	}).then(list=>{ // check if store name in file list
		const taskList=[];
		for(const storeName of list){
			if(!fileList[storeName]){ // store name is this id
				taskList.push(STORAGE.FILES.removeFileID(storeName));
			}
		}
		return Promise.all(taskList).then(()=>taskList.length);
	});
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
	const savePromise=Promise.all(taskList);
	PERFORMANCE.idleTaskManager.addTask(()=>{
		STORAGE.FILES.updateCurrentThumb(); // update thumb when lazy
	});
	//STORAGE.FILES.savingList.

	FILES.fileSelector.addNewFileUIToSelector(newID); // add the icon in selector, sync
	return savePromise;
}