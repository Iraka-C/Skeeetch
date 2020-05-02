/**
 * Transform Animation
 */


/**
 * get transform matrix [a,b,c,d,e,f] from pArr = [x,y,r,s]
 * translate (x,y) rotate r scale s
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
	let anim=ENV.window._transAnimation;

	if(!ENV.displaySettings.enableTransformAnimation) { // no animation
		let mat=ENV.getTransformMatrix(pArr)
		let matrixStr="matrix("+mat[0]+","+mat[1]+","+mat[2]+","+mat[3]+","+mat[4]+","+mat[5]+")";
		anim.target=pArr;
		anim.start=pArr;
		anim.now=pArr;
		anim.process=1;
		$("#canvas-container").css({ // set style
			"transform": matrixStr, // transform
			"box-shadow": "0px 0px "+(4/anim.now[3])+"em #808080" // shadow size
		});
		CANVAS.requestRefresh(); // update canvas anti-aliasing
		return;
	}
	anim.target=pArr;
	anim.start=anim.now;
	anim.process=0;
	if(!anim.isAnimationFired) { // no animation at present
		anim.isAnimationFired=true;
		requestAnimationFrame(ENV._transformAnimation);
	}
}
ENV._transformAnimation=function() {
	let anim=ENV.window._transAnimation;
	let p=anim.process; // deal with animation effect
	if(p<1-1E-6) { // continue animation, double check for unintentional fire
		let nowTime=Date.now();
		if(anim.lastTime>0) { // there's last animation
			PERFORMANCE.submitFpsStat(nowTime-anim.lastTime);
		}
		anim.lastTime=nowTime;

		let tP=anim.target;
		let sP=anim.start;
		// if shift pressed, run animation 10x faster to reduce latency on dragging
		let targetFPS=PERFORMANCE.fpsCounter.fps.clamp(60,240);
		let nextFps=targetFPS/(CURSOR.nowActivity=="pan-paper"&&CURSOR.isDown? 10:1);
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
		$("#canvas-container").css({
			"transform": matrixStr, // transform
			"box-shadow": "0px 0px "+(4/anim.now[3])+"em #808080" // shadow size
		});
		CANVAS.requestRefresh(); // update canvas anti-aliasing

		//console.log(matrixStr);

		if(p<1-1E-6) { // request new frame
			requestAnimationFrame(ENV._transformAnimation);
		}
		else {
			anim.lastTime=0; // cancel timer
			anim.isAnimationFired=false; // cancel animation
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

	// scale interpolation using log scale
	let sL1=Math.log(p1[3]);
	let sL2=Math.log(p2[3]);
	let s=Math.exp((sL2-sL1)*k+sL1);

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

ENV.taskCounter={};
ENV.taskCounter.init=function(){
	const tc=ENV.taskCounter;
	tc.foregroundTaskCnt=0;
	tc.backgroundTaskCnt=0;
	tc.foregroundTaskCompleted=0;
	tc.backgroundTaskCompleted=0;
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
	}
	else if(tc.backgroundTaskCnt){ // there's background task
		const angle=tc.backgroundTaskCompleted/tc.backgroundTaskCnt*359.9;
		$("#front-info-indicator").css("display","block");
		$("#work-indicator-arc-background").attr("stroke","#3398ca33");
		$("#work-indicator-arc").attr({
			"stroke":"#3398ca",
			"d":describeSVGArc(50,50,40,0,angle)
		});
	}
	else{
		$("#front-info-indicator").css("display","none");
	}
}

ENV.taskCounter.startTask=function(taskKind){ // 0: background, else: foreground
	const tc=ENV.taskCounter;
	if(taskKind){ // foreground
		tc.foregroundTaskCnt++;
	}
	else{
		tc.backgroundTaskCnt++;
	}
	tc._updateIndicator();
}

ENV.taskCounter.finishTask=function(taskKind){ // 0: background, else: foreground
	const tc=ENV.taskCounter;
	
	if(taskKind){ // foreground
		tc.foregroundTaskCompleted++;
		if(tc.foregroundTaskCompleted>=tc.foregroundTaskCnt){ // reset
			tc.foregroundTaskCnt=0;
			tc.foregroundTaskCompleted=0;
		}
	}
	else{
		tc.backgroundTaskCompleted++;
		if(tc.backgroundTaskCompleted>=tc.backgroundTaskCnt){ // reset
			tc.backgroundTaskCnt=0;
			tc.backgroundTaskCompleted=0;
		}
	}
	tc._updateIndicator();
}

ENV.debug=function() {
	//$("#work-indicator-arc").attr("d",describeSVGArc(50,50,40,0,359));
}