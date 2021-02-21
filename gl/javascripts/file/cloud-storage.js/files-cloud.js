"use strict";
FILES.CLOUD={
	storage: null,
	loginInfo: null
};

/**
 * Written by Iraka on 20210210
 * the cloud storage manager for Skeeetch
 */

FILES.CLOUD.init=function(fileManager){
	const $container=fileManager.addDiv();
	$container.attr("id","cloud-container");
	$container.css("display","none");

	FILES.CLOUD.$container=$container;
	FILES.CLOUD.fileManager=fileManager;
	FILES.CLOUD.initUI();

	// test if there is already a login info
	try{
		const loginInfo=JSON.parse(localStorage.getItem("oauth-login-info"))||{};
		FILES.CLOUD.loginInfo=loginInfo;
		let service=null;
		switch(loginInfo.serviceName){ // select service type
		case "OneDriveService": service=new OneDriveService();break;
		}
		if(service){ // there is an available service
			FILES.CLOUD.initCloudStorage(service,loginInfo); // login with loginInfo
		}

	}catch{
		// any parsing fault, do nothing
	}
}

FILES.CLOUD.initUI=function(){
	const $container=FILES.CLOUD.$container;

	const $cloudDiv=$("<div id='cloud-div'>");

	// ==================== icons ===================
	const $iconDiv=$("<div id='cloud-icon-div'>"); // for centering the icon
	const $icon=$("<div id='cloud-icon'>");
	const iconUrl="./resources/cloud/user.png";
	// let $img=$(new Image());
	// $img.on("load",()=>{ // check if iconUrl available
	// 	console.log("BG loaded");
	// 	$img.remove();
	// });
	// $img.on("error",()=>{ // check if iconUrl available
	// 	console.log("BG failed");
	// 	$img.remove();
	// });
	// $img.attr("src",iconUrl); // kick, after this, remove

	$icon.css("background-image","url('"+iconUrl+"')");
	$icon.append($("<div id='cloud-icon-border'>"));
	$iconDiv.append($icon);
	
	// ===================== Info ======================
	const $infoPanel=$("<div id='cloud-info-panel'>");

	const $serviceDiv=$("<div id='cloud-info-service'>");
	$serviceDiv.text("Cloud");

	const $usrnDiv=$("<div id='cloud-info-username'>");
	$usrnDiv.text("----");

	const $quotaDiv=$("<div id='cloud-info-quota'>");
	const $quotaRect=$("<div id='cloud-info-quota-rect'>");
	const $quotaText=$("<div id='cloud-info-quota-text'>");
	$quotaText.text("quota");
	$quotaDiv.append($quotaRect,$quotaText);

	$infoPanel.append($serviceDiv,$usrnDiv,$quotaDiv);

	// ======================= buttons =========================
	const $buttonPanel=$("<div id='cloud-button-panel'>");
	const $syncButton=$("<div id='cloud-button-sync' class='cloud-click'>");
	$syncButton.append($("<img src='./resources/cloud/arrow-repeat.svg'>"));

	let isSyncing=false;
	$syncButton.click(()=>{
		if(isSyncing)return; // check and set flag
		isSyncing=true;

		let saveContentPromise;
		$syncButton.addClass("sync-rotate"); // animation effect
		// check auto-save before sync
		if(ENV.displaySettings.isAutoSave){
			saveContentPromise=STORAGE.FILES.requestSaveContentChanges();
		}
		else{
			saveContentPromise=STORAGE.FILES.getUnsavedCheckDialog();
		}

		saveContentPromise.then(()=>{
			return FILES.CLOUD.sync().then(()=>{
				EventDistributer.footbarHint.showInfo(Lang("cloud-sync-complete"),2000);
			}).catch(err=>{
				EventDistributer.footbarHint.showInfo(Lang("cloud-sync-fail"),2000);
				console.warn("Error during sync:",err);
			})
		}).finally(()=>{
			$syncButton.removeClass("sync-rotate");
			isSyncing=false; // cancel flag
			console.log("Sync complete");
		});
	});
	EventDistributer.footbarHint($syncButton,()=>Lang("cloud-sync"));
	$buttonPanel.append($syncButton);

	$cloudDiv.append($iconDiv,$infoPanel,$buttonPanel);
	$container.append($cloudDiv);
}

FILES.CLOUD.initEnableCloudButton=function($repoTitle){
	const $buttonImg=$("<img src='./resources/cloud/cloud-plus.svg'>");
	const $button=$("<div id='cloud-button' class='cloud-click'>").append($buttonImg);
	$repoTitle.append($button);

	$button.click(()=>{
		if(FILES.CLOUD.storage){ // existing service
			FILES.CLOUD.stopCloudService();
		}
		else{ // no service yet
			FILES.CLOUD.startCloudService();
		}
	});
	EventDistributer.footbarHint($button,()=>Lang(FILES.CLOUD.storage?"cloud-logout":"cloud-login"));
}

FILES.CLOUD.setQuotaUI=function(used,total){ // in bytes
	const bytesToStr=bytes=>{
		let unitCnt=0;
		for(let i=0;i<4;i++){ // count unit, B,K,M,G,T
			if(bytes>=900){
				bytes/=1024;
				unitCnt++;
			}
			else{
				break;
			}
		}
		return (bytes>=100?Math.round(bytes):bytes.toFixed(1))+"BKMGT".charAt(unitCnt);
	};
	const displayStr=bytesToStr(used)+"/"+bytesToStr(total);
	$("#cloud-info-quota-text").text(displayStr);

	const perc=used/total*100;
	const displayPerc=perc<0.1?0:Math.max(perc,2); // low: still display some.
	$("#cloud-info-quota-rect").css("width",displayPerc+"%");
}

// ======================= Service related ===========================

FILES.CLOUD.startCloudService=function(){
	const $title=DialogBoxItem.textBox({text: Lang("cloud-service-select-page")});
	const dialog=new DialogBoxItem([$title],[{
		text: Lang("cloud-onedrive"), // OneDrive service
		callback: e=>{
			FILES.CLOUD.initCloudStorage(new OneDriveService()); // no option
		}
	},{ // nothing
		text: Lang("Cancel")
	}]);
	DIALOGBOX.show(dialog);
}

FILES.CLOUD.stopCloudService=function(){
	FILES.CLOUD.storage.logOut().finally(()=>{ // do clean up anyway
		FILES.CLOUD.$container.css("display","none");
		$("#cloud-info-username").text("----");
		$("#cloud-info-service").text("Cloud");
		$("#cloud-button").removeClass("cloud-button-slash");
		$("#cloud-button").children("img").attr("src","./resources/cloud/cloud-plus.svg");
		FILES.CLOUD.storage=null;
		localStorage.removeItem("oauth-login-info"); // remove login info
		EventDistributer.footbarHint.showInfo(Lang("cloud-logout-complete"));
	});
}

/**
 * cloudService: a CloudServiceWrapper representing a service
 * options: login infos
 */
FILES.CLOUD.initCloudStorage=function(cloudService,options){
	// set display and avatar
	$("#cloud-info-service").text(cloudService.displayName);
	$("#cloud-icon").css("background-image","url('"+cloudService.defaultAvatar+"')");

	// init cloud storage
	const storage=new CloudStorage(cloudService);
	FILES.CLOUD.storage=storage;

	const $container=FILES.CLOUD.$container;
	storage.init(options).then(data=>{ // login data
		$container.css("display","block");
		$("#cloud-info-username").text(data.name); // setup username

		data.avatarPromise.then(url=>{ // get avatar
			$("#cloud-icon").css("background-image","url('"+url+"')");
			// @TODO: revoke url after use?
		}).catch(err=>{
			console.log("No avatar received");
		});

		$("#cloud-button").addClass("cloud-button-slash");
		$("#cloud-button").children("img").attr("src","./resources/cloud/cloud-slash.svg");
		storage.getStorageQuota().then(quota=>{ // after logging in, get quota
			// only provided remain (except used and recycled)
			FILES.CLOUD.setQuotaUI(quota.total-quota.remain,quota.total);
		}).catch(err=>{ // quota error here
			console.log("Quota failed",err);
		});

		// set info
		FILES.CLOUD.loginInfo=storage.getLoginInfo();
		localStorage.setItem("oauth-login-info",JSON.stringify(FILES.CLOUD.loginInfo));
	})
	.catch(err=>{ // login error here
		console.warn("Login Failed",err);
		EventDistributer.footbarHint.showInfo(Lang("cloud-login-failed"),2000);
		// and do nothing when failed
		FILES.CLOUD.storage=null;
		// FILES.CLOUD.loginInfo=null; do not clear, cache for faster future use
		localStorage.removeItem("oauth-login-info");
	});
}

FILES.CLOUD.sync=function(){
	const storage=FILES.CLOUD.storage;
	const emptyList={itemList:{}};
	return storage.getFileListFromDir(["Skeeetch","stores"]).catch(err=>{
		if(err!=404)throw err;
		return emptyList; // not found, return empty
	}).then(data=>{
		console.log("cloud",data);
		if(!data.length)return emptyList;
		// try to get .filelist
		for(const item of data){ // for all files
			if(item.name=".filelist"){
				return storage.downloadFile(item).then(fileListData=>{
					// data is arraybuffer
					try{
						return {
							itemList: data,
							cloudList: JSON.parse(arraybufferToString(fileListData))
						};
					}catch(err){ // parse error: not a legal file
						console.log("parse .filelist failed");
						return { // empty
							itemList: data,
							cloudList: {}
						};
					}
				});
			}
		}
		// no .filelist found
		return emptyList; // empty @TODO: manually count from data? for robustness
	}).then(list=>{ // file list acquired
		const cloudList=list.cloudList;
		const itemList=list.itemList;
		LOGGING&&console.log("cloudList",cloudList);
		LOGGING&&console.log("itemList",itemList);

		// check if every file in cloudList really exist
		// @TODO: and check if every file in itemList is in cloudList (optional)
		const nonExistHashes=[];
		for(const hash in cloudList){
			let foundFlag=false;
			const filename=hash+".skeeetch";
			for(let i=0;i<itemList.length;i++){ // find the file item in cloud storage
				const item=itemList[i];
				if(item.name==filename){ // db file found
					foundFlag=true; // found
					break;
				}
			}
			if(!foundFlag){
				nonExistHashes.push(hash);
			}
		}
		for(const hash of nonExistHashes){ // removed non-existing files
			delete cloudList[hash];
		}
		LOGGING&&console.log("cloudList after cleaning",cloudList);
		
		/**
		 * format of item in cloudList should be hash -> {
		 *    createdDate, fileName, lastModifiedDate, lastOpenedDate, hash (again)
		 * }
		 */
		const localList=STORAGE.FILES.filesStore.fileList;
		
		// start compare file hash difference
		// NOTE: these maps have different format!
		const localHashMap=new Map();
		const cloudHashMap=new Map();
		for(const id in localList){
			const item=localList[id];
			// hash -> {fileID, ...item}
			localHashMap.set(item.hash,Object.assign({fileID:id},item));
		}
		for(const hash in cloudList){
			cloudHashMap.set(hash,cloudList[hash]); // hash -> item
		}

		// create list to download and upload
		const downloadList=[]; // contains hash
		const uploadList=[]; // contains fileID

		for(const [hash,item] of cloudHashMap){ // Search files to be downloaded
			if(!localHashMap.has(hash)){ // not in local db, to be downloaded
				downloadList.push(hash);
				continue;
			}
			const cloudModDate=item.lastModifiedDate; // item is a cloud item
			const localItem=localHashMap.get(hash);
			const localModDate=localItem.lastModifiedDate;
			if(localModDate<cloudModDate){ // cloud file newer: download
				downloadList.push(hash);
			}
			else if(localModDate==cloudModDate){ // file not modified, but filename may be changed
				// change the file names directly here
				if(localItem.lastRenameDate<item.lastRenameDate){ // cloud item has newer name
					// rename local file
					const localID=localItem.fileID
					FILES.fileSelector.changeFileNameByFileID(localID,item.fileName,item.lastRenameDate);
					if(localID==ENV.fileID){ // currently opened, change title block
						ENV.setFileTitle(item.fileName);
					}
				}
			}
		}
		for(const [hash,item] of localHashMap){ // Search files to be uploaded
			if(!cloudHashMap.has(hash)){ // not in cloud, to be uploaded
				// check if the current item is changed.
				// If the current item is a blank paper without modification, do not upload
				// @FIXME: imported file / duplicated file also satisfy the following standard
				// if(item.createdDate==item.lastModifiedDate&&item.createdDate==item.lastRenameDate){
				// 	// not changed at all
				// 	continue;
				// }
				uploadList.push(item.fileID);
				continue;
			}
			const localModDate=item.lastModifiedDate;
			const cloudModDate=cloudHashMap.get(hash).lastModifiedDate;
			if(localModDate>cloudModDate){ // local file newer: upload
				uploadList.push(item.fileID);
			}
		}
		LOGGING&&console.log("Maps",cloudHashMap,localHashMap);
		LOGGING&&console.log("Lists",downloadList,uploadList);
		
		// first download, then upload
		return FILES.CLOUD.downloadByHashList(
			downloadList,itemList,localHashMap,cloudHashMap).then(()=>{
			// downloaded, to upload
			return FILES.CLOUD.uploadByFileIDList(uploadList,localHashMap);
		});
	}).then(()=>{ // after uploading, a separate flow
		// refresh login info
		localStorage.setItem("oauth-login-info",JSON.stringify(storage.getLoginInfo()));

		storage.getStorageQuota().then(quota=>{ // after sync, get quota
			FILES.CLOUD.setQuotaUI(quota.total-quota.remain,quota.total);
		}).catch(err=>{ // quota error here
			console.log("Quota failed",err);
		});
	});
}

/**
 * upload the fileIDs in fileIDList
 */
FILES.CLOUD.uploadByFileIDList=function(fileIDList,localHashMap){
	const storage=FILES.CLOUD.storage;
	const localList=STORAGE.FILES.filesStore.fileList;

	let quotaFuse=false; // if quotaFuse is set true, quota exceeded, halt.
	const uploadTasks=[];

	for(const fileID of fileIDList){ // init all indicator
		FILES.fileSelector.setProgressIndicator(fileID,0);
	}

	const uploadItem=(i)=>{
		if(i>=fileIDList.length){ // all uploaded
			return Promise.resolve();
		}
		if(quotaFuse){
			return Promise.reject("Quota exceeded.");
		}
		const fileID=fileIDList[i];

		return STORAGE.FILES.dumpImgDB(fileID).then(buffer=>{
			const hash=localList[fileID].hash;
			const filename=hash+".skeeetch";
			// this async flow is independent to dump DB flow, needn't return
			const task=storage.uploadFile(["Skeeetch","stores",filename],buffer,progress=>{
				FILES.fileSelector.setProgressIndicator(fileID,progress);
			}).then(data=>{
				console.log("Uploaded");
			}).catch(err=>{
				if(err=="Quota exceeded."){
					quotaFuse=true; // enable fuse, halt the upload flow
				}
				else{
					console.warn(err);
				}
			}).finally(()=>{
				FILES.fileSelector.setProgressIndicator(fileID);
			});
			uploadTasks.push(task);
			// upload thumb BTW
			uploadTasks.push(FILES.CLOUD.uploadThumbByFileID(fileID,hash+".png"));
			// upload flow ends here
		}).catch(err=>{
			console.warn(err);
		}).finally(()=>{ // try to upload the next file
			return uploadItem(i+1);
		});
	};

	return uploadItem(0).then(()=>{ // after upload db, upload .filelist
		const newCloudList={}; // create file contents (hash->item)
		for(const fileID in localList){
			const item=localList[fileID];
			newCloudList[item.hash]=item;
		}
		// add upload task
		const buffer=stringToArrayBuffer(JSON.stringify(newCloudList));
		uploadTasks.push(storage.uploadFile(["Skeeetch","stores",".filelist"],buffer));
	}).then(()=>{ // wait for all tasks to complete
		return Promise.all(uploadTasks).then(()=>{
			for(const fileID of fileIDList){
				// clear all indicator (even if they aren't uploaded)
				FILES.fileSelector.setProgressIndicator(fileID);
			}
		});
	});
}

/**
 * upload the thumb of fileID
 * if there is no thumb, then do not upload
 */
FILES.CLOUD.uploadThumbByFileID=function(fileID,filename){ // not certainly successful
	return STORAGE.FILES.getThumbImageData(fileID).then(imgSrc=>{ // RAMBuf8 type
		const w=imgSrc.width;
		const h=imgSrc.height;
		if(!(w&&h)){ // zero content
			throw new Error("Empty thumb");
		}
		// put imgdata into canvas
		const canvas=document.createElement("canvas");
		canvas.width=w;
		canvas.height=h;
		const ctx2d=canvas.getContext("2d");
		const imgData2D=ctx2d.createImageData(w,h);
		imgData2D.data.set(imgSrc.data); // copy the contents of imgSrc into canvas
		ctx2d.putImageData(imgData2D,0,0);
		// export canvas into arraybuffer from blob (png file)
		return new Promise(resolve=>{
			canvas.toBlob(blob=>{
				blob.arrayBuffer().then(buffer=>{
					resolve(buffer);
				})
			},"image/png");
		})
	}).then(buffer=>{ // png buffer, upload this
		return FILES.CLOUD.storage.uploadFile(["Skeeetch","stores",filename],buffer);
	}).catch(err=>{ // thumb not found
		// directly catch: if failed, no need to redo
		console.warn(err);
	});
}

/**
 * download the hash in hashList
 * using items in itemlist
 * localHashMap is the hash items on disk now
 */
FILES.CLOUD.downloadByHashList=function(hashList,itemList,localHashMap,cloudHashMap){
	const storage=FILES.CLOUD.storage;

	const downloadItem=(i)=>{ // the i-th item in hashList
		if(i>=hashList.length){ // all downloaded
			return Promise.resolve();
		}
		const hash=hashList[i];
		let itemIndex=-1;
		let thumbIndex=-1;
		for(let i=0;i<itemList.length;i++){ // find the file item in cloud storage
			const item=itemList[i];
			if(item.name==hash+".skeeetch"){ // db file found
				itemIndex=i;
			}
			else if(item.name==hash+".png"){ // thumbnail file found
				thumbIndex=i;
			}
			if(itemIndex>=0&&thumbIndex>=0){ // both found
				break;
			}
		}
		if(itemIndex==-1){ // file not found on cloud
			console.log("Hash "+hash+" not found on cloud");
			return downloadItem(i+1); // try to fetch the next one
		}
		
		const isCreateUI=!localHashMap.has(hash);
		let fileID;
		if(isCreateUI){
			// there is no local file, create one UI but do not open
			fileID=STORAGE.FILES.generateFileID();
			STORAGE.FILES.filesStore.fileList[fileID]=cloudHashMap.get(hash);
			STORAGE.FILES.filesStore.undroppedList[fileID]=true;
			FILES.fileSelector.addNewFileUIToSelector(fileID,1); // next to opened file
		}
		else{
			fileID=localHashMap.get(hash).fileID;
			const fileItem=STORAGE.FILES.filesStore.fileList[fileID];
			const cloudFileItem=cloudHashMap.get(hash);
			Object.assign(fileItem,cloudFileItem);
			// update displayed name
			FILES.fileSelector.changeFileNameByFileID(fileID,cloudFileItem.fileName);
			if(fileID==ENV.fileID){ // currently opened, change title bar
				ENV.setFileTitle(cloudFileItem.fileName);
			}
		}

		FILES.fileSelector.setProgressIndicator(fileID,0);

		// thumb download
		if(thumbIndex>=0){ // thumb found
			storage.downloadFile(itemList[thumbIndex]).then(data=>{
				const file=new File([data],"",{type:"image/png"});
				const img=new Image();
				img.src=URL.createObjectURL(file); // @TODO: remove url after load;
				img.filename=file.name;
				return new Promise((res,rej)=>{
					img.onload=e=>{ // convert img into ImageData 2D
						const isToSaveThumb=(fileID!=ENV.fileID); // if not currently opened, save
						STORAGE.FILES.updateThumb(fileID,img,isToSaveThumb); // load into thumb and save it
						URL.revokeObjectURL(img.src);
						res();
					};
					img.onerror=err=>{
						rej(err);
					}
				});
			}).catch(err=>{ // download failed: do nothing
				console.warn(err);
			});
		}

		// db download
		return storage.downloadFile(itemList[itemIndex],progress=>{
			FILES.fileSelector.setProgressIndicator(fileID,progress);
		}).then(data=>{
			FILES.fileSelector.setProgressIndicator(fileID); // finish
			STORAGE.FILES.insertImgDB(data,{ // async flow with download
				fileID: fileID // force update
			}).then(()=>{
				if(fileID==ENV.fileID){ // currently opened file
					FILES.reloadCurrentFileFromStorage(); // reload from db
				}
			});
		}).catch(err=>{ // after err: data not inserted yet
			console.warn(err);
			if(isCreateUI){ // ui is created, delete it
				const $uiList=FILES.fileSelector.$uiList;
				$uiList[fileID].remove(); // remove from selector panel
				delete $uiList[fileID]; // remove from ui manager
			}
			else{
				FILES.fileSelector.setProgressIndicator(fileID);
			}
		}).finally(()=>{ // try to fetch the next one
			return downloadItem(i+1);
		})
	};

	return downloadItem(0); // kick
}

FILES.CLOUD.deleteByHash=function(hash){
	const storage=FILES.CLOUD.storage;
	const filename=hash+".skeeetch";
	const thumbname=hash+".png";
	storage.deleteFile(["Skeeetch","stores",thumbname]).catch(err=>{}); // do nothing now

	return storage.deleteFile(["Skeeetch","stores",filename]).then(()=>{
		// after deletion, upload .filelist
		const newCloudList={}; // create file contents (hash->item)
		const localList=STORAGE.FILES.filesStore.fileList;
		for(const fileID in localList){
			const item=localList[fileID];
			newCloudList[item.hash]=item;
		}
		const buffer=stringToArrayBuffer(JSON.stringify(newCloudList));
		return storage.uploadFile(["Skeeetch","stores",".filelist"],buffer);
	}).then(()=>{ // after uploading, a separate flow
		storage.getStorageQuota().then(quota=>{ // after sync, get quota
			FILES.CLOUD.setQuotaUI(quota.total-quota.remain,quota.total);
		}).catch(err=>{ // quota error here
			console.log("Quota failed",err);
		});
	});
}