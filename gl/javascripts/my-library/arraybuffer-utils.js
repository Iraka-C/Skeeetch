
/**
 * These classes interpret numbers in big-endian format.
 * DO NOT use a TypedArray View over ArrayBuffer because the endianess is uncertain!
 * Note: no out-of-bound check!
 */
"use strict";

class ArrayBufferReader{
	constructor(buffer){ // buffer is ArrayBuffer
		this.bufferView=new Uint8Array(buffer); // a viewed buffer
		this.offset=0;
	}
	readUInt8(){
		return this.bufferView[this.offset++];
	}
	readUInt16(){
		const N=this.offset;
		const buffer=this.bufferView;
		const val=(buffer[N]<<8)|(buffer[N+1]);
		this.offset+=2;
		return val;
	}
	readUInt32(){
		const N=this.offset;
		const buffer=this.bufferView;
		const val=(buffer[N]<<24)|(buffer[N+1]<<16)|(buffer[N+2]<<8)|(buffer[N+3]);
		this.offset+=4;
		return val;
	}
	readUTF16String(length){ // NOTE: length is the byte-length, not the length of the string
		const CHUNK=16384;
		// assume length%2==0
		const N=this.offset;
		const buffer=this.bufferView;
		const resArr=new Array(CHUNK);
		let result="";
		let p=0; // pointer in resArr
		for(let i=0;i<length;i+=2){
			if(p==CHUNK){ // deal with 1 batch
				result+=String.fromCharCode.apply(null,resArr);
				p=0; // reset counter
			}
			const offset=N+i;
			resArr[p++]=(buffer[offset]<<8)|(buffer[offset+1]); // uint16
		}
		result+=String.fromCharCode.apply(null,resArr.slice(0,p)); // last chunk
		
		this.offset+=length;
		return result;
	}
	readUInt8Array(length){
		const buffer=this.bufferView;
		const arr=new Uint8Array(length);
		for(let i=0,p=this.offset;i<length;i++,p++){
			arr[i]=buffer[p];
		}
		//const array=this.bufferView.subarray(this.offset,end); // Nope
		/**
		 * Why not to use subarray:
		 * When saving a subarray into IndexedDB, regardless of its length
		 * the IndexedDB will store ALL of the underlying ArrayBuffer.
		 * Which means even if only a small fraction of ArrayBuffer is used,
		 * all of its contents will be stored.
		 * If there are two independent views on this ArrayBuffer, and both are stored
		 * then the ArrayBuffer will be stored TWICE.
		 */
		this.offset+=length;
		return arr;
	}
	skip(length){
		this.offset+=length;
	}
}

/**
 * Note: when writing a uint larger than the range, trunced rather than clamped!
 */
class ArrayBufferWriter{
	constructor(buffer){ // buffer is ArrayBuffer
		this.bufferView=new Uint8Array(buffer); // a viewed buffer
		this.offset=0;
	}
	writeUInt8(v){
		this.bufferView[this.offset++]=v;
	}
	writeUInt16(v){
		const N=this.offset;
		const buffer=this.bufferView;
		buffer[N]=v>>8&0xFF;
		buffer[N+1]=v&0xFF;
		this.offset+=2;
	}
	writeUInt32(v){
		const N=this.offset;
		const buffer=this.bufferView;
		buffer[N]=v>>24&0xFF;
		buffer[N+1]=v>>16&0xFF;
		buffer[N+2]=v>>8&0xFF;
		buffer[N+3]=v&0xFF;
		this.offset+=4;
	}
	writeUTF16String(str){
		const N=this.offset;
		const buffer=this.bufferView;
		for(let i=0,p=0;i<str.length;i++,p+=2){
			const offset=N+p; // position in buffer
			const val=str.charCodeAt(i);
			buffer[offset]=val>>8&0xFF; // write uint16 in big-endian
			buffer[offset+1]=val&0xFF;
		}
		this.offset+=str.length*2;
	}
	writeUInt8Array(arr){
		const buffer=this.bufferView;
		for(let i=0,p=this.offset;i<arr.length;i++,p++){
			buffer[p]=arr[i];
		}
		this.offset+=arr.length;
	}
	skip(length){
		this.offset+=length;
	}
}

// ================== Typed Reader/Writer ======================
class TypedReader{
	constructor(buffer){
		this.reader=new ArrayBufferReader(buffer);
	}
	read(){
		const reader=this.reader;
		const type=reader.readUInt8();
		switch(type){
			case 1:{ // number
				return reader.readUInt32();
			}
			case 2:{ // string
				const len=reader.readUInt32(); // string length
				return reader.readUTF16String(len*2);
			}
			case 3:{
				const len=reader.readUInt32(); // array length
				return reader.readUInt8Array(len);
			}
			default:
				throw new Error("Cannot read type "+type);
		}
	}
	isEnd(){
		const reader=this.reader;
		return reader.offset>=reader.bufferView.length;
	}
}

/**
 * Type: number(1), string(2), uint8arr(3), else: ???
 * Number: [1] [....] (uint32)
 * String: [2] [....] (string length) [...   ] (string content)
 * Uint8Array: [3] [....] (array length) [...   ] (array content)
 */
class TypedWriter{
	constructor(buffer){
		this.writer=new ArrayBufferWriter(buffer);
	}
	write(v){
		const writer=this.writer;
		if(typeof(v)=="number"){ // number within uint32 range
			writer.writeUInt8(1);
			writer.writeUInt32(v);
		}
		else if(typeof(v)=="string"){ // utf-16 string
			writer.writeUInt8(2);
			writer.writeUInt32(v.length);
			writer.writeUTF16String(v);
		}
		else if(v instanceof Uint8Array){
			writer.writeUInt8(3);
			writer.writeUInt32(v.length);
			writer.writeUInt8Array(v);
		}
		else{
			throw new Error("Cannot write type",v);
		}
	}
	static getBytesNeeded(v){
		if(typeof(v)=="number"){ // number within uint32 range
			if(v<0||v>=65536){
				throw new Error("Cannot write number "+v);
			}
			return 5; // type(1) + uint32(4)
		}
		if(typeof(v)=="string"){ // utf-16 string
			return 5+v.length*2;
		}
		if(v instanceof Uint8Array){
			return 5+v.length;
		}
		throw new Error("Cannot write type",v);
	}
}