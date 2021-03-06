"use strict";
FILES.tempPaperSize={
	width: 0,
	height: 0,
	left: 0, // for cropping
	top: 0
};
FILES.exportOptions={ // do not save this: init every time
	jpegQuality: 100
}

FILES.initFileMenu=function() {
	const fileManager=new SettingManager($("#file-menu-panel"),Lang("Files"));
	FILES.fileManager=fileManager;

	// ================ Import Action ================
	fileManager.addSectionTitle(Lang("Add Content"));
	
	const STANDARD_SIZE_MM={
		"A0":[841,1189],  "A1":[594,841],  "A2":[420,594],
		"A3":[297,420],   "A4":[210,297],  "A5":[148,210],
		"A6":[105,148],
		"B0":[1000,1414], "B1":[707,1000], "B2":[500,707],
		"B3":[353,500],   "B4":[250,353],  "B5":[176,250],
		"B6":[125,176],
		"C0":[917,1297],  "C1":[648,917],  "C2":[458,648],
		"C3":[324,458],   "C4":[229,324],  "C5":[162,229],
		"C6":[114,162],
		"1K":[787,1092],  "2K":[540,740],  "4K":[370,540],
		"8K":[260,370],  "12K":[250,260],
		"16K":[185,260], "24K":[170,180],
		"32K":[130,184], "36K":[115,170], "48K":[85,260],
		"64K":[85,125]
	};
	const STD_PPMM=300/25.4; // pixel per mm

	const widthUpdateFunc=fileManager.addInstantNumberItem(
		Lang("Paper Width"),() => FILES.tempPaperSize.width,Lang("px"),
		newVal => { // set on input
			if(!newVal)return;
			const stdPaper=STANDARD_SIZE_MM[newVal.toUpperCase()];
			if(stdPaper){ // std paper, horizontal
				const tWidth=Math.round(stdPaper[1]*STD_PPMM);
				const tHeight=Math.round(stdPaper[0]*STD_PPMM);
				if(tWidth>ENV.maxPaperSize||tHeight>ENV.maxPaperSize){
					EventDistributer.footbarHint.showInfo(Lang("Specified paper too large"));
					return; // too large
				}
				FILES.tempPaperSize.width=tWidth;
				FILES.tempPaperSize.height=tHeight;
				heightUpdateFunc();
			}
			else { // pixel number
				newVal=(newVal-0).clamp(16,ENV.maxPaperSize);
				FILES.tempPaperSize.width=newVal;
			}
			sizeChangeHint(true);
			cropDraggerUpdater(true);
		},
		(dW,oldVal) => { // set on scroll
			let newVal=(FILES.tempPaperSize.width+dW*20).clamp(16,ENV.maxPaperSize);
			FILES.tempPaperSize.width=newVal;
			sizeChangeHint(true);
			cropDraggerUpdater(true);
		},
		(dx,oldVal) => { // set on drag-x
			let newVal=Math.round((+oldVal)+dx).clamp(16,ENV.maxPaperSize);
			FILES.tempPaperSize.width=newVal;
			sizeChangeHint(true);
			cropDraggerUpdater(true);
		}
	);
	widthUpdateFunc("input").on("focus",e=>{ // add on focus drag start
		cropDraggerUpdater(true);
		sizeChangeHint(true);
	});

	const heightUpdateFunc=fileManager.addInstantNumberItem(
		Lang("Paper Height"),() => FILES.tempPaperSize.height,Lang("px"),
		newVal => { // set on input
			if(!newVal)return;
			const stdPaper=STANDARD_SIZE_MM[newVal.toUpperCase()];
			if(stdPaper){ // std paper, vertical
				const tWidth=Math.round(stdPaper[0]*STD_PPMM);
				const tHeight=Math.round(stdPaper[1]*STD_PPMM);
				if(tWidth>ENV.maxPaperSize||tHeight>ENV.maxPaperSize){
					EventDistributer.footbarHint.showInfo(Lang("Specified paper too large"));
					return; // too large
				}
				FILES.tempPaperSize.width=tWidth;
				FILES.tempPaperSize.height=tHeight;
				widthUpdateFunc();
			}
			else { // pixel number
				newVal=(newVal-0).clamp(16,ENV.maxPaperSize);
				FILES.tempPaperSize.height=newVal;
			}
			sizeChangeHint(true);
			cropDraggerUpdater(true);
		},
		(dW,oldVal) => { // set on scroll
			let newVal=(FILES.tempPaperSize.height+dW*20).clamp(16,ENV.maxPaperSize);
			FILES.tempPaperSize.height=newVal;
			sizeChangeHint(true);
			cropDraggerUpdater(true);
		},
		(dx,oldVal) => { // set on drag-x
			let newVal=Math.round((+oldVal)+dx).clamp(16,ENV.maxPaperSize);
			FILES.tempPaperSize.height=newVal;
			sizeChangeHint(true);
			cropDraggerUpdater(true);
		}
	);
	heightUpdateFunc("input").on("focus",e=>{ // add on focus drag start
		cropDraggerUpdater(true);
		sizeChangeHint(true);
	});

	// The function used to update the dragger interface
	const cropDraggerUpdater=FILES.initCropDragger(widthUpdateFunc,heightUpdateFunc);
	const sizeChangeHint=fileManager.addHint(Lang("workspace-hint-1"));
	FILES.initNewButtons(fileManager,sizeChangeHint);

	// ==================== Export action =====================
	fileManager.addSectionTitle(Lang("Save Content"));
	fileManager.addSwitch(Lang("Auto Save"),[Lang("On"),Lang("Off")],null,val => {
		switch(val) {
			case 1: ENV.setAutoSave(false); break;
			default: ENV.setAutoSave(true); break;
		}
		autoSaveButtonFunc(!ENV.displaySettings.isAutoSave);
	},() => ENV.displaySettings.isAutoSave? 0:1);
	const autoSaveButtonFunc=fileManager.addButton(Lang("Save in browser"),e => {
		FILES.savePaperAction();
	});
	EventDistributer.footbarHint(autoSaveButtonFunc(),() => Lang("Save in browser")+" (Ctrl+S)");
	autoSaveButtonFunc(!ENV.displaySettings.isAutoSave); // init when loading

	FILES.initSaveButtons(fileManager);
	
	FILES.CLOUD.init(fileManager);
	
	const $repoTitle=fileManager.addSectionTitle(Lang("Repository"));
	FILES.CLOUD.initEnableCloudButton($repoTitle); // "start cloud" button

	FILES.fileSelector.init(fileManager);

	// ============== open action ===============
	// Refreshing the file panel and selector
	// then, refresh UI when expanded
	fileManager.setOpenButton($("#file-button"));
	fileManager.onMenuOpen(()=>{
		FILES.tempPaperSize={
			width: ENV.paperSize.width,
			height: ENV.paperSize.height,
			left: 0,
			top: 0
		};
		// update thumb image
		if(ENV.displaySettings.isAutoSave){ // update saved
			STORAGE.FILES.updateCurrentThumb();
		}
		else{ // previously may be not loaded
			const $fileUI=FILES.fileSelector.$uiList[ENV.fileID];
			const cv=$fileUI.find(".file-ui-canvas")[0];
			if(!(cv.width&&cv.height)){
				STORAGE.FILES.updateCurrentThumb();
			}
		}
	});
	fileManager.onMenuClose(()=>{ // open to close, turn off dragging
		cropDraggerUpdater(false);
		sizeChangeHint(false);
	});
}

// ===================Initializations =====================
FILES._createTextButtons=function(text,imgUrl){
	return $("<div class='files-row-button'>").append(
		$("<img>").attr("src",imgUrl),
		$("<div>").html(text)
	);
}
FILES.initNewButtons=function(fileManager,sizeChangeHint){
	sizeChangeHint(false);

	const newPaperFunc=()=>{ // clear all, reinit
		STORAGE.FILES.getUnsavedCheckDialog().then(()=>{
			FILES.newPaperAction();
			sizeChangeHint(false); // reset size change hint (resize)
			fileManager.toggleExpand(); // close the file menu
		});
	};

	const changeSizeFunc=()=>{
		const [w,h,l,t]=[
			FILES.tempPaperSize.width,
			FILES.tempPaperSize.height,
			FILES.tempPaperSize.left,
			FILES.tempPaperSize.top
		];
		if(w!=ENV.paperSize.width||h!=ENV.paperSize.height||l||t) { // size changed
			// preserve contents
			const histItem={ // Remember History
				type: "bundle",
				children: []
			}
			if(l||t){ // cropped, needs panning
				for(const item of LAYERS.layerTree.children){ // all root nodes
					CANVAS.panLayer(item,-l,-t,false);
					histItem.children.push({
						type: "node-pan",
						id: item.id,
						dx: -l,
						dy: -t
					});
				}
			}
			histItem.children.push({
				type: "paper-size",
				prevSize: [ENV.paperSize.width,ENV.paperSize.height],
				nowSize: [w,h]
			});
			HISTORY.addHistory(histItem); // submit history
			ENV.setPaperSize(w,h,true);
			fileManager.toggleExpand();
		}
		else{
			EventDistributer.footbarHint.showInfo(Lang("resize-wh-hint"));
		}
		sizeChangeHint(false);
	};

	const $fileInput=$("<input type='file' style='display:none;position:fixed;top:-1000px'/>");
	$fileInput.on("change",e => { // file selected
		FILES.onFilesLoaded($fileInput[0].files,true);
	});
	const openFileFunc=()=>{
		$fileInput[0].click();
		fileManager.toggleExpand();
	};

	
	fileManager.addButtonRow([{
		$element: FILES._createTextButtons(
			Lang("New Paper"),
			"./resources/menu-button/new-paper.svg"
		),
		callback: newPaperFunc
	},{
		$element: FILES._createTextButtons(
			Lang("Change Paper Size"),
			"./resources/menu-button/resize-paper.svg"
		),
		callback: changeSizeFunc
	},{
		$element: FILES._createTextButtons(
			Lang("Open File"),
			"./resources/menu-button/open-file.svg"
		),
		callback: openFileFunc
	}]);
}

FILES.initSaveButtons=function(fileManager){
	const copyFunc=()=>{
		let newName=ENV.getFileTitle(); // current name
		if(newName.length>240){ // too long, cut it
			newName=newName.slice(0,240)+"..."+Lang("node-copy-suffix");
		}
		else{
			newName+=Lang("node-copy-suffix");
		}
		function toSaveAsNew(){ // save as new file operation
			ENV.setFileTitle(newName);
			STORAGE.FILES.saveCurrentOpenedFileAs();
		}
		EventDistributer.footbarHint.showInfo(Lang("Saving")+" ...",3000);
		if(ENV.displaySettings.isAutoSave){ // shall save present before switching to a new file
			const layerTreeStr=STORAGE.FILES.saveLayerTree();
			STORAGE.FILES.updateCurrentThumb(); // maybe a draw after open file menu
			Promise.all([
				STORAGE.FILES.saveLayerTreeInDatabase(layerTreeStr),
				STORAGE.FILES.saveAllContents()
			]).then(()=>{
				toSaveAsNew();
			});
		}
		else{ // directly save as new, discard changes to the old one TODO: auto save logic
			STORAGE.FILES.updateThumbFromDatabase(ENV.fileID); // reload saved thumb
			toSaveAsNew();
		}	
	};

	const psdFunc=()=>{
		EventDistributer.footbarHint.showInfo(Lang("Rendering")+" ...");
		fileManager.toggleExpand();
		ENV.taskCounter.startTask(1); // start PSD task
		setTimeout(e=>{
			FILES.saveAsPSD().then(isSuccess=>{
				ENV.taskCounter.finishTask(1); // finish PSD task
			})
		},1000);
	};

	const pngFunc=()=>{
		EventDistributer.footbarHint.showInfo(Lang("Saving")+" ...");
		fileManager.toggleExpand();
		ENV.taskCounter.startTask(1); // save PNG task
		setTimeout(FILES.saveAsPNG,500);
	};

	fileManager.addButtonRow([{
		$element: FILES._createTextButtons(
			Lang("Save as new file"),
			"./resources/menu-button/copy-paper.svg"
		),
		callback: copyFunc
	},{
		$element: FILES._createTextButtons(
			Lang("Save as PSD"),
			"./resources/menu-button/save-psd.svg"
		),
		callback: psdFunc
	},{
		$element: FILES._createTextButtons(
			Lang("Save as PNG"),
			"./resources/menu-button/save-png.svg"
		),
		callback: pngFunc
	}]);
}

// ==================== Actions in setting ======================
FILES.newPaperAction=function(newFileName){
	// Do not save existing changes to the files
	// init a new storage space
	ENV.fileID=STORAGE.FILES.generateFileID();
	ENV.setFileTitle(newFileName||"Skeeetch");
	STORAGE.FILES.initLayerStorage(ENV.fileID); // record new title and create storage
	// Some works on new file
	let w=FILES.tempPaperSize.width;
	let h=FILES.tempPaperSize.height;
	if(!(w&&h)){ // no temp size at present
		w=ENV.paperSize.width;
		h=ENV.paperSize.height;
	}
	ENV.setPaperSize(w,h);
	LAYERS.initFirstLayer(); // also store the initial layer contents
	FILES.fileSelector.addNewFileUIToSelector(ENV.fileID); // add the icon in selector

	const $titleInput=$("#filename-input");
	const ti=$titleInput[0];
	$titleInput.focus(); // prompt the user to input the title
	ti.selectionStart=ti.selectionEnd="Skeeetch".length;
}

FILES.savePaperAction=function(){ // saving in repository
	EventDistributer.footbarHint.showInfo(Lang("Saving all contents")+" ...");
	const layerTreeStr=STORAGE.FILES.saveLayerTree();
	STORAGE.FILES.saveLayerTreeInDatabase(layerTreeStr); // update structure in database
	STORAGE.FILES.saveAllContents(); // update contents in database
	STORAGE.FILES.updateCurrentThumb(); // update thumb in database
}

// =================== Import operations =====================

FILES.initImportDropHandler=function() {
	$("body").on("dragenter dragleave dragover drop",e => {
		e.preventDefault();
		if(e.type=="drop") {
			FILES.onFilesLoaded(e.originalEvent.dataTransfer.files);
		}
	});

	const $fileMenu=$("#file-menu-panel");
	const $fileMenuMask=$("<div id='file-menu-panel-mask'>").append();
	const $fileMenuHint=$("<div id='file-menu-panel-hint'>+</div>");
	$fileMenuMask.append($fileMenuHint);
	$fileMenu.append($fileMenuMask);

	$("#file-button").on("dragenter",e=>{ // expand when drag on to file button
		if(!FILES.fileManager.isExpanded()){
			FILES.fileManager.toggleExpand();
		}
	});

	let enterCnt=0;
	$fileMenu.on("dragenter dragover dragleave drop",e => {
		e.preventDefault();
		e.stopPropagation(); // don't pass to body
		if(e.type=="drop") {
			enterCnt=0;
			$fileMenuMask.css("opacity","0");
			FILES.onFilesLoaded(e.originalEvent.dataTransfer.files,true);
		}
		else if(e.type=="dragenter"){
			if(!enterCnt){
				$fileMenuMask.css("opacity","1");
			}
			enterCnt++;
		}
		else if(e.type=="dragleave"){
			enterCnt--;
			if(!enterCnt){
				$fileMenuMask.css("opacity","0");
			}
		}
	});
}

/**
 * isNewFile: if true, load as a new file in repo
 * else, add a layer in the current file
 */
FILES.onFilesLoaded=function(files,isNewFile){
	isNewFile=isNewFile||false;
	const file=files[0]; // @TODO: open multiple files
	//console.log(file);

	if(!file) return; // dragging layer

	// Check file type
	if(file.name.endsWith(".psd")) { // a Photoshop file
		EventDistributer.footbarHint.showInfo(Lang("Reading file contents")+" ...");
		ENV.taskCounter.startTask(1); // register load file task
		let reader=new FileReader();
		reader.readAsArrayBuffer(file);
		reader.onload=function() {
			FILES.loadAsPSD(this.result,file.name.slice(0,-4));
		}
	}

	else if(file.name.endsWith(".skeeetch")){ // a skeeetch db file
		EventDistributer.footbarHint.showInfo(Lang("Reading file contents")+" ...");
		let reader=new FileReader();
		reader.readAsArrayBuffer(file);
		reader.onload=function() {
			FILES.openDBFile(this.result,file.name.slice(0,-9));
		}
	}

	else if(file.type&&file.type.match(/image*/)) { // an image file
		window.URL=window.URL||window.webkitURL;
		const img=new Image();
		img.src=window.URL.createObjectURL(file);
		img.filename=file.name;
		img.onload=function(e) {
			window.URL.revokeObjectURL(img.src); // release after use
			if(img.width>ENV.maxPaperSize||img.height>ENV.maxPaperSize){
				// larger than maximum paper size
				EventDistributer.footbarHint.showInfo(Lang("error-oversize")+ENV.maxPaperSize+Lang("pix"),2000);
				return;
			}
			if(isNewFile){
				FILES.tempPaperSize.width=img.width;
				FILES.tempPaperSize.height=img.height;
				const newName=file.name.slice(0,file.name.lastIndexOf("."));

				STORAGE.FILES.getUnsavedCheckDialog().then(()=>{
					FILES.newPaperAction(newName); // after creating new paper
					const newFileID=ENV.fileID; // record here
					FILES.loadAsImage(this,LAYERS.active);
					// always save when loading
					const layerTreeStr=STORAGE.FILES.saveLayerTree();
					STORAGE.FILES.saveLayerTreeInDatabase(layerTreeStr),
					STORAGE.FILES.saveContentChanges(LAYERS.active,true);
					FILES.fileManager.update(); // update file menu like width/height
					PERFORMANCE.idleTaskManager.addTask(e=>{ // when idle
						STORAGE.FILES.updateCurrentThumb(); // also update and save thumb
						setTimeout(e=>{ // in case it doesn't update (updated before layer composition finish)
							const $fileUI=FILES.fileSelector.$uiList[newFileID];
							const cv=$fileUI.find(".file-ui-canvas")[0];
							if(!(cv.width&&cv.height)){
								STORAGE.FILES.updateCurrentThumb();
							}
						},1000);
					});
				});
			}
			else{
				FILES.loadAsImage(this);
			}
		}
	}
}
