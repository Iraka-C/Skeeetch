/**
 * Web worker for file saving at storage-manager-files.js
 * Only for compression
 */

importScripts("../compressor.js");

/**
 * e.data={
	id: texture id,
	rawData: data to be compressed
 * }
 */
onmessage=e => { // to global scope
	encodeData(e.data.id,e.data.rawData);
}

/**
 * This method isn't thread-safe!
 */
function encodeData(nodeID,rawData){
	// Initialization
	function decodeFloat16(bin) {
		const exp=((bin>>>10)&0x1F)-15; // exp>0
		return exp>=0? (1<<exp)*(1+(bin&0x03FF)/0x400):0;
	};

	// data compression, rawData is typed
	//const CHUNK_SIZE=1024*1024*64; // 64MB, largest chunk browser may store in IDB
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

	postMessage({
		id: nodeID,
		data: data
	});
}
