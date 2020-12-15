/**
 * Clipboard operation management
 * TODO: change to Promise type
 */
CLIPBOARD={};

// items is DataTransferList
// async function!
CLIPBOARD.paste=function(items,isSpace){
	function pasteAction(img){
		let lastCopiedInfo=JSON.parse(localStorage.getItem("clipboard"))||{};
		
		if(!(lastCopiedInfo.width==img.width&&lastCopiedInfo.height==img.height)){
			// certainly not the same image
			lastCopiedInfo={}; // discard
			localStorage.removeItem("clipboard"); // clipboard no such data now @TODO: new win clipboard?
		}
		if(isSpace){ // Ctrl+Space+V
			const validArea={...LAYERS.active.rawImageData.validArea};
			if(LAYERS.active instanceof CanvasNode){ // successfully cleared
				if(LAYERS.active.isOpacityLocked()){
					EventDistributer.footbarHint.showInfo(Lang("Cannot replace content: Opacity locked"));
					return; // cannot change opacity
				}
				if(CANVAS.clearAll()){ // contents successfully cleared
					FILES.loadAsImage(img,LAYERS.active,{ // save history in this function
						left: lastCopiedInfo.info.left, // if lastCopiedInfo=={}, then nothing changes
						top: lastCopiedInfo.info.top,
						changedArea: validArea // record the change of whole area
					}); // do not change other props of this layer
				}
				
			}
			else{ // not a CanvasNode
				EventDistributer.footbarHint.showInfo(Lang("Cannot replace content: Not a canvas"));
				return;
			}
		}
		else{ // directly load to new
			FILES.loadAsImage(img,null,lastCopiedInfo.info);
		}
	}

	// TODO: same as file, deal with multiple files
	for(const v in items){
		const item=items[v];
		if(item.kind=="file") {
			const file=item.getAsFile(); // get file object from data transfer object
			if(file.type&&file.type.match(/image*/)) { // an image file
				window.URL=window.URL||window.webkitURL;
				const img=new Image();
				img.src=window.URL.createObjectURL(file);
				img.filename="";
				img.onload=function() {
					pasteAction(this);
				}
				break; // only deal with one
			}
		}
	}
}

// copy to clipboard, imgData is a renderer image data
// imgInfo is optional
// async function!
CLIPBOARD.copy=function(imgData,imgInfo){
	const vArea=imgData.validArea; // copy only valid area
	if(!vArea.width||!vArea.height){ // no contents
		return false;
	}
	// Must be a context2d canvas for Blob
	// copy only valid area
	const canvas=CANVAS.renderer.getContext2DCanvasFromImageData(imgData,vArea);
	//console.log(canvas.width,canvas.height);
	canvas.toBlob(blob => { // Only Context2D can be safely changed into blob
		const item=new ClipboardItem({"image/png":blob});
		navigator.clipboard.write([item]);
	});
	localStorage.setItem("clipboard",JSON.stringify({ // save image info
		info: Object.assign({ // add left/top info
			left: vArea.left,
			top: vArea.top
		},imgInfo),
		width: canvas.width,
		height: canvas.height
	}));
	return true;
}