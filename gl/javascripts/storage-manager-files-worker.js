/**
 * Web worker for file saving at storage-manager-files.js
 * 
 * Part of the Skeeetch project.
 */
fileWorkerScript=function(){
	// handle events
	onmessage=e => { // to global scope
		// Initialization
		// See https://stackoverflow.com/questions/22172426/using-importsscripts-within-blob-in-a-karma-environment
		if(e.data.url){ // Only called when loaded with Blob
			console.log('Init with Blob, script: ',e.data.url,"javascripts/compressor.js");
			importScripts(e.data.url+"javascripts/compressor.js");
			return;
		}

		console.log('Message received from main script');
		console.log(e.data);
		
		const data=Compressor.encode(e.data); // encode first!
	
		postMessage("Yes! "+data.length);
	}
}

try{
	if(window!=self){ // called as normal worker
		console.log("Init Directly");
		importScripts("./compressor.js");
		fileWorkerScript();
	}
}catch(err){ // no window defined
	console.log("Init in worker");
	importScripts("./compressor.js");
	fileWorkerScript();
}
