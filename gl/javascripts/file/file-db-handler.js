/**
 * Handle files according to DB operation
 */

// File Generation
FILES.saveAsDBFile=function(fileID){
	// TODO: check current file is saved
	return STORAGE.FILES.dumpImgDB(fileID).then(buffer=>{
		const blob=new Blob([buffer],{type: "application/octet-stream"});
		const filename=STORAGE.FILES.filesStore.fileList[fileID].fileName;
		FILES.downloadBlob(filename+".skeeetch",blob);
	});
}

FILES.openDBFile=function(buffer,filename){
	ENV.taskCounter.startTask(1); // start open task
	return STORAGE.FILES.getUnsavedCheckDialog()
	.then(()=>{ // saved or aborted
		return STORAGE.FILES.insertImgDB(buffer,{
			fileName: filename
			// hash and date will be handled by insertImgDB when new file created
		});
	})
	.then(()=>{ // after database filled
		return STORAGE.FILES.getLayerTreeFromDatabase();
	})
	.then(layerTree => { // after getting layer tree, load contents
		localStorage.setItem("layer-tree",JSON.stringify(layerTree));
		const paperSize=layerTree.paperSize;
		
		// reset tempPaperSize
		FILES.tempPaperSize={
			width: paperSize[0],
			height: paperSize[1],
			left: 0,
			top: 0
		};
		ENV.setFileTitle(filename); // set new title now
		ENV.setPaperSize(...paperSize); // set paper size and clear all contents
		return STORAGE.FILES.loadLayerTree(layerTree);
	})
	.catch(err=>{
		console.warn(err);
		if(typeof(err)=="string"){
			console.log(err);
			EventDistributer.footbarHint.showInfo(Lang(err),2000);
		}
	})
	.finally(()=>{ // after loading
		ENV.taskCounter.finishTask(1); // end open task
	});
}