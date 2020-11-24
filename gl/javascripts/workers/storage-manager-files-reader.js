/**
 * reader for file saving at storage-manager-files.js
 * 
 * Part of the Skeeetch project.
 * 
 * read from file won't cause key confliction (no key modification)
 */

importScripts("../compressor.js");
importScripts("../localforage.min.js");
importScripts("../my-forage.js");

let storage=null;

onmessage=e => { // to global scope
	storage=new MyForage("img",e.data.fileID);
	storage.init().then(()=>{
		getData(e.data.id);
	});
	
}

function getData(nodeID){ // thread-safe I/O
	storage.getItem(nodeID).then(chunkN => {
		if(!chunkN){ // Not stored or zero chunk
			postMessage({
				id: nodeID,
				data: null
			});
		}

		const chunkPromises=[];
		for(let i=0;i<chunkN;i++) { // get data slices
			const key=nodeID+"#"+i;
			const kPromise=storage.getItem(key);
			chunkPromises.push(kPromise);
		}
		Promise.all(chunkPromises).then(chunks=>{ // reconstruct data
			if(chunkN==1){ // only one chunk, don't need to set offset
				postMessage({
					id: nodeID,
					data: Compressor.decode(chunks[0])
				});
			}
			else{ // need to combine chunks
				let totalLen=0;
				for(const v of chunks){
					totalLen+=v.length;
				}
				const data=new Uint8Array(totalLen);
				let offset=0; // offset of chunk v in data
				for(const v of chunks){
					data.set(v,offset);
					offset+=v.length;
				}
				postMessage({
					id: nodeID,
					data: Compressor.decode(data)
				});
			}
		}).catch(err=>{
			console.error("Get content error");
			postMessage({
				id: nodeID,
				error: err
			});
		});
	});
}
