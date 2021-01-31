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