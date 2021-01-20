"use strict";

/**
 * A block used to show real-time FPS value
 */

PERFORMANCE.FPSMonitor={
	fpsAnim: [],
	fpsStroke: [],
	update: ()=>{} // empty function
};

PERFORMANCE.FPSMonitor.init=function(){
	const N=200; // width of box
	PERFORMANCE.FPSMonitor.fpsAnim=new Array(N);
	PERFORMANCE.FPSMonitor.fpsStroke=new Array(N);
	PERFORMANCE.FPSMonitor.fpsAnim.fill(60);
	PERFORMANCE.FPSMonitor.fpsStroke.fill(60);
	
	const $anim=$("#anim-fps-line");
	const $stroke=$("#stroke-fps-line");
	const fpsAnim=PERFORMANCE.FPSMonitor.fpsAnim;
	const fpsStroke=PERFORMANCE.FPSMonitor.fpsStroke;

	PERFORMANCE.FPSMonitor.update=function(fA,fS){
		if(fA){ // animation fps update
			fpsAnim.shift();
			fpsAnim.push(fA);
	
			let pts="";
			for(let i=0;i<N;i++){
				const f=fpsAnim[i].clamp(0,150);
				pts+=i+","+(150-f)+" ";
			}
			$anim.attr("points",pts);
		}
		if(fS){ // stroke fps update
			fpsStroke.shift();
			fpsStroke.push(fS);
	
			let pts="";
			for(let i=0;i<N;i++){
				const f=fpsStroke[i].clamp(0,150);
				pts+=i+","+(150-f)+" ";
			}
			$stroke.attr("points",pts);
		}
	};

	$("#fps-monitor-box").css("display","block");
	$anim.attr("points","");
	$stroke.attr("points","");
}

PERFORMANCE.FPSMonitor.close=function(){
	PERFORMANCE.FPSMonitor.update=()=>{};
	$("#fps-monitor-box").css("display","none");
};