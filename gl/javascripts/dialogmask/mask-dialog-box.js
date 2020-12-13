DIALOGBOX={
	nowItem: null // now dialog box item
};

DIALOGBOX.init=function(){
	const $ui=$("#body-mask-panel");
	$ui.empty();
}

DIALOGBOX.show=function(dialogBoxItem){
	if(DIALOGBOX.nowItem){ // chain this box
		DIALOGBOX.nowItem.append(dialogBoxItem);
		return;
		//throw new Error("Try to show dialog when Dialog Box Occupied!");
	}
	const $ui=$("#body-mask-panel");
	$ui.append(dialogBoxItem.$ui);
	DIALOGBOX.nowItem=dialogBoxItem;
	$ui.fadeIn(250);
};

DIALOGBOX._change=function(dialogBoxItem){
	const $ui=$("#body-mask-panel");
	$ui.empty();
	$ui.append(dialogBoxItem.$ui);
	DIALOGBOX.nowItem=dialogBoxItem;
}

DIALOGBOX.clear=function(){
	const $ui=$("#body-mask-panel");
	$ui.fadeOut(400,e=>{
		$ui.empty();
		DIALOGBOX.nowItem=null;
	});
};

/**
 * an item that can be used to create dialog boxes
 * buttonArr=[{
 *    text: text in the button,
 *    callback: (form)=>{}, called when pressed
 * }, ...]
 */
class DialogBoxItem{
	constructor($uiArr,buttonArr){
		this.$ui=$("<div class='dialog-box-container'>");
		this.$form=$("<div class='dialog-box-form'>");
		this.$buttonPanel=$("<div class='dialog-box-button-panel'>");
		this._next=null; // next item to activate

		for(const $ui of $uiArr){
			this.$form.append($ui);
		}
		for(const button of buttonArr){
			const $b=DialogBoxItem._button(button.text);
			$b.click(e=>{
				if(button.callback){
					button.callback(this._getForm());
				}
				if(this._next){ // there's another box, maybe AFTER callback
					DIALOGBOX._change(this._next);
				}
				else{
					DIALOGBOX.clear();
				}
			});
			this.$buttonPanel.append($b);
		}

		this.$ui.append(this.$form,this.$buttonPanel);
	}

	_getForm(){
		const form=[];
		for(const item of this.$form.children()){
			if(item instanceof HTMLInputElement){
				form.push({
					name: item.name,
					value: item.value
				});
			}
		}
		return form;
	}

	append(dialogBoxItem){ // append a dialog box item to show after this
		let p=this;
		while(p._next){
			p=p._next;
		}
		p._next=dialogBoxItem;
	}

	/**
	 * get a new input box
	 * @param {*} option {
	 *    isPassword: true/false, is this a password box
	 *    name: input box name
	 * }
	 */
	static inputBox(option){
		const $input=$("<input class='dialog-box-input' maxLength='256'>"); // size overwritten with css
		$input.attr({
			"type": option.isPassword?"password":"text",
			"name": option.name
		});
		return $input;
	}

	static textBox(option){
		const $text=$("<div class='dialog-box-text'>");
		$text.text(option.text);
		return $text;
	}

	static _button(text){
		const $button=$("<div class='dialog-box-button'>");
		$button.text(text);
		return $button;
	}
}