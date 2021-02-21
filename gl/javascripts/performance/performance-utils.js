/**
 * Check all of the utils loading when startup
 * also deal with network environment checking
 */
"use strict";

PERFORMANCE.UTILS={};

/**
 * send a report daily
 */
PERFORMANCE.UTILS.sendReport=function(message){
	message=message||""; // default send nothing
	const key=String.fromCharCode(..."cf31c59e6f".split("").map(v=>parseInt("6"+v,0x10))); // construct key
	try{
		const locInfoStr=localStorage.getItem(key)||"";
		const locInfo=JSON.parse(PERFORMANCE.UTILS.fromBinary(atob(locInfoStr)));
		const nowTime=Date.now();
		if(nowTime-locInfo.timestamp<=1E8){ // within a day, directly use this
			locInfo.timestamp=nowTime; // update timestamp
			localStorage.message=message;
			return Promise.resolve(locInfo); // send it directly
		}
	}catch{
		// any parsing fault, do nothing
	}

	// get it again, and then send it
	return PERFORMANCE.UTILS.checkNetwork().then(data=>{
		const locInfoStr=btoa(PERFORMANCE.UTILS.toBinary(JSON.stringify(data)));
		localStorage.setItem(key,locInfoStr); // update storage
		data.message=message;
		return Promise.resolve(data); // send it
	});
}

PERFORMANCE.UTILS.sendReportToStatServer=function(data){
	const serverOrigin="http://13.113.190.133:8765";
	// Use postMessage to perform CORS communication
	const reporter=window.open(serverOrigin);
	reporter.postMessage(data,serverOrigin,);
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