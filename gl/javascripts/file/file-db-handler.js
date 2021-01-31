/**
 * Handle files according to DB operation
 */

// File Generation
FILES.saveAsDBFile=function(fileID){
	return STORAGE.FILES.dumpImgDB(fileID).then(buffer=>{
		const blob=new Blob([buffer],{type: "application/octet-stream"});
		const filename=ENV.getFileTitle();
		FILES.downloadBlob(filename+".skeeetch",blob);
	});
}