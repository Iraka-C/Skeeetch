"use strict";
FILES.CLOUD={
	storage: null
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
	$syncButton.click(()=>{
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
			return FILES.CLOUD.sync().catch(err=>{
				console.warn("Error during sync:",err);
			})
		}).finally(()=>{
			$syncButton.removeClass("sync-rotate");
			console.log("Sync complete");
		});
	});
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
}

FILES.CLOUD.setQuotaUI=function(used,total){ // in bytes
	used/=1024*1024; // MB
	total/=1024*1024; // MB

	const bytesToStr=bytes=>{
		return bytes>=900?
			(bytes/1024).toFixed(1)+"G":
			bytes>=100?
				Math.round(bytes)+"M":
				bytes.toFixed(1)+"M";
	};
	const usedStr=bytesToStr(used);
	const totalStr=bytesToStr(total);
	const displayStr=usedStr+"/"+totalStr;
	$("#cloud-info-quota-text").text(displayStr);

	const perc=used/total;
	$("#cloud-info-quota-rect").css("width",perc*100+"%");
}

// ======================= Service related ===========================

FILES.CLOUD.startCloudService=function(){
	const $title=DialogBoxItem.textBox({text: Lang("cloud-service-select-page")});
	const dialog=new DialogBoxItem([$title],[{
		text: Lang("cloud-onedrive"), // OneDrive service
		callback: e=>{
			$("#cloud-info-service").text("OneDrive");
			$("#cloud-icon").css("background-image","url('./resources/cloud/onedrive.svg')");
			FILES.CLOUD.initCloudStorage(new OneDriveService());
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
		$("#cloud-button").children("img").attr("src","./resources/cloud/cloud-plus.svg");
		FILES.CLOUD.storage=null;
	});
}

/**
 * cloudService: a CloudServiceWrapper representing a service
 * options: login infos
 */
FILES.CLOUD.initCloudStorage=function(cloudService,options){
	const storage=new CloudStorage(cloudService);
	FILES.CLOUD.storage=storage;

	const $container=FILES.CLOUD.$container;

	storage.init(/*...*/).then(data=>{ // login data
		$container.css("display","block");
		$("#cloud-info-username").text(data.name); // setup username

		data.avatarPromise.then(url=>{ // get avatar
			$("#cloud-icon").css("background-image","url('"+url+"')");
			// @TODO: revoke url after use?
		}).catch(err=>{
			console.log("No avatar received");
		});

		$("#cloud-button").children("img").attr("src","./resources/cloud/cloud-slash.svg");
		storage.getStorageQuota().then(quota=>{ // after logging in, get quota
			// only provided remain (except used and recycled)
			FILES.CLOUD.setQuotaUI(quota.total-quota.remain,quota.total);
		}).catch(err=>{ // quota error here
			console.log("Quota failed",err);
		});
	})
	.catch(err=>{ // login error here
		console.warn("Login Failed",err);
		// and do nothing when failed
		FILES.CLOUD.storage=null;
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
		console.log("cloudList",cloudList);
		console.log("itemList",list.itemList);
		
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

		for(const [hash,item] of cloudHashMap){
			if(!localHashMap.has(hash)){ // not in local db, to be downloaded
				downloadList.push(hash);
				continue;
			}
			const cloudModDate=item.lastModifiedDate;
			const localModDate=localHashMap.get(hash).lastModifiedDate;
			if(localModDate<cloudModDate){ // cloud file newer: download
				downloadList.push(hash);
			}
		}
		for(const [hash,item] of localHashMap){
			if(!cloudHashMap.has(hash)){ // not in cloud, to be uploaded
				uploadList.push(item.fileID);
				continue;
			}
			const localModDate=item.lastModifiedDate;
			const cloudModDate=cloudHashMap.get(hash).lastModifiedDate;
			if(localModDate>cloudModDate){ // local file newer: upload
				uploadList.push(item.fileID);
			}
		}
		console.log("Maps",cloudHashMap,localHashMap);
		console.log("Lists",downloadList,uploadList);
		
		// first download, then upload
		return FILES.CLOUD.downloadByHashList(
			downloadList,list.itemList,localHashMap,cloudHashMap).then(()=>{
			// downloaded, to upload
			return FILES.CLOUD.uploadByFileIDList(uploadList,localHashMap);
		});
	}).then(()=>{ // after uploading, a separate flow
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

	const uploadItem=(i)=>{
		if(i>=fileIDList.length){ // all uploaded
			return Promise.resolve();
		}
		if(quotaFuse){
			return Promise.reject("Quota exceeded.");
		}
		const fileID=fileIDList[i];
		FILES.fileSelector.setProgressIndicator(fileID,0);

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
					throw err;
				}
			}).finally(()=>{
				FILES.fileSelector.setProgressIndicator(fileID);
			});
			uploadTasks.push(task);
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
		return Promise.all(uploadTasks);
	})
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