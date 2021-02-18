/**
 * Pre-request: CloudServiceWrapper
 */

class CloudStorage{
	/**
	 * @param {CloudServiceWrapper} service a cloud service provider wrapped by CloudServiceWrapper
	 */
	constructor(service){
		this.username=null;
		this.service=service;
		this.isLoggedIn=false;
	}

	/**
	 * login and get username / avatar
	 */
	init(loginInfo){
		loginInfo=loginInfo||{};
		let loginPromise;
		if(loginInfo.accessToken){
			loginPromise=this._loginWithAccessToken(loginInfo);
		}
		else if(loginInfo.refreshToken){
			loginPromise=this._loginWithRefreshToken(loginInfo);
		}
		else{
			loginPromise=this._loginNew();
		}
		return loginPromise.then(data=>{
			this.username=data.name;
			data.avatarPromise=this.service.getUserAvatar().then(data=>{ // avatar data
				if(data instanceof ArrayBuffer){ // binary data
					const blob=new Blob([data],{type:"application/octet-binary"});
					const blobUrl=URL.createObjectURL(blob);
					return blobUrl;
				}
				else{ // url
					return data;
				}
			});
			// NOTE: data.avatarPromise won't be catched by the following catch block
			// this is reasonable because avatar is not that important
			return data;
		});
	}

	/**
	 * oauth login
	 */
	_loginNew(){
		console.log("Try to login with oauth");
		return this.service.oauthLogin()
		.then(data=>{
			this.isLoggedIn=true;
			return this.service.getUserInformation();
		}).catch(err=>{ // when error occurs, cancel login status
			console.warn(err);
			this.isLoggedIn=false; // cancel login status
			throw err; // continue exception
		});
	}

	_loginWithAccessToken(loginInfo){
		console.log("Try to login with access token");

		this.service.accessToken=loginInfo.accessToken;
		this.service.refreshToken=loginInfo.refreshToken;
		this.isLoggedIn=true;
		return this.service.getUserInformation().catch(err=>{
			this.isLoggedIn=false; // cancel login status
			if(err instanceof OAuthAuthenticationError){ // access token expired
				return this._loginWithRefreshToken(loginInfo); // try refresh
			}
			else{ // other error
				throw err;
			}
		});
	}
	_loginWithRefreshToken(loginInfo){
		console.log("Refresh access token");
		
		this.service.refreshToken=loginInfo.refreshToken;
		return this.service.refreshLogin()
		.then(()=>{
			this.isLoggedIn=true;
			return this.service.getUserInformation();
		})
		.catch(err=>{
			console.warn(err);
			if(err.status==400&&err.responseJSON.error=="invalid_grant"){ // refresh token expired
				console.log("Refresh failed!");
				return this._loginNew(); // try oauth
			}
			throw err; // other error
		})
		.catch(err=>{
			this.isLoggedIn=false; // cancel login status
			console.warn(err); // do not do anything now
			throw err;
		});
	}

	logOut(){
		return this.service.oauthLogout().finally(()=>{
			this.isLoggedIn=false; // cancel login status
		});
	}

	getLoginInfo(){ // sync!
		return {
			name: this.username,
			accessToken: this.service.accessToken,
			refreshToken: this.service.refreshToken
		};
	}

	/**
	 * Only catch error when file operation
	 * @param {*} err the error generated by a service function call
	 */
	_catchAuthenticationError(err){
		if(err instanceof OAuthAuthenticationError){ // unauthorized
			this.isLoggedIn=false;
			return this.service.refreshLogin()
			.catch(err=>{ // refresh token expired
				console.warn(err);
				if(err.status==400&&err.responseJSON.error=="invalid_grant"){
					console.log("Refresh failed!");
					return this._loginNew(); // try oauth. @TODO: what if username/icon changed?
				}
				throw err; // other error
			})
			.then(loginInfo=>{ // try to refresh login
				this.isLoggedIn=true;
				console.warn("Refresh Login Info",loginInfo);
				throw err; // throw error after refresh for retry.
			});
			// Other types of error: do not retry. Not a problem solvable by refreshLogin()
		}
		
		throw err; // other error, deal with it later
	}

	/**
	 * Note: this class will not save quota
	 * because the quota should be refreshed everytime before upload
	 */
	getStorageQuota(){
		return this.service.getStorageQuota().catch(err=>{
			// strange, but it seems directly calling this._catchAuthenticationError
			// will change this to undefined
			return this._catchAuthenticationError.call(this,err);
		});
	}

	getFileListFromDir(dirArray){
		return this.service.getFileListFromDir(dirArray).catch(err=>{
			return this._catchAuthenticationError.call(this,err);
		});
	}

	/**
	 * return a Promise resolves when upload completes. else, rejects.
	 * This function does not care whether the directory exists. This is handled by service
	 * @param {String} dirArray name
	 * @param {ArrayBuffer} buffer contents
	 * @param {(progress,speed)=>{}} callback a callback function monitoring the upload process
	 * progress (Number) is the process value from 0 (just start) to 1 (finished)
	 * speed (Number) is the current upload speed in byte/s
	 */
	uploadFile(dirArray,buffer,callback){
		if(typeof(callback)!="function"){
			callback=function(){}; // empty function instead
		}
		const service=this.service;
		const dataLength=buffer.byteLength; // in bytes
		const startT=Date.now();
		callback(0,0); // init status

		return service.getStorageQuota().then(quota=>{ // refresh quota before upload
			if(dataLength>quota.remain){ // exceeded @TODO: save at least 1MB for tmp files?
				return Promise.reject("Quota exceeded.");
			}
			let uploadPromise;
			if(dataLength<=this.service.smallFileThreshold){
				uploadPromise=service.uploadSmallFile(dirArray,buffer).then(data=>{
					const endT=Date.now();
					callback(1,dataLength*1000/(endT-startT)); // process is 1 now
					return data;
				});
			}
			else{ // speed calculated inside
				uploadPromise=service.uploadLargeFile(dirArray,buffer,callback);
			}
			return uploadPromise.catch(err=>{
				return this._catchAuthenticationError.call(this,err);
			});
		})
		
	}

	downloadFile(item,callback){
		if(typeof(callback)!="function"){
			callback=function(){}; // empty function instead
		}
		return this.service.downloadFile(item,callback).catch(err=>{
			return this._catchAuthenticationError.call(this,err);
		});
	}
}
