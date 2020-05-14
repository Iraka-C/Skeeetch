/**
 * Web worker for file saving at storage-manager-files.js
 * 
 * Part of the Skeeetch project.
 */

importScripts("./compressor.js");
importScripts("./localforage.min.js");
storage=localforage.createInstance({name: "img"});

onmessage=e => { // to global scope
	if(e.data.save){
		saveData(e.data.id,e.data.rawData);
	}
	else if(e.data.get){
		getData(e.data.id);
	}
}

function saveData(nodeID,rawData){
	// Initialization
	function decodeFloat16(bin) {
		const exp=((bin>>>10)&0x1F)-15; // exp>0
		return exp>=0? (1<<exp)*(1+(bin&0x03FF)/0x400):0;
	};

	// data compression, rawData is typed
	const CHUNK_SIZE=1024*1024*64; // 64MB, largest chunk browser may store in IDB
	let pixels;
	if(rawData instanceof Float32Array){
		pixels=new Uint8ClampedArray(rawData);
	}
	else if(rawData instanceof Uint16Array){
		pixels=new Uint8ClampedArray(rawData.length);
		for(let i=0;i<rawData.length;i++) {
			pixels[i]=decodeFloat16(rawData[i]);
		}
	}
	else{
		pixels=rawData;
	}

	// Save encoded data
	const data=Compressor.encode(pixels); // encode first!
	console.log("Compress in worker "+(100*data.length/pixels.length).toFixed(2)+"%");

	const chunkN=Math.max(Math.ceil(data.length/CHUNK_SIZE),1); // at lease 1 chunk
	const bufPromise=self.storage.setItem(nodeID,chunkN);
	const chunkPromises=[bufPromise];
	for(let i=0;i<chunkN;i++) { // save a slice of data
		const key=nodeID+"#"+i;
		const chunk=data.slice(i*CHUNK_SIZE,(i+1)*CHUNK_SIZE);
		const kPromise=self.storage.setItem(key,chunk);
		chunkPromises.push(kPromise);
	}

	Promise.all(chunkPromises).then(v => {
		//console.log(nodeID+" Saved");
		postMessage({
			chunkN: chunkN,
			id: nodeID,
			save: true
		});
	}).catch(err => {
		console.warn(err);
		postMessage({
			chunkN: chunkN,
			id: nodeID,
			isError: true,
			save: true
		});
	});
}

function getData(nodeID){
	storage.getItem(nodeID).then(chunkN => {
		if(!chunkN){ // Not stored or zero chunk
			postMessage({
				data: null,
				get: true
			});
		}

		const chunkPromises=[];
		for(let i=0;i<chunkN;i++) { // get data slices
			const key=nodeID+"#"+i;
			const kPromise=storage.getItem(key);
			chunkPromises.push(kPromise);
		}
		Promise.all(chunkPromises).then(chunks=>{
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

			postMessage({
				data: Compressor.decode(data),
				get: true
			});
		}).catch(err=>{
			console.error("Get content error");
			postMessage({
				data: null,
				get: true,
				isError: true
			});
		});
	});
}
