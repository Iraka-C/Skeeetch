class OneDriveService extends CloudServiceWrapper{
	constructor(){
		/**
		 * Must implement:
		 * this.smallFileThreshold (can be 0 or Infinity)
		 * this.accessToken
		 * this.refreshToken
		 */
		super();
		this.smallFileThreshold=1024*1024*4; // 4MB limit for OneDrive
		this.appID="6b5feae2-0f13-43d0-98fb-165096a7e7c2";

		const path=window.location.href;
		const pLastSlash=path.lastIndexOf("/");
		this.redirectURI=path.substring(0,pLastSlash)+"/oauth-login.html";
		this.privilege="files.readwrite offline_access User.Read";

		/**
		 * for login
		 */
		this.displayName="OneDrive";
		this.defaultAvatar="./resources/cloud/onedrive.svg";
	}

	/**
	 * Microsoft account requires a 2-step oauth process for single page application.
	 * Note: only new window is acceptable. IFrame does not work.
	 */
	oauthLogin(){
		const oauthURL="https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
		const verifier="verifier";
		const windowFeature="menubar=0,location=0,resizable=yes,scrollbars=yes,status=0,titlebar=no,width=350,height=500,left=600,top=100";

		return CloudServiceWrapper._getCodeChallenge(verifier)
		.then(challenge=>{ // open a window for oauth login
			const newWindow=window.open(CloudServiceWrapper._createQueryUrlFromParams(oauthURL,{
				"client_id": this.appID,
				"redirect_uri": this.redirectURI,
				"response_type": "code", // 2-step process
				"response_mode": "fragment", // return code in hash
				"scope": this.privilege, // access to OneDrive account
				"code_challenge_method": "S256", // challenge SHA-256 encrypted
				"code_challenge": challenge
			}),"_blank",windowFeature);

			// try to open a page
			return new Promise((res,rej)=>{
				if(!newWindow){ // open window failed
					rej("Cannot open OAuth window.");
				}
				newWindow.focus();
				
				let checkOpenTimer=0; // timer for checking if popup is living

				window.onOAuthCode=()=>{ // register onload listener
					const hash=newWindow.location.hash;
					console.log("HASH for Code",hash);
					
					// remove resources
					newWindow.close(); // safely close
					clearInterval(checkOpenTimer); // cancel monitor
					window.onOAuthCode=undefined; // cancel listener

					if(hash.indexOf("code=")>=0){ // resolve after code get
						const params=CloudServiceWrapper._getUrlParams(hash);
						res(params.code); // resolve with code
					}
					else{
						rej("Authentication failed");
					}
				};

				// If the oauth login window is closed by user (reject login)
				// This promise will never be resolved
				// This handler is to solve this problem
				checkOpenTimer=setInterval(()=>{
					if(newWindow.closed){ // remove resources
						clearInterval(checkOpenTimer); // cancel monitor
						window.onOAuthCode=undefined; // cancel listener
						rej("Login cancelled");
					}
					// else: just wait
				},1000); // test every 1s
			});
		})
		.then(code=>{ // we have the login code. exchange it for access token
			return new Promise((res,rej)=>{ // promisify ajax
				$.ajax({ // get access token
					url: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
					contentType: "application/x-www-form-urlencoded",
					type: "POST",
					data: {
						"client_id": this.appID,
						"grant_type": "authorization_code",
						"redirect_uri": this.redirectURI,
						"code": code,
						"code_verifier": verifier,
						"scope": this.privilege, // save privilege request
					},
					success: (data,status)=>{
						console.log("OAuth logged in",data);
						this.accessToken=data["access_token"];
						this.refreshToken=data["refresh_token"];
						res(data);
					},
					error: (xhr,text,err)=>{
						rej(err);
					}
				});
			});
		});
	}

	refreshLogin(){
		return new Promise((res,rej)=>{
			$.ajax({ // refresh access token
				url: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
				contentType: "application/x-www-form-urlencoded",
				type: "POST",
				data: {
					"client_id": this.appID,
					"grant_type": "refresh_token",
					"redirect_uri": this.redirectURI,
					"scope": this.privilege, // save privilege request
					"refresh_token": this.refreshToken
				},
				success: (data,status)=>{
					console.log("OAuth refreshed",data);
					this.accessToken=data["access_token"];
					this.refreshToken=data["refresh_token"];
					res(data);
				},
				error: (xhr,text,err)=>{
					rej(xhr);
				}
			});
		});
	}

	oauthLogout(){
		const logoutURL="https://login.microsoftonline.com/common/oauth2/v2.0/logout";
		const windowFeature="menubar=0,location=0,resizable=yes,scrollbars=yes,status=0,titlebar=no,width=350,height=500,left=600,top=100";
		const newWindow=window.open(logoutURL,"_blank",windowFeature);

		// try to open a page
		return new Promise((res,rej)=>{
			if(!newWindow){ // open window failed
				rej("Cannot open OAuth window.");
			}
			newWindow.focus();
			// remove secrets
			this.accessToken=null;
			this.refreshToken=null;
			res();
		});
	}

	_catchAuthenticationError(xhr){
		// 401 error: special type for refresh token
		// other error, deal with it later
		throw xhr.status==401?new OAuthAuthenticationError():xhr;
	}

	getUserInformation(){
		return new Promise((res,rej)=>{
			$.ajax({ // load username
				url: "https://graph.microsoft.com/v1.0/me/",
				beforeSend: xhr=>{
					xhr.setRequestHeader('Authorization',this.accessToken);
				},
				type: "GET",
				success: (data,status)=>{
					// console.log("User",data);
					res({name:data["displayName"]});
				},
				error: (xhr,text,err)=>{
					rej(xhr);
				}
			});
		}).catch(this._catchAuthenticationError);
	}

	getUserAvatar(){
		return new Promise((res,rej)=>{ // use beta version API to get avatar
			const req=new XMLHttpRequest();
			req.open("GET","https://graph.microsoft.com/beta/me/photo/$value");
			req.setRequestHeader('Authorization',this.accessToken);
			req.setRequestHeader("Content-Type","image/jpg");
			req.responseType="arraybuffer"; // require binary buffer
			req.timeout=50000;
			req.onload=()=>res(req.response);
			req.ontimeout=()=>rej("Timeout");
			req.onerror=()=>rej(req);
			req.send();
		});
	}

	// ============================ Storage contents related =================================

	getStorageQuota(){
		return new Promise((res,rej)=>{
			$.ajax({ // load drive information
				url: "https://graph.microsoft.com/v1.0/me/drives",
				beforeSend: xhr=>{
					xhr.setRequestHeader('Authorization',this.accessToken);
				},
				type: "GET",
				success: (data,status)=>{
					const quota=data.value[0].quota;
					res({
						total: quota.total,
						remain: quota.remaining
					});
				},
				error: (xhr,text,err)=>{
					rej(xhr);
				}
			});
		}).catch(this._catchAuthenticationError);
	}

	getFileListFromDir(dirArray){
		const targetURL="https://graph.microsoft.com/v1.0/me/drive/root:/"
			+dirArray.join("/")+":/children";
		return new Promise((res,rej)=>{
			$.ajax({ // load drive
				url: targetURL,
				beforeSend: xhr=>{
					xhr.setRequestHeader('Authorization',this.accessToken);
				},
				type: "GET",
				success: (data,status)=>{
					const fileList=[]; // tidied file contents
					for(const item of data.value){
						fileList.push({
							name: item.name,
							size: item.size, // size in bytes
							url: item["@microsoft.graph.downloadUrl"]
						});
					}
					res(fileList);
				},
				error: (xhr,text,err)=>{
					if(xhr.status==404){
						rej(404);
					}
					else{
						console.warn("Skeeetch folder Error",xhr,err);
						rej(xhr);
					}
				}
			});
		}).catch(this._catchAuthenticationError);
	}

	/**
	 * Note: for OnrDrive, you can create a folder while its parent does not exist.
	 * This will create all nested folders alongside the directory. (without 404)
	 */
	createDir(dirArray){
		const N1=dirArray.length-1;
		const targetURL="https://graph.microsoft.com/v1.0/me/drive/root:/"
			+dirArray.slice(0,N1).join("/")+":/children";
		return new Promise((res,rej)=>{
			$.ajax({ // try to create folder
				url: targetURL,
				beforeSend: xhr=>{
					xhr.setRequestHeader('Authorization',this.accessToken);
				},
				data: JSON.stringify({
					"name": dirArray[N1],
					"folder": {},
					"@microsoft.graph.conflictBehavior": "fail" // by default, do nothing
				}),
				contentType: "application/json",
				type: "POST",
				success: (data,status)=>{
					res();
				},
				error: (xhr,text,err)=>{
					rej(xhr);
				}
			});
		}).catch(this._catchAuthenticationError);
	}

	uploadSmallFile(dirArray,buffer){
		const targetURL="https://graph.microsoft.com/v1.0/me/drive/root:/"
			+dirArray.join("/")+":/content";

		return new Promise((res,rej)=>{
			// $.ajax does not support binary data
			const req=new XMLHttpRequest();
			req.open("PUT",targetURL);
			req.setRequestHeader("Authorization",this.accessToken);
			req.setRequestHeader("Content-Type","application/octet-stream");
			req.timeout=50000;
			req.onload=()=>{
				if(req.status==401){
					rej(req);
				}
				else{
					res(JSON.parse(req.response));
				}
			};
			req.ontimeout=()=>rej("Timeout");
			req.onerror=()=>rej(req);
			req.send(buffer);
		}).catch(this._catchAuthenticationError);
	}

	uploadLargeFile(dirArray,buffer,callback){
		const FRAGMENT_SIZE=320*1024*16; // 16 chunks, 5MB
		const dataLength=buffer.byteLength; // in bytes
		// recursively upload a fragment
		const uploadRange=(info,start,end)=>{
			const startT=Date.now();
			return this._uploadFragment(info.url,buffer,start,end)
			.then(nextInfo=>{
				if(OneDriveService.halt){ // a fuse for debug
					return Promise.reject("halted manually");
				}
				
				// calculate progress and speed
				const nowT=Date.now();
				callback(end/dataLength,(end-start)*1000/(nowT-startT));
				if(!nextInfo.nextExpectedRanges){ // uploaded
					return Promise.resolve(nextInfo); // file info now
				}

				// calculate the range to upload next
				const nextRange=nextInfo.nextExpectedRanges[0].split("-");
				const nextStart=Number.parseInt(nextRange[0]);
				const nextEnd=nextRange[1]?Number.parseInt(nextRange[1])+1:dataLength;
				return uploadRange(info,nextStart,Math.min(nextStart+FRAGMENT_SIZE,nextEnd));
			});
		};

		return this._requestUploadSession(dirArray).then(info=>{
			// calculate the range to upload next
			const nextRange=info.nextExpectedRanges?info.nextExpectedRanges[0].split("-"):["0",""];
			const nextStart=Number.parseInt(nextRange[0]);
			const nextEnd=nextRange[1]?Number.parseInt(nextRange[1]):dataLength;
			return uploadRange(info,nextStart,Math.min(nextStart+FRAGMENT_SIZE,nextEnd));
		});
	}

	/**
	 * request a session to upload a new large file
	 * under Skeeetch directory
	 */
	_requestUploadSession(dirArray){
		const targetURL="https://graph.microsoft.com/v1.0/me/drive/root:/"
			+dirArray.join("/")+":/createUploadSession";
		return new Promise((res,rej)=>{
			$.ajax({ // try to create folder
				url: targetURL,
				beforeSend: xhr=>{
					xhr.setRequestHeader('Authorization',this.accessToken);
				},
				data: JSON.stringify({
					"item": {
						"@odata.type": "microsoft.graph.driveItemUploadableProperties",
						"@microsoft.graph.conflictBehavior": "replace",
						"name": dirArray[dirArray.length-1] // last string
					}
				}),
				contentType: "application/json",
				type: "POST",
				success: (data,status)=>{
					res({
						url: data.uploadUrl,
						expire: Date.parse(data.expirationDateTime)
					});
				},
				error: (xhr,text,err)=>{
					rej(xhr);
				}
			});
		}).catch(this._catchAuthenticationError);
	}

	/**
	 * For Onedrive, max chunk is 60MB, and a range of multiples of 320KB
	 * $.ajax does not support binary data, use http request
	 * @param {String} url the upload url for session
	 * @param {ArrayBuffer} buffer the content buffer
	 * @param {Number} start start byte (included)
	 * @param {Number} end end byte (excluded)
	 */
	_uploadFragment(url,buffer,start,end){
		const range="bytes "+start+"-"+(end-1)+"/"+buffer.byteLength;
		return new Promise((res,rej)=>{
			const req=new XMLHttpRequest();
			req.open("PUT",url);
			req.setRequestHeader("Content-Type","application/octet-stream");
			//req.setRequestHeader("Content-Length",end-start);
			req.setRequestHeader("Content-Range",range);
			req.timeout=50000;
			req.onload=()=>res(JSON.parse(req.response));
			req.ontimeout=()=>rej("Timeout");
			req.onerror=()=>rej(req);
			req.send(buffer.slice(start,end));
			// upload request does not support onprogress
		});
	}

	downloadFile(item,callback){
		const TIMEOUT_DOWNLOAD=60000; // there should be progress in 1 min
		callback(0,0);
		return new Promise((res,rej)=>{
			let lastTime=Date.now();
			let lastLoaded=0;

			const req=new XMLHttpRequest();
			let abortTimer=0;
			function clearAbortTimer(){
				if(abortTimer){
					clearTimeout(abortTimer);
					abortTimer=0;
				}
			}
			function restartAbortTimer(){
				clearAbortTimer();
				abortTimer=setTimeout(()=>{ // cancel download
					req.abort();
				},TIMEOUT_DOWNLOAD);
			}

			req.open("GET",item.url);
			req.responseType="arraybuffer"; // require binary buffer
			req.onload=()=>{ // 100% is also captured by onprogress
				res(req.response);
			};
			req.onprogress=event=>{ // download process can be monitored
				const total=event.total||item.size;
				const nowTime=Date.now();
				const nowLoaded=event.loaded;
				callback(nowLoaded/total,(nowLoaded-lastLoaded)*1000/(nowTime-lastTime));
				lastTime=nowTime;
				lastLoaded=nowLoaded;
				restartAbortTimer(); // restart download monitoring
			}
			req.ontimeout=()=>rej("Timeout");
			req.onabort=()=>rej("Timeout");
			req.onerror=()=>rej(req);
			req.send();
			restartAbortTimer(); // start countdown
		});
	}

	deleteFile(dirArray){
		const targetURL="https://graph.microsoft.com/v1.0/me/drive/root:/"+dirArray.join("/");
		return new Promise((res,rej)=>{
			$.ajax({ // try to create folder
				url: targetURL,
				beforeSend: xhr=>{
					xhr.setRequestHeader('Authorization',this.accessToken);
				},
				contentType: "application/json",
				type: "DELETE",
				success: (data,status)=>{
					res(data);
				},
				error: (xhr,text,err)=>{
					rej(xhr);
				}
			});
		}).catch(this._catchAuthenticationError);
	}
}