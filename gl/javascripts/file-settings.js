FILES.tempPaperSize={
	width: 0,
	height: 0
};
FILES.exportOptions={ // do not save this: init every time
	jpegQuality: 100
}

FILES.initFileMenu=function() {
	let fileManager=new SettingManager($("#file-menu-panel"),Lang("Files"));

	// ================ Import Action ================
	fileManager.addSectionTitle(Lang("Add Content"));
	
	fileManager.addInstantNumberItem(
		Lang("Paper Width"),() => FILES.tempPaperSize.width,Lang("px"),
		newVal => { // set on input
			if(newVal) {
				newVal-=0;
				newVal=newVal.clamp(16,ENV.maxPaperSize);
				FILES.tempPaperSize.width=newVal;
				sizeChangeHint(true);
			}
		},
		(dW,oldVal) => { // set on scroll
			let newVal=(FILES.tempPaperSize.width+dW*20).clamp(16,ENV.maxPaperSize);
			FILES.tempPaperSize.width=newVal;
			sizeChangeHint(true);
		},
		(dx,oldVal) => { // set on drag-x
			let newVal=Math.round((oldVal-0)+dx).clamp(16,ENV.maxPaperSize);
			FILES.tempPaperSize.width=newVal;
			sizeChangeHint(true);
		}
	);
	fileManager.addInstantNumberItem(
		Lang("Paper Height"),() => FILES.tempPaperSize.height,Lang("px"),
		newVal => { // set on input
			if(newVal) {
				newVal-=0;
				newVal=newVal.clamp(16,ENV.maxPaperSize);
				FILES.tempPaperSize.height=newVal;
				sizeChangeHint(true);
			}
		},
		(dW,oldVal) => { // set on scroll
			let newVal=(FILES.tempPaperSize.height+dW*20).clamp(16,ENV.maxPaperSize);
			FILES.tempPaperSize.height=newVal;
			sizeChangeHint(true);
		},
		(dx,oldVal) => { // set on drag-x
			let newVal=Math.round((oldVal-0)+dx).clamp(16,ENV.maxPaperSize);
			FILES.tempPaperSize.height=newVal;
			sizeChangeHint(true);
		}
	);
	EventDistributer.setClick($("#file-button"),event => { // refresh when open
		FILES.tempPaperSize.width=ENV.paperSize.width;
		FILES.tempPaperSize.height=ENV.paperSize.height;
	});
	const sizeChangeHint=fileManager.addHint(Lang("workspace-hint-1"));
	sizeChangeHint(false);

	fileManager.addButton(Lang("New Paper"),() => { // clear all, reinit
		// Save current layerTree and contents in files
		const layerTreeStr=STORAGE.FILES.saveLayerTree();
		STORAGE.FILES.saveLayerTreeInDatabase(layerTreeStr);
		STORAGE.FILES.saveAllContents().then(()=>{
			// init a new storage space
			const oldID=ENV.fileID;
			ENV.fileID=STORAGE.FILES.generateFileID();
			ENV.setFileTitle("Skeeetch");
			STORAGE.FILES.initLayerStorage(ENV.fileID); // record new title and create storage
			// Some works on new file
			ENV.setPaperSize(FILES.tempPaperSize.width,FILES.tempPaperSize.height);
			sizeChangeHint(false);
			LAYERS.initFirstLayer(); // also store the initial layer contents
			fileManager.toggleExpand();

			// Only for debug: remove everything about oldID
			//STORAGE.FILES.removeFileID(oldID);
		});
	});
	fileManager.addButton(Lang("Change Paper Size"),() => {
		if(FILES.tempPaperSize.width!=ENV.paperSize.width
			||FILES.tempPaperSize.height!=ENV.paperSize.height) { // size changed
			// preserve contents
			HISTORY.addHistory({
				type: "paper-size",
				prevSize: [ENV.paperSize.width,ENV.paperSize.height],
				nowSize: [FILES.tempPaperSize.width,FILES.tempPaperSize.height]
			});
			ENV.setPaperSize(FILES.tempPaperSize.width,FILES.tempPaperSize.height,true);
		}
		sizeChangeHint(false);
		fileManager.toggleExpand();
	});

	const $fileInput=$("<input type='file' style='display:none;position:fixed;top:-1000px'/>");
	$fileInput.on("change",e => { // file selected
		FILES.onFilesLoaded($fileInput[0].files);
	});
	fileManager.addButton(Lang("Open File"),() => {
		$fileInput[0].click();
		fileManager.toggleExpand();
	});

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
		EventDistributer.footbarHint.showInfo("Saving all contents ...");
		STORAGE.FILES.saveLayerTree();
		STORAGE.FILES.saveAllContents();
	});
	EventDistributer.footbarHint(autoSaveButtonFunc(),() => Lang("Save in browser")+" (Ctrl+S)");
	autoSaveButtonFunc(!ENV.displaySettings.isAutoSave); // init when loading

	const psdButtonFunc=fileManager.addButton(Lang("Save as PSD"),e => {
		EventDistributer.footbarHint.showInfo("Rendering ...");
		fileManager.toggleExpand();
		ENV.taskCounter.startTask(1); // start PSD task
		setTimeout(FILES.saveAsPSD,1000);
	});
	EventDistributer.footbarHint(psdButtonFunc(),() => Lang("Save as PSD")+" (Ctrl+Shift+S)");

	fileManager.addButton(Lang("Save as PNG"),e => {
		EventDistributer.footbarHint.showInfo("Saving ...");
		fileManager.toggleExpand();
		ENV.taskCounter.startTask(1); // save PNG task
		setTimeout(FILES.saveAsPNG,1000);
	});

	FILES.fileSelector.init(fileManager);

	// ============== open action ===============
	fileManager.setOpenButton($("#file-button"));
}

// =================== Import operations =====================

FILES.initImportDropHandler=function() {
	$("body").on("dragenter dragleave dragover drop",e => {
		e.preventDefault();
		if(e.type=="drop") {
			FILES.onFilesLoaded(e.originalEvent.dataTransfer.files);
		}
	});
}

FILES.onFilesLoaded=function(files){
	const file=files[0]; // @TODO: open multiple files
	//console.log(file);

	if(!file) return; // dragging layer

	// Check file type
	if(file.name.endsWith(".psd")) { // a Photoshop file
		EventDistributer.footbarHint.showInfo("Reading file contents ...");
		ENV.taskCounter.startTask(1); // register load file task
		let reader=new FileReader();
		reader.readAsArrayBuffer(file);
		reader.onload=function() {
			FILES.loadAsPSD(this.result,file.name.slice(0,-4));
		}
	}

	if(file.type&&file.type.match(/image*/)) { // an image file
		window.URL=window.URL||window.webkitURL;
		const img=new Image();
		img.src=window.URL.createObjectURL(file);
		img.filename=file.name;
		img.onload=function(e) {
			FILES.loadAsImage(this);
		}
	}
}
