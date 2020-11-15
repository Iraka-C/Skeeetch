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

	// name display
	let $nameLabel=$("<div class='file-ui-name-label'>");
	let $buttons=$("<div class='file-ui-buttons'>");
	let infoBlock=$("<div class='file-ui-info'>");
	let deleteButtonOuter=$("<div class='file-ui-delete-button-outer'>"); // for reconfirm the deletion
	let deleteButton=$("<div class='file-ui-delete-button'>").append(
		$("<img src='./resources/file-delete.svg'/>") // delete button svg
	);
	deleteButtonOuter.append(deleteButton);
	EventDistributer.footbarHint(deleteButtonOuter,() => Lang("delete-file"));
	$buttons.append($("<table>").append( // file ui button table 2x1
		$("<tr>").append(
			//$("<td>").append(infoBlock),
			$("<td>").append(deleteButtonOuter)
		)
	));
	$buttons.on("click",event=>{
		// only click on button panel, not the ui
		event.stopPropagation(); // do not send click event to $ui (open file)
	});

	// all add to $ui
	$ui.append($cvContainer,$mask,$nameLabel,$buttons);
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
FILES.fileSelector.addNewFileUIToSelector=function(fileID) {
	const fileItem=STORAGE.FILES.filesStore.fileList[fileID];
	const $ui=FILES.fileSelector.$newUI();
	FILES.fileSelector.$uiList[fileID]=$ui; // record corresponding $ui element
	$ui.children(".file-ui-name-label").text(fileItem.fileName);
	// const lastOpen=new Date();
	// lastOpen.setTime(fileItem.lastOpenedDate);
	// $ui.find(".file-ui-info").text(lastOpen.toLocaleDateString());
	FILES.fileSelector.$container.prepend($ui);

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
			const fileName=STORAGE.FILES.filesStore.fileList[fileID].fileName;
			EventDistributer.footbarHint.showInfo("Removing "+fileName+" from database ...",5000);
			delete FILES.fileSelector.$uiList[fileID]; // remove from selector hash
			$ui.remove(); // remove from selector panel
			// remove from storage
			STORAGE.FILES.removeFileID(fileID).then(()=>{
				EventDistributer.footbarHint.showInfo(fileName+" deleted.");
			});

			// The thumb image of this file will be deleted at the next startup.
			// in STORAGE.FILES.loadAllFileThumbs()
		}
	});
	EventDistributer.footbarHint(deleteButton,() =>
		Lang("delete-file-confirm-prefix")
		+fileItem.fileName
		+Lang("delete-file-confirm-suffix")
	);
}

FILES.fileSelector.openFileWithID=function(fileID) {
	// Save current first
	const layerTreeStr=STORAGE.FILES.saveLayerTree();
	Promise.all([
		STORAGE.FILES.saveLayerTreeInDatabase(layerTreeStr),
		STORAGE.FILES.saveAllContents()
	]).then(() => {
		const fileItem=STORAGE.FILES.filesStore.fileList[fileID];
		// open fileID
		ENV.fileID=fileID;
		ENV.setFileTitle(fileItem.fileName);
		STORAGE.FILES.initLayerStorage(ENV.fileID); // record new title and create storage

		// Some works on new file
		STORAGE.FILES.getLayerTreeFromDatabase().then(layerTree => { // after getting
			localStorage.setItem("layer-tree",JSON.stringify(layerTree)); // save in local storage (same as manually save)
			ENV.setPaperSize(...layerTree.paperSize); // set paper size and clear all contents
			STORAGE.FILES.loadLayerTree(layerTree); // load contents
		});
	});
}

// ================ Operation On UI =================
FILES.fileSelector.changeFileNameByFileID=function(fileID,newName) {
	const fileItem=STORAGE.FILES.filesStore.fileList[fileID];
	const $ui=FILES.fileSelector.$uiList[fileID];
	fileItem.fileName=newName;
	$ui.children(".file-ui-name-label").text(newName);
}
