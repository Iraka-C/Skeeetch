"use strict";

/**
 * A block used to show real-time FPS value
 */

PERFORMANCE.FPSMonitor={
	fpsAnim: [],
	fpsStroke: []
};

PERFORMANCE.FPSMonitor.init=function(){
	const N=200; // width of box
	PERFORMANCE.FPSMonitor.fpsAnim=new Array(N);
	PERFORMANCE.FPSMonitor.fpsStroke=new Array(N);
	PERFORMANCE.FPSMonitor.fpsAnim.fill(60);
	PERFORMANCE.FPSMonitor.fpsStroke.fill(60);
}


PERFORMANCE.FPSMonitor.update=function(fA,fS){
	const $anim=$("#anim-fps-line");
	const $stroke=$("#stroke-fps-line");

	const fpsAnim=PERFORMANCE.FPSMonitor.fpsAnim;
	const N=200; // width of box
	if(fA){ // animation fps update
		fpsAnim.shift();
		fpsAnim.push(fA);

		let pts="";
		for(let i=0;i<N;i++){
			const f=fpsAnim[i].clamp(0,120);
			pts+=i+","+(120-f)+" ";
		}
		$anim.attr("points",pts);
	}
	const fpsStroke=PERFORMANCE.FPSMonitor.fpsStroke;
	if(fS){ // stroke fps update
		fpsStroke.shift();
		fpsStroke.push(fS);

		let pts="";
		for(let i=0;i<N;i++){
			const f=fpsStroke[i].clamp(0,120);
			pts+=i+","+(120-f)+" ";
		}
		$stroke.attr("points",pts);
	}
}