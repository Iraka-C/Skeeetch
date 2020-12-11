DIALOGBOX={
	nowItem: null // now dialog box item
};

DIALOGBOX.init=function(){
	const $ui=$("#mask-item");
	$ui.empty();
};

/**
 * an item that can be used to create dialog boxes
 * contentArr[i]={
 *    type: "text"|"input"|"input-password",
 *    name: String,
 *    text: String, the hint for input
 *    callback: (on input changed event)=>String:info|null
 * }
 */
class DialogBoxItem{
	constructor(contentArr,buttonArr){
		this.$ui=$("<div class='dialog-box-container'>");

		for(const item of contentArr){
			if(item.type=="input"){ // insert an input
				const $inputUI=DialogBoxItem._$newInputUI(item);
				
			}
		}
	}

	static _$newInputUI(item){
		const $ui=$("<div class='dialog-box-input-container'>");

		const $input=$("<input class='dialog-box-input' maxLength='256' size='18'>"); // size overwritten with css
		$input.attr("type",item.type.indexOf("password")>-1?"password":"text");
		const $info=$("<div class='dialog-box-input-info'>");
		$ui.append($input,$info);
		return $ui;
	}
}