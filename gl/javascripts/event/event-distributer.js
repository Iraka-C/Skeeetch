"use strict";
const EventDistributer={};

EventDistributer.init=function(){
	EventDistributer.wheel._init();
	EventDistributer.button._init();
	EventDistributer.key._init();
}

/**
 * addListener($DOMElement, callback)
 * callback function format: callback(wheelchange)
 * wheelchange: +1, 0, -1
 */
EventDistributer.wheel={
	_init:function(){
		window.addEventListener("wheel",event=>{ // prevent ANY horizontal action
			updateSpeed(event); // calculate speed
			if(Math.abs(event.deltaY)<Math.abs(event.deltaX)){
				event.preventDefault();
				/**
				 * NOTE: browsers deals differently with preventDefault
				 * Firefox allows default actions before preventing
				 * Safari disables actions if once called preventing
				 * Chrome will report "passive" cannot be prevented
				 */
			}
		},{passive:false});
		EventDistributer.wheel.lineHeight=16; // default 16px per line
		EventDistributer.wheel.threshold=10;//ENV.browserInfo.macOS?5:1;
		EventDistributer.wheel.calcLineHeight(); // calculate once

		// scroll speed monitor
		let lastWheelTime=0;
		function updateSpeed(event){
			const dT=event.timeStamp-lastWheelTime;
			lastWheelTime=event.timeStamp;

			let dX=event.deltaX;
			let dY=event.deltaY;
			if(event.webkitDirectionInvertedFromDevice){
				dX=-dX;
				dY=-dY;
			}
			EventDistributer.wheel.speed=[dX/dT,dY/dT];
		};
	},
	_nowListener:null, // a DOM Object
	_nowFunction:()=>{}, // a function
	_nowPreventDefault:false,
	/**
	 * callback(wY,wX): change on x & y: scroll up = +1, scroll down = -1
	 * by default, prevent default scroll action
	 */
	addListener:function($element,callback,isPreventDefault){ // $element is a jQuery Object
		const el=$element[0];
		const nowPreventDefault=(typeof(isPreventDefault)=="boolean")?isPreventDefault:true;
		// The only hack: Deal with record during capture stage
		el.addEventListener("pointerover",event=>{
			//console.log("over",event.target);
			EventDistributer.wheel._nowListener=el;
			EventDistributer.wheel._nowFunction=callback;
			EventDistributer.wheel._nowPreventDefault=nowPreventDefault;
			EventDistributer.wheel.scrollCnt=[0,0];
		},true);
		// to deal with multiple pointers (e.g. mouse+pen) and when only one pointer's out
		el.addEventListener("pointermove",event=>{
			EventDistributer.wheel._nowListener=el;
			EventDistributer.wheel._nowFunction=callback;
			EventDistributer.wheel._nowPreventDefault=nowPreventDefault;
		},true);
		el.addEventListener("pointerout",event=>{ // pointerup pointercancel?
			EventDistributer.wheel._nowListener=null;
			//console.log("out",event.pointerType);
			EventDistributer.wheel.scrollCnt=[0,0];
		},true);
		el.addEventListener("wheel",EventDistributer.wheel._onwheel,{passive:false});
		// MUST bind this listener on el rather than using window listener
		// So that some default actions could be called/prevented before window handler
		// such as scrolling a div: you can control by yourself
	},
	scrollCnt:[0,0],
	speed: [0,0],
	_overSpeedStart: [Infinity,Infinity],
	overSpeedInterval: [0,0],
	_onwheel:function(e){ // wheel handler

		if(EventDistributer.wheel._nowListener&&EventDistributer.wheel._nowFunction){
			const cnt=EventDistributer.wheel.scrollCnt;
			let deltaX=e.deltaX,deltaY=e.deltaY;
			if(e.deltaMode){
				const lH=EventDistributer.wheel.lineHeight;
				deltaX*=lH;
				deltaY*=lH;
			}
			if(e.webkitDirectionInvertedFromDevice){ // On safari: natural on
				cnt[0]+=deltaX;
				cnt[1]+=deltaY;
			}
			else{ // Win or natural scroll off
				cnt[0]-=deltaX;
				cnt[1]-=deltaY;
			}

			const threshold=EventDistributer.wheel.threshold;
			let wX=0,wY=0; // accumulate the events
			if(cnt[0]>= threshold){wX= 1;cnt[0]=0;}
			if(cnt[0]<=-threshold){wX=-1;cnt[0]=0;}
			if(cnt[1]>= threshold){wY= 1;cnt[1]=0;}
			if(cnt[1]<=-threshold){wY=-1;cnt[1]=0;}
			if(wX||wY){
				EventDistributer.wheel._nowFunction(wY,wX,e); // Y first
			}
			if(EventDistributer.wheel._nowPreventDefault){
				e.preventDefault();
			}
			//e.stopPropagation();
			// propagate this event to window so that it can prevent window default action
		}
	},
	calcLineHeight:function(){
		const el=document.createElement("div");
		Object.assign(el.style,{ // invisible DOM element
			position: "absolute",
			fontSize: "initial", // Supported unless IE
			display: "none"
		});
		document.body.appendChild(el);
		const fontSize=getComputedStyle(el).fontSize;
		document.body.removeChild(el);
		if(fontSize){ // update
			EventDistributer.wheel.lineHeight=parseInt(fontSize);
		}
	}
};

// A button that can detect down-and-drag to its outside
/**
 * addListener($DOMElement, callback)
 * callback function format: callback(pointerchange)
 * pointerchange: {dx,dy} in pixel
 */
EventDistributer.button={
	_init:function(){
	},
	addListener:function($element,callback,initFunc,downFunc,upFunc){ // $element is a jQuery Object
		const el=$element[0];
		let isDown=false;
		let isDragTriggered=false;
		let origin={};
		let initVal={};
		$element.css("touch-action","none"); // prevent touch action on dragging
		$element.on("pointerdown",event=>{
			const e=event.originalEvent;
			initVal=initFunc();
			origin={x:e.clientX,y:e.clientY};
			el.setPointerCapture(e.pointerId); // fix pointer to this element
			isDown=true;
			isDragTriggered=false;
			if(downFunc)downFunc();
			event.stopPropagation();
			//event.preventDefault(); // will prevent focus in Edge
		});
		$element.on("pointermove",event=>{ // call callback when down
			if(!isDown||!(event.originalEvent.buttons&0x1)){
				// pointer isn't down or isn't left button
				return;
			}
			const e=event.originalEvent;
			const dx=e.clientX-origin.x;
			const dy=e.clientY-origin.y;
			if(dx*dx+dy*dy>20){ // moved far
				isDragTriggered=true;
			}

			// trigger after moving from a certain range
			if(isDragTriggered){
				callback({x:dx,y:dy,initVal:initVal});
			}
			event.stopPropagation();
			event.preventDefault(); // prevent scrolling the background div
		});
		$element.on("pointerup pointercancel",event=>{
			const e=event.originalEvent;
			el.releasePointerCapture(e.pointerId); // release pointer from this element
			origin={};
			initVal={};
			isDown=false;
			if(upFunc)upFunc();
			event.stopPropagation();
			event.preventDefault();
		});
	}
};

/**
 * This method differs from $.click is that
 * it won't be affected by dragging-&-release of other element
 * nor by stylus misfire
 */
EventDistributer.setClick=function($element,callback){
	let origin={};
	let isToClick=false;
	$($element).on("pointerdown",event=>{
		const e=event.originalEvent;
		origin={x:e.clientX,y:e.clientY};
		isToClick=true; // ready to click
	});
	$($element).on("pointermove",event=>{
		if(!isToClick)return; // no more click
		const e=event.originalEvent;
		const dx=e.clientX-origin.x;
		const dy=e.clientY-origin.y;
		if(dx*dx+dy*dy>20){ // moved too far
			isToClick=false;
		}
	});
	$($element).on("pointerup pointercancel",event=>{
		if(isToClick){ // not moved
			callback(event);
			isToClick=false; // reset
		}
		origin={};
	});
};

// System hint
// Show a hint from infoFunc() when mouse over $el
EventDistributer.footbarHint=function($el,infoFunc){ // infoFunc put in closure
	$el.on("pointerover",event=>{
		if(EventDistributer.footbarHint.timer){ // clear previous timeout
			clearTimeout(EventDistributer.footbarHint.timer);
			EventDistributer.footbarHint.timer=null;
		}
		EventDistributer.footbarHint.infoFunc=infoFunc; // record this function
		const content=EventDistributer.footbarHint.infoFunc();
		if(content){
			$("#front-info-box").html(content);
			$("#front-info-box").css("opacity","1");
		}
		event.stopPropagation();
	});
	$el.on("pointerout",event=>{
		EventDistributer.footbarHint.infoFunc=null;
		$("#front-info-box").css("opacity","0");
	});
};
EventDistributer.footbarHint.infoFunc=null;
EventDistributer.footbarHint.timer=null;
EventDistributer.footbarHint.update=function(){ // update when environment changes i.e. a key pressed
	if(EventDistributer.footbarHint.infoFunc){ // there's a function registered
		const content=EventDistributer.footbarHint.infoFunc();
		if(content){
			$("#front-info-box").html(content);
		}
	}
};
EventDistributer.footbarHint.showInfo=function(text,time){
	if(EventDistributer.footbarHint.timer){ // clear previous timeout
		clearTimeout(EventDistributer.footbarHint.timer);
		EventDistributer.footbarHint.timer=null;
	}
	EventDistributer.footbarHint.infoFunc=null;
	$("#front-info-box").text(text);
	$("#front-info-box").css("opacity","1");
	EventDistributer.footbarHint.timer=setTimeout(event=>{
		$("#front-info-box").css("opacity","0");
		EventDistributer.footbarHint.timer=null;
	},time||1000);
}

/**
 * keyboard operation, hot keys
 */
EventDistributer.key={
	patterns:[
		/**
		 * each item:
		 * {
		 *    code: keycode like "keya" or "space", "any" for any keycode.
		 *    ctrl, shift, alt,
		 *    callback,
		 *    isPreventDefault
		 * }
		 */
	],
	_init:function(){
		function isKeyDigit(code){
			return (code.length==4&&code.startsWith("key"))||(code.length==6&&code.startsWith("digit"));
		}
		$(window).on("keydown",event=>{
			const code=event.originalEvent.code.toLowerCase();
			const ek=EVENTS.key;
			LOGGING&&console.log("Press: "+code);

			for(const p of EventDistributer.key.patterns){
				if(ek.ctrl==p.ctrl&&ek.shift==p.shift&&ek.alt==p.alt){ // func key matched
					if(p.code==code||(p.code=="any"&&isKeyDigit(code))){ // is this key
						if(p.isPreventDefault){
							event.preventDefault();
						}
						if(!(event.target instanceof HTMLBodyElement)){ // only detect body
							return;
						}
						p.callback(event);
						break;
					}
				}
			}
		});
	},
	/**
	 * Add a hot key callback
	 * @param {String} patternStr something like "ctrl+keyz" or "ctrl+alt+digit0"
	 * @param {()=>{}} callback function to execute when this hot key is fired
	 * @param {Boolean=true} isPreventDefault is to prevent browser action. default: yes
	 * @param {()=>{}} onDetachedCallback function to execute when this hot key is detached (by another binding)
	 */
	addListener:function(patternStr,callback,isPreventDefault,onDetachedCallback){
		// notice left/right: KeyboardEvent.DOM_KEY_LOCATION_STANDARD

		const pattern={
			ctrl: false,
			shift: false,
			alt: false,
			code: ""
		};

		for(const s of patternStr.toLowerCase().split("+")){
			if(s=="ctrl")pattern.ctrl=true;
			else if(s=="shift")pattern.shift=true;
			else if(s=="alt")pattern.alt=true;
			else pattern.code=s;
		}

		if(isPreventDefault===undefined){ // init: true
			isPreventDefault=true;
		}
		pattern.isPreventDefault=isPreventDefault;
		pattern.callback=callback;
		pattern.onDetachedCallback=onDetachedCallback;

		function isKeyDigit(code){
			return (code.length==4&&code.startsWith("key"))||(code.length==6&&code.startsWith("digit"));
		}
		function detachPattern(pt){
			for(let i=0;i<EventDistributer.key.patterns.length;){
				const p=EventDistributer.key.patterns[i];
				if( // same hot key binding
					p.ctrl==pt.ctrl
					&& p.shift==pt.shift
					&& p.alt==pt.alt
					&& (p.code==pt.code||(pt.code=="any"&&isKeyDigit(p.code)))
				){ // remove this binding
					if(p.onDetachedCallback){
						p.onDetachedCallback();
					}
					EventDistributer.key.patterns.splice(i,1);
				}
				else{ // find next one
					i++;
				}
			}
		};
		detachPattern(pattern); // try to detach first
		EventDistributer.key.patterns.push(pattern);

		return ()=>{ // function for detaching
			detachPattern(pattern);
		};
	}
}

// =================== Tool Functions =====================
EventDistributer.isDoubleClicked=(ms)=>(ms>40 && ms<300);