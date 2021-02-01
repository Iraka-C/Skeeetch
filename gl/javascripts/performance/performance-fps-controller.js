/**
 * An auto controller for setting optimal fps for strokes
 */
"use strict";

class FPSController{
	constructor(){
		this.N=241; // control to at most 240fps
		const fRel=new Array(this.N);
		this.fRel=fRel;
		
		// ideal 120Hz monitor: only accepts 120Hz or lower
		for(let i=0;i<=120;i++){
			fRel[i]=120;
		}
		for(let i=121;i<this.N;i++){
			fRel[i]=0;
		}

		this.enabled=false;
	}

	/**
	 * 
	 * @param {Number} fExp expected fps
	 * @param {Number} fMs measured fps
	 */
	update(fExp,fMs){
		const fRel=this.fRel;
		const N=this.N; // max fps

		fExp=Math.round(fExp).clamp(0,240);
		const fMsOld=fRel[fExp];
		if(fMsOld<fMs){ // hard to rise
			fMs=fMsOld*0.8+fMs*0.2;
		}
		else{ // else: easy to drop: directly fMs
			// attenuate the lower fps
			for(let i=1;i<10;i++){ // related to fExp~fExp-9
				const f=fExp-i;
				if(f<=0)break;
				fRel[f]=fMs+(fRel[f]-fMs)*i/10;
			}
		}
		fRel[fExp]=fMs;
		for(let i=fExp-1;i>=0;i--){
			if(fRel[i]<fMs){ // keep monotone decreasing
				fRel[i]=fMs;
			}
			else{
				break;
			}
		}
		for(let i=fExp+1;i<N;i++){
			if(fRel[i]>fMs){ // keep monotone desreasing
				fRel[i]=fMs;
			}
			else{
				break;
			}
		}

		// draw line
		if(this.enabled){
			this._draw();
		}
	}

	getOptimalFps(){
		const N=this.N; // max fps
		const fRel=this.fRel;

		// binary search
		let left=0; // left>fRel[left]
		let right=N-1; // right<fRel[right]
		while(right-left>1){
			const mid=(left+right)>>>1;
			const fMid=fRel[mid];
			if(mid==fMid){ // found
				return mid;
			}
			if(mid<fMid){ // mid too small
				left=mid;
			}
			else{ // mid too large
				right=mid;
			}
		}
		return left;
	}

	_draw(){
		let pts=""; // refresh
		const N=this.N; // max fps
		const fRel=this.fRel;
		for(let i=0;i<N;i++){
			const f=fRel[i].clamp(0,240);
			pts+=i+","+(240-f)+" ";
		}
		$("#fps-em-line").attr("points",pts);
	}
	show(){
		this.enabled=true;
		this._draw();
		$("#fps-curve-box").css("display","block");
	}
	hide(){
		this.enabled=false;
		$("#fps-curve-box").css("display","none");
	}
}