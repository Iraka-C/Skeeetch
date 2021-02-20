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

/**
 * returns a promise resolved with network conditions
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
				coordinate: [data.latitude,data.longitude]
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