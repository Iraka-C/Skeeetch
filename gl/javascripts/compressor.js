class Compressor{
	constructor(){
	}

	encode(uint8arr){
		const diff=this._getDiff(uint8arr);
		const rle=this.encodeRLE(diff);
		const huffman=this.encodeHuffman(rle,16); // 16 as default
		const result=huffman;

		console.log(
			(result.length/1024/1024).toFixed(2)+"MB",
			(100*result.length/uint8arr.length).toFixed(2)+"%"
		);
		return result;
	}

	/**
	 * Needn't group RGBA together:
	 * only gets smaller when more details
	 */
	_getDiff(uint8arr){ // get the diff arr of arr
		const data=uint8arr;
		const diff=new Uint8Array(data.length);
		let nowVal=new Uint8Array(4);
		for(let i=0;i<data.length;i+=4) {
			diff[i]=data[i]-nowVal[0];
			diff[i+1]=data[i+1]-nowVal[1];
			diff[i+2]=data[i+2]-nowVal[2];
			diff[i+3]=data[i+3]-nowVal[3];
			nowVal[0]=data[i];
			nowVal[1]=data[i+1];
			nowVal[2]=data[i+2];
			nowVal[3]=data[i+3];
		}
		return diff;
	}

	/**
	 * encode an uint8arr (0~255) using Huffman
	 * Suppose that uint8arr follows the rule that
	 * neighboring pixels have rather small difference.
	 * @param {Uint8Array} uint8arr image data [r,g,b,a,...]
	 * @param {Number>=8} maxDepth max tree depth, 9~16, init 12
	 */
	encodeHuffman(uint8arr,maxDepth){
		// @TODO: when uint8arr.length==0
		if(!uint8arr.length)return uint8arr;

		maxDepth=isNaN(maxDepth)?16:Math.min(Math.max(maxDepth,9),16);

		const data=uint8arr;
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
		maxDepth=Math.min(maxDepth,q2[0].depth);

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
		while(depList[N-1]>maxDepth){ // not satisfied
			for(let k=N-1;k>=0;k--){ // find the item to promote
				if(depList[k]<maxDepth){ // the first to promote
					const num=1<<(maxDepth-depList[k]); // items it may generate
					depList.splice(k,1,...new Array(num).fill(maxDepth)); // replace
					break;
				}
			}
		}

		// Construct flattened huffman coding table
		const codeList=new Uint16Array(N); // 0 as init
		//console.log(symList[0],depList[0],codeList[0].toString(2));
		for(let i=1;i<N;i++){ // only lower-dep[i] bit of codeList[i] is valid, else is 0
			codeList[i]=(codeList[i-1]+1)<<(depList[i]-depList[i-1]);
			//console.log(symList[i],depList[i],codeList[i].toString(2));
		}

		const code256=new Uint16Array(256);
		const dep256=new Array(256);
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

		const encodedDiff=new Uint8Array(totalLength+768); // with dict padding
		let buf=0; // 32bit
		let pED=0,pBit=0;
		for(let i=0;i<data.length;i++) { // count frequency
			const v=data[i]; // 0~255
			const vCode=code256[v];
			const vLen=dep256[v];

			pBit+=vLen;
			buf|=vCode<<(32-vLen); // put into buffer
			if(pBit>=8){ // combined to 1 bit
				encodedDiff[pED++]=buf>>>24; // copy value
				buf<<=8; // move buffer
				pBit-=8;
			}
		}
		encodedDiff[pED++]=buf>>>24; // pad the tail

		for(let i=0;i<256;i++){ // Stored as Hi-Lo-len
			const id=totalLength+i*3;
			encodedDiff[id]=code256[i]>>>8;
			encodedDiff[id+1]=code256[i]&0xFF;
			encodedDiff[id+2]=dep256[i]; // length of code, 1~16
		}

		//console.log(totalLength,pED);
		return encodedDiff;
	}

	/**
	 * using PackBits algorithm
	 * @param {*} data uint8arr
	 */
	encodeRLE(data){
		if(!data.length)return data;
		if(data.length==1){ // construct [0,d0]
			const res=new Uint8Array(2);
			res[1]=data[0];
			return res;
		}

		const res=[];
		let buf=[];
		let pos=0; // which data to add
		let isRLE=false; // state: raw or rle
		let repeatCnt=0;

		function finishRaw(){ // push the buffer
			if(!buf.length)return;
			res.push(buf.length-1);
			res.push(...buf);
			buf=[];
		}

		function finishRLE(){ // push RLE part
			res.push(257-repeatCnt);
			res.push(data[pos]);
		}

		while(pos<data.length-1){
			const d=data[pos];

			if(d==data[pos+1]){ // same
				if(isRLE){ // still RLE
					if(repeatCnt==127){ //restart RLE
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
					if(buf.length==127){ // restart raw
						finishRaw();
					}
					buf.push(d);
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
			buf.push(data[pos]);
			finishRaw();
		}

		return new Uint8Array(res);
	}
}

class HuffmanNode{
	constructor(symbol,weight){
		this.symbol=symbol;
		this.weight=weight;
		this.children=null;
		this.depth=0;
	}
	static merge(node1,node2){
		const node=new HuffmanNode(null,node1.weight+node2.weight);
		node.children=[node1,node2];
		node.depth=Math.max(node1.depth,node2.depth)+1;
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