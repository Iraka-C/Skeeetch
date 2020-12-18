"use strict";
class ColorInfoManager {
	constructor(param) {
		param=param||{};
		this.type=param.type||"normal";
		this.typeID=param.typeID||0;
		if(this.type=="color-list") {
			if(!param.colorList) {
				throw new Error("No color list provided during construction!");
			}
			this.colorList=param.colorList;
			console.log(this.colorList.length);

			this._initColorList();
		}

	}
	_initColorList() {
		// @TODO: change this into an class object instance
		/**
		 * Suppose named colors are almost generally distributed
		 * Use array as bucket hash. bucket size is 10^3
		 * Each bucket contains all colors in a radius.
		 * cList1 contains (10*3)^3
		 * cList3 contains (10*(2*RAD+1))^3
		 */
		const list=this.colorList;
		const SIZE=13*19*26; // this bucket size contains fYUV space
		this.cList1=new Array(SIZE);
		this.cList3=new Array(SIZE);
		const c1=this.cList1;
		const c3=this.cList3;
		const maxDis2Cell=new Array(SIZE); // temp array for trimming
		for(let i=0;i<SIZE;i++) {
			c1[i]=[];
			c3[i]=[];
			maxDis2Cell[i]=Infinity;
		}

		// The maximum possible distance^2 from yuv=[y,u,v] to a point in cell[yC,uC,vC]
		const maxDis2YUV2Cell=(yuv,yC,uC,vC) => {
			const ctY=yC*10+5;
			const ctU=uC*10+5;
			const ctV=vC*10+5;
			const dY=Math.abs(yuv[0]-ctY)+5;
			const dU=Math.abs(yuv[1]-ctU)+5;
			const dV=Math.abs(yuv[2]-ctV)+5;
			return dY*dY+dU*dU+dV*dV;
		};
		const minDis2YUV2Cell=(yuv,yC,uC,vC) => {
			const ctY=yC*10+5;
			const ctU=uC*10+5;
			const ctV=vC*10+5;
			const dY=Math.max(Math.abs(yuv[0]-ctY)-5,0);
			const dU=Math.max(Math.abs(yuv[1]-ctU)-5,0);
			const dV=Math.max(Math.abs(yuv[2]-ctV)-5,0);
			return dY*dY+dU*dU+dV*dV;
		};
		/**
		 * RAD is the search radius for one ceil
		 * Larger RAD: more precise, but slower.
		 * When tested with webColorList:
		 * for every RAD+1, average search in a ceil is doubled
		 * RAD=3 seems to be at a balance of performance and precision
		 */
		const RAD=list.length>700? 3:list.length>300? 4:5; // more element allows smaller search radius
		for(let l=0;l<list.length;l++) { // calculate minimum possible max dis to a cell
			const v=list[l];
			const rgb=v[1];
			const yuv=rgb2fyuv(rgb); // add YUV value
			v[2]=yuv;
			const yCell=Math.floor(yuv[0]/10);
			const uCell=Math.floor(yuv[1]/10);
			const vCell=Math.floor(yuv[2]/10);
			for(let i=-RAD;i<=RAD;i++) {
				const yC=yCell+i;
				if(yC<0||yC>=13) continue;
				const yID=yC*494;
				for(let j=-RAD;j<=RAD;j++) {
					const uC=uCell+j;
					if(uC<0||uC>=19) continue;
					const yuID=yID+uC*26;
					for(let k=-RAD;k<=RAD;k++) {
						const vC=vCell+k;
						if(vC<0||vC>=26) continue;
						const id=yuID+vC;
						const mDis2=maxDis2YUV2Cell(yuv,yC,uC,vC);
						maxDis2Cell[id]=Math.min(maxDis2Cell[id],mDis2);
					}
				}
			}
		}
		for(let l=0;l<list.length;l++) { // add color item to each cell
			const v=list[l];
			const yuv=v[2]; // yuv value just calculated
			const yCell=Math.floor(yuv[0]/10);
			const uCell=Math.floor(yuv[1]/10);
			const vCell=Math.floor(yuv[2]/10);
			for(let i=-RAD;i<=RAD;i++) {
				const yC=yCell+i;
				if(yC<0||yC>=13) continue;
				const yID=yC*494;
				for(let j=-RAD;j<=RAD;j++) {
					const uC=uCell+j;
					if(uC<0||uC>=19) continue;
					const yuID=yID+uC*26;
					for(let k=-RAD;k<=RAD;k++) {
						const vC=vCell+k;
						if(vC<0||vC>=26) continue;
						const id=yuID+vC;
						if(minDis2YUV2Cell(yuv,yC,uC,vC)>=maxDis2Cell[id]) {
							// larger than the most possible distance, discard
							// This trimming shrinks c1 by 5%
							// shrinks c3 by 85%
							// Increases performance by ~8%
							continue;
						}
						if(Math.abs(i)>1||Math.abs(j)>1||Math.abs(k)>1) {
							c3[id].push(v);
						}
						else {
							c1[id].push(v);
						}
					}
				}
			}
		}
	}

	/**
	 * Sumbit a query on target color
	 * return [info,[r,g,b]]: r,g,b is the related color
	 * @param {[Number,Number,Number]} rgb [r,g,b] from 0~255
	 */
	query(rgb) { // return [info,[r,g,b]]: r,g,b is the related color
		const rgbCell2Hex=(r,g,b) => "#"+((1<<24)+(Math.round(r)<<16)+(Math.round(g)<<8)+Math.round(b)).toString(16).slice(1);
		switch(this.type) {
			default:
			case "normal":
				return [null,rgb];
			case "web-safe":
				const rC=Math.round(rgb[0]/51)*51;
				const gC=Math.round(rgb[1]/51)*51;
				const bC=Math.round(rgb[2]/51)*51;
				return [rgbCell2Hex(...rgb),[rC,gC,bC]];
			case "color-list":
				return this._queryColorList(rgb);
		}
	}

	/**
	 * Fast algorithm for finding the NN of an RGB color under fYUV metrics
	 * Approximate algorithm. The precision can be tuned by THSHLD & RAD.
	 * The concept of precision tuning is to make buckets full but not crowded.
	 * Around 9.3E6 queries/sec among 140 colors.
	 * Around 3.1E6 queries/sec among 1500 colors.
	 */
	_queryColorList(trgb) {
		const tyuv=rgb2fyuv(trgb);
		const yCell=Math.floor(tyuv[0]/10);
		const uCell=Math.floor(tyuv[1]/10);
		const vCell=Math.floor(tyuv[2]/10);

		const searchList=(yuv,list) => {
			let minDis2=Infinity;
			let item=null;
			for(let i=0;i<list.length;i++) {
				const v=list[i];
				const dis2=colorDis(yuv,v[2]);
				if(dis2<minDis2) {
					minDis2=dis2;
					item=v;
				}
			}
			return [item,minDis2];
		}

		const id=yCell*494+uCell*26+vCell;
		const cell1=this.cList1[id];
		const [item1,minDis21]=searchList(tyuv,cell1);

		/**
		 * THSHLD for filtering in 1RAD colors
		 * Smaller: more precise, but slower
		 * when threshold<=100=(10*1)^2, the result is precise
		 */
		if(item1&&minDis21<=100) { // find within nearest radius
			return item1;
		}

		const cell3=this.cList3[id];
		const [item3,minDis23]=searchList(tyuv,cell3);
		if(item3) { // Heuristic: consider as approx. final result
			return minDis21<minDis23? item1:item3;
		}

		// If not found, search the whole list
		return searchList(tyuv,this.colorList)[0];
	}

}