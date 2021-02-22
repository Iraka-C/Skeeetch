"use strict";

/**
 * A block used to show real-time network speed value
 */

PERFORMANCE.NetworkMonitor={
	download: [],
	upload: [],
	update: ()=>{} // empty function
};

PERFORMANCE.NetworkMonitor.init=function(){
	const N=200; // width of box
	PERFORMANCE.NetworkMonitor.download=new Array(N);
	PERFORMANCE.NetworkMonitor.upload=new Array(N);
	
	const $download=$("#download-line");
	const $upload=$("#upload-line");
	const $texts=$("#network-speed-text").children("text");
	const downloadArr=PERFORMANCE.NetworkMonitor.download;
	const uploadArr=PERFORMANCE.NetworkMonitor.upload;
	downloadArr.fill(60);
	uploadArr.fill(60);

	let lastD=0;
	let lastU=0;
	PERFORMANCE.NetworkMonitor.update=function(speedD,speedU){
		const getPath=(arr,maxVal)=>{
			let pts="";
			for(let i=0;i<N;i++){
				const f=(arr[i]*150/maxVal).clamp(0,150);
				pts+=i+","+(150-f)+" ";
			}
			return pts;
		};

		if(typeof(speedD)=="number"){ // download speed update
			lastD=(lastD+speedD)/2; // small filter
			downloadArr.shift();
			downloadArr.push(lastD);
		}
		if(typeof(speedU)=="number"){ // upload speed update
			lastU=(lastU+speedU)/2;
			uploadArr.shift();
			uploadArr.push(lastU);
		}

		let maxSpeed=0;
		let stageSpeed=0;
		for(let i=0;i<N;i++){
			if(maxSpeed<downloadArr[i])maxSpeed=downloadArr[i];
			if(maxSpeed<uploadArr[i])maxSpeed=uploadArr[i];
		}

		stageSpeed=Math.max(Math.pow(2,Math.ceil(Math.log2(maxSpeed))),1)/4;
		maxSpeed=stageSpeed*5;
		$download.attr("points",getPath(downloadArr,maxSpeed));
		$upload.attr("points",getPath(uploadArr,maxSpeed));

		let unitCnt=0;
		for(let i=0;i<5;i++){
			if(stageSpeed<200)break;
			stageSpeed/=1024;
			unitCnt++;
		}

		$texts.eq(0).text("0 "+" kMGT".charAt(unitCnt)+"bps");
		$texts.eq(1).text(stageSpeed.toFixed(1));
		$texts.eq(2).text((stageSpeed*2).toFixed(1));
		$texts.eq(3).text((stageSpeed*3).toFixed(1));
		$texts.eq(4).text((stageSpeed*4).toFixed(1));
	};

	$("#network-monitor-box").css("display","block");
	$download.attr("points","");
	$upload.attr("points","");
}

PERFORMANCE.NetworkMonitor.close=function(){
	PERFORMANCE.NetworkMonitor.update=()=>{};
	$("#network-monitor-box").css("display","none");
};