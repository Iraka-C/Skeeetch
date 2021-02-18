/**
 * Pre-request: jQuery library!
 * The timeout to all ajax operation should be 50s. (50000ms)
 * TODO: add halt function to upload/download
 * TODO: add save in directory, delete file
 */

class CloudServiceWrapper{
	constructor(){
		$.ajaxSetup({timeout:50000});
		/**
		 * Must implement:
		 * this.smallFileThreshold (can be 0 or Infinity)
		 * this.accessToken
		 * this.refreshToken
		 */

		// for API call
		this.accessToken=null;
		this.refreshToken=null;
		this.smallFileThreshold=Infinity; // the threshold for small file limit
	}

	/**
	 * Initialize data used by this storage
	 */
	/*init(){
		return Promise.resolve();
	}*/

	/**
	 * use oauth to login to a site
	 * get an access code to API
	 * or (optional) a refresh code for extending access
	 * resolve when successfully logged in
	 * reject when error or user cancel
	 */
	oauthLogin(){
		return Promise.reject();
	}

	oauthLogout(){
		return Promise.reject();
	}

	/**
	 * If there is a refresh code, use it to refresh the access code
	 * resolve when new access acquired
	 */
	refreshLogin(){
		return Promise.reject();
	}

	/**
	 * get the user information for login
	 * resolve with user info block {
	 *    name, // mandatory
	 *    ...
	 * }
	 */
	getUserInformation(){
		return Promise.reject();
	}

	/**
	 * resolves with a binary buffer or url string
	 */
	getUserAvatar(){
		return Promise.reject();
	}

	/**
	 * get the storage quota of the cloud service
	 * resolve with {
	 *    total: number, total storage space in byte,
	 *    remain: number, remaining storage space in byte.
	 * }
	 */
	getStorageQuota(){
		return Promise.reject();
	}

	/**
	 * get the list of files under root/Skeeetch folder.
	 * A file item is {name,url,size} Object.
	 * if there's no such folder, create a new one.
	 * if get list fails or folder creation fails, reject.
	 */
	/*getFileListUnderSkeeetchFolder(){
		return Promise.reject();
	}*/

	/**
	 * get the list of files under a directory
	 * A file item is {name,url,size} Object.
	 * if there's no such folder, create a new one.
	 * if get list fails or folder creation fails, reject.
	 * @param {[String]} dirArray an array of string representing the directory
	 * ["abc","def","ghi"] means root/abc/def/ghi/
	 * [] means root
	 */
	getFileListFromDir(dirArray){
		return Promise.reject();
	}

	/**
	 * Create a root/Skeeetch folder.
	 * resolve when successfully created.
	 */
	/*createSkeeetchFolder(){
		return Promise.reject();
	}*/

	/**
	 * create a directory (when the parent directory exists)
	 * @param {[String]} dirArray an array of string representing the directory
	 * ["abc","def","ghi"] means root/abc/def/ghi/
	 * [] means root
	 */
	createDir(dirArray){
		return Promise.reject();
	}

	/**
	 * Upload a small file under Skeeetch folder.
	 * A small file is a file whose byte length is under this.smallFileThreshold
	 * @param {[String]} dirArray an array of string representing the directory to the file
	 * e.g. ["abc","def.txt"] is root/abc/def.txt
	 * @param {ArrayBuffer} buffer the content of this file, in ArrayBuffer
	 */
	uploadSmallFile(dirArray,buffer){
		return Promise.reject();
	}

	/**
	 * Upload a large file under Skeeetch folder
	 * @param {[String]} dirArray an array of string representing the directory to the file
	 * @param {ArrayBuffer} buffer the content of this file, in ArrayBuffer
	 * @param {(progress,speed)=>{}} callback a callback function monitoring the upload process
	 * progress (Number) is the process value from 0 (just start) to 1 (finished)
	 * speed (Number) is the current upload speed in byte/s
	 */
	uploadLargeFile(dirArray,buffer,callback){
		return Promise.reject();
	}

	/**
	 * Download a file under Skeeetch folder
	 * @param {Object} item {name,size,url} according to each implementation
	 * @param {(progress,speed)=>{}} callback a callback function monitoring the upload process
	 * similar to uploadLargeFile
	 */
	downloadFile(item,callback){
		return Promise.reject();
	}

	/**
	 * Delete a file in the cloud storage
	 * @param {*} dirArray an array of string representing the directory to the file
	 */
	deleteFile(dirArray){
		return Promise.reject();
	}
	// =================== Utilities ======================

	/**
	 * Return an arraybuffer from a string
	 * @param {String} str UTF-8 encoded string
	 */
	static _stringToArrayBuffer(str){ // UTF-8 string
		const buf=new ArrayBuffer(str.length);
		const bufView=new Uint8Array(buf);
		for(let i=0,strLen=str.length;i<strLen;i++){
			bufView[i]=str.charCodeAt(i);
		}
		return buf;
	}

	/**
	 * calculate a challenge code based on verifier string
	 * challenge = UrlEncode(Base64(SHA256(verifier)))
	 * @param {*} verifier string verifier in UTF-8 encoding
	 */
	static _getCodeChallenge(verifier){
		const ab=CloudServiceWrapper._stringToArrayBuffer(verifier);
		return crypto.subtle.digest("SHA-256",ab).then(buf=>{
			const bufView=new Uint8Array(buf);
			const binStr=String.fromCharCode.apply(null,bufView);
			return Promise.resolve(btoa(binStr)
				.replace(/\+/g,"-") // base64 => base64url
				.replace(/\//g,"_")
				.replace(/=/g,"")
			);
		});
	}

	/**
	 * Turn a Url string into parameters (key-value), return an object
	 * the string is like <?|#>key1=value1&key2=value2&...
	 * @param {string} str the url query/hash part (can or doesn't have leading ?/#)
	 */
	static _getUrlParams(str){
		const lead=str.charAt(0);
		if(lead=="#"||lead=="?"){
			str=str.substring(1);
		}
		const params={};
		for(const p of str.split("&")){ // split with &
			const kv=p.split("="); // split with =
			params[kv[0]]=kv[1];
		}
		return params;
	}

	/**
	 * create a url with query part
	 * @param {*} url the loading url
	 * @param {*} params object containing key->value pairs
	 */
	static _createQueryUrlFromParams(url,params){
		let result=url+"?";
		for(const key in params){
			result+=key+"="+params[key]+"&";
		}
		return result;
	}
}

class OAuthAuthenticationError extends Error{}