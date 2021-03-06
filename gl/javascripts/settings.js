"use strict";
class SettingManager{
	// Add a setting table named "name" to frame
	constructor($outerFrame,name){
		const $frame=$("<div class='menu-scroll-wrapper'>");
		this.$frame=$frame;
		this._updateFuncList=[];
		this.tempVal=null;

		this.onMenuOpenFunc=null;
		this.onMenuCloseFunc=null;
		this.swipeDir=null;
		this.swipeHandler=null;

		let colgroup=$("<colgroup>");
		colgroup.append($("<col class='setting-item-name'>"));
		colgroup.append($("<col class='setting-item-symbol'>"));
		colgroup.append($("<col class='setting-item-value'>"));
		colgroup.append($("<col class='setting-item-unit'>"));

		let title=$("<th colspan='4'>"+name+"</th>");
		let titleRow=$("<tr>").append(title);
		let thead=$("<thead>").append(titleRow);

		let table=$("<table class='setting-table'>");
		table.append(colgroup,thead,"<tbody>");
		let container=$("<div class='setting-table-container'>");
		container.append(table);
		$frame.append(container);

		// Set outer frame properties
		// set a button to control the expansion
		$outerFrame.append($frame);
		$outerFrame.addClass("setting-panel");
		this.isExpanded=()=>{ // is this setting panel expanded?
			return !$outerFrame.hasClass("setting-panel-collapsed");
		}
		this.toggleExpand=()=>{
			if($outerFrame.hasClass("setting-panel-collapsed")){ // not opened
				if(this.onMenuOpenFunc){
					this.onMenuOpenFunc();
				}
				this.update();
				$outerFrame.removeClass("setting-panel-collapsed");
			}
			else{ // opened
				if(this.onMenuCloseFunc){
					this.onMenuCloseFunc();
				}
				$outerFrame.addClass("setting-panel-collapsed");
			}
		};
	}
	// Calls when opening this setting panel
	update(){
		for(let func of this._updateFuncList){
			func();
		}
	}
	// Assign a button to expand / collapse this setting panel
	setOpenButton($div){
		EventDistributer.setClick($div,e=>{
			this.toggleExpand();
		});
	}

	onMenuOpen(func){
		this.onMenuOpenFunc=func;
	}
	onMenuClose(func){
		this.onMenuCloseFunc=func;
	}
// ====================== UI Management ========================
	// Add a section with the name title
	addSectionTitle(title){
		const $block=$("<td colspan='4' class='section-title'>"+title+"</td>");
		this.$frame.find("tbody").append($("<tr>").append($block));
		return $block;
	}
	// Add a numerical setting item where it calls callback instantly on changing the value
	// checkFunction returns true for success, or a string for warning
	// updateFunc()=>val is a function to provide a value to upate the setting panel everytime SettingManager.update() is called
	// valFunc provides how to refresh the display
	addInstantNumberItem(name,valFunc,unit,inputUpdateFunc,scrollUpdateFunc,dragUpdateFunc){
		let $input=$("<input class='value' value='' type='text' maxLength='20' size='5'/>");
		
		let $row=$("<tr class='hoverable'>").append(
			$("<td>"+name+"</td>"),
			$("<td>&gt;</td>"),
			$("<td class='value-container'>").append($input),
			$("<td class='unit'>"+unit+"</td>")
		);

		this.$frame.find("tbody").append($row);
		let _updateFunc=function(param){
			if(param=="input"){
				return $input;
			}
			if(param=="row"){
				return $row;
			}
			if(valFunc){
				const val=valFunc();
				if(typeof(val)!="string"&&isNaN(val)){ // invalid: hide
					$row.css("display","none");
				}
				else{ // a value returned: show
					$row.css("display","table-row");
					$input.val(val);
				}
			}
		}
		SettingManager.setInputInstantNumberInteraction(
			$input,$row,inputUpdateFunc,scrollUpdateFunc,dragUpdateFunc,_updateFunc);
		
		this._updateFuncList.push(_updateFunc);
		return _updateFunc;
	}
	/**
	 * Set an $input element to be modified on input/drag/scroll and changes instantly
	 * $input: the input element to be controlled
	 * $parent: the controller on scroll or drag
	 * 
	 * ** The callback functions
	 * inputUpdateFunc(newVal): try to update corresponding variable to newVal while input completed, return updated value
	 * ** MUST provide inputUpdateFunc!
	 * scrollUpdateFunc(dWheel, oldVal): try to update corresponding variable by dWheel (+1/0/-1), return updated value
	 * dragUpdateFunc(dx, oldVal): try to update corresponding variable by dx mouse move, return updated value
	 *    Provide oldVal before clicking for precision reference (Optional)
	 * 
	 * scrollUpdateFunc/dragUpdateFunc .target: the scrolling or dragging target $ui object
	 */
	static setInputInstantNumberInteraction($input,$parent,inputUpdateFunc,scrollUpdateFunc,dragUpdateFunc,_updateFunc){
		$parent=$parent||$input; // if no parent provided, then set itself as the trigger element
		if(inputUpdateFunc){ // check the value on change
			$input.on("change",event=>{ // Input
				let val=$input.val();
				if(inputUpdateFunc){ // Must!
					inputUpdateFunc(val);
				}
				_updateFunc();
			});
		}
		else{ // disable the input
			$input[0].disabled="true";
		}
		$input.on("select",event=>{ // No selection - conflict wuth drag action
			event.preventDefault();
			const v=$input[0];
			v.selectionStart=v.selectionEnd;
		});
		const scrollTgt=scrollUpdateFunc.target?scrollUpdateFunc.target:$input;
		EventDistributer.wheel.addListener(scrollTgt,dw=>{ // Scroll on ONLY input by default
			let val=$input.val();
			if(scrollUpdateFunc){
				scrollUpdateFunc(dw,val);
			}
			_updateFunc();
		});
		const dragTgt=dragUpdateFunc.target?dragUpdateFunc.target:$parent;
		EventDistributer.button.addListener(dragTgt, // Drag on parent by default
			dP=>{ // Drag
				if(dragUpdateFunc){
					const dS=dP.x-dP.y; // right/up: ++
					dragUpdateFunc(dS,dP.initVal);
				}
				_updateFunc();
			},
			()=>$input.val(), // provide old value
			e=>$input.css("caret-color","transparent"), // when down
			e=>$input.css("caret-color","auto") // when up
		);
	}
	
	// Add a hint under some settings
	addHint(text){
		let hint=$("<td class='setting-hint' colspan='4'>"+text+"</td>");
		this.$frame.find("tbody").append($("<tr>").append(hint));
		let _updateFunc=function(newText){
			// this.update() doesn't change the context or visibility!
			if(newText===undefined){
				return;
			}
			if(newText===null||newText===false){ // invalid value
				hint.fadeOut(250);
			}
			else if(newText===true){ // only show
				hint.fadeIn(250);
			}else{ // change context
				hint.fadeIn(250);
				hint.html(newText);
			}
		}
		this._updateFuncList.push(_updateFunc);
		return _updateFunc;
	}
	// Add a switch with some preset selections
	// callback(selectedID), doesn't need to return a value
	addSwitch(name,valArr,unit,callback,valFunc){
		let toggle=valFunc?valFunc():0;
		let $item=$("<tr class='hoverable'>").append(
			$("<td>"+name+"</td>"),
			$("<td>&gt;</td>")
		);
		if(typeof(unit)=="string"){
			$item.append(
				$("<td class='value'>"+valArr[toggle]+"</td>"),
				$("<td class='unit'>"+unit+"</td>")
			);
		}
		else{
			$item.append($("<td class='value' colspan='2'>"+valArr[toggle]+"</td>"));
		}

		/**
		 * **NOTE** In some browsers, the following listener may be
		 * triggered twice when using a pen. (possibly a bug?)
		 * Add interval restriction to prevent double-clicking
		 * 
		 * Also implemented in setSwitchInteraction()
		 */
		let lastClickTime=-10000;
		$item.on("pointerdown",event=>{
			if(event.timeStamp-lastClickTime>=100){ // 100ms works in tested browsers
				toggle++;
				if(toggle>=valArr.length)toggle-=valArr.length;
				$item.find(".value").text(valArr[toggle]);
				if(callback)callback(toggle);
			}
			event.stopPropagation(); // only click on this switch
		});
		$item.on("pointerup pointercancel",event=>{
			lastClickTime=event.timeStamp; // record the last time pointer leaving the button
		});

		this.$frame.find("tbody").append($item);

		let _updateFunc=function(){
			if(valFunc){
				const val=valFunc();
				if(isNaN(val)){ // not a number: hide this switch
					$item.css("display","none");
				}
				else{
					toggle=val;
					$item.css("display","table-row");
					$item.find(".value").text(valArr[toggle]);
				}
			}
		}
		this._updateFuncList.push(_updateFunc);
		return _updateFunc;
	}

	/**
	 * Set a div as switch / toggle
	 * Click on $parent, change the value of $input
	 * N_ is the number of selections of this switch
	 *    If N_ is a "number" type, auto initialize the switch as start from 0
	 *    If N_ is a {"N":<number>} type, no initialization. Must manually initialize by calling _updateFunc.
	 * 
	 * callback is the function called when toggle value is set (by clicking or _updateFunc)
	 * If you want to specify the action only when clicking:
	 *    clickCallbacks.before is called before toggle change
	 *    clickCallbacks.after is called after toggle change
	 * 
	 * The return value is a function where you can manually control the toggle status.
	 * call the _updateFunc(val) will also trigger callback
	 * Notice you can call with a negative value such as _updateFunc(-1) to set up a leading status before toggling
	 */
	static setSwitchInteraction($el,$parent,N_,callback,clickCallbacks){
		$parent=$parent||$el; // if no parent provided, set as itself
		let toggle=0; // Init as 0;
		const N=typeof(N_)=="number"?N_:N_.N;
		function setVal(v){ // set the status of this switch as v
			toggle=Math.round(v)%N;
			if(callback)callback($el,toggle);
		};
		if(typeof(N_)=="number"){
			setVal(0); // Init target as 0
		}

		/**
		 * **NOTE** In some browsers, the following listener may be
		 * triggered twice when using a pen. (possibly a bug?)
		 * Add interval restriction to prevent double-clicking
		 */
		let lastClickTime=-10000;
		$parent.on("pointerdown",event=>{
			if(event.timeStamp-lastClickTime>=100){ // not too near
				if(clickCallbacks&&clickCallbacks.before)clickCallbacks.before(toggle);
				setVal(toggle+1); // call next selection
				if(clickCallbacks&&clickCallbacks.after)clickCallbacks.after(toggle);
			}
			event.stopPropagation();
		});
		$parent.on("pointerup pointercancel",event=>{
			lastClickTime=event.timeStamp; // record the last time pointer leaving the button
		});

		const _updateFunc=function(v){
			if(typeof(v)=="number"){
				setVal(v);
			}
		}
		return _updateFunc;
	}
	// Add an info frame to show some data
	// valFunc()=>v called when opening this setting
	addInfo(name,unit,valFunc){
		let item=$("<tr>").append(
			$("<td>"+name+"</td>"),
			$("<td>&gt;</td>")
		);
		if(typeof(unit)=="string"){
			item.append(
				$("<td class='value'></td>"),
				$("<td class='unit'>"+unit+"</td>")
			);
		}
		else{
			item.append($("<td class='value' colspan='2'>"+unit+"</td>"));
		}
		let _updateFunc=function(){
			if(valFunc){
				const val=valFunc(v=>{ // async ver
					item.find(".value").text(v);
				})
				if(!isNaN(val)){ // sync ver
					item.find(".value").text(val);
				}
			}
		}
		this._updateFuncList.push(_updateFunc);
		this.$frame.find("tbody").append(item);
	}
	// Add a single click button with callback
	addButton(text,callback){
		const $button=$("<div class='setting-button'>"+text+"</div>");
		const $buttonField=$("<td colspan='4' class='setting-button-container'></td>");
		$buttonField.append($button);
		$button.on("click",event=>callback?callback():null);
		const $row=$("<tr>").append($buttonField);
		this.$frame.find("tbody").append($row);
		return isShown=>{ // update function
			if(isShown==undefined){ // provide button div
				return $button;
			}
			if(isShown){
				$row.css("display","table-row");
			}
			else{
				$row.css("display","none");
			}
		};
	}

	/**
	 * add a row of buttons
	 * @param {Array} option an array of
	 * {
	 *    $element {String}: button content (jQuery element)
	 *    callback {Function}: callback function when clicked
	 * }
	 */
	addButtonRow(option){
		// the area to place buttons
		const $contents=$("<div class='setting-row'>");
		const $rowField=$("<td colspan='4' class='setting-row-field'>").append($contents);

		const N=option.length; // button number
		for(let i=0;i<N;i++){
			const $button=$("<div class='setting-row-button'>");
			$button.append(option[i].$element);
			$button.on("click",option[i].callback);
			$contents.append($button);
		}

		this.$frame.find("tbody").append($("<tr>").append($rowField));
	}

	// @TODO: API detail design
	// Add a setting item group where it calls callback after checked changing the values
	/**
	 * paramArr:[paramGroup, ...], paramGroup={...}
	 */
	addCheckNumberItemGroup(){
	}

	addDiv(){
		const $div=$("<div class='setting-div'>");
		const $divField=$("<td colspan='4'></td>");
		$divField.append($div);
		const $divRow=$("<tr>").append($divField);
		this.$frame.find("tbody").append($divRow);
		return $div;
	}

	//====================== drag/swipe to close ======================
	// swipe to close
	setSwipeDirection(dir){ // dir="none"/null/"left"/"right"
		this.swipeDir=dir;

		let lastVX=0;
		let lastSXOverSpeedTime=0;
		if(!this.swipeHandler){ // init swipe handler
			this.swipeHandler=(dy,dx,event)=>{
				const T=event.timeStamp;
				const vX=Math.abs(EventDistributer.wheel.speed[0]);
				const vY=Math.abs(EventDistributer.wheel.speed[1]);
				
				const threshold=1;
				if(vX>threshold&&Math.abs(lastVX)<=threshold){
					// start to overspeed
					lastSXOverSpeedTime=T;
				}
				else if(vX>threshold&&vX>vY){ // vertical scroll
					// end overspeeding
					const dT=T-lastSXOverSpeedTime;
					if(dT>100){ // over threshold
						const isLeft=lastVX<0;
						if(this.isExpanded()){ // do on this menu first
							if(isLeft&&this.swipeDir=="left"){ // towards left
								console.log("To Left");
								this.toggleExpand();
							}
							else if(!isLeft&&this.swipeDir=="right"){ // towards right
								console.log("To Right");
								this.toggleExpand();
							}
							else{ // also treat as global event
								EVENTS.menuSwipeOperation(isLeft);
							}
						}
						else{
							EVENTS.menuSwipeOperation(isLeft);
						}
						lastSXOverSpeedTime=Infinity; // cancel following
					}
				}
				lastVX=EventDistributer.wheel.speed[0];
			};
			// Do not prevent scrolling on menu
			EventDistributer.wheel.addListener(this.$frame.parent(),this.swipeHandler,false);
		}
	}
}