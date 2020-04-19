PALETTE.colorManager={};
PALETTE.nowNamedList=null;
PALETTE.colorManager.init=function(list){
	PALETTE.colorManager.cList1=new Array(13*12*16);
	PALETTE.colorManager.cList3=new Array(13*12*16);
	const c1=PALETTE.colorManager.cList1;
	const c3=PALETTE.colorManager.cList3;
	for(let i=0;i<c1.length;i++)c1[i]=[];
	for(let i=0;i<c3.length;i++)c3[i]=[];

	list=list||PALETTE.webColorList;
	PALETTE.nowNamedList=list;
	/**
	 * RAD is the search radius for one ceil
	 * Larger RAD: more precise, but slower.
	 * When tested with webColorList:
	 * for RAD=3, average search in a ceil is 16.4 times
	 * for RAD=4, it's 30.5 times
	 * for RAD=2, it's 7.8 times
	 * for RAD=1, it's 3.0 times
	 * RAD=3 seems to be at a balance of performance and precision
	 * For the long namedColorList, RAD=2 is better
	 */
	const RAD=list.length>400?2:3; // for long list, the RAD can be smaller
	for(let i=0;i<list.length;i++){
		const v=list[i];
		const rgb=v[1];
		const yuv=rgb2yuv(rgb); // add YUV value
		v[2]=yuv;
		const yCell=Math.floor(yuv[0]/16);
		const uCell=Math.floor(yuv[1]/16);
		const vCell=Math.floor(yuv[2]/16);
		for(let i=-RAD;i<=RAD;i++){
			for(let j=-RAD;j<=RAD;j++){
				for(let k=-RAD;k<=RAD;k++){
					const yC=yCell+i;
					const uC=uCell+j;
					const vC=vCell+k;
					if(yC<0||yC>=13)continue;
					if(uC<0||uC>=12)continue;
					if(vC<0||vC>=16)continue;
					const id=yC*192+uC*16+vC;
					if(Math.abs(i)>1||Math.abs(j)>1||Math.abs(k)>1){
						c3[id].push(v);
					}
					else{
						c1[id].push(v);
					}
				}
			}
		}
	}
}

PALETTE.colorManager.rgb8bitColor=function(trgb){
	// R3 G3 B2
	const rCell=Math.round(Math.floor(trgb[0]/32)*36.42);
	const gCell=Math.round(Math.floor(trgb[1]/32)*36.42);
	const bCell=Math.round(Math.floor(trgb[2]/64)*85);
	return [rCell,gCell,bCell];
}

PALETTE.colorManager.rgb2webColor=function(trgb){
	// 00~FF
	const rCell=Math.floor(trgb[0]/16)*17;
	const gCell=Math.floor(trgb[1]/16)*17;
	const bCell=Math.floor(trgb[2]/16)*17;
	return [rCell,gCell,bCell];
}

// Approximate NN algorithm, search only 1 ceil, fast
PALETTE.colorManager.rgb2namedColor=function(trgb){
	const tyuv=rgb2yuv(trgb);
	const yCell=Math.floor(tyuv[0]/16);
	const uCell=Math.floor(tyuv[1]/16);
	const vCell=Math.floor(tyuv[2]/16);

	const searchList=(yuv,list)=>{
		let minDis2=Infinity;
		let item=null;
		for(let i=0;i<list.length;i++){
			const v=list[i];
			const dis2=colorDis(yuv,v[2]);
			if(dis2<minDis2){
				minDis2=dis2;
				item=v;
			}
		}
		return [item,minDis2];
	}

	const id=yCell*192+uCell*16+vCell;
	const cell1=PALETTE.colorManager.cList1[id];
	let [item1,minDis21]=searchList(tyuv,cell1);
	/**
	 * THSHLD for filtering in 1RAD colors
	 * Smaller: more precise, but slower
	 * when THSHLD<min(maxColorDis), the result is precise
	 */
	const THSHLD=80;
	if(item1&&minDis21<=THSHLD){ // find within nearest radius
		return item1;
	}
	// Of course you can add a cell2, but that does not help with performance much
	const cell3=PALETTE.colorManager.cList3[id];
	let [item3,minDis23]=searchList(tyuv,cell3);
	if(item3){ // Heuristic: consider as approx. final result
		return minDis21<minDis23?item1:item3;
	}
	
	// If not found, search the whole list
	return searchList(tyuv,PALETTE.nowNamedList)[0];
};
