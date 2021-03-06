"use strict";
FILES.fileSelector={};

FILES.fileSelector.init=function(fileManager) {
	const $fileListDiv=fileManager.addDiv();
	$fileListDiv.attr("id","file-selector-container");

	FILES.fileSelector.$container=$fileListDiv;
	FILES.fileSelector.fileManager=fileManager;
	FILES.fileSelector.initSelectorUI();
}
FILES.fileSelector.$uiList={};

// ============== items in file selector ==============
FILES.fileSelector.$newUI=function() {
	let $ui=$("<div class='file-ui'>");

	// thumb container
	let $cvContainer=$("<div class='file-ui-canvas-container'>");
	let $cvBackground=$("<div class='file-ui-canvas-background'>");
	let $cv=$("<canvas class='file-ui-canvas' width='0' height='0'>");
	$cvContainer.append($cvBackground,$cv);

	let $mask=$("<div class='file-ui-mask'>");
	let $indicator=$("<div class='file-ui-indc'>");
	$indicator.append($(`
		<svg viewBox="0 0 100 100" shape-rendering="geometricPrecision" xmlns="http://www.w3.org/2000/svg" version="1.1">
			<circle class="file-indicator-bg" cx="50" cy="50" r="40" stroke="#ffffff44" fill="none" stroke-width="10" />
			<path class="file-indicator-arc" stroke="#cccccc" fill="none" stroke-width="10" stroke-linecap="round" />
		</svg>
	`));

	// name display
	let $nameLabel=$("<div class='file-ui-name-label'>");
	let $buttons=$("<div class='file-ui-buttons'>");
	let infoBlock=$("<div class='file-ui-info'>");
	let dumpDBButton=$("<div class='file-ui-dump-button'>").append(
		$("<img src='./resources/file-dump.svg'/>") // delete button svg
	);
	infoBlock.append(dumpDBButton);

	let deleteButtonOuter=$("<div class='file-ui-delete-button-outer'>"); // for reconfirm the deletion
	let deleteButton=$("<div class='file-ui-delete-button'>").append(
		$("<img src='./resources/file-delete.svg'/>") // delete button svg
	);
	deleteButtonOuter.append(deleteButton);
	EventDistributer.footbarHint(deleteButtonOuter,() => Lang("delete-file"));
	$buttons.append($("<table>").append( // file ui button table 2x1
		$("<tr>").append(
			$("<td>").append(infoBlock),
			$("<td>").append(deleteButtonOuter)
		)
	));
	$buttons.on("click",event=>{
		// only click on button panel, not the ui
		event.stopPropagation(); // do not send click event to $ui (open file)
	});

	// all add to $ui
	$ui.append($cvContainer,$mask,$nameLabel,$buttons,$indicator);
	/** file seletor pen down won't influence dragging (there's no dragging) */
	// $ui.on("pointerdown",event => {
	// 	if(event.originalEvent.pointerType=="pen") { // "drag" doesn't support pointer type
	// 		event.stopPropagation(); // cancel the following "drag" event on pen
	// 	}
	// });

	// preview thumb moving effect
	const setThumbTransform=str => $cv.css("transform",str);
	$ui.on("pointermove",event => { // move thumb image
		let offset=$ui.offset();
		let dx=event.pageX-offset.left,dy=event.pageY-offset.top;
		let w=$ui.width(),h=$ui.height();
		const transformType=$cv.attr("data-transform-type");
		const transformAmount=$cv.attr("data-transform-amount");
		if(transformType=="X") { // perform X transform
			let tx=dx/w;
			setThumbTransform("translateX("+(transformAmount*tx)+"px)");
		}
		else { // perform Y transform
			let ty=dy/h;
			setThumbTransform("translateY("+(transformAmount*ty)+"px)");
		}
	});
	$ui.on("pointerout",event => { // reset thumb image position
		const transformType=$cv.attr("data-transform-type");
		const transformAmount=$cv.attr("data-transform-amount");
		if(transformType=="X") { // perform X transform
			setThumbTransform("translateX("+(transformAmount/2)+"px)");
		}
		else { // perform Y transform
			setThumbTransform("translateY("+(transformAmount/2)+"px)");
		}
	});
	return $ui;
}

FILES.fileSelector.initSelectorUI=function() {
	const idList=[];
	for(const k in STORAGE.FILES.filesStore.fileList) { // for all files
		idList.push({
			id: k,
			time: STORAGE.FILES.filesStore.fileList[k].lastOpenedDate
		});
	}
	idList.sort((a,b) => a.time-b.time); // last opened date ascending order
	for(const item of idList) { // add old (opened) files first
		FILES.fileSelector.addNewFileUIToSelector(item.id);
	}
}

// insert a fileItem UI in FILES.fileSelector.$container (at the front aka. prepend)
// the fileID must be in the STORAGE.FILES.filesStore.fileList
// This function does not care about the thumb canvas update
// order is the order in the selector.
FILES.fileSelector.addNewFileUIToSelector=function(fileID,order) {
	const fileItem=STORAGE.FILES.filesStore.fileList[fileID];
	const $ui=FILES.fileSelector.$newUI();
	FILES.fileSelector.$uiList[fileID]=$ui; // record corresponding $ui element
	$ui.children(".file-ui-name-label").text(fileItem.fileName);
	// const lastOpen=new Date();
	// lastOpen.setTime(fileItem.lastOpenedDate);
	// $ui.find(".file-ui-info").text(lastOpen.toLocaleDateString());
	if(!order){ // 0 or not specified
		FILES.fileSelector.$container.prepend($ui);
	}
	else{
		FILES.fileSelector.$container.children().eq(order-1).after($ui);
	}

	EventDistributer.footbarHint($ui,() => EVENTS.key.shift?fileID: // press shift for fileID
		fileID==ENV.fileID?"": // Already opened
		Lang("selector-open-prefix")+fileItem.fileName
	);
	$ui.on("click",event => { // open this file
		if(fileID==ENV.fileID) return; // same file, no need to open
		if(ENV.taskCounter.isWorking()) return; // there's operation on the present file
		//FILES.fileSelector.fileManager.toggleExpand(); // Don't need to close?
		FILES.fileSelector.openFileWithID(fileID);

		// when open, put $ui to the front
		$ui.detach();
		FILES.fileSelector.$container.prepend($ui);
	});
	const deleteButton=$ui.find(".file-ui-delete-button");
	deleteButton.on("click",event=>{ // try to delete this
		event.stopPropagation(); // do not click on $ui
		if(fileID!=ENV.fileID){ // current not opening
			const item=STORAGE.FILES.filesStore.fileList[fileID];
			const fileName=item.fileName;
			EventDistributer.footbarHint.showInfo(Lang("file-deleting")(fileName));
			delete FILES.fileSelector.$uiList[fileID]; // remove from selector hash
			$ui.remove(); // remove from selector panel
			
			let cloudPromise;
			if(FILES.CLOUD.storage){ // there is a cloud storage available
				cloudPromise=FILES.CLOUD.deleteByHash(item.hash).catch(err=>{ // 404 or ...
					console.warn(err);
				});
			}
			else{
				cloudPromise=Promise.resolve();
			}
			// remove from storage
			Promise.all([STORAGE.FILES.removeFileID(fileID),cloudPromise]).then(()=>{
				EventDistributer.footbarHint.showInfo(fileName+" "+(
					FILES.CLOUD.storage?
					Lang("file-cloud-deleted"):
					Lang("file-deleted")
				));
			});

			// The thumb image of this file will be deleted at the next startup.
			// in STORAGE.FILES.loadAllFileThumbs()
		}
	});
	EventDistributer.footbarHint(deleteButton,() =>{
		if(FILES.CLOUD.storage){
			return Lang("delete-cloud-file-confirm")(fileItem.fileName);
		}
		else{
			return Lang("delete-file-confirm")(fileItem.fileName);
		}
	});

	const dumpButton=$ui.find(".file-ui-dump-button");
	dumpButton.on("click",event=>{ // try to dump db and download
		FILES.saveAsDBFile(fileID);
	});
	EventDistributer.footbarHint(dumpButton,()=>Lang("dump-db-hint"));
}

FILES.fileSelector.openFileWithID=function(fileID) {
	STORAGE.FILES.getUnsavedCheckDialog().then(() => { // ready to open
		const fileItem=STORAGE.FILES.filesStore.fileList[fileID];
		// open fileID
		ENV.fileID=fileID;
		ENV.setFileTitle(fileItem.fileName);
		STORAGE.FILES.initLayerStorage(ENV.fileID); // record new title and create storage

		// Some works on new file
		STORAGE.FILES.getLayerTreeFromDatabase().then(layerTree => { // after getting
			localStorage.setItem("layer-tree",JSON.stringify(layerTree)); // save in local storage (same as manually save)
			// reset tempPaperSize
			FILES.tempPaperSize={
				width: layerTree.paperSize[0],
				height: layerTree.paperSize[1],
				left: 0,
				top: 0
			};
			FILES.fileManager.update();
			ENV.setPaperSize(...layerTree.paperSize); // set paper size and clear all contents
			STORAGE.FILES.loadLayerTree(layerTree).catch(err=>{ // load contents
				// error
			});
		});
	});
}

// ================ Operation On UI =================
/**
 * renameDate is optional: when did this file get this name
 */
FILES.fileSelector.changeFileNameByFileID=function(fileID,newName,renameDate) {
	const fileItem=STORAGE.FILES.filesStore.fileList[fileID];
	const $ui=FILES.fileSelector.$uiList[fileID];
	fileItem.fileName=newName;
	fileItem.lastRenameDate=renameDate||Date.now();
	$ui.children(".file-ui-name-label").text(newName);
}

/**
 * Set the progress indicator of el (if el is a $ui)
 * or the indicator of fileID el (if el is a string)
 * progress 0~1. if undefined, hide the indicator
 */
FILES.fileSelector.setProgressIndicator=function(el,progress){
	//console.log("To set indic",el);
	if(typeof(el)=="string"){ // get the $ui
		el=FILES.fileSelector.$uiList[el];
	}
	const $indcDiv=el.children(".file-ui-indc");
	if(typeof(progress)!="number"){ // hide
		$indcDiv.css("display","none");
		return;
	}

	$indcDiv.css("display","flex");
	const $indc=$indcDiv.find(".file-indicator-arc");
	if(progress==0){
		$indc.attr("d",""); // hide
	}
	else{
		const angle=progress*359.9;
		$indc.attr("d",describeSVGArc(50,50,40,0,angle));
	}
}
