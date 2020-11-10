FILES.fileSelector={};

FILES.fileSelector.init=function(fileManager){
	const $fileListDiv=fileManager.addDiv();
	FILES.fileSelector.initSelectorUI($fileListDiv);
}

// ============== items in file selector ==============
FILES.fileSelector.$newUI=function(){
	let $ui=$("<div class='file-ui'>");

	// thumb container
	let $cvContainer=$("<div class='file-ui-canvas-container'>");
	let $cv=$("<canvas class='file-ui-canvas' width='0' height='0'>");
	$cvContainer.append($cv);

	let $mask=$("<div class='file-ui-mask'>");

	// name display
	let $nameLabel=$("<div class='file-ui-name-label'>");
	let $buttons=$("<div class='file-ui-buttons'>");
	let openButton=$("<div class='file-ui-open-button'>").append($("<img>"));
	let deleteButton=$("<div class='file-ui-delete-button'>").append($("<img>"));
	$buttons.append($("<table>").append( // file ui button table 2x1
		$("<tr>").append(
			$("<td>").append(openButton),
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

FILES.fileSelector.initSelectorUI=function($container){
	for(const k in STORAGE.FILES.filesStore.fileList) { // for all files
		const fileItem=STORAGE.FILES.filesStore.fileList[k];
		const $ui=FILES.fileSelector.$newUI();
		$ui.children(".file-ui-name-label").text(fileItem.fileName);
		$container.append($ui);
	}
}

