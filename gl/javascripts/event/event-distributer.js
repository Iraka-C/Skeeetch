EventDistributer={};

EventDistributer.init=function(){
	EventDistributer.wheel._init();
	EventDistributer.button._init();
}

/**
 * addListener($DOMElement, callback)
 * callback function format: callback(wheelchange)
 * wheelchange: +1, 0, -1
 */
EventDistributer.wheel={
	_init:function(){
		//window.addEventListener("wheel",EventDistributer.wheel._onwheel,false);
	},
	_nowListener:null, // a DOM Object
	_nowFunction:()=>{}, // a function
	/**
	 * callback(wY,wX): change on x & y: scroll up = +1, scroll down = -1
	 */
	addListener:function($element,callback){ // $element is a jQuery Object
		let el=$element[0];
		// The only hack: Deal with record during capture stage
		el.addEventListener("pointerover",event=>{
			//console.log("over",event.target);
			EventDistributer.wheel._nowListener=el;
			EventDistributer.wheel._nowFunction=callback;
		},true);
		// to deal with multiple pointers (e.g. mouse+pen) and when only one pointer's out
		el.addEventListener("pointermove",event=>{
			EventDistributer.wheel._nowListener=el;
			EventDistributer.wheel._nowFunction=callback;
		},true);
		el.addEventListener("pointerout",event=>{ // pointerup pointercancel?
			EventDistributer.wheel._nowListener=null;
			//console.log("out",event.pointerType);
		},true);
		el.onwheel=EventDistributer.wheel._onwheel;
	},
	_onwheel:function(event){
		if(EventDistributer.wheel._nowListener&&EventDistributer.wheel._nowFunction){
			let e=event;//.originalEvent;
			let dx=e.deltaX;
			let dy=e.deltaY;
			let wX=dx<0?1:dx>0?-1:0;
			let wY=dy<0?1:dy>0?-1:0;
			EventDistributer.wheel._nowFunction(wY,wX); // Y first
			event.stopPropagation(); // prevent scrolling
		}
		return false;
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
		let origin={};
		let initVal={};
		$element.css("touch-action","none"); // prevent touch action on dragging
		$element.on("pointerdown",event=>{
			const e=event.originalEvent;
			initVal=initFunc();
			origin={x:e.clientX,y:e.clientY};
			el.setPointerCapture(e.pointerId); // fix pointer to this element
			isDown=true;
			if(downFunc)downFunc();
		});
		$element.on("pointermove",event=>{ // call callback when down
			if(!isDown||!(event.originalEvent.buttons&0x1)){
				// pointer isn't down or isn't left button
				return;
			}
			const e=event.originalEvent;
			const dx=e.clientX-origin.x;
			const dy=e.clientY-origin.y;
			callback({x:dx,y:dy,initVal:initVal});
		});
		$element.on("pointerup pointercancel",event=>{
			const e=event.originalEvent;
			el.releasePointerCapture(e.pointerId); // release pointer from this element
			origin={};
			initVal={};
			isDown=false;
			if(upFunc)upFunc();
		});
	}
};

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

// ========= Another verision of button ===========
// A button that can detect down-and-drag to its outside
/**
 * addListener($DOMElement, callback)
 * callback function format: callback(pointerchange)
 * pointerchange: {dx,dy} in pixel
 */
// EventDistributer.button={
// 	// @TODO: Buggy! What if multitouch?
// 	// @TODO: Buggy! moving from one div to another while pressing also changes listener target
// 	_init:function(){
// 		$(window).on("pointermove",EventDistributer.button._onpointermove);
// 		$(window).on("pointerup pointercancel",EventDistributer.button._onpointerup);
// 	},
// 	_nowPointerID: -1,
// 	isDragging:false,
// 	_origin:{x:NaN,y:NaN},
// 	_nowListener:null, // a DOM Object
// 	_nowFunction:()=>{}, // a function
// 	_nowInitValue:null,
// 	addListener:function($element,callback,initFunc){ // $element is a jQuery Object
// 		let el=$element[0];
// 		el.addEventListener("pointerdown",event=>{
// 			console.log("down");
			
// 			EventDistributer.button._nowPointerID=event.originalEvent.pointerId;
// 			EventDistributer.button._nowListener=el;
// 			EventDistributer.button._nowFunction=callback;
// 			EventDistributer.button._nowInitValue=initFunc();
// 			EventDistributer.button._origin={x:event.clientX,y:event.clientY};
// 			EventDistributer.button.isDragging=true;
// 		},true);
// 	},
// 	_onpointermove:function(event){ // send the {dx,dy}
	
// 		console.log("move");
// 		if(EventDistributer.button._nowListener&&EventDistributer.button._nowFunction){
// 			// There is a pointer down
// 			// @TODO: disable drawing when dragging here
// 			let e=event.originalEvent;
// 			let dx=e.clientX-EventDistributer.button._origin.x;
// 			let dy=e.clientY-EventDistributer.button._origin.y;
// 			EventDistributer.button._nowFunction({x:dx,y:dy,initVal:EventDistributer.button._nowInitValue});
// 		}
// 	},
// 	_onpointerup:function(event){
		
// 		console.log("up");
// 		EventDistributer.button._nowListener=null;
// 		EventDistributer.button._origin={x:NaN,y:NaN};
// 		EventDistributer.button._nowInitValue={};
// 		EventDistributer.button.isDragging=false;
// 	}
// };
// ============= END ============

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
 * key is a character (string)
 * funcKey=[isCtrl,isShift,isAlt]
 * isPreventDefault: if there is a default action of the browser, prevent it
 * 
 * //@TODO: simplify "keydown" binding
 * At present, there are listeners as much as the number of hotkeys
 * Simplify them to one for each element?
 */
EventDistributer.key={
	_init:function(){
	},
	addListener:function(key,callback,isPreventDefault){
		// notice left/right: KeyboardEvent.DOM_KEY_LOCATION_STANDARD

		let keys=key.toLowerCase().split("+");
		let funcKey=[
			keys.indexOf("ctrl")>=0, // Ctrl
			keys.indexOf("shift")>=0, // Shift
			keys.indexOf("alt")>=0 // Alt
		];
		let code=keys[keys.length-1];

		if(isPreventDefault===undefined){ // init: true
			isPreventDefault=true;
		}
		$(window).on("keydown",event=>{
			if(event.originalEvent.key.toLowerCase()==code){ // check keycode
				const ek=EVENTS.key;
				if(ek.ctrl==funcKey[0]&&ek.shift==funcKey[1]&&ek.alt==funcKey[2]){ // the key combination
					callback(event);
					if(isPreventDefault){ // only prevent default after executing
						event.preventDefault();
					}
				}
			}
		});
	}
}