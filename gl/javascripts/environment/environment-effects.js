/**
 * Transform Animation
 */
"use strict";

/**
 * get transform matrix [a,b,c,d,e,f] from pArr = [x,y,r,s]
 * translate (x,y) rotate r scale s
 * order: trans -> rot CW(paper center) -> scale(paper center)
 */
ENV.getTransformMatrix=function(pArr) {
	let cpw=ENV.window.SIZE.width;
	let cph=ENV.window.SIZE.height;

	let transCX=-ENV.paperSize.width/2;
	let transCY=-ENV.paperSize.height/2;

	let rot=pArr[2]/180*Math.PI;
	let rotS=Math.sin(rot);
	let rotC=Math.cos(rot);
	let scale=pArr[3];
	let flip=ENV.window.flip? -1:1;

	let transWX=cpw/2+pArr[0];
	let transWY=cph/2+pArr[1];

	let c=-scale*rotS;
	let d=scale*rotC;
	let a=d*flip;
	let b=-c*flip;

	let e=transCX+transWX;
	let f=transCY+transWY;
	return [a,b,c,d,e,f];
}

/**
 * Update transform animation control
 */
ENV.fireTransformAnimation=function(pArr) {
	this._animationEndResolve=null;
	const animationEndPromise=new Promise(res=>{
		ENV.fireTransformAnimation._animationEndResolve=res;
	});
	// If previous animation not ended (Promise not resolved)
	// discard directly, won't cause memory leak (with browser GC)


	let anim=ENV.window._transAnimation;
	if(!ENV.displaySettings.enableTransformAnimation) { // no animation
		let mat=ENV.getTransformMatrix(pArr)
		let matrixStr="matrix("+mat[0]+","+mat[1]+","+mat[2]+","+mat[3]+","+mat[4]+","+mat[5]+")";
		anim.target=pArr;
		anim.start=pArr;
		anim.now=pArr;
		anim.process=1;
		if(ENV.browserInfo.gecko){ // box-shadow limit for firefox
			$("#canvas-container").css({
				"transform": matrixStr, // transform
				"box-shadow": "0px 0px "
					+Math.min(64/anim.now[3],300/window.devicePixelRatio)
					+"px #00000088" // shadow size
			});

		}
		else{
			$("#canvas-container").css({
				"transform": matrixStr, // transform
				"box-shadow": "0px 0px "
					+(64/anim.now[3])
					+"px #00000088" // shadow size
			});
		}
		ENV.fireTransformAnimation._animationEndResolve();
		ENV.fireTransformAnimation._animationEndResolve=null; // release
		return animationEndPromise;
	}
	anim.target=pArr;
	anim.start=anim.now;
	anim.process=0;
	if(!anim.isAnimationFired) { // no animation at present
		anim.isAnimationFired=true;
		requestAnimationFrame(ENV._transformAnimation);
	}
	return animationEndPromise;
}

ENV._transformAnimation=function(timestamp) { // timestamp in ms
	let anim=ENV.window._transAnimation;
	let p=anim.process; // deal with animation effect
	if(p<1-1E-6) { // continue animation, double check for unintentional fire
		let nowTime=timestamp;
		if(anim.lastTime>0) { // there's last animation
			PERFORMANCE.animationFpsCounter.submit(nowTime-anim.lastTime);
		}
		anim.lastTime=nowTime;

		let tP=anim.target;
		let sP=anim.start;
		let targetFPS=PERFORMANCE.animationFpsCounter.fps.clamp(30,240);
		let animSpeed=1;
		if(CURSOR.isDown){ // for certain applications, speed up animation
			if(CURSOR.nowActivity=="pan-paper"){
				animSpeed=10;
			}
			else if(CURSOR.nowActivity=="rotate-paper"){
				animSpeed=4;
			}
			else if(CURSOR.nowActivity=="rotate-zoom-paper"){
				animSpeed=6;
			}
		}
		let nextFps=targetFPS/animSpeed;
		let step=1/(anim.time*nextFps);
		p+=step;
		if(p>1) p=1; // end
		anim.process=p;
		// interpolate by p
		let q=1-p;
		q*=q; // (1-p)^2
		q=1-q*q; // 4th order 1-(1-p)^4

		let newP=pArrInterpolate(sP,tP,q);
		anim.now=newP;
		let newM=ENV.getTransformMatrix(newP);
		let matrixStr="matrix("+newM[0]+","+newM[1]+","+newM[2]+","+newM[3]+","+newM[4]+","+newM[5]+")";
		if(ENV.browserInfo.gecko){
			$("#canvas-container").css({
				"transform": matrixStr, // transform
				"box-shadow": "0px 0px "
					+Math.min(64/anim.now[3],300/window.devicePixelRatio)
					+"px #00000088" // shadow size
			});

		}
		else{
			$("#canvas-container").css({
				"transform": matrixStr, // transform
				"box-shadow": "0px 0px "
					+(64/anim.now[3])
					+"px #00000088" // shadow size
			});
		}
		//console.log(matrixStr);
		if(DRAG.setNewPaperPoints&&DRAG.mode!="none"){ // update dragger layer
			DRAG.updateUI(anim.now);
		}

		if(p<0.999999) { // request new frame
			// NOTE: this does not need to follow ENV.displaySettings.maxFPS
			// as if it is too slow, the system will require cancelling the animation
			requestAnimationFrame(ENV._transformAnimation);
		}
		else {
			anim.lastTime=0; // cancel timer
			anim.isAnimationFired=false; // cancel animation
			ENV.fireTransformAnimation._animationEndResolve(); // end
			ENV.fireTransformAnimation._animationEndResolve=null; // release
		}
	}
}

// linear interpolation by k: (1-k)p1+kp2, special notice on angle and scale
function pArrInterpolate(p1,p2,k) {
	let x=(p2[0]-p1[0])*k+p1[0];
	let y=(p2[1]-p1[1])*k+p1[1];

	// angle interpolation around a circle
	let d1=p1[2],d2=p2[2];
	let dD=(d2-d1)%360;
	if(dD<0) dD+=360;
	if(dD>180) { // CCW
		dD-=360; // -180<dD<0
	}
	let r=d1+dD*k;

	// scale interpolation using log scale (X) causes trembling
	// let sL1=Math.log(p1[3]);
	// let sL2=Math.log(p2[3]);
	// let s=Math.exp((sL2-sL1)*k+sL1);
	let sL1=p1[3];
	let sL2=p2[3];
	let s=(sL2-sL1)*k+sL1;

	return [x,y,r,s];
}

// =================== Work Indicator ======================

function polarToCartesian(centerX,centerY,radius,deg) {
	let rad=(deg-90)*Math.PI/180.0;
	return {
		x: centerX+radius*Math.cos(rad),
		y: centerY+radius*Math.sin(rad)
	};
}

function describeSVGArc(x,y,radius,startAngle,endAngle) {
	let start=polarToCartesian(x,y,radius,endAngle);
	let end=polarToCartesian(x,y,radius,startAngle);

	let largeArcFlag=endAngle-startAngle<=180? "0":"1";
	let d=["M",start.x,start.y,"A",radius,radius,0,largeArcFlag,0,end.x,end.y];
	return d.join(" ");
}

/**
 * Task Counter for foreground & background tasks
 * call ENV.taskCounter.startTask()/finishTask() to update the indicator
 * read ENV.taskCounter.isTryingToAbort to see if user is trying to abort a task
 * call ENV.taskCounter.isWorking() to see if there is a task working
 */
ENV.taskCounter={};
ENV.taskCounter.init=function(){
	const tc=ENV.taskCounter;
	tc.foregroundTaskCnt=0;
	tc.backgroundTaskCnt=0;
	tc.foregroundTaskCompleted=0;
	tc.backgroundTaskCompleted=0;

	tc.taskInfoRecorder=new Map();

	tc.isTryingToAbort=false; // a sign indicating if user is trying to abort
	$("#front-info-indicator").on("pointerdown",e=>{
		tc.isTryingToAbort=true;
	});
	ENV.taskCounter._updateIndicator(); // reset indicator ui
	CURSOR.setBusy(false); // reset busy status
}

ENV.taskCounter._updateIndicator=function(){
	const tc=ENV.taskCounter;
	if(tc.foregroundTaskCnt){ // there's foreground task
		const angle=tc.foregroundTaskCompleted/tc.foregroundTaskCnt*359.9;
		$("#front-info-indicator").css("display","block");
		$("#work-indicator-arc-background").attr("stroke","#cc673533");
		$("#work-indicator-arc").attr({
			"stroke":"#cc6735",
			"d":describeSVGArc(50,50,40,0,angle)
		});
		$("#work-indicator-abort-button").attr({ // show abort button
			"stroke":"#cc6735",
			"opacity":"1"
		});
		$("#front-info-panel").css("pointer-events","auto"); // allow clicking
	}
	else if(tc.backgroundTaskCnt){ // there's background task
		const angle=tc.backgroundTaskCompleted/tc.backgroundTaskCnt*359.9;
		$("#front-info-indicator").css("display","block");
		$("#work-indicator-arc-background").attr("stroke","#3398ca33");
		$("#work-indicator-arc").attr({
			"stroke":"#3398ca",
			"d":describeSVGArc(50,50,40,0,angle)
		});
		$("#work-indicator-abort-button").attr({
			"stroke":"#3398ca",
			"opacity":"0"
		});
		$("#front-info-panel").css("pointer-events","none");
	}
	else{
		$("#front-info-indicator").css("display","none");
		$("#front-info-panel").css("pointer-events","none");
	}
}

ENV.taskCounter.startTask=function(taskKind,taskInfo){ // 0: background, else: foreground
	const tc=ENV.taskCounter;
	if(taskKind){ // foreground
		if(!tc.foregroundTaskCnt){ // start to have busy tasks
			CURSOR.setBusy(true);
			PERFORMANCE.idleTaskManager.startBusy();
		}
		tc.foregroundTaskCnt++;
	}
	else{
		tc.backgroundTaskCnt++;
	}
	tc._updateIndicator();

	if(taskInfo){
		const cnt=tc.taskInfoRecorder.get(taskInfo)||0;
		tc.taskInfoRecorder.set(taskInfo,cnt+1);
	}
}

ENV.taskCounter.finishTask=function(taskKind,taskInfo){ // 0: background, else: foreground
	const tc=ENV.taskCounter;
	
	if(taskKind){ // foreground
		tc.foregroundTaskCompleted++;
		if(tc.foregroundTaskCompleted>=tc.foregroundTaskCnt){ // reset
			tc.foregroundTaskCnt=0;
			tc.foregroundTaskCompleted=0;
			tc.isTryingToAbort=false;
			CURSOR.setBusy(false);
			PERFORMANCE.idleTaskManager.startIdle();
		}
	}
	else{
		tc.backgroundTaskCompleted++;
		if(tc.backgroundTaskCompleted>=tc.backgroundTaskCnt){ // reset
			tc.backgroundTaskCnt=0;
			tc.backgroundTaskCompleted=0;
			tc.isTryingToAbort=false;
		}
	}
	tc._updateIndicator();

	if(taskInfo){
		const cnt=tc.taskInfoRecorder.get(taskInfo)||0;
		if(cnt<=1){ // all dealt
			tc.taskInfoRecorder.delete(taskInfo);
		}
		else{
			tc.taskInfoRecorder.set(taskInfo,cnt-1);
		}
	}
}

ENV.taskCounter.isWorking=function(){
	return !!(ENV.taskCounter.foregroundTaskCnt||ENV.taskCounter.backgroundTaskCnt);
}
ENV.taskCounter.printStatus=function(){
	const tc=ENV.taskCounter;
	let info="Foreground Task: "+tc.foregroundTaskCnt
		+", Background Task: "+tc.backgroundTaskCnt+"\n";
	for(const [taskInfo,cnt] of tc.taskInfoRecorder){
		info+="\t"+taskInfo+" - "+cnt+"\n";
	}
	console.log(info);
}

ENV.debug=function() {
	//$("#work-indicator-arc").attr("d",describeSVGArc(50,50,40,0,359));
}