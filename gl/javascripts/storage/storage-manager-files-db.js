/**
 * content operations related to db file operation
 */

// dump a DB store file content into ArrayBuffer
STORAGE.FILES.dumpImgDB=function(fileID){
	if(!STORAGE.FILES.filesStore.fileList[fileID]){
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
		// encode all objects
		for(const kv of kvs){
			if(typeof(kv[1])=="object"){
				if(kv[1].buffer instanceof ArrayBuffer){
					continue; // a typed array
				}
				kv[1]=JSON.stringify(kv[1]); // stringify normal objects
			}
		}
		let totalLen=0;
		for(const [k,v] of kvs){
			totalLen+=TypedWriter.getBytesNeeded(k)+TypedWriter.getBytesNeeded(v);
		}

		// encode file info
		

		// encode binary stream
		const buffer=new ArrayBuffer(totalLen);
		const writer=new TypedWriter(buffer);
		for(const [k,v] of kvs){
			writer.write(k);
			writer.write(v);
		}
		return Promise.resolve(buffer);
	});
}