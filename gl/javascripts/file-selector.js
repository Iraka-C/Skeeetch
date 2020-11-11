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
	let $cv=$("<canvas class='file-ui-canvas' width='0' height='0'>");
	$cvContainer.append($cv);

	let $mask=$("<div class='file-ui-mask'>");

	// name display
	let $nameLabel=$("<div class='file-ui-name-label'>");
	let $buttons=$("<div class='file-ui-buttons'>");
	let infoBlock=$("<div class='file-ui-info'>");
	let deleteButton=$("<div class='file-ui-delete-button'>").append(
		$("<img src='./resources/file-delete.svg'/>") // delete button svg
	);
	$buttons.append($("<table>").append( // file ui button table 2x1
		$("<tr>").append(
			$("<td>").append(infoBlock),
			$("<td>").append(deleteButton)
		)
	));

	// all add to $ui
	$ui.append($cvContainer,$mask,$nameLabel,$buttons);
	$ui.on("pointerdown",event => {
		if(event.originalEvent.pointerType=="pen") { // "drag" doesn't support pointer type
			event.stopPropagation(); // cancel the following "drag" event on pen
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
FILES.fileSelector.addNewFileUIToSelector=function(fileID) {
	const fileItem=STORAGE.FILES.filesStore.fileList[fileID];
	const $ui=FILES.fileSelector.$newUI();
	FILES.fileSelector.$uiList[fileID]=$ui; // record corresponding $ui element
	$ui.children(".file-ui-name-label").text(fileItem.fileName);
	// const lastOpen=new Date();
	// lastOpen.setTime(fileItem.lastOpenedDate);
	// $ui.find(".file-ui-info").text(lastOpen.toLocaleDateString());
	FILES.fileSelector.$container.prepend($ui);

	EventDistributer.footbarHint($ui,() => fileID);
	$ui.on("click",event => { // open this file
		if(fileID==ENV.fileID) return; // same file, no need to open
		console.log("Try to open "+fileID);
		//FILES.fileSelector.fileManager.toggleExpand(); // Don't need to close?
		FILES.fileSelector.openFileWithID(fileID);

		// when open, put $ui to the front
		$ui.detach();
		FILES.fileSelector.$container.prepend($ui);
	});
	$ui.find(".file-ui-delete-button").on("click",event=>{ // try to delete this
		event.stopPropagation(); // do not click on $ui
		if(fileID!=ENV.fileID){ // current not opening
			const fileName=STORAGE.FILES.filesStore.fileList[fileID].fileName;
			EventDistributer.footbarHint.showInfo("Removing "+fileName+" from database ...",5000);
			delete FILES.fileSelector.$uiList[fileID]; // remove from selector hash
			$ui.remove(); // remove from selector panel
			// remove from storage
			STORAGE.FILES.removeFileID(fileID).then(()=>{
				EventDistributer.footbarHint.showInfo(fileName+" removed from database.");
			});
		}
	});
}

FILES.fileSelector.openFileWithID=function(fileID) {
	// Save current first
	const layerTreeStr=STORAGE.FILES.saveLayerTree();
	STORAGE.FILES.saveLayerTreeInDatabase(layerTreeStr);
	STORAGE.FILES.saveAllContents().then(() => {
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

// ================ On UI Operation =================
FILES.fileSelector.changeFileNameByFileID=function(fileID,newName) {
	const fileItem=STORAGE.FILES.filesStore.fileList[fileID];
	const $ui=FILES.fileSelector.$uiList[fileID];
	fileItem.fileName=newName;
	$ui.children(".file-ui-name-label").text(newName);
}
