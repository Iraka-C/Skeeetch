/**
 * Language Setting
 */
LANG={};
// @TODO: donot use cookies. Use advanced client storage instead
switch(Cookies.get("lang")){
case "zh":LANG=LANG_ZH;break;
case "en":LANG=LANG_EN;break;
default:LANG=LANG_ZH;
};
//LANG=LANG_ZH; // language setting, read from cookie
Lang=text=>LANG[text]||text; // if not found, use the original text
LANG.init=()=>{
	for(const id of Object.keys(LANG._id)){ // set DOM contents
		if(!id)continue; // invalid key
		const item=document.getElementById(id);
		if(!item)continue; // not found
		
		switch(item.nodeName){
			case "DIV":item.innerHTML=LANG._id[id];break;
			case "INPUT":item.value=LANG._id[id];break;
		}
	}
}
//Cookies.set("lang","zh");