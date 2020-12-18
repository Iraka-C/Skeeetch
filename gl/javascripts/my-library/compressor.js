"use strict";
class Compressor{
	// targetSize is in bytes
	// Although rle sometimes gives worse result after huffman
	// under most cases it works well
	static encode(uint8arr){
		if(!uint8arr.length){ // 0 length
			return uint8arr;
		}
		const diff=Compressor._getDiff(uint8arr);
		const rle=Compressor.encodeRLE(diff);
		const result=Compressor.encodeHuffman(rle);
		return result;
	}

	// uint8arr is huffman encoded
	static decode(uint8arr){
		if(!uint8arr.length){ // 0 length
			return uint8arr;
		}
		const rle=Compressor.decodeHuffman(uint8arr);
		const diff=Compressor.decodeRLE(rle);
		const result=Compressor._getSum(diff);
		return result;
	}

	/**
	 * Needn't group vertical lines together:
	 * only gets smaller when more details
	 */
	static _getDiff(uint8arr){ // get the diff arr of arr
		const data=uint8arr;
		const diff=new Uint8Array(data.length);
		diff[0]=data[0];
		diff[1]=data[1];
		diff[2]=data[2];
		diff[3]=data[3];
		for(let i=4;i<data.length;i+=4) {
			diff[i]=data[i]-data[i-4];
			diff[i+1]=data[i+1]-data[i-3];
			diff[i+2]=data[i+2]-data[i-2];
			diff[i+3]=data[i+3]-data[i-1];
		}
		return diff;
	}

	/**
	 * The inverse function of _getDiff
	 */
	static _getSum(diff){
		const data=new Uint8Array(diff.length);
		data[0]=diff[0];
		data[1]=diff[1];
		data[2]=diff[2];
		data[3]=diff[3];
		for(let i=4;i<data.length;i+=4) {
			data[i]=diff[i]+data[i-4];
			data[i+1]=diff[i+1]+data[i-3];
			data[i+2]=diff[i+2]+data[i-2];
			data[i+3]=diff[i+3]+data[i-1];
		}
		return data;
	}

	/**
	 * encode an rle (0~255) using Huffman
	 * max tree depth is 12
	 * @param {Uint8Array} rlearr rle compressed data
	 */
	static encodeHuffman(rlearr){
		const data=rlearr; // except last byte
		const freq=new Uint32Array(256);
		for(let i=0;i<data.length;i++) { // count frequency
			freq[data[i]]++;
		}

		// construct Huffman tree using two queues
		const q1=[],q2=[];
		for(let i=0;i<256;i++){ // construct q1
			if(freq[i]){ // only insert valid symbol
				q1.push(new HuffmanNode(i,freq[i]));
			}
		}
		q1.sort((e1,e2)=>e1.weight-e2.weight); // sort according to freq
		if(q1.length==1){ // only one element
			q2.push(q1.pop());
		}

		const infinityNode=new HuffmanNode(NaN,Infinity);
		while(q1.length+q2.length>1){ // there are remainings
			const e10=q1.length?q1[0]:infinityNode;
			const e11=q1.length>1?q1[1]:infinityNode;
			const e20=q2.length?q2[0]:infinityNode;
			const e21=q2.length>1?q2[1]:infinityNode;

			// Choose the minimum way to pop elements
			const w11=e10.weight+e11.weight;
			const w12=e10.weight+e20.weight;
			const w22=e20.weight+e21.weight;
			const minW=Math.min(w11,w12,w22);
			let elem1,elem2;
			if(minW==w11){
				elem1=q1.shift();
				elem2=q1.shift();
			}
			else if(minW==w12){
				elem1=q1.shift();
				elem2=q2.shift();
			}
			else{
				elem1=q2.shift();
				elem2=q2.shift();
			}
			// push new node
			q2.push(HuffmanNode.merge(elem1,elem2));
		}

		// Optimize tree depth - sort according to depth
		const depthSortList=[]; // construct depth list
		const setVal=(node,d)=>{ // traverse tree
			if(node.children){
				setVal(node.children[0],d+1);
				setVal(node.children[1],d+1);
			}
			else{
				depthSortList.push({
					symbol: node.symbol,
					depth: Math.max(d,1) // at least 1 bit
				});
			}
		}
		setVal(q2[0],0); // set all node depth
		depthSortList.sort((e1,e2)=>e1.depth-e2.depth); // sort with depth asc.
		
		// flatten tree nodes: heuristic
		const N=depthSortList.length; // N symbols
		const symList=new Array(N);
		const depList=new Array(N);
		for(let i=0;i<N;i++){ // copy for shifting values
			symList[i]=depthSortList[i].symbol;
			depList[i]=depthSortList[i].depth;
		}

		const MAX_DEPTH=12;
		while(depList[N-1]>MAX_DEPTH){ // not satisfied
			for(let k=N-1;k>=0;k--){ // find the item to promote
				if(depList[k]<MAX_DEPTH){ // the first to promote
					const num=1<<(MAX_DEPTH-depList[k]); // items it may generate
					depList.splice(k,1,...new Array(num).fill(MAX_DEPTH)); // replace
					break;
				}
			}
		}

		// Construct flattened huffman coding table
		const codeList=new Uint16Array(N); // 0 as init
		for(let i=1;i<N;i++){ // only lower-dep[i] bit of codeList[i] is valid, else is 0
			codeList[i]=(codeList[i-1]+1)<<(depList[i]-depList[i-1]);
		}

		const code256=new Uint16Array(256);
		const dep256=new Uint8Array(256); // if dep256[i]==0, i doesn't have any coding
		for(let i=0;i<N;i++){ // indexed to table
			const v=symList[i];
			code256[v]=codeList[i];
			dep256[v]=depList[i];
		}

		// Encode with constructed table
		let totalLength=0;
		for(let i=0;i<N;i++){
			totalLength+=depList[i]*freq[symList[i]];
		}
		totalLength=Math.ceil(totalLength/8);

		// with dict padding, total length(32bit)
		const encoded=new Uint8Array(totalLength+516);
		let buf=0; // 32bit buf for encoding
		let pED=0,pBit=0;
		for(let i=0;i<data.length;i++) { // encode each byte
			const v=data[i]; // 0~255
			const vCode=code256[v];
			const vLen=dep256[v];

			pBit+=vLen;
			buf|=vCode<<(32-pBit); // put into buffer, left aligned

			while(pBit>=8){ // combined to 1 byte
				encoded[pED++]=buf>>>24; // copy value
				buf<<=8; // move buffer
				pBit-=8;
			}
		}
		encoded[pED++]=buf>>>24; // pad the tail

		for(let i=0;i<256;i++){ // Stored as Hi(8),Lo(4)-Len(4)
			const id=totalLength+i*2;
			encoded[id]=code256[i]>>>4; // high 8 bits
			encoded[id+1]=(code256[i]<<4)&0xF0|dep256[i]&0xF; // low 4 bits + length 4 bits
		}

		const dLen=data.length;
		encoded[totalLength+512]=dLen>>24&0xFF; // note length
		encoded[totalLength+513]=dLen>>16&0xFF;
		encoded[totalLength+514]=dLen>>8&0xFF;
		encoded[totalLength+515]=dLen&0xFF;

		return encoded;
	}

	static decodeHuffman(hfmData){
		const totalLength=hfmData.length-516; // exclude dict padding
		const dLen= // total decoded data length
			(hfmData[totalLength+512]<<24)|
			(hfmData[totalLength+513]<<16)|
			(hfmData[totalLength+514]<<8)|
			(hfmData[totalLength+515]);

		const dict=new Array(4096); // 12bit dict
		for(let i=0;i<256;i++){
			const hi=hfmData[totalLength+i*2];
			const lo=hfmData[totalLength+i*2+1];
			const code=(hi<<4)|(lo>>4)&0xF;
			const len=lo&0xF;
			if(!len)continue; // not coded
			const mov=12-len; // highest bit align
			dict.fill({ // fill with an Object reference
				symbol:i,
				len:len
			},code<<mov,(code+1)<<mov);
		}

		const decoded=new Uint8Array(dLen); // with huffmanCnt
		let pDD=0; // now tail position in decoded

		// NOTE: According to JS specs, bitwise operators only accept 32bit Ints.
		let buf=0; // 32bit buf for decoding
		let pED=0; // encoded element pos
		let pBit=0; // tail position in buf (after lowest valid bit)
		while(pDD<dLen){
			const b=hfmData[pED++];
			pBit+=8;
			buf|=b<<(32-pBit);
			
			while(pBit>=12&&pDD<dLen){
				const code=buf>>>20; // highest 12 bit decides the code
				const elem=dict[code];

				decoded[pDD++]=elem.symbol;
				const l=elem.len;
				buf<<=l; // throw highest elem.len bits
				pBit-=l;
			}
		}
		return decoded;
	}

	/**
	 * using PackBits algorithm
	 * @param {*} data uint8arr
	 */
	static encodeRLE(data){
		if(!data.length){
			return new Uint8Array(); // a single 0
		}
		if(data.length==1){ // construct [0,d0]
			const res=new Uint8Array(2);
			res[1]=data[0];
			return res;
		}
		
		const CHUNK_LEN=1048576;
		let res=new Uint8Array(CHUNK_LEN); // 1MB
		const resList=[res];
		let resPos=0; // length in last chunk

		const buf=new Uint8Array(128); // buffer for raw part
		let bufPos=0; // next pos in buffer

		let pos=0; // which data to add
		let isRLE=false; // state: raw or rle
		let repeatCnt=0;

		function extendResult(){ // extend the length of res for 1MB
			res=new Uint8Array(CHUNK_LEN);
			resList.push(res);
			resPos=0;
		}
		function pushVal(val){ // number
			if(resPos==CHUNK_LEN){
				extendResult();
			}
			res[resPos++]=val;
		};
		function pushBuf(){ // buffer
			const newResPos=resPos+bufPos;
			if(newResPos>CHUNK_LEN){
				const remainLen=CHUNK_LEN-resPos;
				res.set(buf.subarray(0,remainLen),resPos);
				extendResult();
				res.set(buf.subarray(remainLen,bufPos),0);
				resPos=bufPos-remainLen;
				bufPos=0;
			}
			else{ // enough length
				res.set(buf.subarray(0,bufPos),resPos);
				resPos+=bufPos;
				bufPos=0;
			}
		}

		function finishRaw(){ // push the buffer into result
			if(!bufPos)return;
			pushVal(bufPos-1);
			pushBuf();
		}

		function finishRLE(){ // push RLE part
			pushVal(1-repeatCnt);
			pushVal(data[pos]);
		}

		let nextD=data[0];
		while(pos<data.length-1){
			const d=nextD;
			nextD=data[pos+1];

			if(d==nextD){ // same
				if(isRLE){ // still RLE
					if(repeatCnt==127){ // restart RLE
						finishRLE();
						repeatCnt=0;
					}
					repeatCnt++;
				}
				else{ // start RLE
					finishRaw();
					isRLE=true;
					repeatCnt=1;
				}
			}
			else{ // different
				if(isRLE){ // stop RLE
					repeatCnt++;
					finishRLE();
					isRLE=false;
					repeatCnt=0;
				}
				else{
					if(bufPos==127){ // restart raw
						finishRaw();
					}
					buf[bufPos++]=d;
				}
			}
			pos++;
		}

		// final work
		if(isRLE){
			repeatCnt++;
			finishRLE();
		}
		else{
			buf[bufPos++]=data[pos];
			finishRaw();
		}


		//return res.slice(0,resPos);
		const totalLen=(resList.length-1)*CHUNK_LEN+resPos;
		const finalRes=new Uint8Array(totalLen);
		let offset=0;
		for(let i=0;i<resList.length-1;i++){ // set whole chunks
			finalRes.set(resList[i],offset);
			offset+=CHUNK_LEN;
		}
		finalRes.set(res.subarray(0,resPos),offset); // copy the last chunk
		return finalRes;
	}

	/**
	 * using PackBits algorithm
	 * @param {*} data uint8arr
	 */
	static decodeRLE(data){
		if(!data.length){
			return data;
		}

		const CHUNK_LEN=1048576;
		let res=new Uint8Array(CHUNK_LEN); // 1MB
		let resList=[res];
		let resPos=0; // length in the last chunk
		function extendResult(){ // extend the length of res for 1MB
			res=new Uint8Array(CHUNK_LEN);
			resList.push(res);
		}
		function pushVal(val,cnt){ // push several same numbers
			const newResPos=resPos+cnt;
			if(newResPos>CHUNK_LEN){ // longer
				res.fill(val,resPos,CHUNK_LEN);
				extendResult();
				resPos=newResPos-CHUNK_LEN;
				res.fill(val,0,resPos);
			}
			else{ // able to contain
				res.fill(val,resPos,newResPos);
				resPos=newResPos;
			}
		};
		function pushData(start,cnt){ // push several numbers from data
			const newResPos=resPos+cnt;
			if(newResPos>CHUNK_LEN){ // need to extend
				const remainLen=CHUNK_LEN-resPos;
				const newStart=start+remainLen;
				res.set(data.subarray(start,newStart),resPos);
				extendResult();
				const newLen=newResPos-CHUNK_LEN;
				res.set(data.subarray(newStart,newStart+newLen),0);
				resPos=newLen;
			}
			else{ // able to contain
				res.set(data.subarray(start,start+cnt),resPos);
				resPos+=cnt;
			}
			
		};

		let pos=0;
		while(pos<data.length){
			let header=data[pos++];
			if(header<128){ // consecutive bytes
				pushData(pos,header+1); // extend
				pos+=header+1; // pass header+1 bytes
			}
			else if(header>128){ // -1~-127, repeating part
				pushVal(data[pos++],257-header); // extend
			}
			// 128 is ignored
		}

		const totalLen=(resList.length-1)*CHUNK_LEN+resPos;
		const finalRes=new Uint8Array(totalLen);
		let offset=0;
		for(let i=0;i<resList.length-1;i++){ // set whole chunks
			finalRes.set(resList[i],offset);
			offset+=CHUNK_LEN;
		}
		finalRes.set(res.subarray(0,resPos),offset); // copy the last chunk
		return finalRes;
	}
}

class HuffmanNode{
	constructor(symbol,weight){
		this.symbol=symbol;
		this.weight=weight;
		this.children=null;
	}
	static merge(node1,node2){
		const node=new HuffmanNode(null,node1.weight+node2.weight);
		node.children=[node1,node2];
		return node;
	}
	toString(){
		if(this.children){
			return "["+this.children[0].toString()+","+this.children[1].toString()+"]";
		}
		else{
			return this.symbol+"";
		}
	}
}